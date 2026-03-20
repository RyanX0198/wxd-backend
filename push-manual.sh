#!/bin/bash

# 手动推送脚本
# 用法: ./push-manual.sh YOUR_GITHUB_TOKEN

TOKEN=$1

if [ -z "$TOKEN" ]; then
    echo "用法: ./push-manual.sh YOUR_GITHUB_TOKEN"
    echo "请访问 https://github.com/settings/tokens 生成新的 Personal Access Token"
    exit 1
fi

cd /Users/ryan/.openclaw/workspace-backend-lead/WXD-Backend

git remote set-url origin https://RyanX0198:${TOKEN}@github.com/RyanX0198/wxd-backend.git

echo "正在推送代码..."
git push origin main

if [ $? -eq 0 ]; then
    echo "✅ 推送成功！"
    echo "Render 将自动重新部署"
else
    echo "❌ 推送失败，请检查 Token 是否正确"
fi
