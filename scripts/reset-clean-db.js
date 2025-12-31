const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// 데이터베이스 파일 경로
const dbPath = path.join(__dirname, '../database/inventory.db');
const schemaPath = path.join(__dirname, '../database/schema.sql');

// 데이터베이스 초기화 함수 (샘플 데이터 없이)
function resetCleanDatabase() {
    console.log('🔄 데이터베이스 초기화 시작...');
    console.log('📁 데이터베이스 경로:', dbPath);

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

        // 데이터베이스 연결 종료
        db.close((err) => {
            if (err) {
                console.error('❌ 데이터베이스 종료 실패:', err.message);
                return;
            }
            console.log('🎉 데이터베이스 초기화 완료!');
            console.log('📝 깨끗한 상태 (샘플 데이터 없음)');
            console.log(`📁 데이터베이스 위치: ${dbPath}`);
            console.log('');
            console.log('💡 서버를 재시작하면 변경사항이 적용됩니다.');
        });
    });
}

// 스크립트 실행
if (require.main === module) {
    resetCleanDatabase();
}

module.exports = { resetCleanDatabase };
