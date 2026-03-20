# WXD Backend 部署指南

## 方案：Render.com（推荐，有免费额度）

### 步骤：

1. 访问 https://render.com
2. 用GitHub登录
3. 点击 "New Web Service"
4. 选择 WXD-Backend 代码仓库
5. 配置：
   - Name: wxd-backend
   - Environment: Node
   - Build Command: npm install
   - Start Command: npm start
   - Plan: Free
6. 点击 "Create Web Service"

### 环境变量（Render Dashboard设置）：
```
PORT=10000
NODE_ENV=production
```

### 部署后：
- 获得生产URL: https://wxd-backend-xxxx.onrender.com
- 前端修改 API_BASE_URL 为这个地址

---

## 备选方案：Fly.io

```bash
# 安装 flyctl
curl -L https://fly.io/install.sh | sh

# 登录
fly auth login

# 部署
cd /Users/ryan/.openclaw/workspace-backend-lead/WXD-Backend
fly launch
fly deploy
```

---

## 本地测试（确保后端正常）

```bash
cd /Users/ryan/.openclaw/workspace-backend-lead/WXD-Backend
node src/index.ts
```

测试API:
```bash
curl http://localhost:3001/health
```
