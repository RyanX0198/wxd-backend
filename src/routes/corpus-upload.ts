// Polyfill for Node.js 18 - must be before mammoth import
if (typeof global.DOMMatrix === 'undefined') {
  global.DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    constructor(init?: any) { if (init) Object.assign(this, init); }
    multiply() { return this; }
    translate() { return this; }
    scale() { return this; }
    rotate() { return this; }
    transformPoint() { return { x: 0, y: 0 }; }
  } as any;
}
if (typeof global.ImageData === 'undefined') {
  global.ImageData = class ImageData {
    data: Uint8ClampedArray; width: number; height: number;
    constructor(data: any, width: number, height?: number) {
      this.data = data;
      this.width = width;
      this.height = height || width;
    }
  } as any;
}
if (typeof global.Path2D === 'undefined') {
  global.Path2D = class Path2D {
    addPath() {}
    closePath() {}
    moveTo() {}
    lineTo() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
    arc() {}
    arcTo() {}
    ellipse() {}
    rect() {}
  } as any;
}

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import mammoth from 'mammoth';
import { PrismaClient } from '@prisma/client';
import { jwt } from '../utils/jwt.ts';

const router = Router();
const prisma = new PrismaClient();

// 确保上传目录存在
const UPLOAD_DIR = './uploads/corpus';
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 配置multer存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// 文件过滤 - 只允许特定类型
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['.docx', '.doc', '.txt', '.md'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型，仅支持 DOCX, DOC, TXT, MD'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB限制
});

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

/**
 * 从文件中提取文本内容
 */
async function extractText(filePath: string, mimeType: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.docx' || ext === '.doc') {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } else if (ext === '.txt' || ext === '.md') {
      return fs.readFileSync(filePath, 'utf-8');
    } else {
      throw new Error('不支持的文件类型');
    }
  } catch (error: any) {
    console.error('文本提取失败:', error);
    throw new Error(`无法提取文件内容: ${error.message}`);
  }
}

/**
 * POST /api/corpus/upload - 上传文件到语料库
 */
router.post('/upload', authMiddleware, upload.single('file'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的文件' });
    }

    const { category = '未分类', tags = '[]' } = req.body;
    const file = req.file;

    console.log('[CorpusUpload] 收到文件:', file.originalname);

    // 提取文本内容
    let content = '';
    try {
      content = await extractText(file.path, file.mimetype);
      console.log('[CorpusUpload] 文本提取成功，长度:', content.length);
    } catch (extractError: any) {
      // 提取失败也保存文件，但标记为未索引
      console.error('[CorpusUpload] 文本提取失败:', extractError.message);
    }

    // 保存到数据库
    const corpus = await prisma.corpus.create({
      data: {
        title: file.originalname,
        content: content || '[无法提取文本内容]',
        category,
        tags: tags,
        source: file.filename, // 存储文件名用于后续下载
        isTemplate: false,
        indexed: content.length > 0 // 有内容才算索引成功
      }
    });

    console.log('[CorpusUpload] 保存成功:', corpus.id);

    res.json({
      success: true,
      data: {
        id: corpus.id,
        name: file.originalname,
        size: file.size,
        category,
        tags: JSON.parse(tags),
        indexed: corpus.indexed,
        uploadedAt: corpus.createdAt,
        path: `/uploads/corpus/${file.filename}`
      }
    });
  } catch (error: any) {
    console.error('[CorpusUpload] 上传失败:', error);

    // 清理上传的文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: '文件上传失败',
      message: error.message
    });
  }
});

/**
 * GET /api/corpus/files - 获取语料库文件列表
 */
router.get('/files', authMiddleware, async (req: any, res) => {
  try {
    const { category, indexed, page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    // 构建查询条件
    const where: any = {};
    if (category) where.category = category;
    if (indexed !== undefined) where.indexed = indexed === 'true';

    const [files, total] = await Promise.all([
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
          indexed: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.corpus.count({ where })
    ]);

    // 获取文件大小（从文件系统）
    const filesWithSize = files.map(file => {
      let size = 0;
      if (file.source) {
        const filePath = path.join(UPLOAD_DIR, file.source);
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          size = stats.size;
        }
      }

      return {
        id: file.id,
        name: file.title,
        size,
        category: file.category,
        tags: JSON.parse(file.tags || '[]'),
        indexed: file.indexed,
        uploadedAt: file.createdAt,
        updatedAt: file.updatedAt,
        path: file.source ? `/uploads/corpus/${file.source}` : null
      };
    });

    res.json({
      success: true,
      data: {
        files: filesWithSize,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error: any) {
    console.error('[CorpusFiles] 获取文件列表失败:', error);
    res.status(500).json({
      error: '获取文件列表失败',
      message: error.message
    });
  }
});

/**
 * DELETE /api/corpus/files/:id - 删除语料文件
 */
router.delete('/files/:id', authMiddleware, async (req: any, res) => {
  try {
    const { id } = req.params;

    // 获取文件信息
    const corpus = await prisma.corpus.findUnique({
      where: { id }
    });

    if (!corpus) {
      return res.status(404).json({ error: '文件不存在' });
    }

    // 删除物理文件
    if (corpus.source) {
      const filePath = path.join(UPLOAD_DIR, corpus.source);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // 删除数据库记录
    await prisma.corpus.delete({ where: { id } });

    res.json({ success: true, message: '删除成功' });
  } catch (error: any) {
    console.error('[CorpusDelete] 删除失败:', error);
    res.status(500).json({
      error: '删除失败',
      message: error.message
    });
  }
});

/**
 * POST /api/corpus/trigger-index - 触发文件索引
 */
router.post('/trigger-index', authMiddleware, async (req: any, res) => {
  try {
    // 获取所有未索引的文件
    const pendingFiles = await prisma.corpus.findMany({
      where: { indexed: false },
      select: { id: true, title: true, source: true }
    });

    if (pendingFiles.length === 0) {
      return res.json({
        success: true,
        message: '没有待索引的文件',
        data: { total: 0, indexed: 0 }
      });
    }

    // 异步索引处理（简化版）
    let indexedCount = 0;
    for (const file of pendingFiles) {
      try {
        if (file.source) {
          const filePath = path.join(UPLOAD_DIR, file.source);
          if (fs.existsSync(filePath)) {
            const content = await extractText(filePath, '');
            await prisma.corpus.update({
              where: { id: file.id },
              data: {
                content,
                indexed: true
              }
            });
            indexedCount++;
          }
        }
      } catch (err) {
        console.error(`[CorpusIndex] 索引失败 ${file.title}:`, err);
      }
    }

    res.json({
      success: true,
      data: {
        total: pendingFiles.length,
        indexed: indexedCount
      }
    });
  } catch (error: any) {
    console.error('[CorpusIndex] 触发索引失败:', error);
    res.status(500).json({
      error: '触发索引失败',
      message: error.message
    });
  }
});

export default router;
