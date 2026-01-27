const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// 统一 API 命名空间
const api = express.Router();

api.get('/', (req, res) => {
  res.json({ message: 'Mando API root' });
});

api.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

api.get('/version', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const version = fs.readFileSync(path.join(__dirname, '../VERSION'), 'utf8').trim();
  res.json({ version });
});

api.get('/status', (req, res) => {
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid
  });
});

app.use('/api', api);

app.listen(PORT, () => {
  console.log(`Backend is running at http://localhost:${PORT}`);
});
