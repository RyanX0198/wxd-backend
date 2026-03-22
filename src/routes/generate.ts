import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { 
  getHumanizePrompt, 
  getHumanizeSystemRole,
  validateHumanizeLevel,
  HumanizeLevel 
} from '../lib/humanize.ts';

const router = Router();
const prisma = new PrismaClient();

// DeepSeek API配置
const DEEPSEEK_API_KEY = 'sk-cb6715bc91a34415b607191c0c0bbb6b';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

/**
 * 获取参考语料内容
 * 根据corpusIds查询语料库，返回格式化的参考范文
 */
async function getCorpusReferences(corpusIds: string[]): Promise<string> {
  if (!corpusIds || corpusIds.length === 0) {
    return '';
  }
  
  try {
    const corpora = await prisma.corpus.findMany({
      where: {
        id: { in: corpusIds }
      },
      select: {
        id: true,
        title: true,
        content: true,
        category: true,
        source: true
      }
    });
    
    if (corpora.length === 0) {
      return '';
    }
    
    // 更新使用次数
    await prisma.corpus.updateMany({
      where: { id: { in: corpusIds } },
      data: { useCount: { increment: 1 } }
    });
    
    // 格式化参考范文
    const references = corpora.map((corpus, index) => {
      return `【参考范文 ${index + 1}】
标题：${corpus.title}
文种：${corpus.category}
${corpus.source ? `来源：${corpus.source}` : ''}

正文：
${corpus.content.substring(0, 2000)}${corpus.content.length > 2000 ? '...' : ''}
---`;
    });
    
    return '\n\n【参考范文】\n以下是一些优秀的参考范文，请在写作时学习其语言风格、结构安排和用词特点，但不要直接抄袭内容：\n\n' + references.join('\n\n');
  } catch (error) {
    console.error('获取参考语料失败:', error);
    return '';
  }
}

// Prompt 模板 - 8种文种完整版
const prompts = {
  讲话稿: (topic: string, from: string, to: string) => `你是一位资深的教育政务演讲撰稿专家，拥有20年公文写作经验。请根据以下信息撰写一份高质量的讲话稿：

【讲话主题】${topic}
【讲话人身份】${from}
【听众对象】${to}

写作要求：
1. 语言庄重得体，符合教育政务场合
2. 结构完整：开场白→工作回顾→形势分析→工作部署→动员号召→结束语
3. 使用教育政务专业用语，避免口语化
4. 适当使用排比、对偶增强气势
5. 要有具体数据和实例支撑
6. 字数要求：1500-2000字
7. 语言要有感染力，体现领导水平和胸怀

请直接输出完整的讲话稿正文，不需要标注格式说明：`,

  活动通知: (topic: string, from: string, to: string) => `你是一位资深的政府机关公文写作专家。请撰写一份规范、专业的活动通知：

【活动名称】${topic}
【发文单位】${from}
【通知对象】${to}

写作要求：
1. 符合《党政机关公文处理工作条例》格式规范
2. 包含完整的公文要素：标题、主送机关、正文、落款
3. 正文结构：通知缘由→活动安排（时间、地点、参加人员）→具体要求→其他事项
4. 时间地点明确，要求具体可操作
5. 语言简洁明了，一事一通知
6. 使用规范的公文用语和格式

请直接输出完整的通知正文：`,

  工作总结: (topic: string, from: string, to: string) => `你是一位资深的政府机关公文写作专家。请撰写一份高质量的工作总结：

【总结主题】${topic}
【单位名称】${from}
【上报对象】${to}

写作要求：
1. 符合党政机关公文格式规范
2. 结构完整：标题→正文（工作回顾+成绩经验+存在问题+下步打算）→落款
3. 成绩用数据说话，展示具体成果
4. 问题实事求是，不回避矛盾
5. 经验提炼到位，有理论高度
6. 下步打算具体可行，措施得力
7. 语言庄重、准确、简练，体现政治性和专业性
8. 字数要求：2000-2500字

请直接输出完整的工作总结正文：`,

  请示: (topic: string, from: string, to: string) => `你是一位资深的政府机关公文写作专家。请撰写一份规范的请示：

【请示事项】${topic}
【请示单位】${from}
【主送机关】${to}

写作要求：
1. 符合《党政机关公文处理工作条例》中请示的格式规范
2. 结构：标题→主送机关→正文（请示缘由+请示事项+请示结语）→落款
3. 一文一事，不得多头请示
4. 请示缘由充分，理由具体
5. 请示事项明确，意见具体可行
6. 结语使用规范用语（如"妥否，请批示""以上请示，请予审批"等）
7. 语言谦逊得体，体现对上级的尊重
8. 字数要求：800-1200字

请直接输出完整的请示正文：`,

  报告: (topic: string, from: string, to: string) => `你是一位资深的政府机关公文写作专家。请撰写一份规范的报告：

【报告主题】${topic}
【报告单位】${from}
【主送机关】${to}

写作要求：
1. 符合《党政机关公文处理工作条例》中报告的格式规范
2. 结构：标题→主送机关→正文（报告缘由+报告内容+报告结语）→落款
3. 报告内容实事求是，情况准确
4. 条理清晰，层次分明
5. 不得夹带请示事项
6. 结语使用规范用语（如"特此报告""以上报告，请审阅"等）
7. 语言庄重、准确、简练
8. 字数要求：1500-2500字

请直接输出完整的报告正文：`,

  批复: (topic: string, from: string, to: string) => `你是一位资深的政府机关公文写作专家。请撰写一份规范的批复：

【批复事项】${topic}
【批复机关】${from}
【主送机关】${to}

写作要求：
1. 符合《党政机关公文处理工作条例》中批复的格式规范
2. 结构：标题→主送机关→正文（批复依据+批复意见+执行要求）→落款
3. 批复依据明确（引用下级机关来文）
4. 批复意见明确，态度鲜明
5. 执行要求具体可操作
6. 语言权威、肯定、简练
7. 一文一批，针对性强
8. 字数要求：500-1000字

请直接输出完整的批复正文：`,

  函: (topic: string, from: string, to: string) => `你是一位资深的政府机关公文写作专家。请撰写一份规范的函：

【函件主题】${topic}
【发函单位】${from}
【收函单位】${to}

写作要求：
1. 符合《党政机关公文处理工作条例》中函的格式规范
2. 结构：标题→主送机关→正文（发函缘由+函件内容+结语）→落款
3. 适用于不相隶属机关之间商洽工作、询问和答复问题、请求批准和答复审批事项
4. 语气得体，商洽性函件用语谦逊，答复性函件用语明确
5. 内容简明扼要，一事一函
6. 结语使用规范用语（如"特此函达""请予函复""此复"等）
7. 语言礼貌、准确、简练
8. 字数要求：600-1200字

请直接输出完整的函件正文：`,

  纪要: (topic: string, from: string, to: string) => `你是一位资深的政府机关公文写作专家。请撰写一份规范的会议纪要：

【会议主题】${topic}
【纪要单位】${from}
【发送对象】${to}

写作要求：
1. 符合《党政机关公文处理工作条例》中纪要的格式规范
2. 结构：标题→会议信息（时间、地点、主持人、出席人）→正文（会议内容+议定事项）
3. 客观准确记录会议主要精神和议定事项
4. 条理清晰，分条列项
5. 语言简练，去掉口语化表达
6. 突出会议决定和行动要求
7. 不记录详细过程，只记要点
8. 字数要求：1000-2000字

请直接输出完整的纪要正文：`
};

// POST /api/generate
router.post('/', async (req, res) => {
  try {
    const { type, topic, from, to, wordCount, formality, urgency, humanizeLevel, corpusIds } = req.body;
    
    if (!type || !topic || !from || !to) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    if (!['讲话稿', '活动通知', '工作总结', '请示', '报告', '批复', '函', '纪要'].includes(type)) {
      return res.status(400).json({ error: '不支持的文种类型' });
    }
    
    // 验证并设置去AI味级别
    const validHumanizeLevel = validateHumanizeLevel(humanizeLevel);
    
    // 构建基础prompt
    const basePrompt = prompts[type as keyof typeof prompts](topic, from, to);
    
    // 添加参数调整
    let paramInstructions = '';
    
    // 字数调整
    if (wordCount) {
      paramInstructions += `\n字数要求：严格控制在${wordCount}字左右。`;
    }
    
    // 风格调整（如果没有选择去AI味，则使用传统风格参数）
    if (formality && validHumanizeLevel === 'none') {
      const styleMap: Record<number, string> = {
        1: '通俗易懂，口语化表达，便于群众理解',
        2: '较为通俗，适当使用专业术语',
        3: '标准公文风格，庄重得体',
        4: '较为正式，强调规范性和严肃性',
        5: '严谨正式，高度规范，使用标准公文用语'
      };
      paramInstructions += `\n语言风格：${styleMap[formality] || styleMap[3]}`;
    }
    
    // 紧迫程度
    if (urgency) {
      const urgencyMap: Record<number, string> = {
        1: '常规公文，语气平和',
        2: '较为紧急，语气适当加快',
        3: '紧急公文，强调时效性，要求尽快落实'
      };
      paramInstructions += `\n紧迫程度：${urgencyMap[urgency] || urgencyMap[1]}`;
    }
    
    // 添加去AI味指令（如果有选择）
    if (validHumanizeLevel !== 'none') {
      paramInstructions += getHumanizePrompt(validHumanizeLevel);
    }
    
    // 获取参考范文（如果提供了corpusIds）
    let corpusReferences = '';
    if (corpusIds && Array.isArray(corpusIds) && corpusIds.length > 0) {
      corpusReferences = await getCorpusReferences(corpusIds);
    }
    
    // 完整prompt
    const prompt = basePrompt + paramInstructions + corpusReferences;
    
    // 构建系统角色（根据去AI味级别）
    const systemRole = getHumanizeSystemRole(validHumanizeLevel);
    
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
          { role: 'system', content: systemRole },
          { role: 'user', content: prompt }
        ],
        temperature: validHumanizeLevel === 'none' ? 0.7 : 0.8,
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
    
    res.json({
      success: true,
      data: {
        content: generatedContent,
        type,
        topic,
        model: 'deepseek-chat',
        params: { wordCount, formality, urgency, humanizeLevel: validHumanizeLevel },
        corpusIds: corpusIds || []
      }
    });
  } catch (error: any) {
    console.error('生成失败:', error);
    res.status(500).json({ 
      error: '生成失败', 
      message: error.message 
    });
  }
});

export default router;
