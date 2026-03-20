// api/auth/login.js
const db = require('../../lib/db');
const jwt = require('../../lib/jwt');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: '邮箱和密码不能为空' });
  }
  
  // 验证用户
  const user = db.verifyUser(email, password);
  if (!user) {
    return res.status(401).json({ error: '邮箱或密码错误' });
  }
  
  const token = jwt.sign({ userId: user.id, email: user.email });
  
  res.json({
    success: true,
    data: {
      token,
      user: { id: user.id, email: user.email, name: user.name }
    }
  });
};
