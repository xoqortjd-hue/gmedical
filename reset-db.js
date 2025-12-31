// 데이터베이스 완전 초기화 스크립트
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('데이터베이스 완전 초기화 시작...\n');

// 순차적으로 실행
db.run('DELETE FROM transactions', function (err) {
    if (err) console.log('transactions:', err.message);
    else console.log(`✅ transactions 삭제: ${this.changes}건`);

    db.run('DELETE FROM products', function (err) {
        if (err) console.log('products:', err.message);
        else console.log(`✅ products 삭제: ${this.changes}건`);

        db.run('DELETE FROM lending_items', function (err) {
            console.log(`✅ lending_items 삭제: ${this.changes || 0}건`);

            db.run('DELETE FROM lending_history', function (err) {
                console.log(`✅ lending_history 삭제: ${this.changes || 0}건`);

                // 확인
                db.get('SELECT COUNT(*) as cnt FROM products', (err, row) => {
                    console.log(`\n📊 남은 제품 수: ${row ? row.cnt : 0}`);

                    db.get('SELECT COUNT(*) as cnt FROM transactions', (err, row) => {
                        console.log(`📊 남은 거래 수: ${row ? row.cnt : 0}`);
                        console.log('\n🎉 초기화 완료!');
                        db.close();
                    });
                });
            });
        });
    });
});
