// api/documents/index.js
const db = require('../../lib/db');
const jwt = require('../../lib/jwt');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 验证登录
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }
  
  let userId;
  try {
    const token = authHeader.substring(7);
    const payload = jwt.verify(token);
    userId = payload.userId;
  } catch {
    return res.status(401).json({ error: 'Token无效' });
  }
  
  if (req.method === 'GET') {
    // 获取文档列表
    const docs = db.getDocumentsByUserId(userId);
    res.json({
      success: true,
      data: docs.map(d => ({
        id: d.id,
        title: d.title,
        preview: d.content.substring(0, 200) + '...',
        createdAt: d.createdAt
      }))
    });
  } else if (req.method === 'POST') {
    // 创建文档
    const { title, content } = req.body;
    if (!title) {
      return res.status(400).json({ error: '标题不能为空' });
    }
    const doc = db.createDocument(title, content || '', userId);
    res.json({ success: true, data: doc });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
