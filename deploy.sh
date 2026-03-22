#!/bin/bash
# WXD Backend 部署脚本

echo "========================================="
echo "WXD Backend 部署到 Render"
echo "========================================="
echo ""

# 检查是否在正确的目录
if [ ! -f "render.yaml" ]; then
  echo "❌ 错误：未找到 render.yaml，请确保在项目根目录"
  exit 1
fi

echo "✅ 项目文件检查通过"
echo ""

# 推送到 GitHub
echo "【步骤1】推送代码到 GitHub..."
git add .
git commit -m "deploy: 准备部署到 Render"
git push origin main

echo "✅ 代码已推送到 GitHub"
echo ""

# 显示部署信息
echo "【步骤2】Render 部署配置"
echo ""
echo "请访问: https://dashboard.render.com"
echo ""
echo "点击 'New +' → 'Web Service'"
echo "选择仓库: RyanX0198/wxd-backend"
echo ""
echo "配置信息："
echo "  - Name: wxd-backend"
echo "  - Environment: Node"
echo "  - Build Command: npm install"
echo "  - Start Command: npm start"
echo "  - Plan: Free"
echo ""
echo "环境变量："
echo "  - PORT: 10000"
echo "  - NODE_ENV: production"
echo "  - DEEPSEEK_API_KEY: sk-cb6715bc91a34415b607191c0c0bbb6b"
echo ""
echo "部署完成后，会获得类似以下的 URL："
echo "  https://wxd-backend-xxx.onrender.com"
echo ""
echo "【步骤3】更新前端 API 地址"
echo ""
echo "获得后端 URL 后，修改前端 .env.production："
echo "  VITE_API_URL=https://wxd-backend-xxx.onrender.com/api"
echo ""
echo "然后重新部署前端："
echo "  cd ../workspace-frontend-lead"
echo "  npm run build"
echo "  vercel deploy --prod"
echo ""
echo "========================================="
