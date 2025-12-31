/**
 * 중복 병원 데이터 정리 스크립트
 * 
 * 발견된 중복:
 * - 휴병원: ID 3, 4 → ID 3 유지
 * - 거제 대우병원: ID 20, 21 → ID 20 유지
 * - 거제대우: ID 22, 23 → ID 20으로 병합 (거제 대우병원과 동일)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/inventory.db');
const db = new sqlite3.Database(dbPath);

// 중복 정리 매핑: 삭제할 ID → 유지할 ID
const mergeMap = {
    4: 3,    // 휴병원 중복 → ID 3으로
    21: 20,  // 거제 대우병원 중복 → ID 20으로
    22: 20,  // 거제대우 → 거제 대우병원으로 통합
    23: 20   // 거제대우 중복 → 거제 대우병원으로 통합
};

const deleteIds = [4, 21, 22, 23];

console.log('🏥 중복 병원 데이터 정리 시작...\n');

db.serialize(() => {
    // 1. 현재 상태 확인
    console.log('📋 정리할 중복 병원 목록:');
    db.all('SELECT id, name FROM hospitals WHERE id IN (?, ?, ?, ?)', deleteIds, (err, rows) => {
        if (err) {
            console.error('조회 실패:', err.message);
            return;
        }
        rows.forEach(row => {
            console.log(`  - ID ${row.id}: "${row.name}" → ID ${mergeMap[row.id]}로 병합`);
        });
    });

    // 2. lending_items 테이블에서 hospital_id 업데이트
    console.log('\n🔄 lending_items 테이블 업데이트 중...');

    for (const [oldId, newId] of Object.entries(mergeMap)) {
        db.run(
            'UPDATE lending_items SET hospital_id = ? WHERE hospital_id = ?',
            [newId, oldId],
            function (err) {
                if (err) {
                    console.error(`  ❌ ID ${oldId} → ${newId} 업데이트 실패:`, err.message);
                } else if (this.changes > 0) {
                    console.log(`  ✅ lending_items: ${this.changes}개 레코드 업데이트 (ID ${oldId} → ${newId})`);
                }
            }
        );
    }

    // 3. lending_movements 테이블에서 from_hospital_id, to_hospital_id 업데이트
    console.log('\n🔄 lending_movements 테이블 업데이트 중...');

    for (const [oldId, newId] of Object.entries(mergeMap)) {
        db.run(
            'UPDATE lending_movements SET from_hospital_id = ? WHERE from_hospital_id = ?',
            [newId, oldId],
            function (err) {
                if (err) {
                    console.error(`  ❌ from_hospital_id ${oldId} → ${newId} 업데이트 실패:`, err.message);
                } else if (this.changes > 0) {
                    console.log(`  ✅ lending_movements (from): ${this.changes}개 레코드 업데이트`);
                }
            }
        );

        db.run(
            'UPDATE lending_movements SET to_hospital_id = ? WHERE to_hospital_id = ?',
            [newId, oldId],
            function (err) {
                if (err) {
                    console.error(`  ❌ to_hospital_id ${oldId} → ${newId} 업데이트 실패:`, err.message);
                } else if (this.changes > 0) {
                    console.log(`  ✅ lending_movements (to): ${this.changes}개 레코드 업데이트`);
                }
            }
        );
    }

    // 4. 중복 병원 레코드 삭제
    console.log('\n🗑️ 중복 병원 레코드 삭제 중...');

    db.run(
        `DELETE FROM hospitals WHERE id IN (${deleteIds.join(',')})`,
        function (err) {
            if (err) {
                console.error('❌ 병원 삭제 실패:', err.message);
            } else {
                console.log(`  ✅ ${this.changes}개 중복 병원 삭제 완료`);
            }
        }
    );

    // 5. 결과 확인
    setTimeout(() => {
        console.log('\n📊 정리 후 병원 목록:');
        db.all('SELECT id, name FROM hospitals ORDER BY name', [], (err, rows) => {
            if (err) {
                console.error('결과 조회 실패:', err.message);
            } else {
                rows.forEach(row => {
                    console.log(`  - ID ${row.id}: ${row.name}`);
                });
                console.log(`\n✅ 총 ${rows.length}개 병원 (중복 제거 완료)`);
            }

            db.close(() => {
                console.log('\n🏁 데이터베이스 연결 종료');
            });
        });
    }, 1000);
});
