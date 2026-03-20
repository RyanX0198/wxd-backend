import { Router } from 'express';

const router = Router();

// DeepSeek API配置
const DEEPSEEK_API_KEY = 'sk-cb6715bc91a34415b607191c0c0bbb6b';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

// Prompt 模板 - 优化版
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

请直接输出完整的工作总结正文：`
};

// POST /api/generate
router.post('/', async (req, res) => {
  try {
    const { type, topic, from, to } = req.body;
    
    if (!type || !topic || !from || !to) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    if (!['讲话稿', '活动通知', '工作总结'].includes(type)) {
      return res.status(400).json({ error: '不支持的文种类型' });
    }
    
    // 构建 prompt
    const prompt = prompts[type as keyof typeof prompts](topic, from, to);
    
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
          { role: 'system', content: '你是一位资深的政府公文写作专家，擅长撰写各类教育政务公文。' },
          { role: 'user', content: prompt }
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
    const content = data.choices?.[0]?.message?.content || '';
    
    if (!content) {
      throw new Error('AI返回内容为空');
    }
    
    res.json({
      success: true,
      data: {
        content,
        type,
        topic,
        model: 'deepseek-chat'
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
