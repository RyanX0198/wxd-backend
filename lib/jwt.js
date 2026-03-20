// lib/jwt.js - JWT工具
const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET || 'wxd-secret-key-2026';

function sign(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verify(token) {
  try {
    const [header, body, signature] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) throw new Error('Invalid signature');
    return JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch {
    throw new Error('Invalid token');
  }
}

module.exports = { sign, verify };
