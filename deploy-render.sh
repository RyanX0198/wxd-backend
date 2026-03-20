#!/bin/bash

# WXD Backend Render.com 部署脚本

echo "🚀 开始部署 WXD Backend 到 Render.com..."

# 1. 检查代码
echo "📦 检查代码..."
if [ ! -f "package.json" ]; then
    echo "❌ 错误：找不到 package.json"
    exit 1
fi

if [ ! -f "render.yaml" ]; then
    echo "❌ 错误：找不到 render.yaml"
    exit 1
fi

# 2. 安装依赖
echo "📥 安装依赖..."
npm install

# 3. 测试本地启动
echo "🧪 测试本地启动..."
timeout 5 npm start &
sleep 2

if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ 本地测试通过"
else
    echo "⚠️ 本地测试失败，继续部署..."
fi

# 4. 提交代码到Git（如果需要）
echo "📤 准备部署文件..."

# 5. 输出部署步骤
echo ""
echo "================================"
echo "✅ 部署准备完成！"
echo "================================"
echo ""
echo "请按以下步骤完成部署："
echo ""
echo "1. 访问 https://dashboard.render.com"
echo "2. 点击 'New Web Service'"
echo "3. 选择 'Build and deploy from a Git repository'"
echo "4. 选择 WXD-Backend 代码仓库"
echo "5. 填写配置："
echo "   - Name: wxd-backend"
echo "   - Environment: Node"
echo "   - Build Command: npm install"
echo "   - Start Command: npm start"
echo "   - Plan: Free"
echo "6. 点击 'Advanced' 添加磁盘："
echo "   - Mount Path: /data"
echo "   - Size: 1 GB"
echo "7. 点击 'Create Web Service'"
echo ""
echo "部署完成后，你将获得类似以下的URL："
echo "https://wxd-backend-xxxx.onrender.com"
echo ""
echo "然后将前端 API_BASE_URL 修改为该地址"
echo ""
