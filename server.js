const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// 미들웨어 설정
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));  // Base64 이미지 다중 업로드를 위해 50MB로 증가
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// 사진 정적 제공 (DB에서 분리된 사진 파일)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    maxAge: '7d',
    etag: true,
}));

// 정적 파일 제공 (클라이언트 빌드 파일)
app.use(express.static(path.join(__dirname, 'client/build')));

// 데이터베이스 연결
const dbPath = path.join(__dirname, 'database/inventory.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 데이터베이스 연결 실패:', err.message);
    } else {
        console.log('✅ SQLite 데이터베이스 연결 성공');
    }
});

// ===== 라우트 임포트 =====
const hospitalRoutes = require('./routes/hospital-routes');
const lendingRoutes = require('./routes/lending-routes');
// UDI 라우트는 로컬 전용 (AWS 미배포). 파일이 있으면 로딩, 없으면 무시.
let udiRoutes = null;
try { udiRoutes = require('./routes/udi-routes'); } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') throw e;
    console.log('[INFO] UDI routes not deployed (skipping)');
}

// ===== 라우트 미들웨어 =====
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/lending', lendingRoutes);
if (udiRoutes) app.use('/api/udi', udiRoutes);

// ===== 창구(채널) API =====
// 채널 테이블 초기화
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        code TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`INSERT OR IGNORE INTO channels (name, code) VALUES ('금양', 'GY')`);
    db.run(`INSERT OR IGNORE INTO channels (name, code) VALUES ('세종', 'SJ')`);
    db.run(`INSERT OR IGNORE INTO channels (name, code) VALUES ('참조은', 'CJE')`);
    db.run(`INSERT OR IGNORE INTO channels (name, code) VALUES ('온', 'ON')`);
    db.run(`INSERT OR IGNORE INTO channels (name, code) VALUES ('남경', 'NK')`);
});

// ===== 거래처(Customers) 테이블 초기화 =====
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT UNIQUE,
        type TEXT DEFAULT 'GENERAL',
        contact_person TEXT,
        phone TEXT,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS staff_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, function() {
        // 초기 담당자 데이터 삽입 (중복 무시)
        const staffList = ['박성현', '이호진', '하준혁', '정성엽', '이주호', '이정국', '오형준', '조용원', '하수천'];
        staffList.forEach(name => {
            db.run('INSERT OR IGNORE INTO staff_members (name) VALUES (?)', [name]);
        });
    });

    db.run(`CREATE TABLE IF NOT EXISTS repair_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lending_item_id INTEGER,
        product_name TEXT NOT NULL,
        status TEXT DEFAULT 'REQUESTED' CHECK(status IN ('REQUESTED','SENT','IN_REPAIR','RETURNED','COMPLETED')),
        repair_company TEXT,
        issue_description TEXT,
        requested_by TEXT,
        requested_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        sent_date DATETIME,
        returned_date DATETIME,
        completed_date DATETIME,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS repair_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repair_id INTEGER NOT NULL,
        status_change TEXT,
        note TEXT,
        photo_url TEXT,
        logged_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (repair_id) REFERENCES repair_records(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS report_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(period_start, period_end)
    )`);

    // 단톡방 대화 자동분석 → 검토 대기함(제안). 승인 후에만 실제 반영.
    // 설계: docs/superpowers/specs/2026-06-04-kakao-to-aws-inbox-design.md
    db.run(`CREATE TABLE IF NOT EXISTS chat_proposals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_room TEXT,
        message_date TEXT,
        raw_text TEXT,
        raw_hash TEXT UNIQUE,
        event_type TEXT CHECK(event_type IN ('REPAIR','MOVE','NOTE')),
        extracted_json TEXT,
        mapped_product_id INTEGER,
        mapped_hospital_id INTEGER,
        confidence REAL DEFAULT 0,
        status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPLIED','REJECTED')),
        applied_ref TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        applied_at DATETIME
    )`);

    // products 테이블에 ownership 컬럼 추가 (기존 테이블 마이그레이션)
    db.run(`ALTER TABLE products ADD COLUMN ownership TEXT DEFAULT 'OWN'`, (err) => {
        // 이미 컬럼이 있으면 에러 무시
    });
});

// ===== 장비 소유 구분 API =====
app.put('/api/products/:id/ownership', (req, res) => {
    const { ownership } = req.body;
    if (!['OWN', 'CONSIGNED'].includes(ownership)) {
        return res.status(400).json({ error: '유효하지 않은 구분입니다 (OWN 또는 CONSIGNED)' });
    }
    db.run('UPDATE products SET ownership = ? WHERE id = ?', [ownership, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ===== 담당자 API =====
app.get('/api/staff', (req, res) => {
    db.all('SELECT * FROM staff_members WHERE active = 1 ORDER BY name', [], (err, rows) => {
        if (err) {
            console.error('담당자 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/api/staff', (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: '담당자 이름은 필수입니다' });
    }
    db.run('INSERT OR IGNORE INTO staff_members (name) VALUES (?)', [name.trim()], function(err) {
        if (err) {
            console.error('담당자 추가 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, id: this.lastID, name: name.trim() });
    });
});

// ===== 수리 관리 API =====

// 수리 목록 조회
app.get('/api/repairs', (req, res) => {
    const { status } = req.query;
    let query = 'SELECT * FROM repair_records ORDER BY CASE status WHEN "IN_REPAIR" THEN 1 WHEN "SENT" THEN 2 WHEN "REQUESTED" THEN 3 WHEN "RETURNED" THEN 4 WHEN "COMPLETED" THEN 5 END, updated_at DESC';
    let params = [];
    if (status && status !== 'all') {
        query = 'SELECT * FROM repair_records WHERE status = ? ORDER BY updated_at DESC';
        params = [status];
    }
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 수리 현황 요약 (리포트용) - :id 라우트보다 먼저 선언 필요
app.get('/api/repairs/summary/active', (req, res) => {
    db.all('SELECT * FROM repair_records WHERE status NOT IN ("COMPLETED") ORDER BY requested_date ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 기간 내 수리 완료(전달완료) 내역 조회 (리포트 특이사항 자동입력용)
// completed_date 는 UTC(CURRENT_TIMESTAMP) 저장이므로 KST(+9h) 보정하여 날짜 비교
app.get('/api/repairs/summary/completed', (req, res) => {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
        return res.status(400).json({ error: 'start_date와 end_date는 필수입니다' });
    }
    db.all(
        `SELECT * FROM repair_records
         WHERE status = 'COMPLETED'
           AND completed_date IS NOT NULL
           AND date(completed_date, '+9 hours') BETWEEN date(?) AND date(?)
         ORDER BY completed_date ASC`,
        [start_date, end_date],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// ─────────────────────────────────────────────────────────────
// 단톡방 대화 검토 대기함 (chat_proposals)
// 분석기(클로드 코드 스케줄)가 후보를 등록하고, 사용자가 웹에서 승인하면 반영.
// 설계: docs/superpowers/specs/2026-06-04-kakao-to-aws-inbox-design.md
// ─────────────────────────────────────────────────────────────

// 후보 일괄 등록 (raw_hash 중복은 자동 무시)
app.post('/api/inbox/proposals', (req, res) => {
    const { proposals } = req.body;
    if (!Array.isArray(proposals) || proposals.length === 0) {
        return res.status(400).json({ error: 'proposals 배열은 필수입니다' });
    }
    const crypto = require('crypto');
    db.serialize(() => {
        const stmt = db.prepare(`INSERT OR IGNORE INTO chat_proposals
            (source_room, message_date, raw_text, raw_hash, event_type, extracted_json, mapped_product_id, mapped_hospital_id, confidence)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        let skipped = 0;
        proposals.forEach(p => {
            const type = ['REPAIR', 'MOVE', 'NOTE'].includes(p.event_type) ? p.event_type : null;
            if (!type) { skipped++; return; }
            const room = p.source_room || '';
            const date = p.message_date || '';
            const raw = p.raw_text || '';
            const hash = crypto.createHash('sha256').update(`${room}|${date}|${type}|${raw}`).digest('hex');
            stmt.run([room, date, raw, hash, type,
                JSON.stringify(p.extracted || {}),
                p.mapped_product_id || null, p.mapped_hospital_id || null,
                typeof p.confidence === 'number' ? p.confidence : 0]);
        });
        stmt.finalize((err) => {
            if (err) return res.status(500).json({ error: err.message });
            db.get(`SELECT COUNT(*) AS pending FROM chat_proposals WHERE status='PENDING'`, [], (e, row) => {
                res.json({ ok: true, received: proposals.length, skipped, pending: row ? row.pending : null });
            });
        });
    });
});

// 검토 대기함 목록 (제품·병원명 조인)
app.get('/api/inbox/proposals', (req, res) => {
    const status = req.query.status || 'PENDING';
    db.all(`
        SELECT cp.*, p.name AS mapped_product_name, h.name AS mapped_hospital_name
        FROM chat_proposals cp
        LEFT JOIN products p ON p.id = cp.mapped_product_id
        LEFT JOIN hospitals h ON h.id = cp.mapped_hospital_id
        WHERE cp.status = ?
        ORDER BY cp.message_date DESC, cp.id DESC
    `, [status], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// PENDING 개수 (네비 배지용)
app.get('/api/inbox/count', (req, res) => {
    db.get(`SELECT COUNT(*) AS pending FROM chat_proposals WHERE status='PENDING'`, [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ pending: row ? row.pending : 0 });
    });
});

// 제안 거부
app.patch('/api/inbox/proposals/:id/reject', (req, res) => {
    db.run(`UPDATE chat_proposals SET status='REJECTED' WHERE id=? AND status='PENDING'`, [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(409).json({ error: '이미 처리되었거나 없는 제안입니다' });
        res.json({ ok: true });
    });
});

// 제안 승인 → event_type별 실제 반영. 프론트가 교정한 권위값을 body로 받음.
app.patch('/api/inbox/proposals/:id/apply', (req, res) => {
    const id = req.params.id;
    db.get(`SELECT * FROM chat_proposals WHERE id=?`, [id], (err, prop) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!prop) return res.status(404).json({ error: '제안을 찾을 수 없습니다' });
        if (prop.status !== 'PENDING') return res.status(409).json({ error: '이미 처리된 제안입니다' });

        const type = req.body.event_type || prop.event_type;
        const markApplied = (ref) => {
            db.run(`UPDATE chat_proposals SET status='APPLIED', applied_ref=?, applied_at=CURRENT_TIMESTAMP,
                        mapped_product_id=COALESCE(?, mapped_product_id), mapped_hospital_id=COALESCE(?, mapped_hospital_id)
                    WHERE id=?`,
                [String(ref), req.body.mapped_product_id || null, req.body.mapped_hospital_id || null, id],
                function (uerr) {
                    if (uerr) return res.status(500).json({ error: uerr.message });
                    res.json({ ok: true, event_type: type, applied_ref: ref });
                });
        };

        if (type === 'REPAIR') {
            const { product_name, repair_company, issue_description, requested_by } = req.body;
            if (!product_name) return res.status(400).json({ error: '장비명(product_name)은 필수입니다' });
            db.run(`INSERT INTO repair_records (lending_item_id, product_name, status, repair_company, issue_description, requested_by)
                    VALUES (?, ?, 'REQUESTED', ?, ?, ?)`,
                [req.body.lending_item_id || null, product_name, repair_company || '', issue_description || '', requested_by || ''],
                function (ierr) {
                    if (ierr) return res.status(500).json({ error: ierr.message });
                    markApplied(`repair:${this.lastID}`);
                });
        } else if (type === 'NOTE') {
            const { period_start, period_end, note_text } = req.body;
            if (!period_start || !period_end || !note_text) {
                return res.status(400).json({ error: 'period_start, period_end, note_text는 필수입니다' });
            }
            db.get(`SELECT note FROM report_notes WHERE period_start=? AND period_end=?`, [period_start, period_end], (gerr, row) => {
                if (gerr) return res.status(500).json({ error: gerr.message });
                const prev = row ? row.note : '';
                const merged = prev && prev.trim() ? `${prev}\n${note_text}` : note_text;
                db.run(`INSERT INTO report_notes (period_start, period_end, note, updated_at)
                        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                        ON CONFLICT(period_start, period_end)
                        DO UPDATE SET note=excluded.note, updated_at=CURRENT_TIMESTAMP`,
                    [period_start, period_end, merged],
                    function (ierr) {
                        if (ierr) return res.status(500).json({ error: ierr.message });
                        markApplied(`note:${period_start}~${period_end}`);
                    });
            });
        } else if (type === 'MOVE') {
            const { lending_item_id, to_hospital_id, moved_by, notes } = req.body;
            if (!lending_item_id || !to_hospital_id) {
                return res.status(400).json({ error: '장비(lending_item_id)와 병원(to_hospital_id)을 선택해야 합니다' });
            }
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                db.get('SELECT * FROM lending_items WHERE id=?', [lending_item_id], (gerr, item) => {
                    if (gerr || !item) { db.run('ROLLBACK'); return res.status(404).json({ error: '랜딩 아이템을 찾을 수 없습니다' }); }
                    const from_hospital_id = item.hospital_id;
                    db.run('UPDATE lending_items SET hospital_id=?, deploy_date=CURRENT_TIMESTAMP WHERE id=?', [to_hospital_id, lending_item_id], function (uerr) {
                        if (uerr) { db.run('ROLLBACK'); return res.status(500).json({ error: uerr.message }); }
                        db.run(`INSERT INTO lending_movements (lending_item_id, from_hospital_id, to_hospital_id, movement_type, quantity, moved_by, notes)
                                VALUES (?, ?, ?, 'MOVE', ?, ?, ?)`,
                            [lending_item_id, from_hospital_id, to_hospital_id, item.quantity, moved_by || '단톡방자동', notes || ''],
                            function (merr) {
                                if (merr) { db.run('ROLLBACK'); return res.status(500).json({ error: merr.message }); }
                                const moveId = this.lastID;
                                db.run('COMMIT');
                                db.run(`UPDATE chat_proposals SET status='APPLIED', applied_ref=?, applied_at=CURRENT_TIMESTAMP WHERE id=?`,
                                    [`move:${moveId}`, id], function () {
                                        res.json({ ok: true, event_type: 'MOVE', from_hospital_id, to_hospital_id });
                                    });
                            });
                    });
                });
            });
        } else {
            return res.status(400).json({ error: '알 수 없는 event_type' });
        }
    });
});

// 수리 상세 + 로그 조회
app.get('/api/repairs/:id', (req, res) => {
    db.get('SELECT * FROM repair_records WHERE id = ?', [req.params.id], (err, record) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!record) return res.status(404).json({ error: '수리 기록을 찾을 수 없습니다' });
        db.all('SELECT * FROM repair_logs WHERE repair_id = ? ORDER BY created_at DESC', [req.params.id], (err2, logs) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ ...record, logs });
        });
    });
});

// 수리 의뢰 등록
app.post('/api/repairs', (req, res) => {
    const { lending_item_id, product_name, repair_company, issue_description, requested_by, notes, photo_url } = req.body;
    if (!product_name) return res.status(400).json({ error: '장비명은 필수입니다' });

    db.run(`INSERT INTO repair_records (lending_item_id, product_name, status, repair_company, issue_description, requested_by, notes)
        VALUES (?, ?, 'REQUESTED', ?, ?, ?, ?)`,
        [lending_item_id || null, product_name, repair_company || '', issue_description || '', requested_by || '', notes || ''],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const repairId = this.lastID;
            // 초기 로그
            db.run(`INSERT INTO repair_logs (repair_id, status_change, note, photo_url, logged_by) VALUES (?, ?, ?, ?, ?)`,
                [repairId, '의뢰접수', issue_description || '수리 의뢰 등록', photo_url || null, requested_by || ''],
                () => res.json({ success: true, id: repairId })
            );
        }
    );
});

// 수리 정보 수정
app.put('/api/repairs/:id', (req, res) => {
    const { product_name, repair_company, issue_description, requested_by, notes } = req.body;
    db.run(`UPDATE repair_records SET product_name = COALESCE(?, product_name), repair_company = COALESCE(?, repair_company),
        issue_description = COALESCE(?, issue_description), requested_by = COALESCE(?, requested_by),
        notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [product_name, repair_company, issue_description, requested_by, notes, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// 수리 상태 변경
app.put('/api/repairs/:id/status', (req, res) => {
    const { status, note, logged_by, photo_url } = req.body;
    const validStatuses = ['REQUESTED', 'SENT', 'IN_REPAIR', 'RETURNED', 'COMPLETED'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: '유효하지 않은 상태입니다' });

    const statusLabels = { REQUESTED: '의뢰접수', SENT: '택배발송', IN_REPAIR: '수리중', RETURNED: '회수', COMPLETED: '전달완료' };
    const dateField = { SENT: 'sent_date', RETURNED: 'returned_date', COMPLETED: 'completed_date' };
    const dateUpdate = dateField[status] ? `, ${dateField[status]} = CURRENT_TIMESTAMP` : '';

    db.run(`UPDATE repair_records SET status = ?, updated_at = CURRENT_TIMESTAMP${dateUpdate} WHERE id = ?`,
        [status, req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.run(`INSERT INTO repair_logs (repair_id, status_change, note, photo_url, logged_by) VALUES (?, ?, ?, ?, ?)`,
                [req.params.id, statusLabels[status], note || '', photo_url || null, logged_by || ''],
                () => res.json({ success: true })
            );
        }
    );
});

// 수리 로그 추가 (사진/메모)
app.post('/api/repairs/:id/log', (req, res) => {
    const { note, logged_by, photo_url } = req.body;
    db.run(`INSERT INTO repair_logs (repair_id, status_change, note, photo_url, logged_by) VALUES (?, ?, ?, ?, ?)`,
        [req.params.id, '메모 추가', note || '', photo_url || null, logged_by || ''],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.run('UPDATE repair_records SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
            res.json({ success: true, id: this.lastID });
        }
    );
});

// 수리 업체 목록 (이전 입력 기록 - 장비명 기준 필터)
app.get('/api/repair-companies', (req, res) => {
    const { product_name } = req.query;
    let query, params;
    if (product_name) {
        query = 'SELECT DISTINCT repair_company FROM repair_records WHERE repair_company IS NOT NULL AND repair_company != "" AND product_name = ? ORDER BY repair_company';
        params = [product_name];
    } else {
        query = 'SELECT DISTINCT repair_company FROM repair_records WHERE repair_company IS NOT NULL AND repair_company != "" ORDER BY repair_company';
        params = [];
    }
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => r.repair_company));
    });
});

// ===== 거래처 API =====
// 거래처 목록 조회
app.get('/api/customers', (req, res) => {
    db.all('SELECT * FROM customers ORDER BY name', [], (err, rows) => {
        if (err) {
            console.error('거래처 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// 거래처 추가
app.post('/api/customers', (req, res) => {
    const { name, code, type, contact_person, phone, address } = req.body;

    if (!name) {
        return res.status(400).json({ error: '거래처명은 필수입니다' });
    }

    const customerCode = code || name.substring(0, 3).toUpperCase() + Date.now().toString().slice(-4);

    db.run(
        `INSERT INTO customers (name, code, type, contact_person, phone, address) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, customerCode, type || 'GENERAL', contact_person, phone, address],
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint')) {
                    return res.status(409).json({ error: '이미 등록된 거래처입니다' });
                }
                console.error('거래처 등록 실패:', err.message);
                return res.status(500).json({ error: err.message });
            }
            res.json({
                success: true,
                id: this.lastID,
                message: `거래처 "${name}" 등록 완료`
            });
        }
    );
});

// 채널 목록 조회
app.get('/api/channels', (req, res) => {
    db.all('SELECT * FROM channels ORDER BY id', [], (err, rows) => {
        if (err) {
            console.error('채널 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// ===== API 라우트 =====

// 1. 전체 제품 조회
app.get('/api/products', (req, res) => {
    const query = `
        SELECT 
            p.*,
            CASE 
                WHEN p.current_stock <= p.safety_stock THEN 'LOW'
                WHEN p.current_stock <= p.safety_stock * 1.5 THEN 'WARNING'
                ELSE 'NORMAL'
            END as stock_status
        FROM products p
        ORDER BY p.name
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('제품 조회 실패:', err.message);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 2. 바코드로 제품 조회
app.get('/api/products/:barcode', (req, res) => {
    const { barcode } = req.params;

    db.get('SELECT * FROM products WHERE barcode = ?', [barcode], (err, row) => {
        if (err) {
            console.error('바코드 조회 실패:', err.message);
            res.status(500).json({ error: err.message });
            return;
        }

        if (row) {
            res.json(row);
        } else {
            res.status(404).json({ error: '제품을 찾을 수 없습니다' });
        }
    });
});

// 2.5. 제품 등록 (QR 코드 생성용) - 자동으로 부산사무실에 초기 배치
app.post('/api/products', (req, res) => {
    const { barcode, name, category, current_stock, safety_stock, unit_price } = req.body;

    if (!barcode || !name) {
        return res.status(400).json({ error: '바코드와 제품명은 필수입니다' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 1. 제품 등록
        const productQuery = `
            INSERT INTO products (barcode, name, category, current_stock, safety_stock, unit_price)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        db.run(productQuery, [barcode, name, category || 'EQUIPMENT', current_stock || 0, safety_stock || 10, unit_price || 0], function (err) {
            if (err) {
                db.run('ROLLBACK');
                console.error('제품 등록 실패:', err.message);
                return res.status(500).json({ error: err.message });
            }

            const productId = this.lastID;

            // 2. 자동으로 부산사무실(hospital_id=2)에 초기 배치 생성
            const lendingQuery = `
                INSERT INTO lending_items (product_id, hospital_id, quantity, status, notes)
                VALUES (?, 2, 1, 'ACTIVE', '초기 등록 - 부산사무실')
            `;

            db.run(lendingQuery, [productId], function (lendingErr) {
                if (lendingErr) {
                    db.run('ROLLBACK');
                    console.error('초기 배치 생성 실패:', lendingErr.message);
                    return res.status(500).json({ error: lendingErr.message });
                }

                const lendingItemId = this.lastID;

                // 3. 배치 이력 기록
                const movementQuery = `
                    INSERT INTO lending_movements (lending_item_id, to_hospital_id, movement_type, quantity, moved_by, notes)
                    VALUES (?, 2, 'DEPLOY', 1, 'System', '제품 등록 시 자동 배치')
                `;

                db.run(movementQuery, [lendingItemId], function (movementErr) {
                    if (movementErr) {
                        db.run('ROLLBACK');
                        console.error('배치 이력 기록 실패:', movementErr.message);
                        return res.status(500).json({ error: movementErr.message });
                    }

                    db.run('COMMIT');
                    res.json({
                        success: true,
                        message: '제품 등록 완료 (부산사무실에 자동 배치됨)',
                        product_id: productId,
                        lending_item_id: lendingItemId
                    });
                });
            });
        });
    });
});

// 2.5.0 서브그룹 일괄 이름 변경
//   from_base = 'ZENIUS MIS' → to_base = 'ZENIUS PRO'
//   조건: name LIKE 'from_base#%' (정확히 from_base 로 시작 + # 인 행만)
//   적용: name 의 'from_base#' prefix → 'to_base#'
//   --dry_run 으로 영향받을 제품 미리보기
app.post('/api/products/bulk-rename-base', (req, res) => {
    const { from_base, to_base, dry_run } = req.body || {};

    if (!from_base || !to_base) {
        return res.status(400).json({ error: 'from_base 와 to_base 는 필수입니다' });
    }
    if (from_base === to_base) {
        return res.status(400).json({ error: '변경할 이름이 동일합니다' });
    }

    const pattern = `${from_base}#%`;
    const fromPrefix = `${from_base}#`;
    const toPrefix = `${to_base}#`;

    db.all(
        `SELECT id, name FROM products WHERE name LIKE ? ORDER BY id`,
        [pattern],
        (err, rows) => {
            if (err) {
                console.error('[bulk-rename-base] preview 실패:', err.message);
                return res.status(500).json({ error: err.message });
            }

            const preview = (rows || []).map(r => ({
                id: r.id,
                from: r.name,
                to: r.name.replace(new RegExp('^' + escapeRegExp(fromPrefix)), toPrefix)
            }));

            if (dry_run) {
                return res.json({ success: true, dry_run: true, count: preview.length, preview });
            }

            if (!preview.length) {
                return res.json({ success: true, count: 0, preview: [] });
            }

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                let completed = 0;
                let failed = false;
                preview.forEach(p => {
                    db.run(
                        `UPDATE products SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                        [p.to, p.id],
                        (uErr) => {
                            if (uErr && !failed) {
                                failed = true;
                                console.error('[bulk-rename-base] update 실패:', uErr.message);
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: uErr.message });
                            }
                            completed++;
                            if (completed === preview.length && !failed) {
                                db.run('COMMIT');
                                res.json({ success: true, count: preview.length, preview });
                            }
                        }
                    );
                });
            });
        }
    );
});

function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 2.5.1. 제품 수정 (UPDATE) - notes, repair_history 포함
app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const { name, category, safety_stock, unit_price, purchase_price, selling_price, channel_id, hospital_id, notes, repair_history } = req.body;

    if (!id) {
        return res.status(400).json({ error: '제품 ID는 필수입니다' });
    }

    const updateQuery = `
        UPDATE products 
        SET name = COALESCE(?, name),
            category = COALESCE(?, category),
            safety_stock = COALESCE(?, safety_stock),
            unit_price = COALESCE(?, unit_price),
            notes = COALESCE(?, notes),
            repair_history = COALESCE(?, repair_history),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;

    db.run(updateQuery, [name, category, safety_stock, unit_price || purchase_price, notes, repair_history, id], function (err) {
        if (err) {
            console.error('제품 수정 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: '제품을 찾을 수 없습니다' });
        }

        console.log(`제품 수정 완료: ID ${id}, 변경된 행: ${this.changes}`);
        res.json({
            success: true,
            message: '제품이 수정되었습니다',
            product_id: id,
            changes: this.changes
        });
    });
});

// 2.6. 제품 삭제 (부산사무실에 있는 장비만 삭제 가능)
app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: '제품 ID는 필수입니다' });
    }

    // 1. 먼저 제품의 활성 랜딩 아이템 확인
    const checkQuery = `
        SELECT li.id, li.hospital_id, h.name as hospital_name
        FROM lending_items li
        JOIN hospitals h ON li.hospital_id = h.id
        WHERE li.product_id = ? AND li.status = 'ACTIVE'
        ORDER BY li.id DESC
        LIMIT 1
    `;

    db.get(checkQuery, [id], (err, lendingItem) => {
        if (err) {
            console.error('랜딩 아이템 확인 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }

        // 2. 랜딩 아이템이 있는 경우, 부산사무실인지 확인
        if (lendingItem) {
            // 부산사무실 확인 (이름에 '사무실' 또는 '본사'가 포함된 경우)
            const isOffice = lendingItem.hospital_name.includes('사무실') ||
                lendingItem.hospital_name.includes('본사') ||
                lendingItem.hospital_name.includes('창고');

            if (!isOffice) {
                return res.status(400).json({
                    error: `이 제품은 현재 "${lendingItem.hospital_name}"에 배치되어 있어 삭제할 수 없습니다. 먼저 "부산사무실"로 회수(이동) 처리 후 삭제해주세요.`
                });
            }
        }

        // 3. 삭제 가능 - 연관된 lending_items와 lending_movements도 삭제
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // 연관된 lending_movements 삭제
            db.run(`DELETE FROM lending_movements WHERE lending_item_id IN 
                    (SELECT id FROM lending_items WHERE product_id = ?)`, [id], (err) => {
                if (err) {
                    db.run('ROLLBACK');
                    console.error('이동 이력 삭제 실패:', err.message);
                    return res.status(500).json({ error: err.message });
                }

                // 연관된 lending_items 삭제
                db.run('DELETE FROM lending_items WHERE product_id = ?', [id], (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('랜딩 아이템 삭제 실패:', err.message);
                        return res.status(500).json({ error: err.message });
                    }

                    // 제품 삭제
                    db.run('DELETE FROM products WHERE id = ?', [id], function (err) {
                        if (err) {
                            db.run('ROLLBACK');
                            console.error('제품 삭제 실패:', err.message);
                            return res.status(500).json({ error: err.message });
                        }

                        if (this.changes === 0) {
                            db.run('ROLLBACK');
                            return res.status(404).json({ error: '제품을 찾을 수 없습니다' });
                        }

                        db.run('COMMIT');
                        res.json({
                            success: true,
                            message: '제품이 삭제되었습니다 (연관된 랜딩 기록도 함께 삭제됨)',
                            deleted_id: id
                        });
                    });
                });
            });
        });
    });
});

// 2.6.1 제품 강제 삭제 (관리자 모드 - 위치 무관하게 삭제)
app.delete('/api/products/:id/force', (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: '제품 ID는 필수입니다' });
    }

    // 위치 확인 없이 바로 삭제 진행
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 연관된 lending_movements 삭제
        db.run(`DELETE FROM lending_movements WHERE lending_item_id IN 
                (SELECT id FROM lending_items WHERE product_id = ?)`, [id], (err) => {
            if (err) {
                db.run('ROLLBACK');
                console.error('이동 이력 삭제 실패:', err.message);
                return res.status(500).json({ error: err.message });
            }

            // 연관된 lending_items 삭제
            db.run('DELETE FROM lending_items WHERE product_id = ?', [id], (err) => {
                if (err) {
                    db.run('ROLLBACK');
                    console.error('랜딩 아이템 삭제 실패:', err.message);
                    return res.status(500).json({ error: err.message });
                }

                // 제품 삭제
                db.run('DELETE FROM products WHERE id = ?', [id], function (err) {
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('제품 삭제 실패:', err.message);
                        return res.status(500).json({ error: err.message });
                    }

                    if (this.changes === 0) {
                        db.run('ROLLBACK');
                        return res.status(404).json({ error: '제품을 찾을 수 없습니다' });
                    }

                    db.run('COMMIT');
                    res.json({
                        success: true,
                        message: '⚠️ 강제 삭제 완료 (연관 데이터 모두 삭제)',
                        deleted_id: id
                    });
                });
            });
        });
    });
});

// (중복 API 삭제됨 - 2.5.1에서 notes, repair_history 처리)

// 3. 입고 처리
app.post('/api/inventory/in', (req, res) => {
    const { barcode, quantity, notes } = req.body;

    if (!barcode || !quantity || quantity <= 0) {
        return res.status(400).json({ error: '바코드와 수량을 올바르게 입력해주세요' });
    }

    // 트랜잭션 시작
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 제품 확인
        db.get('SELECT * FROM products WHERE barcode = ?', [barcode], (err, product) => {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }

            if (!product) {
                db.run('ROLLBACK');
                return res.status(404).json({ error: '제품을 찾을 수 없습니다' });
            }

            const previousStock = product.current_stock;
            const newStock = previousStock + parseInt(quantity);

            // 재고 업데이트
            db.run(
                'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newStock, product.id],
                function (err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err.message });
                    }

                    // 입고 로그 기록
                    db.run(
                        'INSERT INTO inventory_logs (product_id, type, quantity, previous_stock, new_stock, notes) VALUES (?, ?, ?, ?, ?, ?)',
                        [product.id, 'IN', quantity, previousStock, newStock, notes || ''],
                        function (err) {
                            if (err) {
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: err.message });
                            }

                            // 배치 정보 추가
                            db.run(
                                'INSERT INTO batches (product_id, quantity) VALUES (?, ?)',
                                [product.id, quantity],
                                function (err) {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return res.status(500).json({ error: err.message });
                                    }

                                    db.run('COMMIT');
                                    res.json({
                                        success: true,
                                        message: '입고 처리 완료',
                                        product: product.name,
                                        previous_stock: previousStock,
                                        quantity: quantity,
                                        new_stock: newStock
                                    });
                                }
                            );
                        }
                    );
                }
            );
        });
    });
});

// 4. 출고 처리 (간단한 FIFO)
app.post('/api/inventory/out', (req, res) => {
    const { barcode, quantity, notes } = req.body;

    if (!barcode || !quantity || quantity <= 0) {
        return res.status(400).json({ error: '바코드와 수량을 올바르게 입력해주세요' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 제품 확인
        db.get('SELECT * FROM products WHERE barcode = ?', [barcode], (err, product) => {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }

            if (!product) {
                db.run('ROLLBACK');
                return res.status(404).json({ error: '제품을 찾을 수 없습니다' });
            }

            const previousStock = product.current_stock;
            const outQuantity = parseInt(quantity);

            // 재고 부족 체크
            if (previousStock < outQuantity) {
                db.run('ROLLBACK');
                return res.status(400).json({
                    error: '재고가 부족합니다',
                    current_stock: previousStock,
                    requested: outQuantity
                });
            }

            const newStock = previousStock - outQuantity;

            // 재고 업데이트
            db.run(
                'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newStock, product.id],
                function (err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err.message });
                    }

                    // 출고 로그 기록
                    db.run(
                        'INSERT INTO inventory_logs (product_id, type, quantity, previous_stock, new_stock, notes) VALUES (?, ?, ?, ?, ?, ?)',
                        [product.id, 'OUT', outQuantity, previousStock, newStock, notes || ''],
                        function (err) {
                            if (err) {
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: err.message });
                            }

                            db.run('COMMIT');

                            // 안전재고 경고 체크
                            const isLowStock = newStock <= product.safety_stock;

                            res.json({
                                success: true,
                                message: '출고 처리 완료',
                                product: product.name,
                                previous_stock: previousStock,
                                quantity: outQuantity,
                                new_stock: newStock,
                                low_stock_warning: isLowStock
                            });
                        }
                    );
                }
            );
        });
    });
});

// 5. 안전재고 이하 제품 조회 (장비/기구는 소모품이 아니므로 제외)
app.get('/api/alerts/low-stock', (req, res) => {
    const query = `
        SELECT 
            *,
            (safety_stock * 2) as recommended_order_qty,
            ROUND((current_stock * 100.0 / safety_stock), 1) as stock_ratio
        FROM products 
        WHERE current_stock <= safety_stock 
          AND category != 'EQUIPMENT'
        ORDER BY stock_ratio ASC, name
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('저재고 조회 실패:', err.message);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 6. 입출고 이력 조회
app.get('/api/logs', (req, res) => {
    const query = `
        SELECT 
            l.*,
            p.name as product_name,
            p.barcode
        FROM inventory_logs l
        JOIN products p ON l.product_id = p.id
        ORDER BY l.created_at DESC
        LIMIT 50
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('로그 조회 실패:', err.message);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// React 앱 제공 (프로덕션용)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 실행중입니다`);
    console.log(`📱 http://localhost:${PORT} 에서 접속 가능합니다`);
});

// 프로세스 종료시 데이터베이스 연결 해제
process.on('SIGINT', () => {
    console.log('\n🔄 서버 종료 중...');
    db.close((err) => {
        if (err) {
            console.error('데이터베이스 종료 실패:', err.message);
        } else {
            console.log('✅ 데이터베이스 연결 해제');
        }
        process.exit(0);
    });
});
