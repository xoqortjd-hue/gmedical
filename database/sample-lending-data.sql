-- 샘플 병원 데이터
INSERT OR IGNORE INTO hospitals (name, code, address, contact_person, phone) VALUES
('서울대학교병원', 'SNUH', '서울시 종로구 대학로 101', '김담당', '02-2072-2114'),
('삼성서울병원', 'SMC', '서울시 강남구 일원로 81', '이담당', '02-3410-2114'),
('아산병원', 'AMC', '서울시 송파구 올림픽로 43길 88', '박담당', '02-3010-3114'),
('세브란스병원', 'SEV', '서울시 서대문구 연세로 50-1', '최담당', '02-2228-5800'),
('본사', 'HQ', '서울시 강남구 테헤란로 123', '관리팀', '02-1234-5678');

-- 샘플 기구/장비 제품
INSERT OR IGNORE INTO products (barcode, name, category, current_stock, safety_stock, unit_price) VALUES
('9901234567890', '수술용 메스 세트', 'EQUIPMENT', 0, 0, 150000),
('9901234567891', '초음파 진단기', 'EQUIPMENT', 0, 0, 5000000),
('9901234567892', '혈압계 (디지털)', 'EQUIPMENT', 0, 0, 80000),
('9901234567893', '청진기 (고급형)', 'EQUIPMENT', 0, 0, 120000);

-- 샘플 바이오로직 제품
INSERT OR IGNORE INTO products (barcode, name, category, current_stock, safety_stock, unit_price) VALUES
('9901234567894', '인슐린 주사제 100IU', 'BIOLOGIC', 0, 0, 25000),
('9901234567895', '면역글로불린 5g', 'BIOLOGIC', 0, 0, 180000),
('9901234567896', '성장호르몬 주사', 'BIOLOGIC', 0, 0, 350000),
('9901234567897', '항암제 (생물학적)', 'BIOLOGIC', 0, 0, 450000);

-- 샘플 랜딩 데이터
INSERT OR IGNORE INTO lending_items (product_id, hospital_id, serial_number, quantity, expiration_date, status, notes) VALUES
(11, 1, 'EQ-2024-001', 5, '2025-12-31', 'ACTIVE', '서울대병원 정형외과'),
(12, 2, 'EQ-2024-002', 2, NULL, 'ACTIVE', '삼성병원 영상의학과'),
(13, 3, 'EQ-2024-003', 10, NULL, 'ACTIVE', '아산병원 내과'),
(15, 1, 'BIO-2024-001', 100, '2025-06-30', 'ACTIVE', '서울대병원 내분비내과'),
(16, 2, 'BIO-2024-002', 50, '2025-08-15', 'ACTIVE', '삼성병원 혈액종양내과'),
(17, 4, 'BIO-2024-003', 30, '2025-05-20', 'ACTIVE', '세브란스병원 소아과');

-- 샘플 이동 이력
INSERT OR IGNORE INTO lending_movements (lending_item_id, from_hospital_id, to_hospital_id, movement_type, quantity, moved_by, notes) VALUES
(1, 5, 1, 'DEPLOY', 5, '김영업', '초기 배치'),
(2, 5, 2, 'DEPLOY', 2, '이영업', '초기 배치'),
(3, 5, 3, 'DEPLOY', 10, '박영업', '초기 배치');
