# WXD-Backend

WXD写作助手后端服务

## 项目简介

这是 WXD 写作助手的后端数据管理模块，负责：
- 文档的 CRUD 操作
- 用户认证和授权
- 数据持久化和备份

## 技术栈

- Node.js + TypeScript
- Express.js
- PostgreSQL
- Prisma ORM
- Redis
- Docker

## 目录结构

```
WXD-Backend/
├── src/
│   ├── routes/        # API 路由
│   ├── controllers/   # 控制器
│   ├── models/        # 数据模型
│   ├── middleware/    # 中间件
│   ├── utils/         # 工具函数
│   └── index.ts       # 入口
├── prisma/
│   └── schema.prisma  # 数据库模型
├── docs/              # 文档
├── tests/             # 测试
├── docker-compose.yml
└── README.md
```

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入数据库配置

# 数据库迁移
npx prisma migrate dev

# 启动开发服务器
npm run dev
```

## API 文档

见飞书文档: [API 说明](https://feishu.cn/xxx)

## 部署

```bash
# Docker 部署
docker-compose up -d
```

---

*维护者*: backend-lead  
*主Agent*: 卡维斯
