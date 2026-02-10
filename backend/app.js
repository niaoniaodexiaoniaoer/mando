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

const upload = multer({ storage: multer.memoryStorage() });
const db = new sqlite3.Database(path.join(__dirname, 'mando.db'));

// --- 数据库初始化 ---
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT, real_name TEXT, role_id INTEGER, company_id INTEGER, phone TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS login_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        user_id INTEGER, 
        username TEXT, 
        real_name TEXT, 
        photo_url TEXT, 
        location TEXT, 
        status TEXT, 
        ip_address TEXT, 
        device_info TEXT, 
        login_time DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS companies (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, role_name TEXT, role_key TEXT)`);
});

// --- 1. 认证接口 ---
app.post('/api/auth/verify-account', (req, res) => {
    const { username, password } = req.body;
    const sql = `
        SELECT u.id, u.username, u.real_name, u.phone, r.role_key, c.name as company_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN companies c ON u.company_id = c.id
        WHERE (u.username = ? OR u.phone = ?) AND u.password = ?
    `;
    db.get(sql, [username, username, password], (err, user) => {
        if (err) return res.status(500).json({ success: false, message: '数据库错误' });
        if (user) {
            res.json({ success: true, user });
        } else {
            res.json({ success: false, message: '账号或密码错误' });
        }
    });
});

app.post('/api/auth/finalize-login', upload.single('photo'), async (req, res) => {
    const { user_id, username, real_name, status, location } = req.body;
    const photo = req.file;

    try {
        const key = `logs/${Date.now()}-${username}.jpg`;
        await r2.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            Body: photo.buffer,
            ContentType: 'image/jpeg',
        }));

        const photo_url = `${process.env.R2_PUBLIC_URL}/${key}`;

        db.get(`SELECT u.*, r.role_key FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`, [user_id], (err, user) => {
            db.run(
                "INSERT INTO login_logs (user_id, username, real_name, photo_url, status, location) VALUES (?,?,?,?,?,?)",
                [user_id, username, real_name, photo_url, status, location],
                (dbErr) => {
                    if (dbErr) return res.json({ success: false, message: '日志写入失败' });
                    res.json({
                        success: true,
                        user: { id: user.id, username: user.username, real_name: user.real_name, role_key: user.role_key }
                    });
                }
            );
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- 2. 管理后台接口 ---

// [2026-02-10 修订] 对齐 Dashboard.vue 第 184 行，接口名由 init-data 改为 options
app.get('/api/admin/options', (req, res) => {
    const data = { roles: [], companies: [] };
    // [2026-02-10 修订] 将 role_name 重命名为 name，匹配前端选项渲染逻辑
    db.all("SELECT id, role_name as name FROM roles", [], (err, r) => {
        data.roles = r || [];
        db.all("SELECT id, name FROM companies", [], (err, c) => {
            data.companies = c || [];
            res.json(data);
        });
    });
});

// [2026-02-10 修订] 增加 count 字段，解决前端 Dashboard-BxEgIrEG.js 报 Cannot read properties of undefined (reading 'count') 的问题
app.get('/api/admin/logs', (req, res) => {
    db.all("SELECT * FROM login_logs ORDER BY login_time DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ 
            success: true,
            data: rows || [], 
            count: rows ? rows.length : 0 
        });
    });
});

app.get('/api/admin/users', (req, res) => {
    const sql = `SELECT u.*, c.name as company_name, r.role_name FROM users u
                 LEFT JOIN companies c ON u.company_id = c.id
                 LEFT JOIN roles r ON u.role_id = r.id`;
    db.all(sql, (err, rows) => res.json(rows));
});

app.post('/api/admin/users', (req, res) => {
    const { username, password, real_name, role_id, company_id, phone } = req.body;
    db.run("INSERT INTO users (username, password, real_name, role_id, company_id, phone) VALUES (?,?,?,?,?,?)",
        [username, password, real_name, role_id, company_id, phone], (err) => res.json({ success: !err }));
});

app.put('/api/admin/users/:id', (req, res) => {
    const { username, password, real_name, role_id, company_id, phone } = req.body;
    db.run("UPDATE users SET username=?, password=?, real_name=?, role_id=?, company_id=?, phone=? WHERE id=?",
        [username, password, real_name, role_id, company_id, phone, req.params.id], (err) => res.json({ success: !err }));
});

app.delete('/api/admin/users/:id', (req, res) => {
    db.run("DELETE FROM users WHERE id = ?", req.params.id, (err) => res.json({ success: !err }));
});

app.get('/api/admin/companies', (req, res) => {
    db.all("SELECT * FROM companies", (err, rows) => res.json(rows));
});

app.post('/api/admin/companies', (req, res) => {
    db.run("INSERT INTO companies (name) VALUES (?)", [req.body.name], (err) => res.json({ success: !err }));
});

app.put('/api/admin/companies/:id', (req, res) => {
    db.run("UPDATE companies SET name=? WHERE id=?", [req.body.name, req.params.id], (err) => res.json({ success: !err }));
});

app.delete('/api/admin/companies/:id', (req, res) => {
    if (parseInt(req.params.id) === 1) return res.status(403).json({ error: '初始单位不可删除' });
    db.run("DELETE FROM companies WHERE id = ?", req.params.id, (err) => res.json({ success: !err }));
});

app.get('/api/admin/roles', (req, res) => {
    db.all("SELECT * FROM roles", (err, rows) => res.json(rows));
});

app.post('/api/admin/roles', (req, res) => {
    db.run("INSERT INTO roles (role_name, role_key) VALUES (?,?)", [req.body.role_name, req.body.role_key], (err) => res.json({ success: !err }));
});

app.delete('/api/admin/roles/:id', (req, res) => {
    if (parseInt(req.params.id) === 1) return res.status(403).json({ error: '初始角色不可删除' });
    db.run("DELETE FROM roles WHERE id = ?", req.params.id, (err) => res.json({ success: !err }));
});

// --- 静态文件托管 ---
app.use(express.static(path.join(__dirname, 'dist')));

// [保持原有 Node v24 正则写法不变]
app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});