const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'mando.db'));

console.log("\n[ M&O 系统数据库全量数据核查 ]");
console.log("==================================================================================");

db.serialize(() => {
    // 1. 账号管理 (包含手机号字段)
    const userSql = `
        SELECT 
            u.id, 
            u.real_name as "姓名", 
            u.phone as "手机号",
            u.username as "账号", 
            u.password as "密码", 
            c.name as "所属单位", 
            r.role_name as "角色"
        FROM users u
        LEFT JOIN companies c ON u.company_id = c.id
        LEFT JOIN roles r ON u.role_id = r.id
    `;
    db.all(userSql, [], (err, rows) => {
        console.log("\n1. 账号管理 (Users)");
        if (err) console.error("查询失败:", err.message);
        else console.table(rows);
    });

    // 2. 单位管理
    db.all("SELECT id, name as '单位名称' FROM companies", [], (err, rows) => {
        console.log("\n2. 单位管理 (Companies)");
        if (err) console.error("查询失败:", err.message);
        else console.table(rows);
    });

    // 3. 角色管理
    db.all("SELECT id, role_name as '角色名称', role_key as 'Key' FROM roles", [], (err, rows) => {
        console.log("\n3. 角色管理 (Roles)");
        if (err) console.error("查询失败:", err.message);
        else console.table(rows);
    });

    // 4. 登录日志 (新增：含自拍、位置、探针数据)
    const logSql = `
        SELECT 
            id, 
            real_name as "人员", 
            login_time as "时间", 
            status as "状态",
            location as "地理位置",
            photo_url as "R2照片地址",
            ip_address as "IP"
        FROM login_logs 
        ORDER BY login_time DESC
    `;
    db.all(logSql, [], (err, rows) => {
        console.log("\n4. 登录日志 (Login Logs)");
        if (err) {
            console.error("查询失败（可能表尚未创建）:", err.message);
        } else {
            console.table(rows);
            console.log(`注：当前日志总数 ${rows.length} 条，探针阈值 10,000 条。`);
        }
        
        // 完成所有查询后关闭连接
        db.close();
        console.log("\n======================== 检查完成 ========================");
    });
});