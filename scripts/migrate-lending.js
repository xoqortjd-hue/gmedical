const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// 데이터베이스 파일 경로
const dbPath = path.join(__dirname, '../database/inventory.db');

console.log('🔄 랜딩 관리 시스템 마이그레이션 시작...');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 데이터베이스 연결 실패:', err.message);
        process.exit(1);
    }
    console.log('✅ 데이터베이스 연결 성공');
});

db.serialize(() => {
    // 1. products 테이블에 category 컬럼 추가
    db.run(`ALTER TABLE products ADD COLUMN category TEXT DEFAULT 'MEDICINE'`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ products 테이블 수정 실패:', err.message);
        } else {
            console.log('✅ products 테이블에 category 컬럼 추가');
        }
    });

    // 2. hospitals 테이블 생성
    db.run(`
        CREATE TABLE IF NOT EXISTS hospitals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT UNIQUE NOT NULL,
            address TEXT,
            contact_person TEXT,
            phone TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('❌ hospitals 테이블 생성 실패:', err.message);
        } else {
            console.log('✅ hospitals 테이블 생성 완료');
        }
    });

    // 3. lending_items 테이블 생성
    db.run(`
        CREATE TABLE IF NOT EXISTS lending_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            hospital_id INTEGER NOT NULL,
            serial_number TEXT,
            quantity INTEGER NOT NULL,
            expiration_date DATE,
            status TEXT DEFAULT 'ACTIVE',
            lending_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            return_date DATETIME,
            notes TEXT,
            FOREIGN KEY (product_id) REFERENCES products(id),
            FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
        )
    `, (err) => {
        if (err) {
            console.error('❌ lending_items 테이블 생성 실패:', err.message);
        } else {
            console.log('✅ lending_items 테이블 생성 완료');
        }
    });

    // 4. lending_movements 테이블 생성 (GPS 제외)
    db.run(`
        CREATE TABLE IF NOT EXISTS lending_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lending_item_id INTEGER NOT NULL,
            from_hospital_id INTEGER,
            to_hospital_id INTEGER,
            movement_type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            movement_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            moved_by TEXT,
            photo_url TEXT,
            notes TEXT,
            FOREIGN KEY (lending_item_id) REFERENCES lending_items(id),
            FOREIGN KEY (from_hospital_id) REFERENCES hospitals(id),
            FOREIGN KEY (to_hospital_id) REFERENCES hospitals(id)
        )
    `, (err) => {
        if (err) {
            console.error('❌ lending_movements 테이블 생성 실패:', err.message);
        } else {
            console.log('✅ lending_movements 테이블 생성 완료');
        }
    });

    // 5. 인덱스 생성
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_lending_items_product ON lending_items(product_id)',
        'CREATE INDEX IF NOT EXISTS idx_lending_items_hospital ON lending_items(hospital_id)',
        'CREATE INDEX IF NOT EXISTS idx_lending_items_status ON lending_items(status)',
        'CREATE INDEX IF NOT EXISTS idx_lending_movements_item ON lending_movements(lending_item_id)',
        'CREATE INDEX IF NOT EXISTS idx_lending_movements_date ON lending_movements(movement_date)'
    ];

    indexes.forEach((indexSql, i) => {
        db.run(indexSql, (err) => {
            if (err) {
                console.error(`❌ 인덱스 ${i + 1} 생성 실패:`, err.message);
            }
        });
    });
    console.log('✅ 인덱스 생성 완료');

    // 6. 샘플 데이터 삽입
    const sampleDataPath = path.join(__dirname, '../database/sample-lending-data.sql');
    if (fs.existsSync(sampleDataPath)) {
        const sampleData = fs.readFileSync(sampleDataPath, 'utf8');
        db.exec(sampleData, (err) => {
            if (err) {
                console.error('❌ 샘플 데이터 삽입 실패:', err.message);
            } else {
                console.log('✅ 샘플 데이터 삽입 완료');
            }
            
            // 데이터베이스 연결 종료
            db.close((err) => {
                if (err) {
                    console.error('❌ 데이터베이스 종료 실패:', err.message);
                } else {
                    console.log('🎉 마이그레이션 완료!');
                }
            });
        });
    } else {
        console.log('⚠️  샘플 데이터 파일 없음 - 스킵');
        db.close((err) => {
            if (err) {
                console.error('❌ 데이터베이스 종료 실패:', err.message);
            } else {
                console.log('🎉 마이그레이션 완료!');
            }
        });
    }
});
