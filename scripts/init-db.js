const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// 데이터베이스 파일 경로
const dbPath = path.join(__dirname, '../database/inventory.db');
const schemaPath = path.join(__dirname, '../database/schema.sql');
const sampleDataPath = path.join(__dirname, '../database/sample_data.sql');

// 데이터베이스 초기화 함수
function initializeDatabase() {
    console.log('🔄 데이터베이스 초기화 시작...');

    // 기존 데이터베이스 파일 삭제 (새로 시작)
    if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        console.log('✅ 기존 데이터베이스 파일 삭제');
    }

    // 새 데이터베이스 생성
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('❌ 데이터베이스 생성 실패:', err.message);
            return;
        }
        console.log('✅ SQLite 데이터베이스 생성 완료');
    });

    // 스키마 실행
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema, (err) => {
        if (err) {
            console.error('❌ 스키마 생성 실패:', err.message);
            return;
        }
        console.log('✅ 데이터베이스 스키마 생성 완료');

        // 샘플 데이터 삽입
        const sampleData = fs.readFileSync(sampleDataPath, 'utf8');
        db.exec(sampleData, (err) => {
            if (err) {
                console.error('❌ 샘플 데이터 삽입 실패:', err.message);
                return;
            }
            console.log('✅ 샘플 데이터 삽입 완료');

            // 데이터베이스 연결 종료
            db.close((err) => {
                if (err) {
                    console.error('❌ 데이터베이스 종료 실패:', err.message);
                    return;
                }
                console.log('🎉 데이터베이스 초기화 완료!');
                console.log(`📁 데이터베이스 위치: ${dbPath}`);
            });
        });
    });
}

// 스크립트 실행
if (require.main === module) {
    initializeDatabase();
}

module.exports = { initializeDatabase };
