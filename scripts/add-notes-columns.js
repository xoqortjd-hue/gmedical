const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 products 테이블에 notes, repair_history 컬럼 추가 중...');

db.serialize(() => {
    // notes 컬럼 추가
    db.run(`ALTER TABLE products ADD COLUMN notes TEXT`, (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('✅ notes 컬럼이 이미 존재합니다');
            } else {
                console.error('❌ notes 컬럼 추가 실패:', err.message);
            }
        } else {
            console.log('✅ notes 컬럼 추가 완료');
        }
    });

    // repair_history 컬럼 추가
    db.run(`ALTER TABLE products ADD COLUMN repair_history TEXT`, (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('✅ repair_history 컬럼이 이미 존재합니다');
            } else {
                console.error('❌ repair_history 컬럼 추가 실패:', err.message);
            }
        } else {
            console.log('✅ repair_history 컬럼 추가 완료');
        }
    });
});

db.close((err) => {
    if (err) {
        console.error('❌ DB 연결 종료 실패:', err.message);
    } else {
        console.log('✅ 마이그레이션 완료');
    }
});
