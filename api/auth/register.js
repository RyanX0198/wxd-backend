// api/auth/register.js
const db = require('../../lib/db');
const jwt = require('../../lib/jwt');

module.exports = (req, res) => {
  // 允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { email, password, name } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: '邮箱和密码不能为空' });
  }
  
  // 检查是否已存在
  const existing = db.findUserByEmail(email);
  if (existing) {
    return res.status(400).json({ error: '该邮箱已被注册' });
  }
  
  // 创建用户
  const user = db.createUser(email, password, name || email.split('@')[0]);
  const token = jwt.sign({ userId: user.id, email: user.email });
  
  res.json({
    success: true,
    data: { token, user }
  });
};
