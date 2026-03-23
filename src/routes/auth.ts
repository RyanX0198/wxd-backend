import { Router } from 'express';
import { mockDB } from '../mockDB.ts';
import { jwt } from '../utils/jwt.ts';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码必填' });
    }
    
    // 检查用户是否存在
    const existingUser = await mockDB.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: '该邮箱已被注册' });
    }
    
    // 创建用户
    const user = await mockDB.createUser(email, password, name || email.split('@')[0]);
    
    // 生成token
    const token = jwt.sign({ userId: user.id, email: user.email });
    
    res.json({
      success: true,
      data: {
        token,
        user: {
          userId: user.id,
          email: user.email,
          name: user.name
        }
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码必填' });
    }
    
    // 查找用户
    const user = await mockDB.verifyUser(email, password);
    if (!user) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }
    
    // 生成token
    const token = jwt.sign({ userId: user.id, email: user.email });
    
    res.json({
      success: true,
      data: {
        token,
        user: {
          userId: user.id,
          email: user.email,
          name: user.name
        }
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// GET /api/auth/me (验证token)
router.get('/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供token' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token);
    
    res.json({
      success: true,
      data: {
        user: decoded
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'token无效' });
  }
});

export default router;
