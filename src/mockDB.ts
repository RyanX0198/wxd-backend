// SQLite 数据库 - 使用 sqlite3（纯JavaScript，无需编译）
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

// 数据库文件路径
const dbPath = path.join(process.cwd(), 'data.db');

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
  }
  return db;
}

export const mockDB = {
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
  }
};
