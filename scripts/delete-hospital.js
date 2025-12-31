const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/inventory.db');

// 1. 현재 상태 확인
db.all("SELECT * FROM hospitals WHERE name LIKE '%좋은삼%'", (err, rows) => {
    console.log('현재 좋은삼 관련 병원:');
    console.log(JSON.stringify(rows, null, 2));

    // 2. "좋은삼선", "좋은삼점" 삭제 (잘못된 명칭)
    db.run("DELETE FROM hospitals WHERE name IN ('좋은삼선', '좋은삼점')", function (err) {
        if (err) {
            console.log('삭제 오류:', err.message);
        } else {
            console.log('삭제된 행:', this.changes);
        }

        // 3. 삭제 후 확인
        db.all("SELECT * FROM hospitals WHERE name LIKE '%좋은삼%'", (err, rows) => {
            console.log('삭제 후 좋은삼 관련 병원:');
            console.log(JSON.stringify(rows, null, 2));
            db.close();
        });
    });
});
