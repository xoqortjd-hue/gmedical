/**
 * 모바일 UI 사진 기능 마이그레이션
 * lending_items 테이블에 photo_url, photo_uploaded_by, photo_uploaded_at 컬럼 추가
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/inventory.db');

console.log('🔄 사진 기능 마이그레이션 시작...');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 데이터베이스 연결 실패:', err.message);
        process.exit(1);
    }
    console.log('✅ 데이터베이스 연결 성공');
});

db.serialize(() => {
    // photo_url 컬럼 추가
    db.run(`ALTER TABLE lending_items ADD COLUMN photo_url TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ photo_url 컬럼 추가 실패:', err.message);
        } else {
            console.log('✅ lending_items 테이블에 photo_url 컬럼 추가');
        }
    });

    // photo_uploaded_by 컬럼 추가
    db.run(`ALTER TABLE lending_items ADD COLUMN photo_uploaded_by TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ photo_uploaded_by 컬럼 추가 실패:', err.message);
        } else {
            console.log('✅ lending_items 테이블에 photo_uploaded_by 컬럼 추가');
        }
    });

    // photo_uploaded_at 컬럼 추가
    db.run(`ALTER TABLE lending_items ADD COLUMN photo_uploaded_at DATETIME`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ photo_uploaded_at 컬럼 추가 실패:', err.message);
        } else {
            console.log('✅ lending_items 테이블에 photo_uploaded_at 컬럼 추가');
        }

        // 마이그레이션 완료 후 연결 종료
        db.close((err) => {
            if (err) {
                console.error('❌ 데이터베이스 종료 실패:', err.message);
            } else {
                console.log('🎉 사진 기능 마이그레이션 완료!');
            }
        });
    });
});
