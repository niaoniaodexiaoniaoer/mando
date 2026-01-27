const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// Auth skeleton middleware
// =========================
const AUTH_ENABLED = false; // 以后上线时改成 true

function authGuard(req, res, next) {
  if (!AUTH_ENABLED) return next();

  const token = req.headers['x-api-key'];
  if (!token || token !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// =========================
// API router
// =========================
const api = express.Router();

// API 根节点
api.get('/', (req, res) => {
  res.json({ message: 'Mando API root' });
});

// 健康检查
api.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

// 版本号
api.get('/version', (req, res) => {
  let version = 'unknown';
  try {
    version = fs
      .readFileSync(path.join(__dirname, '../VERSION'), 'utf8')
      .trim();
  } catch (e) {
    version = 'missing';
  }
  res.json({ version });
});

// 运行状态
api.get('/status', (req, res) => {
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid
  });
});

// 只对 /api 命名空间启用鉴权骨架
app.use('/api', authGuard, api);

// =========================
// Root route (for sanity)
// =========================
app.get('/', (req, res) => {
  res.type('text').send('Mando API is running. See /api/health');
});

// =========================
// Start server
// =========================
app.listen(PORT, () => {
  console.log(`Backend is running at http://localhost:${PORT}`);
});
