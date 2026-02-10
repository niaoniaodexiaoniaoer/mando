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

// --- 1. 认证接口 (对齐 Login.vue) ---
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

// --- 登录接口增强 (确保角色信息返回) ---
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

        const photo_url = `https://${process.env.R2_CUSTOM_DOMAIN}/${key}`;
        
        // 修改：在记录日志的同时，查询最新的用户信息返回给前端
        db.get(`
            SELECT u.*, r.role_key 
            FROM users u 
            JOIN roles r ON u.role_id = r.id 
            WHERE u.id = ?`, [user_id], (err, user) => {
            
            db.run(
                "INSERT INTO login_logs (user_id, username, real_name, photo_url, status, location) VALUES (?,?,?,?,?,?)",
                [user_id, username, real_name, photo_url, status, location]
            );

            res.json({ 
                success: true, 
                user: {
                    id: user.id,
                    username: user.username,
                    real_name: user.real_name,
                    role_key: user.role_key // 确保前端能拿到这个 key
                }
            });
        });
    } catch (error) {
        console.error('Finalize login error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- 2. 管理后台接口 ---
app.get('/api/admin/init-data', (req, res) => {
    const data = {};
    db.all("SELECT id, role_name as name FROM roles", [], (err, r) => {
        data.roles = r;
        db.all("SELECT id, name FROM companies", [], (err, c) => {
            data.companies = c; res.json(data);
        });
    });
});

app.get('/api/admin/logs', (req, res) => {
    db.all("SELECT * FROM login_logs ORDER BY login_time DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
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
// 确保前端 build 后的 dist 文件夹放在 backend 目录下
app.use(express.static(path.join(__dirname, 'dist')));

// --- 核心修复：Node v24 路由兼容性补丁 ---
// 使用原生正则表达式代替字符串通配符，彻底解决 PathError
app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});