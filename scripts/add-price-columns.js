const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('📦 lending_items 테이블에 가격 컬럼 추가 중...');

// Get current table info
db.all("PRAGMA table_info(lending_items)", [], (err, columns) => {
    if (err) {
        console.error('❌ 테이블 정보 조회 실패:', err.message);
        process.exit(1);
    }

    const columnNames = columns.map(col => col.name);
    const addColumn = (colName, colDef, description) => {
        return new Promise((resolve) => {
            if (columnNames.includes(colName)) {
                console.log(`ℹ️ ${colName} 컬럼이 이미 존재합니다`);
                resolve();
            } else {
                db.run(`ALTER TABLE lending_items ADD COLUMN ${colName} ${colDef}`, [], (err) => {
                    if (err) {
                        console.error(`❌ ${colName} 추가 실패:`, err.message);
                    } else {
                        console.log(`✅ ${colName} (${description}) 컬럼 추가 완료`);
                    }
                    resolve();
                });
            }
        });
    };

    Promise.all([
        addColumn('purchase_price', 'REAL DEFAULT 0', '매입가'),
        addColumn('selling_price', 'REAL DEFAULT 0', '판매가'),
        addColumn('channel_id', 'INTEGER', '창구')
    ]).then(() => {
        console.log('\n🎉 마이그레이션 완료!');

        // Show updated table structure
        db.all("PRAGMA table_info(lending_items)", [], (err, updatedColumns) => {
            console.log('\n📋 lending_items 테이블 구조:');
            updatedColumns.forEach(col => {
                console.log(`  - ${col.name} (${col.type || 'unknown'})`);
            });
            db.close();
        });
    });
});
