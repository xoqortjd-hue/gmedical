const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 데이터베이스 연결
const dbPath = path.join(__dirname, '../database/inventory.db');
const db = new sqlite3.Database(dbPath);

// 1. 전체 랜딩 현황 조회
router.get('/items', (req, res) => {
    const { category, hospital_id } = req.query;

    let query = `
        SELECT 
            li.id,
            li.product_id,
            li.hospital_id,
            li.channel_id,
            li.serial_number,
            li.quantity,
            li.expiration_date,
            li.deploy_date,
            li.return_date,
            li.status,
            li.photo_uploaded_by,
            li.photo_uploaded_at,
            li.notes,
            li.purchase_price,
            li.selling_price,
            CASE WHEN li.photo_url IS NOT NULL AND li.photo_url != '' THEN 1 ELSE 0 END as photo_exists,
            p.name as product_name,
            p.barcode as product_barcode,
            p.category,
            p.notes as product_notes,
            p.repair_history as product_repair_history,
            h.name as hospital_name,
            h.code as hospital_code,
            c.name as channel_name,
            COALESCE(
                (SELECT moved_by FROM lending_movements 
                 WHERE lending_item_id = li.id 
                 AND movement_type = 'DEPLOY' 
                 ORDER BY movement_date DESC LIMIT 1),
                '미지정'
            ) as moved_by,
            CASE 
                WHEN li.expiration_date IS NOT NULL AND 
                     julianday(li.expiration_date) - julianday('now') <= 30 
                THEN 'EXPIRING_SOON'
                WHEN li.status = 'ACTIVE' THEN 'ACTIVE'
                ELSE li.status
            END as alert_status,
            CAST(julianday(li.expiration_date) - julianday('now') AS INTEGER) as days_until_expiry
        FROM lending_items li
        JOIN products p ON li.product_id = p.id
        JOIN hospitals h ON li.hospital_id = h.id
        LEFT JOIN channels c ON li.channel_id = c.id
        WHERE li.status = 'ACTIVE'
    `;

    const params = [];

    if (category) {
        query += ' AND p.category = ?';
        params.push(category);
    }

    if (hospital_id) {
        query += ' AND li.hospital_id = ?';
        params.push(hospital_id);
    }

    query += ' ORDER BY li.expiration_date ASC, h.name';

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('랜딩 현황 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// 2. 바코드로 제품 조회 (랜딩 배치 여부 무관)
router.get('/items/barcode/:barcode', (req, res) => {
    const { barcode } = req.params;

    // 먼저 제품이 존재하는지 확인
    const productQuery = `SELECT * FROM products WHERE barcode = ?`;

    db.get(productQuery, [barcode], (err, product) => {
        if (err) {
            console.error('제품 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }

        if (!product) {
            return res.status(404).json({ error: '등록되지 않은 제품입니다' });
        }

        // 제품이 존재하면, 랜딩 배치 여부 확인
        const lendingQuery = `
            SELECT 
                li.*,
                h.name as hospital_name,
                h.code as hospital_code
            FROM lending_items li
            JOIN hospitals h ON li.hospital_id = h.id
            WHERE li.product_id = ? AND li.status = 'ACTIVE'
        `;

        db.get(lendingQuery, [product.id], (err, lendingItem) => {
            if (err) {
                console.error('랜딩 정보 조회 실패:', err.message);
                return res.status(500).json({ error: err.message });
            }

            // 응답 데이터 구성
            const response = {
                product_name: product.name,
                barcode: product.barcode,
                category: product.category,
                is_deployed: !!lendingItem,
                ...product
            };

            if (lendingItem) {
                // 배치된 경우: 랜딩 정보 포함
                response.id = lendingItem.id;
                response.hospital_id = lendingItem.hospital_id;
                response.hospital_name = lendingItem.hospital_name;
                response.hospital_code = lendingItem.hospital_code;
                response.quantity = lendingItem.quantity;
                response.serial_number = lendingItem.serial_number;
                response.expiration_date = lendingItem.expiration_date;
                response.status = lendingItem.status;
            } else {
                // 배치되지 않은 경우: 기본값 설정
                response.hospital_name = '미배치';
                response.quantity = 0;
            }

            res.json(response);
        });
    });
});

// 3. 유통기한 임박 제품 조회
router.get('/expiring', (req, res) => {
    const { days = 30 } = req.query;

    const query = `
        SELECT 
            li.*,
            p.name as product_name,
            p.barcode,
            p.category,
            h.name as hospital_name,
            h.code as hospital_code,
            CAST(julianday(li.expiration_date) - julianday('now') AS INTEGER) as days_until_expiry
        FROM lending_items li
        JOIN products p ON li.product_id = p.id
        JOIN hospitals h ON li.hospital_id = h.id
        WHERE li.status = 'ACTIVE' 
          AND li.expiration_date IS NOT NULL
          AND julianday(li.expiration_date) - julianday('now') <= ?
        ORDER BY days_until_expiry ASC
    `;

    db.all(query, [days], (err, rows) => {
        if (err) {
            console.error('유통기한 임박 제품 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// 3.1 GTIN으로 제품 마스터 조회 (자동 채움용)
router.get('/product-by-gtin/:gtin', (req, res) => {
    const { gtin } = req.params;

    if (!gtin) {
        return res.status(400).json({ error: 'GTIN은 필수입니다' });
    }

    // 제품 정보 + 마지막 입고 시 가격 정보 조회
    const query = `
        SELECT 
            p.*,
            (SELECT purchase_price FROM lending_items WHERE product_id = p.id ORDER BY deploy_date DESC LIMIT 1) as last_purchase_price,
            (SELECT selling_price FROM lending_items WHERE product_id = p.id ORDER BY deploy_date DESC LIMIT 1) as last_selling_price,
            (SELECT COUNT(*) FROM lending_items WHERE product_id = p.id) as total_lending_count
        FROM products p 
        WHERE p.barcode = ?
    `;

    db.get(query, [gtin], (err, product) => {
        if (err) {
            console.error('GTIN 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }

        if (!product) {
            return res.status(404).json({
                found: false,
                message: '등록된 제품이 없습니다. 신규 제품으로 등록해주세요.'
            });
        }

        res.json({
            found: true,
            product: {
                id: product.id,
                name: product.name,
                barcode: product.barcode,
                category: product.category,
                purchase_price: product.last_purchase_price || 0,
                selling_price: product.last_selling_price || 0,
                total_lending_count: product.total_lending_count || 0
            }
        });
    });
});

// 3.5 랜딩 제품 등록 (GS1 바코드 스캔 → 제품 + 랜딩 아이템 생성)
router.post('/register-product', (req, res) => {
    const { product_name, gtin, lot_number, expiration_date, channel_id, hospital_id, quantity, category, notes, purchase_price, selling_price } = req.body;

    if (!product_name || !hospital_id) {
        return res.status(400).json({ error: '제품명과 병원은 필수입니다' });
    }

    const barcode = gtin || `LENDING_${Date.now()}`;
    const productCategory = category || 'CONSUMABLE';

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 1. 제품 등록 (이미 있으면 기존 제품 사용)
        const findProductQuery = `SELECT id FROM products WHERE barcode = ?`;
        db.get(findProductQuery, [barcode], (err, existingProduct) => {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }

            const registerProduct = (productId) => {
                // 2. 랜딩 아이템 등록 (가격 정보 포함)
                const lendingQuery = `
                    INSERT INTO lending_items (product_id, hospital_id, serial_number, quantity, expiration_date, notes, status, channel_id, purchase_price, selling_price)
                    VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
                `;
                const serial = lot_number || `SN${Date.now()}`;

                db.run(lendingQuery, [productId, hospital_id, serial, quantity || 1, expiration_date, notes, channel_id || null, purchase_price || 0, selling_price || 0], function (lendingErr) {
                    if (lendingErr) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: lendingErr.message });
                    }

                    const lendingItemId = this.lastID;

                    // 3. 이동 이력 기록
                    const movementQuery = `
                        INSERT INTO lending_movements (lending_item_id, to_hospital_id, movement_type, quantity, moved_by, notes)
                        VALUES (?, ?, 'DEPLOY', ?, ?, ?)
                    `;
                    const channelNote = channel_id ? `채널ID: ${channel_id}` : '';
                    const fullNotes = [notes, channelNote].filter(Boolean).join(' | ');

                    db.run(movementQuery, [lendingItemId, hospital_id, quantity || 1, 'GS1 Scanner', fullNotes], function (moveErr) {
                        if (moveErr) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: moveErr.message });
                        }

                        db.run('COMMIT');
                        res.json({
                            success: true,
                            message: '랜딩 제품 등록 완료',
                            product_id: productId,
                            lending_item_id: lendingItemId
                        });
                    });
                });
            };

            if (existingProduct) {
                // 기존 제품이 있으면 category 업데이트 (BIOLOGIC 입고 시)
                if (productCategory === 'BIOLOGIC' || productCategory === 'biologic') {
                    db.run('UPDATE products SET category = ? WHERE id = ?', [productCategory.toUpperCase(), existingProduct.id], (updateErr) => {
                        if (updateErr) {
                            console.error('제품 카테고리 업데이트 실패:', updateErr.message);
                        }
                    });
                }
                registerProduct(existingProduct.id);
            } else {
                // 새 제품 등록
                const insertProductQuery = `
                    INSERT INTO products (barcode, name, category, current_stock, safety_stock)
                    VALUES (?, ?, ?, 0, 0)
                `;
                db.run(insertProductQuery, [barcode, product_name, productCategory], function (productErr) {
                    if (productErr) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: productErr.message });
                    }
                    registerProduct(this.lastID);
                });
            }
        });
    });
});

// 4. 랜딩 배치
router.post('/deploy', (req, res) => {
    const { product_id, hospital_id, serial_number, quantity, expiration_date, notes } = req.body;

    if (!product_id || !hospital_id || !quantity) {
        return res.status(400).json({ error: '제품, 병원, 수량은 필수입니다' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 랜딩 아이템 등록
        const insertQuery = `
            INSERT INTO lending_items (product_id, hospital_id, serial_number, quantity, expiration_date, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        db.run(insertQuery, [product_id, hospital_id, serial_number, quantity, expiration_date, notes], function (err) {
            if (err) {
                db.run('ROLLBACK');
                console.error('랜딩 배치 실패:', err.message);
                return res.status(500).json({ error: err.message });
            }

            const lending_item_id = this.lastID;

            // 이동 이력 기록
            const movementQuery = `
                INSERT INTO lending_movements (lending_item_id, to_hospital_id, movement_type, quantity, moved_by, notes)
                VALUES (?, ?, 'DEPLOY', ?, ?, ?)
            `;

            db.run(movementQuery, [lending_item_id, hospital_id, quantity, req.body.moved_by || 'System', notes], function (err) {
                if (err) {
                    db.run('ROLLBACK');
                    console.error('이동 이력 기록 실패:', err.message);
                    return res.status(500).json({ error: err.message });
                }

                db.run('COMMIT');
                res.json({
                    success: true,
                    message: '랜딩 배치 완료',
                    lending_item_id: lending_item_id
                });
            });
        });
    });
});

// 5. 랜딩 회수
router.post('/return', (req, res) => {
    const { lending_item_id, moved_by, notes } = req.body;

    if (!lending_item_id) {
        return res.status(400).json({ error: '랜딩 아이템 ID는 필수입니다' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 랜딩 아이템 조회
        db.get('SELECT * FROM lending_items WHERE id = ?', [lending_item_id], (err, item) => {
            if (err || !item) {
                db.run('ROLLBACK');
                return res.status(404).json({ error: '랜딩 아이템을 찾을 수 없습니다' });
            }

            // 상태 업데이트
            db.run(
                'UPDATE lending_items SET status = ?, return_date = CURRENT_TIMESTAMP WHERE id = ?',
                ['RETURNED', lending_item_id],
                function (err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err.message });
                    }

                    // 이동 이력 기록
                    const movementQuery = `
                        INSERT INTO lending_movements (lending_item_id, from_hospital_id, movement_type, quantity, moved_by, notes)
                        VALUES (?, ?, 'RETURN', ?, ?, ?)
                    `;

                    db.run(movementQuery, [lending_item_id, item.hospital_id, item.quantity, moved_by || 'System', notes], function (err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: err.message });
                        }

                        db.run('COMMIT');
                        res.json({
                            success: true,
                            message: '랜딩 회수 완료'
                        });
                    });
                }
            );
        });
    });
});

// 6. 병원 간 이동
router.post('/move', (req, res) => {
    const { lending_item_id, to_hospital_id, moved_by, photo_url, notes } = req.body;

    if (!lending_item_id || !to_hospital_id) {
        return res.status(400).json({ error: '랜딩 아이템 ID와 목적지 병원은 필수입니다' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 현재 랜딩 아이템 조회
        db.get('SELECT * FROM lending_items WHERE id = ?', [lending_item_id], (err, item) => {
            if (err || !item) {
                db.run('ROLLBACK');
                return res.status(404).json({ error: '랜딩 아이템을 찾을 수 없습니다' });
            }

            const from_hospital_id = item.hospital_id;

            // 병원 정보 및 배치일 업데이트 (이동 시 최신 현황에 표시되도록)
            db.run(
                'UPDATE lending_items SET hospital_id = ?, deploy_date = CURRENT_TIMESTAMP WHERE id = ?',
                [to_hospital_id, lending_item_id],
                function (err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err.message });
                    }

                    // 이동 이력 기록
                    const movementQuery = `
                        INSERT INTO lending_movements 
                        (lending_item_id, from_hospital_id, to_hospital_id, movement_type, quantity, moved_by, photo_url, notes)
                        VALUES (?, ?, ?, 'MOVE', ?, ?, ?, ?)
                    `;

                    db.run(movementQuery, [lending_item_id, from_hospital_id, to_hospital_id, item.quantity, moved_by || 'System', photo_url, notes], function (err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: err.message });
                        }

                        db.run('COMMIT');
                        res.json({
                            success: true,
                            message: '이동 완료',
                            from_hospital_id: from_hospital_id,
                            to_hospital_id: to_hospital_id
                        });
                    });
                }
            );
        });
    });
});

// 7. 제품 이동 이력 조회
router.get('/movements/:itemId', (req, res) => {
    const { itemId } = req.params;

    const query = `
        SELECT 
            lm.*,
            h1.name as from_hospital_name,
            h2.name as to_hospital_name
        FROM lending_movements lm
        LEFT JOIN hospitals h1 ON lm.from_hospital_id = h1.id
        LEFT JOIN hospitals h2 ON lm.to_hospital_id = h2.id
        WHERE lm.lending_item_id = ?
        ORDER BY lm.movement_date DESC
    `;

    db.all(query, [itemId], (err, rows) => {
        if (err) {
            console.error('이동 이력 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// 7. 랜딩 아이템 삭제
router.delete('/items/:id', (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: '아이템 ID는 필수입니다' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 먼저 관련 이동 이력 삭제
        db.run('DELETE FROM lending_movements WHERE lending_item_id = ?', [id], function (err) {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }

            // 랜딩 아이템 삭제
            db.run('DELETE FROM lending_items WHERE id = ?', [id], function (err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }

                if (this.changes === 0) {
                    db.run('ROLLBACK');
                    return res.status(404).json({ error: '아이템을 찾을 수 없습니다' });
                }

                db.run('COMMIT');
                res.json({
                    success: true,
                    message: '삭제되었습니다',
                    deleted_id: id
                });
            });
        });
    });
});

// 7.5 랜딩 아이템 사진 업로드 (최근 10장 유지)
router.put('/items/:id/photo', (req, res) => {
    const { id } = req.params;
    const { photo_url, uploaded_by } = req.body;
    const MAX_PHOTOS = 10; // 최대 유지할 사진 수 (3장 → 10장으로 변경)

    console.log(`📤 [PUT /items/${id}/photo] 사진 업로드 요청 - 업로더: ${uploaded_by || '미지정'}`);

    if (!id) {
        console.error(`❌ [PUT /items/:id/photo] 아이템 ID 누락`);
        return res.status(400).json({ error: '아이템 ID는 필수입니다' });
    }

    if (!photo_url) {
        console.error(`❌ [PUT /items/${id}/photo] 사진 데이터 누락`);
        return res.status(400).json({ error: '사진 데이터가 필요합니다' });
    }

    // 용량 제한 제거됨 - 사용자 요청에 따라 제한 없음
    const photoSize = photo_url.length;
    console.log(`📊 [PUT /items/${id}/photo] 사진 데이터 크기: ${(photoSize / 1024).toFixed(1)}KB`);

    db.serialize(() => {
        // 새 사진 추가 (기존 사진 삭제는 프론트엔드에서 DELETE API로 처리됨)
        db.run(`
            INSERT INTO lending_item_photos (lending_item_id, photo_url, uploaded_by)
            VALUES (?, ?, ?)
        `, [id, photo_url, uploaded_by || '영업담당자'], function (err) {
            if (err) {
                console.error(`❌ [PUT /items/${id}/photo] 사진 저장 실패:`, err.message);
                return res.status(500).json({ error: err.message });
            }

            const newPhotoId = this.lastID;
            console.log(`✅ [PUT /items/${id}/photo] 사진 저장 완료 - photo_id: ${newPhotoId}`);

            // 3. lending_items 테이블도 최신 사진으로 업데이트 (호환성)
            db.run(`
                UPDATE lending_items 
                SET photo_url = ?, 
                    photo_uploaded_by = ?, 
                    photo_uploaded_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [photo_url, uploaded_by || '영업담당자', id], (updateErr) => {
                if (updateErr) {
                    console.error(`⚠️ [PUT /items/${id}/photo] lending_items 업데이트 실패:`, updateErr.message);
                }
            });

            res.json({
                success: true,
                message: '사진이 업로드되었습니다',
                item_id: id,
                photo_id: newPhotoId
            });
        });
    });
});

// 7.6 랜딩 아이템 사진 이력 조회
router.get('/items/:id/photos', (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: '아이템 ID는 필수입니다' });
    }

    db.all(`
        SELECT id, photo_url, uploaded_by, uploaded_at
        FROM lending_item_photos
        WHERE lending_item_id = ?
        ORDER BY uploaded_at DESC
    `, [id], (err, rows) => {
        if (err) {
            console.error('사진 이력 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows || []);
    });
});

// 7.7 랜딩 아이템 개별 사진 삭제
router.delete('/items/:id/photos/:photoId', (req, res) => {
    const { id, photoId } = req.params;

    if (!id || !photoId) {
        return res.status(400).json({ error: '아이템 ID와 사진 ID는 필수입니다' });
    }

    db.run(`
        DELETE FROM lending_item_photos 
        WHERE id = ? AND lending_item_id = ?
    `, [photoId, id], function (err) {
        if (err) {
            console.error('사진 삭제 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: '사진을 찾을 수 없습니다' });
        }

        // 최신 사진으로 lending_items 테이블 업데이트
        db.get(`
            SELECT photo_url, uploaded_by, uploaded_at 
            FROM lending_item_photos 
            WHERE lending_item_id = ? 
            ORDER BY uploaded_at DESC 
            LIMIT 1
        `, [id], (err, row) => {
            if (row) {
                db.run(`
                    UPDATE lending_items 
                    SET photo_url = ?, photo_uploaded_by = ?, photo_uploaded_at = ?
                    WHERE id = ?
                `, [row.photo_url, row.uploaded_by, row.uploaded_at, id]);
            } else {
                // 사진이 모두 삭제된 경우
                db.run(`
                    UPDATE lending_items 
                    SET photo_url = NULL, photo_uploaded_by = NULL, photo_uploaded_at = NULL
                    WHERE id = ?
                `, [id]);
            }
        });

        console.log(`🗑️ 사진 삭제 완료: 아이템 ID ${id}, 사진 ID ${photoId}`);
        res.json({ success: true, message: '사진이 삭제되었습니다' });
    });
});

// 7.8 랜딩 아이템 전체 사진 삭제
router.delete('/items/:id/photos', (req, res) => {
    const { id } = req.params;
    console.log(`🗑️ [DELETE /items/${id}/photos] 전체 사진 삭제 요청`);

    if (!id) {
        console.error(`❌ [DELETE /items/:id/photos] 아이템 ID 누락`);
        return res.status(400).json({ error: '아이템 ID는 필수입니다' });
    }

    db.run(`
        DELETE FROM lending_item_photos 
        WHERE lending_item_id = ?
    `, [id], function (err) {
        if (err) {
            console.error(`❌ [DELETE /items/${id}/photos] 삭제 실패:`, err.message);
            return res.status(500).json({ error: err.message });
        }

        const deletedCount = this.changes;
        console.log(`✅ [DELETE /items/${id}/photos] ${deletedCount}장 삭제 완료`);

        // lending_items 테이블도 업데이트
        db.run(`
            UPDATE lending_items 
            SET photo_url = NULL, photo_uploaded_by = NULL, photo_uploaded_at = NULL
            WHERE id = ?
        `, [id], (updateErr) => {
            if (updateErr) {
                console.error(`⚠️ [DELETE /items/${id}/photos] lending_items 업데이트 실패:`, updateErr.message);
            } else {
                console.log(`✅ [DELETE /items/${id}/photos] lending_items 테이블 업데이트 완료`);
            }
        });

        res.json({ success: true, message: `${deletedCount}장의 사진이 삭제되었습니다`, deleted_count: deletedCount });
    });
});

// 8. 병원별 카테고리 요약 조회 (CEO 대시보드용)
router.get('/summary', (req, res) => {
    const { hospital_id } = req.query;

    // 병원별 카테고리 수량 집계
    let summaryQuery = `
        SELECT 
            h.id as hospital_id,
            h.name as hospital_name,
            h.code as hospital_code,
            p.category,
            COUNT(*) as item_count,
            SUM(li.quantity) as total_quantity
        FROM lending_items li
        JOIN products p ON li.product_id = p.id
        JOIN hospitals h ON li.hospital_id = h.id
        WHERE li.status = 'ACTIVE'
    `;

    const params = [];
    if (hospital_id) {
        summaryQuery += ' AND li.hospital_id = ?';
        params.push(hospital_id);
    }

    summaryQuery += ' GROUP BY h.id, p.category ORDER BY h.name, p.category';

    db.all(summaryQuery, params, (err, rows) => {
        if (err) {
            console.error('카테고리 요약 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }

        // 병원별로 그룹핑
        const hospitalSummary = {};
        rows.forEach(row => {
            if (!hospitalSummary[row.hospital_id]) {
                hospitalSummary[row.hospital_id] = {
                    hospital_id: row.hospital_id,
                    hospital_name: row.hospital_name,
                    hospital_code: row.hospital_code,
                    equipment_count: 0,
                    biologic_count: 0,
                    consumable_count: 0,
                    total_count: 0
                };
            }

            const summary = hospitalSummary[row.hospital_id];
            if (row.category === 'EQUIPMENT') {
                summary.equipment_count = row.item_count;
            } else if (row.category === 'BIOLOGIC') {
                summary.biologic_count = row.item_count;
            } else if (row.category === 'CONSUMABLE') {
                summary.consumable_count = row.item_count;
            }
            summary.total_count += row.item_count;
        });

        res.json(Object.values(hospitalSummary));
    });
});

// 9. 전체 병원 배치 현황 요약 (CEO 대시보드용)
router.get('/all-hospitals-summary', (req, res) => {
    // 전체 통계
    const totalQuery = `
        SELECT 
            COUNT(DISTINCT li.hospital_id) as total_hospitals,
            COUNT(*) as total_items,
            SUM(CASE WHEN p.category = 'EQUIPMENT' THEN 1 ELSE 0 END) as equipment_count,
            SUM(CASE WHEN p.category = 'BIOLOGIC' THEN 1 ELSE 0 END) as biologic_count,
            SUM(CASE WHEN p.category = 'CONSUMABLE' THEN 1 ELSE 0 END) as consumable_count,
            SUM(CASE WHEN li.expiration_date IS NOT NULL AND 
                julianday(li.expiration_date) - julianday('now') <= 30 THEN 1 ELSE 0 END) as expiring_soon_count
        FROM lending_items li
        JOIN products p ON li.product_id = p.id
        WHERE li.status = 'ACTIVE'
    `;

    // 병원별 요약
    const hospitalQuery = `
        SELECT 
            h.id as hospital_id,
            h.name as hospital_name,
            h.code as hospital_code,
            COUNT(*) as total_items,
            SUM(CASE WHEN p.category = 'EQUIPMENT' THEN 1 ELSE 0 END) as equipment_count,
            SUM(CASE WHEN p.category = 'BIOLOGIC' THEN 1 ELSE 0 END) as biologic_count,
            SUM(CASE WHEN p.category = 'CONSUMABLE' THEN 1 ELSE 0 END) as consumable_count,
            SUM(CASE WHEN li.expiration_date IS NOT NULL AND 
                julianday(li.expiration_date) - julianday('now') <= 30 THEN 1 ELSE 0 END) as expiring_soon_count
        FROM lending_items li
        JOIN products p ON li.product_id = p.id
        JOIN hospitals h ON li.hospital_id = h.id
        WHERE li.status = 'ACTIVE'
        GROUP BY h.id
        ORDER BY h.name
    `;

    // 최근 배치 목록
    const recentQuery = `
        SELECT 
            li.id,
            p.name as product_name,
            p.category,
            h.name as hospital_name,
            li.deploy_date,
            li.quantity
        FROM lending_items li
        JOIN products p ON li.product_id = p.id
        JOIN hospitals h ON li.hospital_id = h.id
        WHERE li.status = 'ACTIVE'
        ORDER BY li.deploy_date DESC
        LIMIT 10
    `;

    Promise.all([
        new Promise((resolve, reject) => {
            db.get(totalQuery, [], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        }),
        new Promise((resolve, reject) => {
            db.all(hospitalQuery, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }),
        new Promise((resolve, reject) => {
            db.all(recentQuery, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        })
    ])
        .then(([totals, hospitals, recentItems]) => {
            res.json({
                summary: totals || {
                    total_hospitals: 0,
                    total_items: 0,
                    equipment_count: 0,
                    biologic_count: 0,
                    consumable_count: 0,
                    expiring_soon_count: 0
                },
                hospitals: hospitals || [],
                recent_items: recentItems || []
            });
        })
        .catch(err => {
            console.error('전체 병원 요약 조회 실패:', err.message);
            res.status(500).json({ error: err.message });
        });
});

// 11. 제품별 요약 (장비별/바이오로직별 현황 - CEO 대시보드용)
router.get('/product-summary', (req, res) => {
    const { category } = req.query; // 'EQUIPMENT' or 'BIOLOGIC'

    if (!category) {
        return res.status(400).json({ error: 'category 파라미터가 필요합니다' });
    }

    // 제품별 총 수량 및 병원별 분포
    const productQuery = `
        SELECT 
            p.id as product_id,
            p.name as product_name,
            p.barcode,
            p.category,
            COUNT(DISTINCT li.id) as total_count,
            GROUP_CONCAT(
                DISTINCT h.name || ':' || (
                    SELECT COUNT(*) FROM lending_items li2 
                    WHERE li2.product_id = p.id AND li2.hospital_id = h.id AND li2.status = 'ACTIVE'
                )
            ) as hospital_distribution
        FROM products p
        LEFT JOIN lending_items li ON p.id = li.product_id AND li.status = 'ACTIVE'
        LEFT JOIN hospitals h ON li.hospital_id = h.id
        WHERE p.category = ?
        GROUP BY p.id
        ORDER BY p.name
    `;

    // 개별 아이템 상세 정보 (deploy_date, deployed_by 포함)
    const itemDetailQuery = `
        SELECT 
            li.id as item_id,
            p.id as product_id,
            p.name as product_name,
            p.barcode,
            h.id as hospital_id,
            h.name as hospital_name,
            li.quantity,
            li.deploy_date,
            lm.moved_by as deployed_by
        FROM lending_items li
        JOIN products p ON li.product_id = p.id
        LEFT JOIN hospitals h ON li.hospital_id = h.id
        LEFT JOIN (
            SELECT lending_item_id, moved_by, movement_date
            FROM lending_movements
            WHERE id IN (
                SELECT MAX(id) FROM lending_movements GROUP BY lending_item_id
            )
        ) lm ON li.id = lm.lending_item_id
        WHERE p.category = ? AND li.status = 'ACTIVE'
        ORDER BY p.name, li.deploy_date DESC
    `;

    // 더 상세한 제품별 병원 분포
    const detailQuery = `
        SELECT 
            p.id as product_id,
            p.name as product_name,
            p.barcode,
            h.id as hospital_id,
            h.name as hospital_name,
            COUNT(li.id) as quantity
        FROM products p
        LEFT JOIN lending_items li ON p.id = li.product_id AND li.status = 'ACTIVE'
        LEFT JOIN hospitals h ON li.hospital_id = h.id
        WHERE p.category = ?
        GROUP BY p.id, h.id
        HAVING quantity > 0 OR h.id IS NULL
        ORDER BY p.name, h.name
    `;

    // 카테고리별 총계
    const summaryQuery = `
        SELECT 
            COUNT(DISTINCT p.id) as total_products,
            COALESCE(SUM(CASE WHEN li.status = 'ACTIVE' THEN 1 ELSE 0 END), 0) as total_deployed
        FROM products p
        LEFT JOIN lending_items li ON p.id = li.product_id
        WHERE p.category = ?
    `;

    Promise.all([
        new Promise((resolve, reject) => {
            db.all(detailQuery, [category], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }),
        new Promise((resolve, reject) => {
            db.get(summaryQuery, [category], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        }),
        new Promise((resolve, reject) => {
            db.all(itemDetailQuery, [category], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        })
    ])
        .then(([details, summary, itemDetails]) => {
            // 제품별로 그룹화
            const productMap = new Map();

            details.forEach(row => {
                if (!productMap.has(row.product_id)) {
                    productMap.set(row.product_id, {
                        product_id: row.product_id,
                        product_name: row.product_name,
                        barcode: row.barcode,
                        total_count: 0,
                        hospitals: [],
                        items: [] // 개별 아이템 상세 정보
                    });
                }

                const product = productMap.get(row.product_id);
                if (row.hospital_name && row.quantity > 0) {
                    product.hospitals.push({
                        hospital_id: row.hospital_id,
                        hospital_name: row.hospital_name,
                        quantity: row.quantity
                    });
                    product.total_count += row.quantity;
                }
            });

            // 개별 아이템 상세 정보 추가
            itemDetails.forEach(item => {
                if (productMap.has(item.product_id)) {
                    productMap.get(item.product_id).items.push({
                        item_id: item.item_id,
                        hospital_name: item.hospital_name,
                        deploy_date: item.deploy_date,
                        deployed_by: item.deployed_by || '영업팀'
                    });
                }
            });

            const products = Array.from(productMap.values()).filter(p => p.total_count > 0);

            res.json({
                category: category,
                summary: summary || { total_products: 0, total_deployed: 0 },
                products: products
            });
        })
        .catch(err => {
            console.error('제품별 요약 조회 실패:', err.message);
            res.status(500).json({ error: err.message });
        });
});

// ===== 바이오로직 출고 처리 =====
router.post('/outbound', (req, res) => {
    const { lending_item_id, customer_id, customer_name, quantity, channel_id, notes } = req.body;

    if (!lending_item_id || !quantity) {
        return res.status(400).json({ error: '필수 정보가 누락되었습니다' });
    }

    // 거래처가 새로 입력된 경우 먼저 등록
    const processOutbound = (customerId) => {
        db.serialize(() => {
            // 1. 해당 lending_item의 수량 확인 및 차감
            db.get('SELECT * FROM lending_items WHERE id = ? AND status = "ACTIVE"', [lending_item_id], (err, item) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                if (!item) {
                    return res.status(404).json({ error: '해당 재고를 찾을 수 없습니다' });
                }
                if (item.quantity < quantity) {
                    return res.status(400).json({ error: `재고 부족 (현재: ${item.quantity}개, 요청: ${quantity}개)` });
                }

                const newQuantity = item.quantity - quantity;

                // 2. 수량 업데이트 (0이면 상태를 RETURNED로 변경)
                const updateQuery = newQuantity > 0
                    ? 'UPDATE lending_items SET quantity = ? WHERE id = ?'
                    : 'UPDATE lending_items SET quantity = 0, status = "RETURNED", return_date = CURRENT_TIMESTAMP WHERE id = ?';
                const updateParams = newQuantity > 0 ? [newQuantity, lending_item_id] : [lending_item_id];

                db.run(updateQuery, updateParams, function (err) {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }

                    // 3. 출고 이력 기록 (lending_movements에 OUTBOUND 타입 추가)
                    db.run(
                        `INSERT INTO lending_movements (lending_item_id, to_hospital_id, movement_type, quantity, moved_by, notes, movement_date)
                         VALUES (?, ?, 'OUTBOUND', ?, ?, ?, CURRENT_TIMESTAMP)`,
                        [lending_item_id, customerId, quantity, `거래처출고`, notes || `거래처 ID: ${customerId}`],
                        function (err) {
                            if (err) {
                                console.error('출고 이력 기록 실패:', err.message);
                            }
                            res.json({
                                success: true,
                                message: `${quantity}개 출고 완료`,
                                remaining_quantity: newQuantity,
                                customer_id: customerId
                            });
                        }
                    );
                });
            });
        });
    };

    // 신규 거래처인 경우 먼저 등록
    if (!customer_id && customer_name) {
        const customerCode = customer_name.substring(0, 3).toUpperCase() + Date.now().toString().slice(-4);
        db.run(
            'INSERT INTO customers (name, code) VALUES (?, ?)',
            [customer_name, customerCode],
            function (err) {
                if (err && !err.message.includes('UNIQUE')) {
                    return res.status(500).json({ error: '거래처 등록 실패: ' + err.message });
                }
                processOutbound(this.lastID || customer_id);
            }
        );
    } else {
        processOutbound(customer_id);
    }
});

// ===== 바이오로직 재고 현황 조회 =====
router.get('/biologic-inventory', (req, res) => {
    const { channel_id } = req.query;

    let query = `
        SELECT 
            li.id as lending_item_id,
            li.quantity,
            li.expiration_date,
            li.serial_number as lot_number,
            li.deploy_date,
            p.id as product_id,
            p.name as product_name,
            p.barcode,
            c.id as channel_id,
            c.name as channel_name,
            h.name as location_name,
            CAST(julianday(li.expiration_date) - julianday('now') AS INTEGER) as days_until_expiry,
            CASE 
                WHEN li.expiration_date IS NULL THEN 'UNKNOWN'
                WHEN julianday(li.expiration_date) < julianday('now') THEN 'EXPIRED'
                WHEN julianday(li.expiration_date) - julianday('now') <= 7 THEN 'CRITICAL'
                WHEN julianday(li.expiration_date) - julianday('now') <= 30 THEN 'WARNING'
                ELSE 'NORMAL'
            END as expiry_status
        FROM lending_items li
        JOIN products p ON li.product_id = p.id
        LEFT JOIN channels c ON li.channel_id = c.id
        LEFT JOIN hospitals h ON li.hospital_id = h.id
        WHERE li.status = 'ACTIVE' 
          AND li.quantity > 0
          AND (p.category = 'BIOLOGIC' OR p.category = 'biologic' OR p.category = 'CONSUMABLE' OR p.category IS NULL)
    `;

    const params = [];
    if (channel_id) {
        query += ' AND li.channel_id = ?';
        params.push(channel_id);
    }

    // 기본 정렬: deploy_date로 가져온 후 JavaScript에서 재정렬
    query += ' ORDER BY li.deploy_date DESC, li.expiration_date ASC, p.name';

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('바이오로직 재고 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }

        // 최신 입고 1개를 첫번째로, 나머지는 유통기한순 정렬
        if (rows.length > 1) {
            const latestItem = rows[0]; // deploy_date DESC로 정렬되어 있으므로 첫번째가 최신
            const restItems = rows.slice(1).sort((a, b) => {
                // 유통기한이 없으면 맨 뒤로
                if (!a.expiration_date && !b.expiration_date) return 0;
                if (!a.expiration_date) return 1;
                if (!b.expiration_date) return -1;
                return new Date(a.expiration_date) - new Date(b.expiration_date);
            });
            rows = [latestItem, ...restItems];
        }

        // 요약 정보 계산
        const summary = {
            total_items: rows.length,
            total_quantity: rows.reduce((sum, r) => sum + r.quantity, 0),
            expired: rows.filter(r => r.expiry_status === 'EXPIRED').length,
            critical: rows.filter(r => r.expiry_status === 'CRITICAL').length,
            warning: rows.filter(r => r.expiry_status === 'WARNING').length
        };

        res.json({ items: rows, summary });
    });
});

// ===== 출고 이력 조회 =====
router.get('/outbound-history', (req, res) => {
    const { channel_id, customer_id, limit } = req.query;

    let query = `
        SELECT 
            lm.id,
            lm.quantity,
            lm.movement_date,
            lm.notes,
            p.name as product_name,
            p.barcode,
            c.name as channel_name,
            cu.name as customer_name
        FROM lending_movements lm
        JOIN lending_items li ON lm.lending_item_id = li.id
        JOIN products p ON li.product_id = p.id
        LEFT JOIN channels c ON li.channel_id = c.id
        LEFT JOIN customers cu ON lm.to_hospital_id = cu.id
        WHERE lm.movement_type = 'OUTBOUND'
    `;

    const params = [];
    if (channel_id) {
        query += ' AND li.channel_id = ?';
        params.push(channel_id);
    }
    if (customer_id) {
        query += ' AND lm.to_hospital_id = ?';
        params.push(customer_id);
    }

    query += ' ORDER BY lm.movement_date DESC';
    query += ` LIMIT ${parseInt(limit) || 50}`;

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('출고 이력 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});
// ===== 바이오로직 재고 항목 삭제 =====
router.delete('/biologic-inventory/:id', (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: '항목 ID가 필요합니다' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 1. 연관된 lending_movements 삭제
        db.run('DELETE FROM lending_movements WHERE lending_item_id = ?', [id], (moveErr) => {
            if (moveErr) {
                db.run('ROLLBACK');
                console.error('이동 이력 삭제 실패:', moveErr.message);
                return res.status(500).json({ error: moveErr.message });
            }

            // 2. lending_item 삭제
            db.run('DELETE FROM lending_items WHERE id = ?', [id], function (err) {
                if (err) {
                    db.run('ROLLBACK');
                    console.error('재고 항목 삭제 실패:', err.message);
                    return res.status(500).json({ error: err.message });
                }

                if (this.changes === 0) {
                    db.run('ROLLBACK');
                    return res.status(404).json({ error: '항목을 찾을 수 없습니다' });
                }

                db.run('COMMIT');
                res.json({
                    success: true,
                    message: '재고 항목이 삭제되었습니다',
                    deleted_id: id
                });
            });
        });
    });
});

// ===== 리포트 API =====

// 거래 이력 조회 (병원별 수술 건수 - 출고→입고 사이클 = 1건 수술)
router.get('/report/transaction-summary', (req, res) => {
    const { period = 'weekly' } = req.query;

    // 기간 계산: weekly = 최근 7일, monthly = 최근 30일
    const days = period === 'monthly' ? 30 : 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const endDate = new Date();
    const endDateStr = endDate.toISOString().split('T')[0];

    // 병원별 수술 건수 집계 (입고 = 수술 완료, 병원에서 부산사무실로 돌아온 건)
    // 1건의 수술 = 장비가 병원에서 사용 후 부산사무실로 입고된 것
    const query = `
        SELECT 
            h.id as hospital_id,
            h.name as hospital_name,
            COUNT(CASE 
                WHEN (lm.movement_type = 'MOVE' AND lm.from_hospital_id = h.id AND lm.to_hospital_id = 2)
                  OR (lm.movement_type = 'RETURN' AND lm.from_hospital_id = h.id)
                THEN 1
                ELSE NULL
            END) as surgery_count
        FROM hospitals h
        LEFT JOIN lending_movements lm ON (
            lm.from_hospital_id = h.id
            AND date(lm.movement_date) >= date(?)
            AND date(lm.movement_date) <= date(?)
        )
        WHERE h.id != 2
        GROUP BY h.id, h.name
        HAVING surgery_count > 0
        ORDER BY surgery_count DESC
    `;

    db.all(query, [startDateStr, endDateStr], (err, rows) => {
        if (err) {
            console.error('거래 이력 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }

        // 합계 계산
        const totalSurgeries = rows.reduce((acc, row) => acc + (row.surgery_count || 0), 0);

        res.json({
            period,
            start_date: startDateStr,
            end_date: endDateStr,
            hospitals: rows,
            totals: {
                total_surgeries: totalSurgeries,
                hospital_count: rows.length
            }
        });
    });
});

// 장비 입출고 현황 조회 (현재 위치 + 최근 3건 이동 경로)
router.get('/report/equipment-status', (req, res) => {
    const { category = 'EQUIPMENT' } = req.query;

    // 먼저 장비 목록 조회
    const equipmentQuery = `
        SELECT DISTINCT
            p.id as product_id,
            p.name as product_name,
            p.barcode,
            li.id as lending_item_id,
            h_current.name as current_hospital,
            h_current.id as current_hospital_id
        FROM products p
        JOIN lending_items li ON p.id = li.product_id AND li.status = 'ACTIVE'
        JOIN hospitals h_current ON li.hospital_id = h_current.id
        WHERE p.category = ?
        ORDER BY p.name
    `;

    db.all(equipmentQuery, [category], (err, equipmentRows) => {
        if (err) {
            console.error('장비 현황 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }

        // 장비명(product_name) 기준으로 중복 제거
        const uniqueEquipment = {};
        equipmentRows.forEach(row => {
            if (!uniqueEquipment[row.product_name]) {
                uniqueEquipment[row.product_name] = row;
            }
        });

        const deduplicatedEquipment = Object.values(uniqueEquipment);

        // 각 장비의 최근 3건 이동 이력 조회
        const movementQuery = `
            SELECT 
                lm.lending_item_id,
                lm.movement_date,
                lm.moved_by,
                lm.movement_type,
                h_from.name as from_hospital,
                h_to.name as to_hospital
            FROM lending_movements lm
            LEFT JOIN hospitals h_from ON lm.from_hospital_id = h_from.id
            LEFT JOIN hospitals h_to ON lm.to_hospital_id = h_to.id
            WHERE lm.lending_item_id IN (${deduplicatedEquipment.map(e => e.lending_item_id).join(',') || '0'})
            ORDER BY lm.lending_item_id, lm.movement_date DESC
        `;

        db.all(movementQuery, [], (err2, movementRows) => {
            if (err2) {
                console.error('이동 이력 조회 실패:', err2.message);
                return res.status(500).json({ error: err2.message });
            }

            // 장비별 이동 이력 그룹핑 (최근 이력 모두)
            const movementsByItem = {};
            movementRows.forEach(row => {
                if (!movementsByItem[row.lending_item_id]) {
                    movementsByItem[row.lending_item_id] = [];
                }
                movementsByItem[row.lending_item_id].push(row);
            });

            // 날짜 포맷 함수
            const formatDateShort = (dateStr) => {
                if (!dateStr) return '';
                try {
                    const d = new Date(dateStr);
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${month}-${day}`;
                } catch {
                    return '';
                }
            };

            // 결과 조합
            const items = deduplicatedEquipment.map(equip => {
                const movements = movementsByItem[equip.lending_item_id] || [];

                // movements는 최신순으로 정렬되어 있음 (최신 이동이 인덱스 0)
                let movementPath = '';

                if (movements.length > 0) {
                    // 최근 2개 이동을 가져와서 경로 구성
                    // 예: 이동1: A→B (12-10), 이동2: B→C (12-15)
                    // 결과: A (12-10) → B (12-15) → C (현재)

                    const recentMovements = movements.slice(0, 2); // 최근 2건

                    // 역순으로 처리 (오래된 것부터)
                    const reversedMoves = [...recentMovements].reverse();

                    const pathParts = [];

                    reversedMoves.forEach((move, idx) => {
                        // 첫 번째 이동의 출발지 추가 (날짜는 해당 이동 날짜)
                        if (idx === 0 && move.from_hospital) {
                            const dateStr = formatDateShort(move.movement_date);
                            pathParts.push(dateStr ? `${move.from_hospital} (${dateStr})` : move.from_hospital);
                        }

                        // 도착지 추가
                        if (move.to_hospital) {
                            // 마지막 이동의 도착지는 현재 위치 = 날짜 없이
                            if (idx === reversedMoves.length - 1) {
                                // 현재 위치는 equip.current_hospital 사용
                                pathParts.push(equip.current_hospital);
                            } else {
                                // 중간 위치는 다음 이동 날짜 사용
                                const nextMove = reversedMoves[idx + 1];
                                const dateStr = nextMove ? formatDateShort(nextMove.movement_date) : '';
                                pathParts.push(dateStr ? `${move.to_hospital} (${dateStr})` : move.to_hospital);
                            }
                        }
                    });

                    // 중복 제거
                    const uniquePath = [];
                    pathParts.forEach(p => {
                        if (uniquePath[uniquePath.length - 1] !== p) {
                            uniquePath.push(p);
                        }
                    });

                    // 최근 3개 위치만 선택
                    movementPath = uniquePath.slice(-3).join(' → ');
                } else {
                    movementPath = equip.current_hospital;
                }

                const latestMovement = movements[0];

                return {
                    product_id: equip.product_id,
                    product_name: equip.product_name,
                    barcode: equip.barcode,
                    lending_item_id: equip.lending_item_id,
                    current_hospital: equip.current_hospital,
                    current_hospital_id: equip.current_hospital_id,
                    movement_path: movementPath,
                    movement_date: latestMovement?.movement_date || null,
                    moved_by: latestMovement?.moved_by || null,
                    is_at_office: equip.current_hospital_id === 2
                };
            });

            // 최근 이동일 기준 정렬
            items.sort((a, b) => {
                const dateA = a.movement_date ? new Date(a.movement_date) : new Date(0);
                const dateB = b.movement_date ? new Date(b.movement_date) : new Date(0);
                return dateB - dateA;
            });

            res.json({
                category,
                items
            });
        });
    });
});

// 영업팀 입출고 현황판 조회 (그리드 형태)
router.get('/report/sales-status', (req, res) => {
    // 장비별 현재 상태 (입고=부산사무실, 출고=다른곳)
    const query = `
        SELECT 
            p.id as product_id,
            p.name as product_name,
            li.id as lending_item_id,
            h.id as hospital_id,
            h.name as hospital_name,
            li.deploy_date,
            lm.moved_by,
            CASE WHEN h.id = 2 THEN 'inbound' ELSE 'outbound' END as status
        FROM products p
        JOIN lending_items li ON p.id = li.product_id AND li.status = 'ACTIVE'
        JOIN hospitals h ON li.hospital_id = h.id
        LEFT JOIN (
            SELECT lm1.lending_item_id, lm1.moved_by
            FROM lending_movements lm1
            INNER JOIN (
                SELECT lending_item_id, MAX(movement_date) as max_date
                FROM lending_movements
                GROUP BY lending_item_id
            ) lm2 ON lm1.lending_item_id = lm2.lending_item_id 
                AND lm1.movement_date = lm2.max_date
        ) lm ON li.id = lm.lending_item_id
        WHERE p.category = 'EQUIPMENT'
        ORDER BY p.name, li.id
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('영업팀 현황판 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }

        // 장비명(product_name) 기준으로 중복 제거: 가장 최근 deploy_date 유지
        const uniqueItems = {};
        rows.forEach(row => {
            const key = row.product_name;
            if (!uniqueItems[key]) {
                uniqueItems[key] = row;
            } else {
                // 이미 존재하면 더 최신 deploy_date로 교체
                const existingDate = uniqueItems[key].deploy_date ? new Date(uniqueItems[key].deploy_date) : new Date(0);
                const newDate = row.deploy_date ? new Date(row.deploy_date) : new Date(0);
                if (newDate > existingDate) {
                    uniqueItems[key] = row;
                }
            }
        });

        const deduplicatedRows = Object.values(uniqueItems);

        // 장비명으로 그룹핑 (예: 지니어스#1, 지니어스#2 ...)
        const groupedByName = {};
        deduplicatedRows.forEach(row => {
            // 장비명에서 기본 이름 추출 (예: "지니어스#1" -> "지니어스")
            const baseName = row.product_name.replace(/#\d+$/, '').trim();
            if (!groupedByName[baseName]) {
                groupedByName[baseName] = [];
            }
            groupedByName[baseName].push({
                product_name: row.product_name,
                lending_item_id: row.lending_item_id,
                hospital_name: row.hospital_name,
                status: row.status,
                deploy_date: row.deploy_date,
                moved_by: row.moved_by
            });
        });

        // 배열로 변환하고 장비 수 기준으로 정렬
        const groups = Object.entries(groupedByName)
            .map(([baseName, items]) => ({
                baseName,
                items: items.sort((a, b) => a.product_name.localeCompare(b.product_name)),
                inboundCount: items.filter(i => i.status === 'inbound').length,
                outboundCount: items.filter(i => i.status === 'outbound').length
            }))
            .sort((a, b) => b.items.length - a.items.length);

        res.json({
            groups,
            summary: {
                total_equipment: deduplicatedRows.length,
                inbound_count: deduplicatedRows.filter(r => r.status === 'inbound').length,
                outbound_count: deduplicatedRows.filter(r => r.status === 'outbound').length
            }
        });
    });
});

module.exports = router;

