import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { jwt } from '../utils/jwt.ts';

const router = Router();
const prisma = new PrismaClient();

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

// 允许的文种类型（与generate路由保持一致）
const VALID_CATEGORIES = [
  '讲话稿', '活动通知', '工作总结', 
  '请示', '报告', '批复', '函', '纪要'
];

/**
 * POST /api/corpus - 添加语料
 * Body: { title, content, category, tags?, source?, isTemplate? }
 */
router.post('/', authMiddleware, async (req: any, res) => {
  try {
    const { title, content, category, tags, source, isTemplate } = req.body;
    
    // 参数验证
    if (!title || !content || !category) {
      return res.status(400).json({ 
        error: '缺少必要参数', 
        required: ['title', 'content', 'category'] 
      });
    }
    
    // 验证文种类型
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ 
        error: '不支持的文种类型',
        supported: VALID_CATEGORIES
      });
    }
    
    // 创建语料
    const corpus = await prisma.corpus.create({
      data: {
        title,
        content,
        category,
        tags: tags ? JSON.stringify(tags) : '[]',
        source: source || null,
        isTemplate: isTemplate || false
      }
    });
    
    // 将tags字符串转换回数组返回
    const result = {
      ...corpus,
      tags: JSON.parse(corpus.tags)
    };
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('创建语料错误:', error);
    res.status(500).json({ 
      error: '创建语料失败', 
      message: error.message 
    });
  }
});

/**
 * GET /api/corpus - 获取语料列表（支持筛选和搜索）
 * Query: { category?, keyword?, isTemplate?, page?, limit? }
 */
router.get('/', authMiddleware, async (req: any, res) => {
  try {
    const { 
      category, 
      keyword, 
      isTemplate,
      page = '1', 
      limit = '20' 
    } = req.query;
    
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;
    
    // 构建查询条件
    const where: any = {};
    
    // 按文种筛选
    if (category && VALID_CATEGORIES.includes(category as string)) {
      where.category = category;
    }
    
    // 按关键词搜索标题
    if (keyword) {
      where.title = {
        contains: keyword as string,
        mode: 'insensitive' // 不区分大小写
      };
    }
    
    // 按是否为模板筛选
    if (isTemplate !== undefined) {
      where.isTemplate = isTemplate === 'true';
    }
    
    // 查询总数和列表
    const [total, items] = await Promise.all([
      prisma.corpus.count({ where }),
      prisma.corpus.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true,
          title: true,
          category: true,
          tags: true,
          source: true,
          isTemplate: true,
          viewCount: true,
          useCount: true,
          createdAt: true,
          updatedAt: true,
          // 不返回完整content，避免数据量过大
          content: false
        }
      })
    ]);
    
    res.json({
      success: true,
      data: {
        items: items.map(item => ({
          ...item,
          tags: JSON.parse(item.tags || '[]')
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error: any) {
    console.error('获取语料列表错误:', error);
    res.status(500).json({ 
      error: '获取语料列表失败', 
      message: error.message 
    });
  }
});

/**
 * GET /api/corpus/:id - 获取语料详情
 */
router.get('/:id', authMiddleware, async (req: any, res) => {
  try {
    const { id } = req.params;
    
    const corpus = await prisma.corpus.findUnique({
      where: { id }
    });
    
    if (!corpus) {
      return res.status(404).json({ error: '语料不存在' });
    }
    
    // 增加浏览次数
    await prisma.corpus.update({
      where: { id },
      data: { viewCount: { increment: 1 } }
    });
    
    // 转换tags为数组返回
    const result = {
      ...corpus,
      tags: JSON.parse(corpus.tags || '[]')
    };
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('获取语料详情错误:', error);
    res.status(500).json({ 
      error: '获取语料详情失败', 
      message: error.message 
    });
  }
});

/**
 * PUT /api/corpus/:id - 更新语料
 */
router.put('/:id', authMiddleware, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { title, content, category, tags, source, isTemplate } = req.body;
    
    // 检查语料是否存在
    const existing = await prisma.corpus.findUnique({
      where: { id }
    });
    
    if (!existing) {
      return res.status(404).json({ error: '语料不存在' });
    }
    
    // 验证文种类型
    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ 
        error: '不支持的文种类型',
        supported: VALID_CATEGORIES
      });
    }
    
    // 更新语料
    const updated = await prisma.corpus.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(category !== undefined && { category }),
        ...(tags !== undefined && { tags: JSON.stringify(tags) }),
        ...(source !== undefined && { source }),
        ...(isTemplate !== undefined && { isTemplate })
      }
    });
    
    // 转换tags为数组返回
    const result = {
      ...updated,
      tags: JSON.parse(updated.tags || '[]')
    };
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('更新语料错误:', error);
    res.status(500).json({ 
      error: '更新语料失败', 
      message: error.message 
    });
  }
});

/**
 * DELETE /api/corpus/:id - 删除语料
 */
router.delete('/:id', authMiddleware, async (req: any, res) => {
  try {
    const { id } = req.params;
    
    // 检查语料是否存在
    const existing = await prisma.corpus.findUnique({
      where: { id }
    });
    
    if (!existing) {
      return res.status(404).json({ error: '语料不存在' });
    }
    
    // 删除语料
    await prisma.corpus.delete({
      where: { id }
    });
    
    res.json({
      success: true,
      message: '语料已删除'
    });
  } catch (error: any) {
    console.error('删除语料错误:', error);
    res.status(500).json({ 
      error: '删除语料失败', 
      message: error.message 
    });
  }
});

/**
 * POST /api/corpus/batch - 批量添加语料（管理员功能）
 * Body: { items: [{ title, content, category, tags?, source? }] }
 */
router.post('/batch', authMiddleware, async (req: any, res) => {
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: '请提供有效的语料数组' });
    }
    
    // 验证所有项目
    const validItems = items.filter(item => {
      return item.title && item.content && 
             item.category && VALID_CATEGORIES.includes(item.category);
    });
    
    if (validItems.length === 0) {
      return res.status(400).json({ error: '没有有效的语料项' });
    }
    
    // 批量创建
    const created = await prisma.corpus.createMany({
      data: validItems.map(item => ({
        title: item.title,
        content: item.content,
        category: item.category,
        tags: JSON.stringify(item.tags || []),
        source: item.source || null,
        isTemplate: item.isTemplate || false
      })),
      skipDuplicates: false
    });
    
    res.json({
      success: true,
      data: {
        created: created.count,
        total: items.length
      }
    });
  } catch (error: any) {
    console.error('批量创建语料错误:', error);
    res.status(500).json({ 
      error: '批量创建语料失败', 
      message: error.message 
    });
  }
});

/**
 * GET /api/corpus/categories/stats - 获取各文种统计
 */
router.get('/categories/stats', authMiddleware, async (req: any, res) => {
  try {
    const stats = await prisma.corpus.groupBy({
      by: ['category'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });
    
    res.json({
      success: true,
      data: stats.map(s => ({
        category: s.category,
        count: s._count.id
      }))
    });
  } catch (error: any) {
    console.error('获取语料统计错误:', error);
    res.status(500).json({ 
      error: '获取语料统计失败', 
      message: error.message 
    });
  }
});

export default router;
