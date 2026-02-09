const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'mando.db'));

db.serialize(() => {
    // 1. 确保基础数据存在
    db.run("INSERT OR IGNORE INTO roles (id, role_name, role_key) VALUES (1, '系统管理员', 'ADMIN')");
    db.run("INSERT OR IGNORE INTO companies (id, name) VALUES (1, '系统管理单位')");
    
    // 2. 强制将 admin 关联到管理员角色
    db.run("UPDATE users SET role_id = 1, company_id = 1 WHERE username = 'admin'", (err) => {
        if (err) console.error("更新失败:", err);
    });

    // 3. 打印最终状态核对
    const sql = `
        SELECT u.username, r.role_key, c.name as company 
        FROM users u 
        JOIN roles r ON u.role_id = r.id 
        JOIN companies c ON u.company_id = c.id 
        WHERE u.username = 'admin'
    `;
    db.get(sql, [], (err, row) => {
        console.log("--- 数据库当前 Admin 状态 ---");
        console.log(row);
        console.log("----------------------------");
        db.close();
    });
});