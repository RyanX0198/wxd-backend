import { Router } from 'express';
import { mockDB } from '../mockDB.ts';
import { jwt } from '../utils/jwt.ts';

const router = Router();

// 验证token中间件
const authMiddleware = (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供token' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'token无效' });
  }
};

// POST /api/documents (创建文档)
router.post('/', authMiddleware, (req: any, res) => {
  try {
    const { title, content } = req.body;
    const userId = req.user.userId;
    
    if (!title || !content) {
      return res.status(400).json({ error: '标题和内容必填' });
    }
    
    const doc = mockDB.createDocument(title, content, userId);
    
    res.json({
      success: true,
      data: {
        id: doc.id,
        title: doc.title,
        createdAt: doc.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: '创建文档失败' });
  }
});

// GET /api/documents (获取文档列表)
router.get('/', authMiddleware, (req: any, res) => {
  try {
    const userId = req.user.userId;
    const docs = mockDB.getDocumentsByUserId(userId);
    
    res.json({
      success: true,
      data: docs.map(d => ({
        id: d.id,
        title: d.title,
        preview: d.content.substring(0, 200) + '...',
        createdAt: d.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: '获取文档列表失败' });
  }
});

export default router;
