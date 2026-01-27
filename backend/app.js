const express = require('express');
const path = require('path');
// 修改这一行，强制指向当前目录下的 .env
require('dotenv').config({ path: path.join(__dirname, '.env') }); 
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
// ... 后面的代码不变
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

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
        browser TEXT
    )`);
});

// 3. Multer 内存存储（直接转发给 R2，不占本地硬盘）
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

// 4. 签到 API
app.post('/api/checkin', upload.single('photo'), async (req, res) => {
    try {
        const { user_name, lat, lng, os, browser, checkin_time } = req.body;
        const fileName = `mando_${Date.now()}.jpg`;

        // 上传到 R2
        await r2.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: fileName,
            Body: req.file.buffer,
            ContentType: 'image/jpeg',
        }));

        const photo_url = `${process.env.R2_PUBLIC_URL}/${fileName}`;

        // 存入数据库
        const sql = `INSERT INTO checkin_logs 
                     (user_name, photo_url, latitude, longitude, device_os, browser, checkin_time) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;
        
        // 使用这种方式可以捕获 SQL 内部错误
        db.run(sql, [user_name, photo_url, lat, lng, os, browser, checkin_time], function(err) {
            if (err) {
                console.error("数据库写入错误:", err.message);
                return res.status(500).json({ error: 'Database Write Failed' });
            }
            console.log(`[签到成功] 用户: ${user_name}, ID: ${this.lastID}`);
            res.json({ message: 'success', id: this.lastID, url: photo_url });
        });
    } catch (error) {
        // 捕获网络、R2上传等所有其他错误，防止进程崩溃
        console.error('系统逻辑错误:', error.message);
        res.status(500).json({ error: 'Server Internal Error' });
    }
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`M&O Backend with R2 running at http://127.0.0.1:${PORT}`);
});