const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('테이블 목록 조회 중...');

db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    if (err) {
        console.error('오류 발생:', err);
        return;
    }
    console.log('발견된 테이블:', tables);
    db.close();
});
