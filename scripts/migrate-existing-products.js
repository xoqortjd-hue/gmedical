/**
 * 기존 products 테이블의 제품 중 lending_items에 없는 제품을
 * 부산사무실(hospital_id=2)에 초기 배치 레코드를 생성하는 마이그레이션 스크립트
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 기존 제품 lending_items 마이그레이션 시작...\n');

// lending_items에 없는 products 찾기
const findQuery = `
    SELECT p.id, p.name, p.barcode, p.category
    FROM products p
    LEFT JOIN lending_items li ON p.id = li.product_id
    WHERE li.id IS NULL
    ORDER BY p.created_at
`;

db.all(findQuery, [], (err, products) => {
    if (err) {
        console.error('❌ 조회 실패:', err.message);
        db.close();
        process.exit(1);
    }

    console.log(`📊 lending_items에 없는 제품 수: ${products.length}개\n`);

    if (products.length === 0) {
        console.log('✅ 마이그레이션 필요 없음 - 모든 제품이 이미 배치되어 있습니다.');
        db.close();
        process.exit(0);
    }

    let processed = 0;
    let errors = 0;

    db.serialize(() => {
        products.forEach((product, index) => {
            // lending_items 추가
            const lendingQuery = `
                INSERT INTO lending_items (product_id, hospital_id, quantity, status, notes)
                VALUES (?, 2, 1, 'ACTIVE', '마이그레이션 - 초기 등록')
            `;

            db.run(lendingQuery, [product.id], function (lendingErr) {
                if (lendingErr) {
                    console.error(`❌ [${product.name}] lending_items 추가 실패:`, lendingErr.message);
                    errors++;
                    checkComplete();
                    return;
                }

                const lendingItemId = this.lastID;

                // lending_movements 추가
                const movementQuery = `
                    INSERT INTO lending_movements (lending_item_id, to_hospital_id, movement_type, quantity, moved_by, notes)
                    VALUES (?, 2, 'DEPLOY', 1, 'Migration', '마이그레이션 스크립트에 의한 자동 배치')
                `;

                db.run(movementQuery, [lendingItemId], function (movementErr) {
                    if (movementErr) {
                        console.error(`❌ [${product.name}] movement 추가 실패:`, movementErr.message);
                        errors++;
                    } else {
                        console.log(`✅ [${index + 1}/${products.length}] ${product.name} (${product.barcode}) → 부산사무실에 배치됨`);
                        processed++;
                    }

                    checkComplete();
                });
            });
        });
    });

    function checkComplete() {
        if (processed + errors === products.length) {
            console.log('\n========================================');
            console.log(`📊 마이그레이션 완료`);
            console.log(`   ✅ 성공: ${processed}개`);
            console.log(`   ❌ 실패: ${errors}개`);
            console.log('========================================\n');
            db.close();
        }
    }
});
