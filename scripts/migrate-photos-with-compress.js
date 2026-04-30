/**
 * AWS 디스크 빠듯할 때용 — 추출과 함께 sharp 로 1280px·q70 JPEG 재압축.
 *
 * 일반 migrate-photos-to-fs.js 와 차이:
 *   - sharp 로 즉시 압축 → 파일 크기 5MB → ~150KB (97% 감소)
 *   - 디스크 거의 안 늘어남
 *   - 한 장씩 처리 + 즉시 UPDATE (멈춰도 다음 실행에서 이어서)
 *   - 배치마다 PRAGMA wal_checkpoint, 마지막에 VACUUM
 *
 * 실행:
 *   npm install sharp --no-save  # 한 번
 *   node scripts/migrate-photos-with-compress.js
 *   node scripts/migrate-photos-with-compress.js --no-vacuum
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const sharp = require('sharp');

const NO_VACUUM = process.argv.includes('--no-vacuum');
const MAX_SIDE = 1280;
const JPEG_QUALITY = 70;

const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'database', 'inventory.db');
const UPLOADS_DIR = path.join(ROOT, 'uploads', 'photos');

if (!fs.existsSync(DB_PATH)) {
    console.error(`[ERROR] DB not found: ${DB_PATH}`);
    process.exit(1);
}
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function ensureColumns(db) {
    return new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(lending_item_photos)", (err, cols) => {
            if (err) return reject(err);
            const names = new Set(cols.map(c => c.name));
            const stmts = [];
            if (!names.has('archived_at')) stmts.push("ALTER TABLE lending_item_photos ADD COLUMN archived_at DATETIME");
            if (!names.has('permanent_keep')) stmts.push("ALTER TABLE lending_item_photos ADD COLUMN permanent_keep INTEGER NOT NULL DEFAULT 0");
            if (!stmts.length) return resolve([]);
            db.serialize(() => {
                stmts.forEach(s => db.run(s));
                db.run('SELECT 1', (e) => e ? reject(e) : resolve(stmts));
            });
        });
    });
}

function parseDataUri(s) {
    if (typeof s !== 'string' || !s.startsWith('data:')) return null;
    const m = s.match(/^data:([^;,]+);base64,(.*)$/s);
    if (!m) return null;
    return { mime: m[1].toLowerCase(), buf: Buffer.from(m[2], 'base64') };
}

function listRows(db, sql) {
    return new Promise((resolve, reject) => {
        db.all(sql, (e, r) => e ? reject(e) : resolve(r));
    });
}

function runSql(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (e) { e ? reject(e) : resolve(this.changes); });
    });
}

async function compressBuffer(buf) {
    const meta = await sharp(buf).rotate().metadata();
    const longSide = Math.max(meta.width || 0, meta.height || 0);
    const pipeline = sharp(buf).rotate();
    if (longSide > MAX_SIDE) {
        pipeline.resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true });
    }
    return await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
}

async function migrateTable(db, table, idCol, dirCol) {
    const rows = await listRows(
        db,
        `SELECT id, ${dirCol} AS dir, photo_url FROM ${table}
          WHERE photo_url LIKE 'data:%'
          ORDER BY id`
    );
    console.log(`\n[${table}] ${rows.length} base64 rows`);

    let extracted = 0;
    let bytesIn = 0;
    let bytesOut = 0;
    const failures = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const parsed = parseDataUri(row.photo_url);
        if (!parsed) {
            failures.push({ id: row.id, reason: 'parse_failed' });
            continue;
        }
        bytesIn += parsed.buf.length;

        const dirId = row.dir != null ? row.dir : 'misc';
        const itemDir = path.join(UPLOADS_DIR, String(dirId));
        const fileName = `${table}_${row.id}.jpg`;
        const filePath = path.join(itemDir, fileName);
        const publicUrl = `/uploads/photos/${dirId}/${fileName}`;

        try {
            const compressed = await compressBuffer(parsed.buf);
            fs.mkdirSync(itemDir, { recursive: true });
            fs.writeFileSync(filePath, compressed);
            bytesOut += compressed.length;
            await runSql(db, `UPDATE ${table} SET photo_url = ? WHERE id = ?`, [publicUrl, row.id]);
            extracted++;
            if (extracted % 20 === 0) {
                process.stdout.write(`  ..${extracted}/${rows.length}  in=${(bytesIn / 1024 / 1024).toFixed(0)}MB out=${(bytesOut / 1024 / 1024).toFixed(1)}MB\n`);
            }
        } catch (e) {
            failures.push({ id: row.id, reason: e.message });
            try { fs.unlinkSync(filePath); } catch {}
        }
    }

    return { extracted, total: rows.length, bytesIn, bytesOut, failures };
}

function dbSize() {
    try { return fs.statSync(DB_PATH).size; } catch { return 0; }
}

(async () => {
    console.log('=== migrate photos (compress + extract) ===');
    const sizeBefore = dbSize();
    console.log(`DB before: ${(sizeBefore / 1024 / 1024).toFixed(1)} MB`);

    const db = new sqlite3.Database(DB_PATH);
    try {
        const added = await ensureColumns(db);
        if (added.length) console.log('[SCHEMA] added:', added);

        const r1 = await migrateTable(db, 'lending_item_photos', 'id', 'lending_item_id');
        console.log(
            `[lending_item_photos] extracted=${r1.extracted}/${r1.total} ` +
            `in=${(r1.bytesIn / 1024 / 1024).toFixed(1)}MB ` +
            `out=${(r1.bytesOut / 1024 / 1024).toFixed(1)}MB ` +
            `failed=${r1.failures.length}`
        );
        if (r1.failures.length) console.log('  failures:', r1.failures.slice(0, 5));

        const r2 = await migrateTable(db, 'lending_items', 'id', 'id');
        console.log(
            `[lending_items] extracted=${r2.extracted}/${r2.total} ` +
            `in=${(r2.bytesIn / 1024 / 1024).toFixed(1)}MB ` +
            `out=${(r2.bytesOut / 1024 / 1024).toFixed(1)}MB ` +
            `failed=${r2.failures.length}`
        );

        if (!NO_VACUUM) {
            console.log('[VACUUM] running...');
            await runSql(db, 'VACUUM');
        }

        const sizeAfter = dbSize();
        console.log(`\nDB after: ${(sizeAfter / 1024 / 1024).toFixed(1)} MB (saved ${((sizeBefore - sizeAfter) / 1024 / 1024).toFixed(1)} MB)`);

        const totalFail = r1.failures.length + r2.failures.length;
        if (totalFail) process.exitCode = 2;
    } catch (e) {
        console.error('[FATAL]', e);
        process.exitCode = 1;
    } finally {
        db.close();
    }
})();
