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

// --- 认证接口 ---
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const sql = `
        SELECT u.id, u.username, u.real_name, r.role_key, c.name as company_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN companies c ON u.company_id = c.id
        WHERE u.username = ? AND u.password = ?
    `;
    db.get(sql, [username, password], (err, user) => {
        if (err) return res.status(500).json({ error: '数据库错误' });
        if (user) {
            res.json({ success: true, user });
        } else {
            res.status(401).json({ success: false, message: '账号或密码错误' });
        }
    });
});

// --- 管理后台：用户管理 ---
app.get('/api/admin/users', (req, res) => {
    const sql = `SELECT u.*, r.role_name, c.name as company_name FROM users u 
                 LEFT JOIN roles r ON u.role_id = r.id 
                 LEFT JOIN companies c ON u.company_id = c.id`;
    db.all(sql, (err, rows) => res.json(rows));
});
app.post('/api/admin/users', (req, res) => {
    const { username, password, real_name, role_id, company_id } = req.body;
    db.run("INSERT INTO users (username, password, real_name, role_id, company_id) VALUES (?,?,?,?,?)",
        [username, password, real_name, role_id, company_id], (err) => res.json({ success: !err }));
});
app.put('/api/admin/users/:id', (req, res) => {
    const { username, password, real_name, role_id, company_id } = req.body;
    db.run("UPDATE users SET username=?, password=?, real_name=?, role_id=?, company_id=? WHERE id=?",
        [username, password, real_name, role_id, company_id, req.params.id], (err) => res.json({ success: !err }));
});
app.delete('/api/admin/users/:id', (req, res) => {
    if (parseInt(req.params.id) === 1) return res.status(403).json({ error: '系统管理员不可删除' });
    db.run("DELETE FROM users WHERE id = ?", req.params.id, (err) => res.json({ success: !err }));
});

// --- 管理后台：公司管理 ---
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

// --- 管理后台：角色管理 ---
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

// 获取选项接口
app.get('/api/admin/options', (req, res) => {
    db.all("SELECT id, role_name as name FROM roles", (err, roles) => {
        db.all("SELECT id, name FROM companies", (err, companies) => {
            res.json({ roles, companies });
        });
    });
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));