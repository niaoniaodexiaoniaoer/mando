const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { PDFDocument } = require('pdf-lib');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(express.json());
const PORT = 3000;

// --- R2 配置 ---
const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const db = new sqlite3.Database(path.join(__dirname, 'mando.db'));

// --- 数据库初始化：增加登录日志表 ---
db.serialize(() => {
    // 确保基础表存在
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT, real_name TEXT, role_id INTEGER, company_id INTEGER, phone TEXT)`);
    
    // 新增登录日志表
    db.run(`CREATE TABLE IF NOT EXISTS login_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        real_name TEXT,
        login_time DATETIME DEFAULT (datetime('now', 'localtime')),
        photo_url TEXT,
        device_info TEXT,
        ip_address TEXT,
        location TEXT,
        status TEXT -- SUCCESS, FAILED
    )`);
});

// --- 认证接口 1：验证账号密码 (第一步) ---
app.post('/api/auth/verify-account', (req, res) => {
    const { username, password } = req.body;
    const sql = `
        SELECT u.id, u.username, u.real_name, u.phone, r.role_key, c.name as company_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN companies c ON u.company_id = c.id
        WHERE (u.username = ? OR u.phone = ?) AND u.password = ?
    `;
    db.get(sql, [username, username, password], (err, row) => {
        if (err) return res.status(500).json({ success: false, message: "数据库错误" });
        if (row) {
            res.json({ success: true, user: row });
        } else {
            res.status(401).json({ success: false, message: "账号或密码错误" });
        }
    });
});

// --- 认证接口 2：记录日志并完成登录 (第二步) ---
app.post('/api/auth/finalize-login', multer().single('photo'), async (req, res) => {
    const { user_id, username, real_name, location, status } = req.body;
    const file = req.file;

    try {
        let photoUrl = '';
        if (file) {
            const fileName = `login_photos/${user_id}_${Date.now()}.jpg`;
            await r2.send(new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: fileName,
                Body: file.buffer,
                ContentType: 'image/jpeg'
            }));
            photoUrl = `https://${process.env.R2_CUSTOM_DOMAIN}/${fileName}`;
        }

        const sql = `INSERT INTO login_logs (user_id, username, real_name, photo_url, device_info, ip_address, location, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        db.run(sql, [user_id, username, real_name, photoUrl, req.headers['user-agent'], req.ip, location, status], function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true });
        });
    } catch (err) {
        console.error("R2 Upload Error:", err);
        res.status(500).json({ success: false, message: "日志记录失败" });
    }
});

// --- 管理后台：用户/单位/角色 (包含 phone 字段) ---
app.get('/api/admin/users', (req, res) => {
    const sql = `SELECT u.*, r.role_name, c.name as company_name FROM users u LEFT JOIN roles r ON u.role_id = r.id LEFT JOIN companies c ON u.company_id = c.id`;
    db.all(sql, [], (err, rows) => res.json(rows));
});

app.post('/api/admin/users', (req, res) => {
    const { username, password, real_name, role_id, company_id, phone } = req.body;
    db.run(`INSERT INTO users (username, password, real_name, role_id, company_id, phone) VALUES (?, ?, ?, ?, ?, ?)`, [username, password, real_name, role_id, company_id, phone], () => res.json({ success: true }));
});

app.put('/api/admin/users/:id', (req, res) => {
    const { username, password, real_name, role_id, company_id, phone } = req.body;
    db.run(`UPDATE users SET username=?, password=?, real_name=?, role_id=?, company_id=?, phone=? WHERE id=?`, [username, password, real_name, role_id, company_id, phone, req.params.id], () => res.json({ success: true }));
});

app.delete('/api/admin/users/:id', (req, res) => {
    db.run("DELETE FROM users WHERE id = ?", req.params.id, () => res.json({ success: true }));
});

app.get('/api/admin/options', (req, res) => {
    const data = {};
    db.all("SELECT id, role_name as name FROM roles", [], (err, r) => {
        data.roles = r;
        db.all("SELECT id, name FROM companies", [], (err, c) => {
            data.companies = c; res.json(data);
        });
    });
});

// --- 管理后台：登录日志查询与探针 ---
app.get('/api/admin/logs', (req, res) => {
    db.all("SELECT * FROM login_logs ORDER BY login_time DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // 日志探针：超过 10000 条触发标记
        const probeTriggered = rows.length > 10000;
        res.json({
            data: rows,
            probe: {
                triggered: probeTriggered,
                count: rows.length,
                threshold: 10000,
                message: probeTriggered ? "警告：日志存储量已到达阈值，请及时清理" : "正常"
            }
        });
    });
});

// --- 基础资料管理 ---
app.get('/api/admin/companies', (req, res) => db.all("SELECT * FROM companies", (err, rows) => res.json(rows)));
app.get('/api/admin/roles', (req, res) => db.all("SELECT * FROM roles", (err, rows) => res.json(rows)));

// --- 静态文件与路由分发 (Node v24 兼容写法) ---
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        next();
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});