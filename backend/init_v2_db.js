// backend/init_v2_db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'mando.db'));

db.serialize(() => {
    // 1. 角色表
    db.run(`CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_name TEXT NOT NULL,
        role_key TEXT UNIQUE NOT NULL
    )`);

    // 2. 公司/供应商表
    db.run(`CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
    )`);

    // 3. 用户表
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        real_name TEXT,
        role_id INTEGER,
        company_id INTEGER,
        FOREIGN KEY(role_id) REFERENCES roles(id),
        FOREIGN KEY(company_id) REFERENCES companies(id)
    )`);

    // 插入初始化数据
    const roles = [
        ['系统管理员', 'ADMIN'],
        ['运行主管', 'SUPERVISOR'],
        ['厂商人员', 'VENDOR']
    ];
    roles.forEach(r => db.run(`INSERT OR IGNORE INTO roles (role_name, role_key) VALUES (?, ?)`, r));

    db.run(`INSERT OR IGNORE INTO companies (name) VALUES ('业主方-中国人寿')`);

    // 预置初始账号: admin / admin123
    // 注意：实际生产应加密，此处先对齐逻辑
    db.run(`INSERT OR IGNORE INTO users (username, password, real_name, role_id, company_id) 
            VALUES ('admin', 'admin123', '张三(管理员)', 1, 1)`);

    console.log("3NF 数据库初始化完成！");
});