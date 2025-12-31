const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('=== 제품 조회 테스트 ===\n');

// 모든 제품 조회
db.all('SELECT * FROM products', [], (err, rows) => {
    if (err) {
        console.error('에러:', err);
        return;
    }

    console.log(`총 ${rows.length}개 제품 등록됨:\n`);
    rows.forEach(row => {
        console.log(`ID: ${row.id}`);
        console.log(`제품명: ${row.name}`);
        console.log(`바코드: ${row.barcode}`);
        console.log(`카테고리: ${row.category}`);
        console.log('---');
    });

    // 특정 바코드 조회
    const testBarcode = '990172615473';
    console.log(`\n바코드 ${testBarcode} 조회:`);

    db.get('SELECT * FROM products WHERE barcode = ?', [testBarcode], (err, row) => {
        if (err) {
            console.error('에러:', err);
        } else if (row) {
            console.log('✅ 제품 찾음:', row);
        } else {
            console.log('❌ 제품 없음');
        }

        db.close();
    });
});
