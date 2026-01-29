const express = require('express');
const path = require('path');
const fs = require('fs'); // 用于读取本地模板
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { PDFDocument } = require('pdf-lib'); // PDF处理核心库
require('dotenv').config({ path: path.join(__dirname, '.env') }); 

const app = express();
const PORT = 3000;

// 1. R2 客户端配置
const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

// 2. 数据库初始化
const db = new sqlite3.Database(path.join(__dirname, 'mando.db'));
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS checkin_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT,
        checkin_time TEXT,
        photo_url TEXT,
        latitude REAL,
        longitude REAL,
        device_os TEXT,
        browser TEXT,
        pdf_url TEXT 
    )`);
});

const upload = multer({ storage: multer.memoryStorage() });
app.use(express.json({ limit: '10mb' })); // 增大限制以接收签名图片数据

// 3. 签到 API
app.post('/api/checkin', upload.single('photo'), async (req, res) => {
    try {
        const { user_name, lat, lng, os, browser, checkin_time } = req.body;
        const fileName = `mando_${Date.now()}.jpg`;

        await r2.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: fileName,
            Body: req.file.buffer,
            ContentType: 'image/jpeg',
        }));

        const photo_url = `${process.env.R2_PUBLIC_URL}/${fileName}`;
        const sql = `INSERT INTO checkin_logs 
                     (user_name, photo_url, latitude, longitude, device_os, browser, checkin_time) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;
        
        db.run(sql, [user_name, photo_url, lat, lng, os, browser, checkin_time], function(err) {
            if (err) return res.status(500).json({ error: 'Database Write Failed' });
            res.json({ message: 'success', id: this.lastID, url: photo_url });
        });
    } catch (error) {
        console.error('签到失败:', error);
        res.status(500).json({ error: 'Server Internal Error' });
    }
});

// 4. 签名并合成 PDF API
app.post('/api/save-signature', async (req, res) => {
    try {
        const { user, task, signatureBase64 } = req.body;

        // A. 读取本地 PDF 模板
        const templatePath = path.join(__dirname, 'assets', '技术安全交底告知书.pdf');
        const existingPdfBytes = fs.readFileSync(templatePath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);

        // B. 处理签名图片 (去掉 Base64 头部)
        const signatureImageBytes = Buffer.from(signatureBase64.split(',')[1], 'base64');
        const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

        // C. 在第二页嵌入签名
        const pages = pdfDoc.getPages();
        const secondPage = pages[1]; // 索引从0开始，1代表第二页
        
        // 预设坐标 (x, y)，根据PDF实际大小调整
        secondPage.drawImage(signatureImage, {
            x: 400,
            y: 100,
            width: 150,
            height: 75,
        });

        // D. 保存并上传 R2
        const pdfBytes = await pdfDoc.save();
        const fileName = `signed_${Date.now()}.pdf`;

        await r2.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: fileName,
            Body: pdfBytes,
            ContentType: 'application/pdf',
        }));

        const pdf_url = `${process.env.R2_PUBLIC_URL}/${fileName}`;
        console.log(`[PDF签署成功] 用户: ${user}, URL: ${pdf_url}`);
        
        res.json({ success: true, pdf_url });
    } catch (error) {
        console.error('PDF合成错误:', error); 
        res.status(500).json({ error: 'PDF Generation Failed' });
    }
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`M&O Backend running at http://127.0.0.1:${PORT}`);
});