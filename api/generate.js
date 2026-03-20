// api/generate.js - DeepSeek AI 生成
const https = require('https');

const DEEPSEEK_API_KEY = 'sk-cb6715bc91a34415b607191c0c0bbb6b';

const prompts = {
  讲话稿: (topic, from, to) => `你是一位资深的教育政务演讲撰稿专家，拥有20年公文写作经验。请根据以下信息撰写一份高质量的讲话稿：

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

请直接输出完整的讲话稿正文：`,

  活动通知: (topic, from, to) => `你是一位资深的政府机关公文写作专家。请撰写一份规范、专业的活动通知：

【活动名称】${topic}
【发文单位】${from}
【通知对象】${to}

写作要求：
1. 符合《党政机关公文处理工作条例》格式规范
2. 包含完整的公文要素：标题、主送机关、正文、落款
3. 正文结构：通知缘由→活动安排→具体要求→其他事项
4. 语言简洁明了，一事一通知

请直接输出完整的通知正文：`,

  工作总结: (topic, from, to) => `你是一位资深的政府机关公文写作专家。请撰写一份高质量的工作总结：

【总结主题】${topic}
【单位名称】${from}
【上报对象】${to}

写作要求：
1. 符合党政机关公文格式规范
2. 结构完整：标题→正文（工作回顾+成绩经验+存在问题+下步打算）→落款
3. 成绩用数据说话，问题实事求是
4. 语言庄重、准确、简练
5. 字数要求：2000-2500字

请直接输出完整的工作总结正文：`
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { type, topic, from, to } = req.body;
  
  if (!type || !topic || !from || !to) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  if (!['讲话稿', '活动通知', '工作总结'].includes(type)) {
    return res.status(400).json({ error: '不支持的文种类型' });
  }
  
  const prompt = prompts[type](topic, from, to);
  
  try {
    // 使用 fetch（Node 18+ 内置）
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一位资深的政府公文写作专家。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    });
    
    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    res.json({
      success: true,
      data: { content, type, topic, model: 'deepseek-chat' }
    });
  } catch (error) {
    console.error('生成失败:', error);
    res.status(500).json({ error: '生成失败', message: error.message });
  }
};
