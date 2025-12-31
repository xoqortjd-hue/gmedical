/**
 * 사진 이력 테이블 마이그레이션
 * lending_item_photos 테이블 생성 (최근 3장 유지)
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/inventory.db');

console.log('🔄 사진 이력 테이블 마이그레이션 시작...');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 데이터베이스 연결 실패:', err.message);
        process.exit(1);
    }
    console.log('✅ 데이터베이스 연결 성공');
});

db.serialize(() => {
    // lending_item_photos 테이블 생성
    db.run(`
        CREATE TABLE IF NOT EXISTS lending_item_photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lending_item_id INTEGER NOT NULL,
            photo_url TEXT NOT NULL,
            uploaded_by TEXT,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (lending_item_id) REFERENCES lending_items(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) {
            console.error('❌ 테이블 생성 실패:', err.message);
        } else {
            console.log('✅ lending_item_photos 테이블 생성 완료');
        }
    });

    // 인덱스 생성 (조회 성능 향상)
    db.run(`
        CREATE INDEX IF NOT EXISTS idx_lending_item_photos_item_id 
        ON lending_item_photos(lending_item_id, uploaded_at DESC)
    `, (err) => {
        if (err && !err.message.includes('already exists')) {
            console.error('❌ 인덱스 생성 실패:', err.message);
        } else {
            console.log('✅ 인덱스 생성 완료');
        }
    });

    // 기존 photo_url 데이터가 있으면 새 테이블로 마이그레이션
    db.all(`
        SELECT id, photo_url, photo_uploaded_by, photo_uploaded_at 
        FROM lending_items 
        WHERE photo_url IS NOT NULL AND photo_url != ''
    `, [], (err, rows) => {
        if (err) {
            console.error('❌ 기존 데이터 조회 실패:', err.message);
            return;
        }

        if (rows && rows.length > 0) {
            console.log(`📦 기존 사진 ${rows.length}개 마이그레이션 중...`);

            const stmt = db.prepare(`
                INSERT INTO lending_item_photos (lending_item_id, photo_url, uploaded_by, uploaded_at)
                VALUES (?, ?, ?, ?)
            `);

            rows.forEach(row => {
                stmt.run(row.id, row.photo_url, row.photo_uploaded_by, row.photo_uploaded_at);
            });

            stmt.finalize(() => {
                console.log(`✅ 기존 사진 ${rows.length}개 마이그레이션 완료`);
                closeDb();
            });
        } else {
            console.log('ℹ️ 마이그레이션할 기존 사진이 없습니다');
            closeDb();
        }
    });
});

function closeDb() {
    db.close((err) => {
        if (err) {
            console.error('❌ 데이터베이스 종료 실패:', err.message);
        } else {
            console.log('🎉 사진 이력 마이그레이션 완료!');
        }
    });
}
