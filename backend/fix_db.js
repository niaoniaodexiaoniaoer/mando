const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'mando.db'));

db.serialize(() => {
    // 1. 修改单位名称为 system default
    db.run("UPDATE companies SET name = 'system default' WHERE id = 1", (err) => {
        if (err) console.error("修改单位失败:", err.message);
        else console.log("✅ 单位名称已成功修改为: system default");
    });

    // 2. 删除 roles 表中 ID 为 2 和 3 的记录
    db.run("DELETE FROM roles WHERE id IN (2, 3)", (err) => {
        if (err) console.error("删除角色失败:", err.message);
        else console.log("✅ 已成功删除角色记录 (ID 2, 3)");
    });

    // 3. 最后查询一下结果进行确认
    db.all("SELECT * FROM roles", (err, roles) => {
        console.log("\n当前角色表 (Roles):", roles);
    });
    db.all("SELECT * FROM companies", (err, cos) => {
        console.log("当前单位表 (Companies):", cos);
        db.close();
    });
});
