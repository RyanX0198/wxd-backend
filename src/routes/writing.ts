import { Router } from 'express';

const router = Router();

// DeepSeek API配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-cb6715bc91a34415b607191c0c0bbb6b';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

// 文档类型映射
const documentTypeMap: Record<string, string> = {
  official: '政务公文',
  news: '新闻通稿',
  summary: '工作总结',
  speech: '领导讲话',
  notice: '通知公告',
  report: '调研报告'
};

// 写作风格映射
const styleMap: Record<string, string> = {
  formal: '正式庄重，语言规范严谨，符合公文标准',
  concise: '简洁凝练，言简意赅，直奔主题',
  vivid: '生动形象，语言活泼，富有感染力',
  rigorous: '严谨规范，论述严密，数据准确',
  approachable: '平易近人，通俗易懂，接地气'
};

// 语气基调映射
const toneMap: Record<string, string> = {
  authoritative: '权威型，体现决策权威，具有约束力，使用"必须"、"务必"、"严格"等词',
  guiding: '指导型，提供工作指导，明确方向，使用"应当"、"建议"、"参考"等词',
  encouraging: '鼓励型，激励士气，调动积极性，使用"希望"、"期待"、"相信"等词',
  neutral: '中性型，客观陈述，不偏不倚',
  urgent: '紧迫型，强调时效，加快落实，使用"立即"、"抓紧"、"尽快"等词'
};

/**
 * 文稿生成接口
 * POST /api/writing/generate
 * 与前端OPTIMIZATION_SUMMARY.md定义保持一致
 */
router.post('/', async (req, res) => {
  try {
    const { 
      documentType, 
      style = 'formal', 
      tone = 'neutral', 
      topic, 
      keywords = [], 
      wordCount = 800,
      requirements = ''
    } = req.body;
    
    // 验证必填参数
    if (!documentType || !topic) {
      return res.status(400).json({ 
        error: '缺少必要参数',
        message: 'documentType和topic为必填项'
      });
    }
    
    // 验证文档类型
    if (!documentTypeMap[documentType]) {
      return res.status(400).json({ 
        error: '不支持的文档类型',
        message: `支持的类型：${Object.keys(documentTypeMap).join(', ')}`
      });
    }
    
    // 构建系统提示词
    const systemPrompt = `你是一位资深的政府公文写作专家，拥有20年公文写作经验。
你的任务是根据用户要求撰写高质量的${documentTypeMap[documentType]}。
请确保：
1. 符合《党政机关公文处理工作条例》格式规范
2. 语言准确、简洁、庄重
3. 结构完整、逻辑清晰
4. 标题吸引人、内容充实`;

    // 构建用户提示词
    const userPrompt = `请撰写一篇关于"${topic}"的${documentTypeMap[documentType]}。

【写作要求】
1. 写作风格：${styleMap[style] || styleMap.formal}
2. 语气基调：${toneMap[tone] || toneMap.neutral}
3. 字数要求：${wordCount}字左右
4. 关键词：${keywords.join('、') || '无'}
${requirements ? `5. 特殊要求：${requirements}` : ''}

【输出格式】
请按以下JSON格式返回：
{
  "title": "文章标题",
  "content": "文章正文内容（使用\\n\\n分隔段落）",
  "outline": ["大纲要点1", "大纲要点2", "大纲要点3", "大纲要点4"],
  "suggestions": ["优化建议1", "优化建议2", "优化建议3"]
}

注意：
1. 只返回JSON数据，不要返回markdown代码块标记
2. 确保JSON格式正确，可以被解析
3. content字段包含完整的文章正文
4. outline包含4-6个要点
5. suggestions包含3-5条具体的优化建议`;

    console.log('[WritingAPI] 开始生成文稿:', { documentType, topic, wordCount });
    
    // 调用 DeepSeek API
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
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
    const generatedContent = data.choices?.[0]?.message?.content || '';
    
    if (!generatedContent) {
      throw new Error('AI返回内容为空');
    }
    
    // 解析AI返回的JSON
    let result;
    try {
      // 尝试直接解析
      result = JSON.parse(generatedContent);
    } catch (e) {
      // 如果直接解析失败，尝试提取JSON部分
      const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('无法解析AI返回的内容');
      }
    }
    
    // 验证返回格式
    if (!result.title || !result.content) {
      throw new Error('AI返回格式不正确');
    }
    
    // 确保outline和suggestions是数组
    if (!Array.isArray(result.outline)) {
      result.outline = [];
    }
    if (!Array.isArray(result.suggestions)) {
      result.suggestions = [];
    }
    
    console.log('[WritingAPI] 文稿生成成功:', result.title);
    
    res.json({
      success: true,
      data: {
        title: result.title,
        content: result.content,
        outline: result.outline,
        suggestions: result.suggestions
      },
      meta: {
        model: 'deepseek-chat',
        documentType,
        style,
        tone,
        wordCount,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    console.error('[WritingAPI] 生成失败:', error);
    res.status(500).json({ 
      success: false,
      error: '生成失败', 
      message: error.message 
    });
  }
});

export default router;
