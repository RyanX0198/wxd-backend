// SQLite 数据库 - 轻量级，数据持久化
import Database from 'better-sqlite3';
import path from 'path';

// Render.com 使用 /data 目录持久化存储
const dbPath = process.env.RENDER_DISK_MOUNT_PATH 
  ? path.join(process.env.RENDER_DISK_MOUNT_PATH, 'data.db')
  : path.join(process.cwd(), 'data.db');

console.log('Database path:', dbPath);

const db = new Database(dbPath);

// 初始化表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    createdAt TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    userId TEXT,
    createdAt TEXT,
    updatedAt TEXT
  )
`);

export const mockDB = {
  createUser(email: string, password: string, name: string) {
    const id = 'user_' + Date.now();
    const stmt = db.prepare('INSERT INTO users (id, email, password, name, createdAt) VALUES (?, ?, ?, ?, ?)');
    stmt.run(id, email, password, name, new Date().toISOString());
    return { id, email, name };
  },
  
  findUserByEmail(email: string) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  },
  
  verifyUser(email: string, password: string) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?');
    return stmt.get(email, password);
  },
  
  createDocument(title: string, content: string, userId: string) {
    const id = 'doc_' + Date.now();
    const now = new Date().toISOString();
    const stmt = db.prepare('INSERT INTO documents (id, title, content, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(id, title, content, userId, now, now);
    return { id, title, content, userId, createdAt: now };
  },
  
  getDocumentsByUserId(userId: string) {
    const stmt = db.prepare('SELECT * FROM documents WHERE userId = ? ORDER BY createdAt DESC');
    return stmt.all(userId);
  }
};
