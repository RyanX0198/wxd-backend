// lib/db.js - SQLite数据库（Vercel兼容版）
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Vercel使用/tmp目录（可写）
const dbDir = process.env.VERCEL ? '/tmp' : process.cwd();
const dbPath = path.join(dbDir, 'data.db');

// 确保目录存在
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

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

module.exports = {
  createUser(email, password, name) {
    const id = 'user_' + Date.now();
    const stmt = db.prepare('INSERT INTO users (id, email, password, name, createdAt) VALUES (?, ?, ?, ?, ?)');
    stmt.run(id, email, password, name, new Date().toISOString());
    return { id, email, name };
  },
  
  findUserByEmail(email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  },
  
  verifyUser(email, password) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?');
    return stmt.get(email, password);
  },
  
  createDocument(title, content, userId) {
    const id = 'doc_' + Date.now();
    const now = new Date().toISOString();
    const stmt = db.prepare('INSERT INTO documents (id, title, content, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(id, title, content, userId, now, now);
    return { id, title, content, userId, createdAt: now };
  },
  
  getDocumentsByUserId(userId) {
    const stmt = db.prepare('SELECT * FROM documents WHERE userId = ? ORDER BY createdAt DESC');
    return stmt.all(userId);
  }
};
