/**
 * 마이그레이션: lending_item_photos 의 base64 데이터를 파일시스템으로 분리.
 *
 * 변경 내용:
 *   1. lending_item_photos 에 archived_at, permanent_keep 컬럼 추가
 *   2. photo_url 의 "data:image/..;base64,..." 값을
 *      ./uploads/photos/{lending_item_id}/{photo_id}.{ext} 파일로 추출
 *   3. photo_url 을 "/uploads/photos/{lending_item_id}/{photo_id}.{ext}" 경로로 갱신
 *   4. lending_items.photo_url 도 동일 처리 (호환 컬럼)
 *   5. VACUUM 으로 빈 공간 회수 (DB 사이즈 축소)
 *
 * 안전장치:
 *   - 이미 파일 경로(/uploads/...)인 행은 건너뜀 (재실행 안전)
 *   - 파일 쓰기 → 검증 → DB 갱신 순서 (롤백 가능)
 *   - 중간 실패 시 이미 분리된 행은 그대로, 미분리 행만 다음 실행에서 처리
 *
 * 실행:
 *   node scripts/migrate-photos-to-fs.js              # 실제 실행
 *   node scripts/migrate-photos-to-fs.js --dry-run    # 변경 없이 통계만
 *   node scripts/migrate-photos-to-fs.js --no-vacuum  # VACUUM 생략
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DRY_RUN = process.argv.includes('--dry-run');
const NO_VACUUM = process.argv.includes('--no-vacuum');

const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'database', 'inventory.db');
const UPLOADS_DIR = path.join(ROOT, 'uploads', 'photos');

if (!fs.existsSync(DB_PATH)) {
    console.error(`[ERROR] DB not found: ${DB_PATH}`);
    process.exit(1);
}

if (!DRY_RUN) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const MIME_EXT = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
};

function parseDataUri(dataUri) {
    if (typeof dataUri !== 'string' || !dataUri.startsWith('data:')) return null;
    const m = dataUri.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
    if (!m) return null;
    const mime = m[1].toLowerCase();
    const base64 = !!m[2];
    const data = m[3];
    if (!base64) return null;
    return { mime, ext: MIME_EXT[mime] || 'bin', buf: Buffer.from(data, 'base64') };
}

function ensureColumns(db) {
    return new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(lending_item_photos)", (err, cols) => {
            if (err) return reject(err);
            const names = new Set(cols.map(c => c.name));
            const stmts = [];
            if (!names.has('archived_at')) {
                stmts.push("ALTER TABLE lending_item_photos ADD COLUMN archived_at DATETIME");
            }
            if (!names.has('permanent_keep')) {
                stmts.push("ALTER TABLE lending_item_photos ADD COLUMN permanent_keep INTEGER NOT NULL DEFAULT 0");
            }
            if (!stmts.length) return resolve({ added: [] });
            if (DRY_RUN) {
                console.log('[DRY-RUN] would run:', stmts);
                return resolve({ added: stmts });
            }
            db.serialize(() => {
                stmts.forEach(s => db.run(s));
                db.run('SELECT 1', (e) => e ? reject(e) : resolve({ added: stmts }));
            });
        });
    });
}

function listPhotos(db) {
    return new Promise((resolve, reject) => {
        db.all(
            "SELECT id, lending_item_id, photo_url FROM lending_item_photos ORDER BY id",
            (err, rows) => err ? reject(err) : resolve(rows)
        );
    });
}

function listItemPhotos(db) {
    return new Promise((resolve, reject) => {
        db.all(
            "SELECT id, photo_url FROM lending_items WHERE photo_url IS NOT NULL AND photo_url != ''",
            (err, rows) => err ? reject(err) : resolve(rows)
        );
    });
}

function updatePhotoUrl(db, table, id, newUrl) {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE ${table} SET photo_url = ? WHERE id = ?`, [newUrl, id], function (e) {
            if (e) return reject(e);
            resolve(this.changes);
        });
    });
}

async function migrateRows(db, rows, table, idCol, dirCol) {
    let extracted = 0;
    let skipped = 0;
    let bytesBefore = 0;
    let bytesAfter = 0;
    const failures = [];

    for (const row of rows) {
        const url = row.photo_url || '';
        bytesBefore += url.length;

        if (!url.startsWith('data:')) {
            skipped++;
            bytesAfter += url.length;
            continue;
        }

        const parsed = parseDataUri(url);
        if (!parsed) {
            failures.push({ id: row.id, reason: 'parse_failed' });
            bytesAfter += url.length;
            continue;
        }

        const dirId = row[dirCol] != null ? row[dirCol] : 'misc';
        const itemDir = path.join(UPLOADS_DIR, String(dirId));
        const fileName = `${table}_${row.id}.${parsed.ext}`;
        const filePath = path.join(itemDir, fileName);
        const publicUrl = `/uploads/photos/${dirId}/${fileName}`;

        if (DRY_RUN) {
            extracted++;
            bytesAfter += publicUrl.length;
            continue;
        }

        try {
            fs.mkdirSync(itemDir, { recursive: true });
            fs.writeFileSync(filePath, parsed.buf);
            const stat = fs.statSync(filePath);
            if (stat.size !== parsed.buf.length) {
                throw new Error(`size mismatch: wrote ${parsed.buf.length}, file ${stat.size}`);
            }
            await updatePhotoUrl(db, table, row.id, publicUrl);
            extracted++;
            bytesAfter += publicUrl.length;
            if (extracted % 20 === 0) {
                console.log(`  [${table}] ${extracted} rows extracted...`);
            }
        } catch (e) {
            failures.push({ id: row.id, reason: e.message });
            try { fs.unlinkSync(filePath); } catch {}
            bytesAfter += url.length;
        }
    }

    return { extracted, skipped, bytesBefore, bytesAfter, failures };
}

function vacuum(db) {
    return new Promise((resolve, reject) => {
        if (NO_VACUUM || DRY_RUN) return resolve(false);
        console.log('[VACUUM] running...');
        db.run('VACUUM', (e) => e ? reject(e) : resolve(true));
    });
}

function dbSize() {
    try { return fs.statSync(DB_PATH).size; } catch { return 0; }
}

(async () => {
    console.log(DRY_RUN ? '=== DRY RUN ===' : '=== MIGRATE photos -> filesystem ===');
    console.log(`DB:       ${DB_PATH}`);
    console.log(`UPLOADS:  ${UPLOADS_DIR}`);
    const sizeBefore = dbSize();
    console.log(`DB size:  ${(sizeBefore / 1024 / 1024).toFixed(1)} MB`);

    const db = new sqlite3.Database(DB_PATH);

    try {
        const colResult = await ensureColumns(db);
        if (colResult.added.length) {
            console.log('[SCHEMA] added:', colResult.added);
        } else {
            console.log('[SCHEMA] columns already present');
        }

        const photos = await listPhotos(db);
        console.log(`\n[lending_item_photos] ${photos.length} rows`);
        const r1 = await migrateRows(db, photos, 'lending_item_photos', 'id', 'lending_item_id');
        console.log(
            `  extracted=${r1.extracted} skipped=${r1.skipped} ` +
            `bytesBefore=${(r1.bytesBefore / 1024 / 1024).toFixed(1)}MB ` +
            `bytesAfter=${(r1.bytesAfter / 1024).toFixed(1)}KB ` +
            `failures=${r1.failures.length}`
        );
        if (r1.failures.length) console.log('  failures sample:', r1.failures.slice(0, 5));

        const items = await listItemPhotos(db);
        console.log(`\n[lending_items] ${items.length} rows with photo_url`);
        const r2 = await migrateRows(db, items, 'lending_items', 'id', 'id');
        console.log(
            `  extracted=${r2.extracted} skipped=${r2.skipped} ` +
            `bytesBefore=${(r2.bytesBefore / 1024 / 1024).toFixed(1)}MB ` +
            `bytesAfter=${(r2.bytesAfter / 1024).toFixed(1)}KB ` +
            `failures=${r2.failures.length}`
        );

        if (!DRY_RUN) {
            await vacuum(db);
        }

        const sizeAfter = dbSize();
        console.log(`\n=== RESULT ===`);
        console.log(`DB size: ${(sizeBefore / 1024 / 1024).toFixed(1)}MB -> ${(sizeAfter / 1024 / 1024).toFixed(1)}MB`);
        console.log(`Saved:   ${((sizeBefore - sizeAfter) / 1024 / 1024).toFixed(1)}MB`);

        const totalFail = r1.failures.length + r2.failures.length;
        if (totalFail) {
            console.log(`[WARN] ${totalFail} rows failed - rerun to retry`);
            process.exitCode = 2;
        }
    } catch (e) {
        console.error('[FATAL]', e);
        process.exitCode = 1;
    } finally {
        db.close();
    }
})();
