const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 데이터베이스 연결
const dbPath = path.join(__dirname, '../database/inventory.db');
const db = new sqlite3.Database(dbPath);

// 1. 전체 병원 목록 조회
router.get('/', (req, res) => {
    const query = 'SELECT * FROM hospitals ORDER BY name';

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('병원 목록 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// 2. 병원 상세 정보 조회
router.get('/:id', (req, res) => {
    const { id } = req.params;

    db.get('SELECT * FROM hospitals WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('병원 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }

        if (row) {
            res.json(row);
        } else {
            res.status(404).json({ error: '병원을 찾을 수 없습니다' });
        }
    });
});

// 병원명 정규화 함수 (중복 체크용)
const normalizeHospitalName = (name) => {
    return name
        .replace(/\s+/g, '')        // 모든 공백 제거
        .replace(/병원$/g, '')       // '병원' 접미사 제거
        .toLowerCase();              // 소문자 변환
};

// 3. 병원 등록 (중복 체크 강화)
router.post('/', (req, res) => {
    const { name, code, address, contact_person, phone } = req.body;

    if (!name || !code) {
        return res.status(400).json({ error: '병원명과 코드는 필수입니다' });
    }

    // 중복 체크: 정규화된 이름으로 비교
    const normalizedNewName = normalizeHospitalName(name);

    db.all('SELECT * FROM hospitals', [], (err, rows) => {
        if (err) {
            console.error('병원 목록 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }

        // 유사한 이름의 병원 찾기
        const duplicate = rows.find(h => {
            const existingNorm = normalizeHospitalName(h.name);
            return existingNorm === normalizedNewName;
        });

        if (duplicate) {
            console.log(`중복 병원 등록 시도 차단: "${name}" → 기존: "${duplicate.name}"`);
            return res.status(409).json({
                error: '유사한 이름의 병원이 이미 존재합니다',
                message: `"${duplicate.name}"이(가) 이미 등록되어 있습니다. 해당 병원을 선택해주세요.`,
                existing_hospital: duplicate
            });
        }

        // 중복 없음 - 등록 진행
        const query = `
            INSERT INTO hospitals (name, code, address, contact_person, phone)
            VALUES (?, ?, ?, ?, ?)
        `;

        db.run(query, [name, code, address, contact_person, phone], function (insertErr) {
            if (insertErr) {
                console.error('병원 등록 실패:', insertErr.message);
                return res.status(500).json({ error: insertErr.message });
            }

            res.json({
                success: true,
                message: '병원 등록 완료',
                hospital_id: this.lastID
            });
        });
    });
});

// 4. 병원 정보 수정
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { name, code, address, contact_person, phone } = req.body;

    const query = `
        UPDATE hospitals 
        SET name = ?, code = ?, address = ?, contact_person = ?, phone = ?
        WHERE id = ?
    `;

    db.run(query, [name, code, address, contact_person, phone, id], function (err) {
        if (err) {
            console.error('병원 정보 수정 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: '병원을 찾을 수 없습니다' });
        }

        res.json({
            success: true,
            message: '병원 정보 수정 완료'
        });
    });
});

// 5. 병원별 랜딩 현황 조회
router.get('/:id/lending-items', (req, res) => {
    const { id } = req.params;

    const query = `
        SELECT 
            li.*,
            p.name as product_name,
            p.barcode,
            p.category,
            CASE 
                WHEN li.expiration_date IS NOT NULL AND 
                     julianday(li.expiration_date) - julianday('now') <= 30 
                THEN 'EXPIRING_SOON'
                WHEN li.status = 'ACTIVE' THEN 'ACTIVE'
                ELSE li.status
            END as alert_status
        FROM lending_items li
        JOIN products p ON li.product_id = p.id
        WHERE li.hospital_id = ? AND li.status = 'ACTIVE'
        ORDER BY li.expiration_date ASC
    `;

    db.all(query, [id], (err, rows) => {
        if (err) {
            console.error('랜딩 현황 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

module.exports = router;
