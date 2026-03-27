FROM node:20-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装全部依赖（tsx需要dev依赖）
RUN npm ci

# 复制代码
COPY . .

# 生成Prisma客户端
RUN npx prisma generate

# 暴露端口
EXPOSE 3001

# 启动命令（使用tsx运行TypeScript）
CMD ["npx", "tsx", "src/index.ts"]
