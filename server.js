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

// ===== 라우트 미들웨어 =====
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/lending', lendingRoutes);

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

    db.run(`CREATE TABLE IF NOT EXISTS report_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(period_start, period_end)
    )`);
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
