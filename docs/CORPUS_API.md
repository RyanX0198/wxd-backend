# WXD Backend API 文档

## 语料库 API (Corpus)

### 基础信息
- 基础路径: `/api/corpus`
- 认证方式: Bearer Token (JWT)

---

### 1. 添加语料

**POST** `/api/corpus`

#### 请求头
```
Authorization: Bearer <token>
Content-Type: application/json
```

#### 请求体
```json
{
  "title": "示例讲话稿",
  "content": "讲话稿正文内容...",
  "category": "讲话稿",
  "tags": ["教育", "年度总结"],
  "source": "XX市教育局",
  "isTemplate": false
}
```

#### 参数说明
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 语料标题 |
| content | string | 是 | 语料正文 |
| category | string | 是 | 文种类型，可选：讲话稿、活动通知、工作总结、请示、报告、批复、函、纪要 |
| tags | array | 否 | 标签数组 |
| source | string | 否 | 来源 |
| isTemplate | boolean | 否 | 是否为模板，默认false |

#### 响应示例
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "示例讲话稿",
    "content": "讲话稿正文内容...",
    "category": "讲话稿",
    "tags": ["教育", "年度总结"],
    "source": "XX市教育局",
    "isTemplate": false,
    "viewCount": 0,
    "useCount": 0,
    "vectorId": null,
    "embedding": null,
    "createdAt": "2026-03-23T03:45:00.000Z",
    "updatedAt": "2026-03-23T03:45:00.000Z"
  }
}
```

---

### 2. 获取语料列表

**GET** `/api/corpus`

#### 请求头
```
Authorization: Bearer <token>
```

#### 查询参数
| 参数 | 类型 | 说明 |
|------|------|------|
| category | string | 按文种筛选，可选值同上 |
| keyword | string | 按关键词搜索标题 |
| isTemplate | boolean | 按是否为模板筛选 |
| page | number | 页码，默认1 |
| limit | number | 每页数量，默认20，最大50 |

#### 响应示例
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "示例讲话稿",
        "category": "讲话稿",
        "tags": ["教育", "年度总结"],
        "source": "XX市教育局",
        "isTemplate": false,
        "viewCount": 10,
        "useCount": 5,
        "createdAt": "2026-03-23T03:45:00.000Z",
        "updatedAt": "2026-03-23T03:45:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

---

### 3. 获取语料详情

**GET** `/api/corpus/:id`

#### 请求头
```
Authorization: Bearer <token>
```

#### 响应示例
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "示例讲话稿",
    "content": "完整的讲话稿正文内容...",
    "category": "讲话稿",
    "tags": ["教育", "年度总结"],
    "source": "XX市教育局",
    "isTemplate": false,
    "viewCount": 11,
    "useCount": 5,
    "vectorId": null,
    "embedding": null,
    "createdAt": "2026-03-23T03:45:00.000Z",
    "updatedAt": "2026-03-23T03:45:00.000Z"
  }
}
```

---

### 4. 更新语料

**PUT** `/api/corpus/:id`

#### 请求头
```
Authorization: Bearer <token>
Content-Type: application/json
```

#### 请求体
```json
{
  "title": "更新的标题",
  "content": "更新的内容",
  "category": "工作总结",
  "tags": ["教育"],
  "source": "XX学校",
  "isTemplate": true
}
```

#### 响应示例
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "更新的标题",
    "content": "更新的内容",
    "category": "工作总结",
    "tags": ["教育"],
    "source": "XX学校",
    "isTemplate": true,
    "viewCount": 10,
    "useCount": 5,
    "createdAt": "2026-03-23T03:45:00.000Z",
    "updatedAt": "2026-03-23T04:00:00.000Z"
  }
}
```

---

### 5. 删除语料

**DELETE** `/api/corpus/:id`

#### 请求头
```
Authorization: Bearer <token>
```

#### 响应示例
```json
{
  "success": true,
  "message": "语料已删除"
}
```

---

### 6. 批量添加语料

**POST** `/api/corpus/batch`

#### 请求头
```
Authorization: Bearer <token>
Content-Type: application/json
```

#### 请求体
```json
{
  "items": [
    {
      "title": "语料1",
      "content": "内容1",
      "category": "讲话稿",
      "tags": ["教育"],
      "source": "来源1"
    },
    {
      "title": "语料2",
      "content": "内容2",
      "category": "工作总结",
      "tags": ["学校"],
      "source": "来源2"
    }
  ]
}
```

#### 响应示例
```json
{
  "success": true,
  "data": {
    "created": 2,
    "total": 2
  }
}
```

---

### 7. 获取文种统计

**GET** `/api/corpus/categories/stats`

#### 请求头
```
Authorization: Bearer <token>
```

#### 响应示例
```json
{
  "success": true,
  "data": [
    {
      "category": "讲话稿",
      "count": 45
    },
    {
      "category": "工作总结",
      "count": 32
    },
    {
      "category": "活动通知",
      "count": 23
    }
  ]
}
```

---

## 写稿 API (Generate) - 更新

### 新增参数

**POST** `/api/generate`

#### 新增请求参数
| 参数 | 类型 | 说明 |
|------|------|------|
| corpusIds | string[] | 参考语料ID数组，最多5个 |

#### 请求体示例
```json
{
  "type": "讲话稿",
  "topic": "2025年教育工作总结",
  "from": "教育局局长",
  "to": "全市教育工作者",
  "wordCount": 2000,
  "formality": 3,
  "urgency": 2,
  "humanizeLevel": "medium",
  "corpusIds": ["uuid-1", "uuid-2"]
}
```

#### 响应示例
```json
{
  "success": true,
  "data": {
    "content": "生成的讲话稿内容...",
    "type": "讲话稿",
    "topic": "2025年教育工作总结",
    "model": "deepseek-chat",
    "params": {
      "wordCount": 2000,
      "formality": 3,
      "urgency": 2,
      "humanizeLevel": "medium"
    },
    "corpusIds": ["uuid-1", "uuid-2"]
  }
}
```

---

## 数据库迁移

### 初始设置

```bash
# 1. 安装依赖
npm install

# 2. 生成 Prisma 客户端
npm run db:generate

# 3. 应用数据库迁移（SQLite 使用 db push）
npm run db:push
```

### 迁移命令

```bash
# 生成 Prisma Client
npm run db:generate

# 推送 schema 到数据库（开发环境）
npm run db:push

# 打开 Prisma Studio 管理界面
npm run db:studio
```

---

## 数据模型

### Corpus (语料表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (PK) | UUID 主键 |
| title | String | 标题 |
| content | String | 正文内容 |
| category | String | 文种类型 |
| tags | String | JSON字符串存储标签 |
| source | String? | 来源 |
| isTemplate | Boolean | 是否为模板 |
| viewCount | Int | 浏览次数 |
| useCount | Int | 使用次数 |
| vectorId | String? | 向量数据库ID（预留） |
| embedding | String? | 向量嵌入数据JSON（预留） |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

---

## 支持的文种类型

- `讲话稿` - 领导讲话稿
- `活动通知` - 活动通知公文
- `工作总结` - 工作总结报告
- `请示` - 请示类公文
- `报告` - 报告类公文
- `批复` - 批复类公文
- `函` - 函件类公文
- `纪要` - 会议纪要

---

*文档版本: 1.0*
*更新日期: 2026-03-23*
