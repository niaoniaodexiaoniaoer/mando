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

// --- 保持原有的 R2 配置不变 ---
const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const db = new sqlite3.Database(path.join(__dirname, 'mando.db'));

// --- 新的 3NF 登录接口 ---
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    // 使用 JOIN 查询，一次性带出角色和公司信息
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

// --- 后台管理接口：获取用户列表 (PC端使用) ---
app.get('/api/admin/users', (req, res) => {
    const sql = `
        SELECT u.id, u.username, u.real_name, r.role_name, c.name as company_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN companies c ON u.company_id = c.id
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 保持原有的静态资源和基本运行逻辑
app.listen(PORT, () => {
    console.log(`Mando 后端 V2 运行在 http://localhost:${PORT}`);
});