// api/health.js
module.exports = (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.VERCEL ? 'vercel' : 'local'
  });
};
