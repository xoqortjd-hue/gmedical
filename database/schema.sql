-- 의약품 재고관리 시스템 데이터베이스 스키마

-- 제품 마스터 테이블
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'CONSUMABLE',
    current_stock INTEGER DEFAULT 0,
    safety_stock INTEGER DEFAULT 10,
    unit_price REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 입출고 로그 테이블
CREATE TABLE IF NOT EXISTS inventory_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    type TEXT CHECK(type IN ('IN', 'OUT')) NOT NULL,
    quantity INTEGER NOT NULL,
    previous_stock INTEGER,
    new_stock INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products (id)
);

-- 배치 정보 테이블 (간단한 FIFO용)
CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    entry_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products (id)
);

-- 병원 테이블
CREATE TABLE IF NOT EXISTS hospitals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    address TEXT,
    contact_person TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 랜딩 아이템 테이블 (병원에 배치된 제품)
CREATE TABLE IF NOT EXISTS lending_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    hospital_id INTEGER NOT NULL,
    serial_number TEXT,
    quantity INTEGER NOT NULL,
    expiration_date DATE,
    status TEXT DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'RETURNED', 'EXPIRED')),
    notes TEXT,
    deploy_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    return_date DATETIME,
    FOREIGN KEY (product_id) REFERENCES products (id),
    FOREIGN KEY (hospital_id) REFERENCES hospitals (id)
);

-- 랜딩 이동 이력 테이블
CREATE TABLE IF NOT EXISTS lending_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lending_item_id INTEGER NOT NULL,
    from_hospital_id INTEGER,
    to_hospital_id INTEGER,
    movement_type TEXT CHECK(movement_type IN ('DEPLOY', 'RETURN', 'MOVE')) NOT NULL,
    quantity INTEGER NOT NULL,
    moved_by TEXT,
    photo_url TEXT,
    notes TEXT,
    movement_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lending_item_id) REFERENCES lending_items (id),
    FOREIGN KEY (from_hospital_id) REFERENCES hospitals (id),
    FOREIGN KEY (to_hospital_id) REFERENCES hospitals (id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_product_id ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_created_at ON inventory_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_batches_product_id ON batches(product_id);
CREATE INDEX IF NOT EXISTS idx_batches_entry_date ON batches(entry_date);
CREATE INDEX IF NOT EXISTS idx_hospitals_code ON hospitals(code);
CREATE INDEX IF NOT EXISTS idx_lending_items_product_id ON lending_items(product_id);
CREATE INDEX IF NOT EXISTS idx_lending_items_hospital_id ON lending_items(hospital_id);
CREATE INDEX IF NOT EXISTS idx_lending_items_status ON lending_items(status);
CREATE INDEX IF NOT EXISTS idx_lending_items_expiration_date ON lending_items(expiration_date);
CREATE INDEX IF NOT EXISTS idx_lending_movements_lending_item_id ON lending_movements(lending_item_id);
CREATE INDEX IF NOT EXISTS idx_lending_movements_movement_date ON lending_movements(movement_date);

-- 창구(채널) 마스터 테이블
CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    code TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 기본 창구 데이터 삽입
INSERT OR IGNORE INTO channels (name, code) VALUES ('금양', 'GY');
INSERT OR IGNORE INTO channels (name, code) VALUES ('세종', 'SJ');
INSERT OR IGNORE INTO channels (name, code) VALUES ('참조은', 'CJE');
INSERT OR IGNORE INTO channels (name, code) VALUES ('온', 'ON');
INSERT OR IGNORE INTO channels (name, code) VALUES ('남경', 'NK');
