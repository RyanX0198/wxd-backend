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
router.post('/', authMiddleware, async (req: any, res) => {
  try {
    const { title, content } = req.body;
    const userId = req.user.userId;
    
    if (!title) {
      return res.status(400).json({ error: '标题必填' });
    }
    
    const doc = await mockDB.createDocument(title, content || '', userId);
    
    res.json({
      success: true,
      data: {
        id: doc.id,
        title: doc.title,
        createdAt: doc.createdAt
      }
    });
  } catch (error) {
    console.error('创建文档错误:', error);
    res.status(500).json({ error: '创建文档失败' });
  }
});

// GET /api/documents (获取文档列表)
router.get('/', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const docs = await mockDB.getDocumentsByUserId(userId);
    
    res.json({
      success: true,
      data: docs.map((d: any) => ({
        id: d.id,
        title: d.title,
        preview: d.content.substring(0, 200) + '...',
        content: d.content,
        wordCount: d.content.length,  // 字数统计
        createdAt: d.createdAt
      }))
    });
  } catch (error) {
    console.error('获取文档错误:', error);
    res.status(500).json({ error: '获取文档列表失败' });
  }
});

// GET /api/documents/:id (获取单个文档)
router.get('/:id', authMiddleware, async (req: any, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const doc = await mockDB.getDocumentById(id);
    
    if (!doc) {
      return res.status(404).json({ error: '文档不存在' });
    }
    
    if (doc.userId !== userId) {
      return res.status(403).json({ error: '无权访问此文档' });
    }
    
    res.json({
      success: true,
      data: {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
      }
    });
  } catch (error) {
    console.error('获取文档错误:', error);
    res.status(500).json({ error: '获取文档失败' });
  }
});

// PUT /api/documents/:id (更新文档)
router.put('/:id', authMiddleware, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    const userId = req.user.userId;
    
    if (!title) {
      return res.status(400).json({ error: '标题必填' });
    }
    
    // 检查文档是否存在且属于当前用户
    const existingDoc = await mockDB.getDocumentById(id);
    if (!existingDoc) {
      return res.status(404).json({ error: '文档不存在' });
    }
    if (existingDoc.userId !== userId) {
      return res.status(403).json({ error: '无权修改此文档' });
    }
    
    const updatedDoc = await mockDB.updateDocument(id, title, content || '');
    
    res.json({
      success: true,
      data: updatedDoc
    });
  } catch (error) {
    console.error('更新文档错误:', error);
    res.status(500).json({ error: '更新文档失败' });
  }
});

// DELETE /api/documents/:id (删除文档)
router.delete('/:id', authMiddleware, async (req: any, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    // 检查文档是否存在且属于当前用户
    const existingDoc = await mockDB.getDocumentById(id);
    if (!existingDoc) {
      return res.status(404).json({ error: '文档不存在' });
    }
    if (existingDoc.userId !== userId) {
      return res.status(403).json({ error: '无权删除此文档' });
    }
    
    await mockDB.deleteDocument(id);
    
    res.json({
      success: true,
      message: '文档已删除'
    });
  } catch (error) {
    console.error('删除文档错误:', error);
    res.status(500).json({ error: '删除文档失败' });
  }
});

export default router;
