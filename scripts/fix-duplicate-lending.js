/**
 * 중복 lending_items 정리 스크립트
 * 
 * 문제: 동일 product_id에 대해 부산사무실 + 다른 병원에 2개의 ACTIVE 레코드 존재
 * 해결: 각 product_id별로 부산사무실(id=2) 외의 병원에 배치된 경우,
 *       부산사무실 레코드를 'RETURNED'로 변경
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 중복 lending_items 검색 중...\n');

// 1. 중복 ACTIVE 레코드 확인
db.all(`
    SELECT 
        li.product_id,
        p.name as product_name,
        li.hospital_id,
        h.name as hospital_name,
        li.id as lending_item_id,
        li.status
    FROM lending_items li
    JOIN products p ON li.product_id = p.id
    JOIN hospitals h ON li.hospital_id = h.id
    WHERE li.status = 'ACTIVE'
    AND li.product_id IN (
        SELECT product_id FROM lending_items 
        WHERE status = 'ACTIVE' 
        GROUP BY product_id HAVING COUNT(*) > 1
    )
    ORDER BY li.product_id, li.hospital_id
`, [], (err, rows) => {
    if (err) {
        console.error('조회 실패:', err);
        db.close();
        return;
    }

    if (rows.length === 0) {
        console.log('✅ 중복 레코드가 없습니다.');
        db.close();
        return;
    }

    console.log(`⚠️ 중복 레코드 ${rows.length}개 발견:\n`);

    // 제품별로 그룹화
    const productGroups = {};
    rows.forEach(row => {
        if (!productGroups[row.product_id]) {
            productGroups[row.product_id] = {
                name: row.product_name,
                items: []
            };
        }
        productGroups[row.product_id].items.push(row);
    });

    // 각 제품 출력
    Object.keys(productGroups).forEach(productId => {
        const group = productGroups[productId];
        console.log(`📦 ${group.name} (product_id: ${productId})`);
        group.items.forEach(item => {
            const isOffice = item.hospital_name.includes('사무실') || item.hospital_name.includes('본사');
            console.log(`   - ${item.hospital_name} (lending_id: ${item.lending_item_id}) ${isOffice ? '← 정리 대상' : ''}`);
        });
        console.log('');
    });

    // 2. 부산사무실(hospital_id=2) 레코드를 RETURNED로 변경
    console.log('\n🔧 중복 레코드 정리 중...');

    db.run(`
        UPDATE lending_items 
        SET status = 'RETURNED', 
            return_date = CURRENT_TIMESTAMP,
            notes = COALESCE(notes, '') || ' [자동정리: 병원 배치 중복]'
        WHERE status = 'ACTIVE'
        AND hospital_id = 2  -- 부산사무실
        AND product_id IN (
            SELECT product_id FROM lending_items 
            WHERE status = 'ACTIVE' 
            GROUP BY product_id HAVING COUNT(*) > 1
        )
    `, function (err) {
        if (err) {
            console.error('정리 실패:', err);
        } else {
            console.log(`✅ ${this.changes}개 중복 레코드 정리 완료`);
        }
        db.close();
    });
});
