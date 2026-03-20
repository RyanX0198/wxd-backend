# WXD 后端 API 设计规范 v1.0

**版本**: v1.0  
**创建日期**: 2026-03-21  
**适用范围**: 所有后端开发任务  
**强制执行**: ✅ 是

---

## 📌 开发前必读

**每次开始开发任务前，必须阅读本文档相关章节。**  
**代码注释必须引用规范：** `// 参照API_DESIGN.md REST规范`

---

## 🌐 基础规范

### 1. RESTful API 设计

#### URL 结构
```
https://api.wxd-writing.com/api/{资源}/{操作}
```

#### HTTP 方法规范
| 方法 | 用途 | 示例 |
|------|------|------|
| GET | 获取资源 | GET /api/documents |
| POST | 创建资源 | POST /api/documents |
| PUT | 更新资源（完整）| PUT /api/documents/{id} |
| PATCH | 更新资源（部分）| PATCH /api/documents/{id} |
| DELETE | 删除资源 | DELETE /api/documents/{id} |

#### 资源命名
- 使用小写复数形式
- 不使用动词
- 使用连字符（kebab-case）

```
✅ GET /api/documents
✅ POST /api/auth/login
❌ GET /api/getDocuments
❌ POST /api/createUser
```

---

## 📤 请求规范

### 请求头
```http
Content-Type: application/json
Authorization: Bearer {JWT_TOKEN}
X-Request-ID: {UUID}  // 可选，用于追踪
```

### 请求体
```json
{
  "title": "文档标题",
  "content": "文档内容"
}
```

### 字段命名
- 使用 camelCase
- 必填字段不加后缀
- 可选字段不加后缀，文档中注明

```json
{
  "userId": "string",      // 必填
  "title": "string",       // 必填
  "description": "string"  // 可选
}
```

---

## 📥 响应规范

### 成功响应

#### 标准格式
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-03-21T12:00:00Z",
    "requestId": "uuid"
  }
}
```

#### 列表响应
```json
{
  "success": true,
  "data": [
    { "id": "1", "title": "..." },
    { "id": "2", "title": "..." }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### 错误响应

#### 标准格式
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "人类可读的错误信息",
    "details": { ... }  // 可选，详细错误信息
  },
  "meta": {
    "timestamp": "2026-03-21T12:00:00Z"
  }
}
```

#### HTTP 状态码
| 状态码 | 场景 | 示例 |
|--------|------|------|
| 200 | 成功 | GET 请求成功 |
| 201 | 创建成功 | POST 创建资源 |
| 400 | 请求参数错误 | 缺少必填字段 |
| 401 | 未认证 | Token 无效或过期 |
| 403 | 无权限 | 访问他人资源 |
| 404 | 资源不存在 | ID 找不到 |
| 409 | 资源冲突 | 重复注册 |
| 422 | 验证失败 | 格式不正确 |
| 429 | 请求过多 | 限流触发 |
| 500 | 服务器错误 | 内部异常 |

#### 错误码定义
```typescript
const ERROR_CODES = {
  // 认证错误 (AUTH_xxx)
  AUTH_INVALID_TOKEN: 'Token无效或过期',
  AUTH_MISSING_TOKEN: '未提供认证令牌',
  AUTH_INVALID_CREDENTIALS: '用户名或密码错误',
  
  // 验证错误 (VALID_xxx)
  VALID_MISSING_FIELD: '缺少必填字段',
  VALID_INVALID_FORMAT: '字段格式不正确',
  VALID_INVALID_LENGTH: '字段长度不符合要求',
  
  // 资源错误 (RES_xxx)
  RES_NOT_FOUND: '资源不存在',
  RES_ALREADY_EXISTS: '资源已存在',
  RES_FORBIDDEN: '无权访问此资源',
  
  // 系统错误 (SYS_xxx)
  SYS_INTERNAL_ERROR: '服务器内部错误',
  SYS_DATABASE_ERROR: '数据库操作失败',
  SYS_RATE_LIMIT: '请求过于频繁'
};
```

---

## 🔐 认证规范

### JWT Token

#### Token 结构
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

#### Token 载荷
```json
{
  "userId": "user_123456",
  "email": "user@example.com",
  "iat": 1711022400,
  "exp": 1711627200  // 7天后过期
}
```

#### Token 刷新策略（MVP阶段可省略）
- Access Token: 15分钟
- Refresh Token: 7天

MVP简化方案：
- 单一 Token: 7天
- 暂不做自动刷新

### 认证中间件
```typescript
// 参照API_DESIGN.md 认证规范
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_MISSING_TOKEN', message: '未提供认证令牌' }
    });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_INVALID_TOKEN', message: 'Token无效或过期' }
    });
  }
};
```

---

## 🗄️ 数据库规范

### 表命名
- 使用小写复数
- 使用下划线分隔

```sql
-- ✅ 正确
CREATE TABLE users (...);
CREATE TABLE documents (...);

-- ❌ 错误
CREATE TABLE User (...);
CREATE TABLE user_document (...);
```

### 字段命名
- 使用 camelCase（SQLite）
- 主键: `id`
- 外键: `{table}Id`（如 `userId`）
- 时间戳: `createdAt`, `updatedAt`

### 字段类型
| 类型 | SQLite | 用途 |
|------|--------|------|
| TEXT | TEXT | 字符串、UUID、时间 |
| INTEGER | INTEGER | 整数、布尔（0/1） |
| REAL | REAL | 浮点数 |
| BLOB | BLOB | 二进制数据 |

### 索引规范
```sql
-- 主键自动索引
-- 外键索引
CREATE INDEX idx_documents_user_id ON documents(userId);

-- 查询字段索引
CREATE INDEX idx_users_email ON users(email);
```

---

## 📊 分页规范

### 请求参数
```
GET /api/documents?page=1&pageSize=20&sort=-createdAt
```

### 参数说明
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | number | 1 | 页码，从1开始 |
| pageSize | number | 20 | 每页数量，最大100 |
| sort | string | -createdAt | 排序，`-`表示倒序 |

### 响应格式
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

## 🛡️ 安全规范

### 输入验证
- 所有输入必须验证
- 使用 Joi 或 Zod 进行 schema 验证
- SQL 注入防护（使用参数化查询）
- XSS 防护（转义输出）

### 限流策略
```typescript
// 参照API_DESIGN.md 限流规范
const rateLimit = {
  windowMs: 15 * 60 * 1000,  // 15分钟
  max: 100,                   // 每IP 100次
  message: {
    success: false,
    error: { code: 'SYS_RATE_LIMIT', message: '请求过于频繁，请稍后再试' }
  }
};
```

### 敏感信息
- 密码必须加密存储（bcrypt）
- JWT Secret 使用环境变量
- 数据库连接字符串使用环境变量
- 不在日志中输出敏感信息

---

## 📝 API 文档示例

### 1. 用户注册

#### 请求
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "用户名"
}
```

#### 成功响应
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "user_123456",
      "email": "user@example.com",
      "name": "用户名"
    }
  },
  "meta": {
    "timestamp": "2026-03-21T12:00:00Z"
  }
}
```

#### 错误响应
```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "RES_ALREADY_EXISTS",
    "message": "该邮箱已被注册"
  }
}
```

### 2. 创建文档

#### 请求
```http
POST /api/documents
Content-Type: application/json
Authorization: Bearer {token}

{
  "title": "文档标题",
  "content": "文档内容..."
}
```

#### 响应
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "doc_123456",
    "title": "文档标题",
    "createdAt": "2026-03-21T12:00:00Z"
  }
}
```

### 3. 获取文档列表

#### 请求
```http
GET /api/documents?page=1&pageSize=20
Authorization: Bearer {token}
```

#### 响应
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": [
    {
      "id": "doc_123456",
      "title": "文档标题",
      "preview": "内容预览...",
      "createdAt": "2026-03-21T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

---

## ✅ 代码检查清单

### 提交前必须检查

- [ ] URL 使用 RESTful 规范
- [ ] HTTP 方法使用正确
- [ ] 请求/响应格式符合规范
- [ ] 错误处理完整（包含错误码和message）
- [ ] HTTP 状态码使用正确
- [ ] 使用认证中间件保护敏感接口
- [ ] 输入数据有验证
- [ ] SQL 使用参数化查询
- [ ] 敏感信息使用环境变量
- [ ] 代码注释引用了 API_DESIGN.md

---

## 📚 参考资源

- [RESTful API Design Best Practices](https://docs.microsoft.com/en-us/azure/architecture/best-practices/api-design)
- [HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

**违反规范的代码将不被合并！**

如有疑问，联系 @卡维斯
