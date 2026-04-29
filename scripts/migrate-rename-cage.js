/**
 * 마이그레이션: Lp케이지셋트 / LP케이지세트(서울) → 케이지기구세트 / 케이지기구세트(서울)
 *
 * 실행: node scripts/migrate-rename-cage.js
 * AWS:  ssh ubuntu@... && cd ~/medical-inventory-system && node scripts/migrate-rename-cage.js
 *
 * - LP25케디 는 변경하지 않음
 * - 인덱스(#1, #2, ...) 등 뒤에 붙는 부분은 그대로 유지
 * - 실행 전 자동 백업 생성
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'database', 'inventory.db');

if (!fs.existsSync(DB_PATH)) {
    console.error(`[ERROR] DB not found: ${DB_PATH}`);
    process.exit(1);
}

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const BACKUP_PATH = path.join(__dirname, '..', 'database', `inventory.backup.${ts}.db`);
fs.copyFileSync(DB_PATH, BACKUP_PATH);
console.log(`[OK] backup -> ${BACKUP_PATH}`);

const db = new sqlite3.Database(DB_PATH);

const previewSql = `
    SELECT id, name FROM products
    WHERE name LIKE 'Lp케이지셋트%'
       OR name LIKE 'LP케이지셋트%'
       OR name LIKE 'LP케이지세트(서울)%'
       OR name LIKE 'Lp케이지세트(서울)%'
    ORDER BY id
`;

db.serialize(() => {
    db.all(previewSql, [], (err, rows) => {
        if (err) {
            console.error('[ERROR] preview:', err);
            db.close();
            process.exit(1);
        }
        if (!rows.length) {
            console.log('[INFO] 변경 대상 없음. 종료.');
            db.close();
            return;
        }
        console.log(`[INFO] 변경 대상 ${rows.length}건:`);
        rows.forEach(r => {
            const newName = r.name
                .replace(/^LP케이지세트\(서울\)/, '케이지기구세트(서울)')
                .replace(/^Lp케이지세트\(서울\)/, '케이지기구세트(서울)')
                .replace(/^Lp케이지셋트/, '케이지기구세트')
                .replace(/^LP케이지셋트/, '케이지기구세트');
            console.log(`  #${r.id}: "${r.name}" -> "${newName}"`);
        });

        db.run('BEGIN');
        // 서울 변형 먼저 (덜 일반적인 패턴부터)
        db.run(
            `UPDATE products SET name = REPLACE(name, 'LP케이지세트(서울)', '케이지기구세트(서울)')
             WHERE name LIKE 'LP케이지세트(서울)%'`,
            function (e) {
                if (e) return console.error('[ERR] LP서울:', e);
                console.log(`[OK] LP케이지세트(서울) -> 케이지기구세트(서울): ${this.changes}건`);
            }
        );
        db.run(
            `UPDATE products SET name = REPLACE(name, 'Lp케이지세트(서울)', '케이지기구세트(서울)')
             WHERE name LIKE 'Lp케이지세트(서울)%'`,
            function (e) {
                if (e) return console.error('[ERR] Lp서울:', e);
                console.log(`[OK] Lp케이지세트(서울) -> 케이지기구세트(서울): ${this.changes}건`);
            }
        );
        db.run(
            `UPDATE products SET name = REPLACE(name, 'Lp케이지셋트', '케이지기구세트')
             WHERE name LIKE 'Lp케이지셋트%'`,
            function (e) {
                if (e) return console.error('[ERR] Lp셋트:', e);
                console.log(`[OK] Lp케이지셋트 -> 케이지기구세트: ${this.changes}건`);
            }
        );
        db.run(
            `UPDATE products SET name = REPLACE(name, 'LP케이지셋트', '케이지기구세트')
             WHERE name LIKE 'LP케이지셋트%'`,
            function (e) {
                if (e) return console.error('[ERR] LP셋트:', e);
                console.log(`[OK] LP케이지셋트 -> 케이지기구세트: ${this.changes}건`);
            }
        );

        db.run('COMMIT', (e) => {
            if (e) {
                console.error('[ERR] COMMIT:', e);
                db.close();
                process.exit(1);
            }
            db.all(
                `SELECT id, name FROM products WHERE name LIKE '케이지기구세트%' ORDER BY id`,
                [],
                (e2, after) => {
                    if (e2) console.error('[ERR] verify:', e2);
                    else {
                        console.log(`\n[VERIFY] 변경 후 케이지기구세트 ${after.length}건:`);
                        after.forEach(r => console.log(`  #${r.id}: ${r.name}`));
                    }
                    db.close();
                }
            );
        });
    });
});
