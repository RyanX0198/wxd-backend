// SQLite 数据库 - 使用 sqlite3（纯JavaScript，无需编译）
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

// 数据库文件路径 - 支持Render持久化磁盘
// Render上挂载在/data，本地开发使用当前目录
const dbPath = process.env.RENDER_DISK_MOUNT_PATH 
  ? path.join('/data', 'data.db')  // Render生产环境
  : path.join(process.cwd(), 'data.db');  // 本地开发环境

console.log('[DB] 数据库路径:', dbPath);

// 创建数据库连接
let db: any = null;

async function getDb() {
  if (!db) {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    // 初始化表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        name TEXT,
        createdAt TEXT
      )
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT,
        userId TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )
    `);

    // 对话表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT DEFAULT '新对话',
        type TEXT DEFAULT 'general',
        userId TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )
    `);

    // 消息表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        role TEXT,
        content TEXT,
        conversationId TEXT,
        createdAt TEXT
      )
    `);
  }
  return db;
}

export const mockDB = {
  // ========== 用户相关 ==========
  async createUser(email: string, password: string, name: string) {
    const db = await getDb();
    const id = 'user_' + Date.now();
    await db.run(
      'INSERT INTO users (id, email, password, name, createdAt) VALUES (?, ?, ?, ?, ?)',
      [id, email, password, name, new Date().toISOString()]
    );
    return { id, email, name };
  },
  
  async findUserByEmail(email: string) {
    const db = await getDb();
    return db.get('SELECT * FROM users WHERE email = ?', [email]);
  },
  
  async verifyUser(email: string, password: string) {
    const db = await getDb();
    return db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
  },

  // ========== 文档相关 ==========
  async createDocument(title: string, content: string, userId: string) {
    const db = await getDb();
    const id = 'doc_' + Date.now();
    const now = new Date().toISOString();
    await db.run(
      'INSERT INTO documents (id, title, content, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      [id, title, content, userId, now, now]
    );
    return { id, title, content, userId, createdAt: now };
  },
  
  async getDocumentsByUserId(userId: string) {
    const db = await getDb();
    return db.all('SELECT * FROM documents WHERE userId = ? ORDER BY createdAt DESC', [userId]);
  },

  async getDocumentById(id: string) {
    const db = await getDb();
    return db.get('SELECT * FROM documents WHERE id = ?', [id]);
  },

  async updateDocument(id: string, title: string, content: string) {
    const db = await getDb();
    const now = new Date().toISOString();
    await db.run(
      'UPDATE documents SET title = ?, content = ?, updatedAt = ? WHERE id = ?',
      [title, content, now, id]
    );
    return { id, title, content, updatedAt: now };
  },

  async deleteDocument(id: string) {
    const db = await getDb();
    await db.run('DELETE FROM documents WHERE id = ?', [id]);
    return { id };
  },

  // ========== 对话相关 ==========
  async createConversation(userId: string, title: string = '新对话', type: string = 'general') {
    const db = await getDb();
    const id = 'conv_' + Date.now();
    const now = new Date().toISOString();
    await db.run(
      'INSERT INTO conversations (id, title, type, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      [id, title, type, userId, now, now]
    );
    return { id, title, type, userId, createdAt: now, updatedAt: now };
  },

  async getConversationsByUserId(userId: string) {
    const db = await getDb();
    return db.all('SELECT * FROM conversations WHERE userId = ? ORDER BY updatedAt DESC', [userId]);
  },

  async getConversationById(id: string) {
    const db = await getDb();
    return db.get('SELECT * FROM conversations WHERE id = ?', [id]);
  },

  async updateConversationTitle(id: string, title: string) {
    const db = await getDb();
    const now = new Date().toISOString();
    await db.run(
      'UPDATE conversations SET title = ?, updatedAt = ? WHERE id = ?',
      [title, now, id]
    );
    return { id, title, updatedAt: now };
  },

  async updateConversationTime(id: string) {
    const db = await getDb();
    const now = new Date().toISOString();
    await db.run('UPDATE conversations SET updatedAt = ? WHERE id = ?', [now, id]);
  },

  async deleteConversation(id: string) {
    const db = await getDb();
    await db.run('DELETE FROM messages WHERE conversationId = ?', [id]);
    await db.run('DELETE FROM conversations WHERE id = ?', [id]);
    return { id };
  },

  // ========== 消息相关 ==========
  async createMessage(conversationId: string, role: string, content: string) {
    const db = await getDb();
    const id = 'msg_' + Date.now();
    const now = new Date().toISOString();
    await db.run(
      'INSERT INTO messages (id, role, content, conversationId, createdAt) VALUES (?, ?, ?, ?, ?)',
      [id, role, content, conversationId, now]
    );
    return { id, role, content, conversationId, createdAt: now };
  },

  async getMessagesByConversationId(conversationId: string) {
    const db = await getDb();
    return db.all('SELECT * FROM messages WHERE conversationId = ? ORDER BY createdAt ASC', [conversationId]);
  },

  async getMessageById(id: string) {
    const db = await getDb();
    return db.get('SELECT * FROM messages WHERE id = ?', [id]);
  }
};
