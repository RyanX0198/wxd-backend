import { Router } from 'express';
import { 
  getHumanizePrompt, 
  getHumanizeSystemRole,
  postProcessHumanize,
  validateHumanizeLevel,
  HumanizeLevel 
} from '../lib/humanize.ts';

const router = Router();

// DeepSeek API配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-cb6715bc91a34415b607191c0c0bbb6b';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

/**
 * POST /api/humanize
 * 
 * 对已有文本进行"去AI味"处理
 * 请求体：
 * {
 *   content: string;          // 需要处理的原始文本（必填）
 *   level: 'light' | 'medium' | 'deep';  // 去AI味强度（必填）
 *   enablePostProcess?: boolean; // 是否启用后处理增强（可选，默认true）
 * }
 * 
 * 响应：
 * {
 *   success: true,
 *   data: {
 *     originalContent: string;    // 原始内容
 *     humanizedContent: string;   // 处理后内容
 *     level: HumanizeLevel;       // 使用的强度级别
 *     model: string;              // 使用的模型
 *     usage: { prompt_tokens: number, completion_tokens: number }
 *   }
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { content, level, enablePostProcess = true } = req.body;

    // 参数验证
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ 
        error: '缺少必要参数', 
        message: 'content字段必填且必须为字符串' 
      });
    }

    if (content.trim().length === 0) {
      return res.status(400).json({ 
        error: '参数错误', 
        message: 'content不能为空' 
      });
    }

    if (content.length > 8000) {
      return res.status(400).json({ 
        error: '参数错误', 
        message: 'content长度不能超过8000字符' 
      });
    }

    const validLevel = validateHumanizeLevel(level);
    if (!level || !['light', 'medium', 'deep'].includes(level)) {
      return res.status(400).json({ 
        error: '参数错误', 
        message: 'level必须为 light、medium 或 deep' 
      });
    }

    // 构建去AI味的系统Prompt
    const systemRole = getHumanizeSystemRole(validLevel);
    const humanizeInstruction = getHumanizePrompt(validLevel);

    const prompt = `请对以下文本进行"去AI味"处理，让它读起来更像真人写的，而不是AI生成的。
${humanizeInstruction}

【原始文本】
${content}

请直接输出处理后的文本，不要添加任何解释说明。保持原文的核心意思不变，只改变表达方式。`;

    // 调用 DeepSeek API 进行改写
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemRole },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8, // 稍微提高温度以增加变化性
        max_tokens: 4000,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('DeepSeek API错误:', errorData);
      throw new Error(`API调用失败: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    let humanizedContent = data.choices?.[0]?.message?.content || '';
    const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };

    if (!humanizedContent) {
      throw new Error('AI返回内容为空');
    }

    // 可选：后处理增强
    if (enablePostProcess) {
      humanizedContent = postProcessHumanize(humanizedContent, validLevel);
    }

    res.json({
      success: true,
      data: {
        originalContent: content,
        humanizedContent: humanizedContent.trim(),
        level: validLevel,
        model: 'deepseek-chat',
        usage: {
          prompt_tokens: usage.prompt_tokens,
          completion_tokens: usage.completion_tokens,
          total_tokens: usage.prompt_tokens + usage.completion_tokens
        }
      }
    });

  } catch (error: any) {
    console.error('去AI味处理失败:', error);
    res.status(500).json({ 
      error: '处理失败', 
      message: error.message 
    });
  }
});

/**
 * POST /api/humanize/stream
 * 
 * 流式去AI味处理（SSE）
 * 适用于大文本或需要实时显示的场景
 */
router.post('/stream', async (req, res) => {
  try {
    const { content, level } = req.body;

    if (!content || !level) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const validLevel = validateHumanizeLevel(level);

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const systemRole = getHumanizeSystemRole(validLevel);
    const humanizeInstruction = getHumanizePrompt(validLevel);

    const prompt = `请对以下文本进行"去AI味"处理，让它读起来更像真人写的。
${humanizeInstruction}

【原始文本】
${content}

请直接输出处理后的文本，不要添加任何解释说明。`;

    // 调用 DeepSeek API (流式)
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemRole },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 4000,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error('API调用失败');
    }

    // 发送开始事件
    res.write(`data: ${JSON.stringify({ type: 'start', level: validLevel })}

`);

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    if (!reader) {
      throw new Error('无法读取响应流');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            
            if (delta) {
              fullContent += delta;
              res.write(`data: ${JSON.stringify({ type: 'chunk', content: delta })}

`);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

    // 后处理
    const finalContent = postProcessHumanize(fullContent, validLevel);

    // 发送结束事件
    res.write(`data: ${JSON.stringify({ 
      type: 'end', 
      fullContent: finalContent.trim(),
      level: validLevel 
    })}

`);
    res.end();

  } catch (error: any) {
    console.error('流式去AI味失败:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}

`);
    res.end();
  }
});

/**
 * GET /api/humanize/levels
 * 
 * 获取去AI味强度级别说明
 */
router.get('/levels', (req, res) => {
  res.json({
    success: true,
    data: {
      levels: [
        {
          key: 'light',
          name: '轻度',
          description: '轻微口语化，保持公文基本结构和规范，适合正式场合',
          features: ['适当使用口语化连接词', '长短句搭配', '减少机械编号']
        },
        {
          key: 'medium',
          name: '中度',
          description: '明显口语化，打破规整结构，添加自然停顿，适合一般场合',
          features: ['自然口语化表达', '段落长短不一', '减少套话空话', '使用真实人称']
        },
        {
          key: 'deep',
          name: '深度',
          description: '完全拟人化，像资深公文写作者亲笔，适合非正式场合',
          features: ['完全口语化', '自然停顿和思考痕迹', '打破格式束缚', '情感真实', '烟火气']
        }
      ]
    }
  });
});

export default router;
