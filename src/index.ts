// Polyfill for Node.js 18 - DOMMatrix and other browser APIs
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

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth.ts';
import documentRoutes from './routes/documents.ts';
import generateRoutes from './routes/generate.ts';
import chatRoutes from './routes/chat.ts';
import humanizeRoutes from './routes/humanize.ts';
import corpusRoutes from './routes/corpus.ts';
import corpusUploadRoutes from './routes/corpus-upload.ts';
import writeRoutes from './api/routes/write.ts';
import { checkKimiConfig } from './llm/service.ts';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS 配置 - 允许所有来源（开发模式）
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false
}));

// 预检请求处理
app.options('*', cors());

app.use(express.json());

// 请求日志
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// 静态文件服务 - 上传的文件
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// 健康检查 - 同时支持 /health 和 /api/health
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'sqlite'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'sqlite'
  });
});

// 注册路由
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/humanize', humanizeRoutes);
app.use('/api/corpus', corpusRoutes);
app.use('/api/corpus', corpusUploadRoutes);  // 文件上传路由
app.use('/api/write', writeRoutes);

// 错误处理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ WXD Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔑 Auth API: http://localhost:${PORT}/api/auth`);
  console.log(`📝 Documents API: http://localhost:${PORT}/api/documents`);
  console.log(`🤖 Generate API: http://localhost:${PORT}/api/generate`);
  console.log(`💬 Chat API: http://localhost:${PORT}/api/chat`);
  console.log(`🎭 Humanize API: http://localhost:${PORT}/api/humanize`);
  console.log(`📚 Corpus API: http://localhost:${PORT}/api/corpus`);
  console.log(`📁 Corpus Upload API: http://localhost:${PORT}/api/corpus/upload`);
  console.log(`✍️ Write API (Agent): http://localhost:${PORT}/api/write`);
  
  // 检查Kimi配置
  const kimiConfig = checkKimiConfig();
  if (kimiConfig.valid) {
    console.log(`🤖 Kimi API: ${kimiConfig.message}`);
  } else {
    console.log(`⚠️ Kimi API: ${kimiConfig.message}`);
  }
});
