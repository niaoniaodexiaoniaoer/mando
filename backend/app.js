const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { PDFDocument } = require('pdf-lib');
require('dotenv').config({ path: path.join(__dirname, '.env') }); 

const app = express();
const PORT = 3000;

const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const db = new sqlite3.Database(path.join(__dirname, 'mando.db'));
db.serialize(() => {
    // 1. 原有签到表 (保持兼容)
    db.run(`CREATE TABLE IF NOT EXISTS checkin_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT, checkin_time TEXT, photo_url TEXT,
        latitude REAL, longitude REAL, device_os TEXT, browser TEXT, pdf_url TEXT 
    )`);

    // 2. 主工单表 (M&O 1.3 核心)
    db.run(`CREATE TABLE IF NOT EXISTS work_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT, creator TEXT, assignee TEXT, status TEXT,
        safety_pdf_url TEXT, summary_text TEXT, summary_photo_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 3. 子任务明细表
    db.run(`CREATE TABLE IF NOT EXISTS sub_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER, sub_name TEXT, status TEXT DEFAULT 'PENDING',
        log_data TEXT, -- 存储 JSON: { photos: [], remark: "" }
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(order_id) REFERENCES work_orders(id)
    )`);
});

const upload = multer({ storage: multer.memoryStorage() });
app.use(express.json({ limit: '10mb' }));

// --- API 1: 创建工单及初始化子任务 ---
app.post('/api/work-orders/start', async (req, res) => {
    const { type, creator, assignee, subTasks } = req.body; // subTasks 是数组 ['A楼', 'B楼'...]
    
    db.run(`INSERT INTO work_orders (type, creator, assignee, status) VALUES (?, ?, ?, 'SAFETY_CHECK')`, 
    [type, creator, assignee], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const orderId = this.lastID;
        
        const stmt = db.prepare(`INSERT INTO sub_tasks (order_id, sub_name, log_data) VALUES (?, ?, ?)`);
        subTasks.forEach(name => {
            stmt.run(orderId, name, JSON.stringify({ photos: [], remark: "" }));
        });
        stmt.finalize();
        
        res.json({ success: true, orderId });
    });
});

// --- API 2: 获取工单详情 (包含子任务) ---
app.get('/api/work-orders/:id', (req, res) => {
    const orderId = req.params.id;
    db.get(`SELECT * FROM work_orders WHERE id = ?`, [orderId], (err, order) => {
        if (!order) return res.status(404).json({ error: 'Order not found' });
        db.all(`SELECT * FROM sub_tasks WHERE order_id = ?`, [orderId], (err, subs) => {
            order.sub_tasks = subs.map(s => ({ ...s, log_data: JSON.parse(s.log_data) }));
            res.json(order);
        });
    });
});

// --- API 3: 更新子任务进度 (上传照片/备注) ---
app.post('/api/sub-tasks/:id/update', upload.array('photos'), async (req, res) => {
    const subId = req.params.id;
    const { remark, status } = req.body;
    let photoUrls = [];

    try {
        if (req.files) {
            for (const file of req.files) {
                const fileName = `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.jpg`;
                await r2.send(new PutObjectCommand({
                    Bucket: process.env.R2_BUCKET_NAME, Key: fileName,
                    Body: file.buffer, ContentType: 'image/jpeg'
                }));
                photoUrls.push(`${process.env.R2_PUBLIC_URL}/${fileName}`);
            }
        }

        db.get(`SELECT log_data FROM sub_tasks WHERE id = ?`, [subId], (err, row) => {
            const data = JSON.parse(row.log_data);
            data.photos.push(...photoUrls);
            data.remark = remark || data.remark;
            
            db.run(`UPDATE sub_tasks SET status = ?, log_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [status || 'RUNNING', JSON.stringify(data), subId], () => {
                res.json({ success: true, photos: data.photos });
            });
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- 原有 PDF 接口 (稍作优化，关联 orderId) ---
app.post('/api/save-signature', async (req, res) => {
    try {
        const { user, task, signatureBase64, orderId } = req.body;
        const templatePath = path.join(__dirname, 'assets', '技术安全交底告知书.pdf');
        const existingPdfBytes = fs.readFileSync(templatePath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const signatureImage = await pdfDoc.embedPng(Buffer.from(signatureBase64.split(',')[1], 'base64'));
        const secondPage = pdfDoc.getPages()[1];
        secondPage.drawImage(signatureImage, { x: 400, y: 100, width: 150, height: 75 });

        const pdfBytes = await pdfDoc.save();
        const fileName = `signed_${Date.now()}.pdf`;
        await r2.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME, Key: fileName,
            Body: pdfBytes, ContentType: 'application/pdf'
        }));

        const pdf_url = `${process.env.R2_PUBLIC_URL}/${fileName}`;
        // 更新工单状态
        if (orderId) {
            db.run(`UPDATE work_orders SET status = 'IN_PROGRESS', safety_pdf_url = ? WHERE id = ?`, [pdf_url, orderId]);
        }
        res.json({ success: true, pdf_url });
    } catch (error) { res.status(500).json({ error: 'PDF Failed' }); }
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`M&O Backend v1.3 running at http://127.0.0.1:${PORT}`);
});