# 🐛 버그 수정 기록: 장비 상태 데이터 불일치

**날짜**: 2026-01-15  
**수정자**: AI Assistant  
**커밋**: `0ddf9dd`

---

## 📋 문제 현상

### 증상
동일한 장비(ILIAD#5, ILIAD#6)가 두 페이지에서 **다른 상태**로 표시됨:

| 페이지 | 위치 | 표시 상태 |
|--------|------|-----------|
| 영업팀 입출고 현황판 | `/mobile/sales/status` | 🔴 **출고** |
| 관리팀 리포트 | `/mobile/report` | 🟢 **부산사무실 (입고)** |

### 기대 동작
모든 페이지에서 동일 장비는 **동일한 최신 상태**를 표시해야 함

---

## 🔍 원인 분석

### 1. 데이터 구조 이해

장비 하나(`product_name: ILIAD#5`)에 복수의 `lending_items` 레코드 존재:

```
lending_items 테이블:
┌────┬─────────────┬─────────────────┬──────────────────────┐
│ id │ product_name│ hospital_name   │ deploy_date          │
├────┼─────────────┼─────────────────┼──────────────────────┤
│ 10 │ ILIAD#5     │ 부산사무실      │ 2026-01-01           │ ← 오래된 레코드
│ 45 │ ILIAD#5     │ 한양대병원      │ 2026-01-15           │ ← 최신 레코드
└────┴─────────────┴─────────────────┴──────────────────────┘
```

### 2. 두 API의 중복 제거 로직 비교

#### ✅ 정상 동작: SalesStatusDashboard
- **API**: `/api/lending/items`
- **로직**: 프론트엔드에서 `deploy_date` 기준 최신 레코드 선택

```javascript
// SalesStatusDashboard.js (라인 60-78)
filtered.forEach(item => {
    const name = item.product_name;
    const lastDate = item.deploy_date || item.lending_date || '';

    if (!latestByName[name] ||
        (lastDate && (!latestByName[name].lastUpdated || lastDate > latestByName[name].lastUpdated))) {
        // 최신 날짜 기준으로 업데이트
        latestByName[name] = { ... };
    }
});
```

#### ❌ 버그: equipment-status API
- **API**: `/api/lending/report/equipment-status`
- **로직**: **첫 번째 발견된 레코드** 사용 (날짜 비교 없음)

```javascript
// 수정 전 lending-routes.js (라인 1351-1357)
equipmentRows.forEach(row => {
    if (!uniqueEquipment[row.product_name]) {  // ← 첫 번째만 저장!
        uniqueEquipment[row.product_name] = row;
    }
});
```

### 3. 버그 발생 원인

SQL 쿼리가 `ORDER BY p.name`으로 정렬하여 **오래된 레코드가 먼저** 반환됨:

```sql
-- 수정 전 쿼리
SELECT ... FROM products p
JOIN lending_items li ON p.id = li.product_id AND li.status = 'ACTIVE'
ORDER BY p.name  -- deploy_date 정렬 없음
```

결과: 오래된 "부산사무실" 레코드가 먼저 반환되어 저장됨

---

## 🔧 수정 내용

### 수정된 SQL 쿼리

```sql
-- 수정 후 쿼리
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.barcode,
    li.id as lending_item_id,
    li.deploy_date,  -- 추가됨
    h_current.name as current_hospital,
    h_current.id as current_hospital_id
FROM products p
JOIN lending_items li ON p.id = li.product_id AND li.status = 'ACTIVE'
JOIN hospitals h_current ON li.hospital_id = h_current.id
WHERE p.category = ?
ORDER BY p.name, li.deploy_date DESC  -- deploy_date 내림차순 정렬 추가
```

### 수정된 중복 제거 로직

```javascript
// 수정 후 lending-routes.js
const uniqueEquipment = {};
equipmentRows.forEach(row => {
    const existing = uniqueEquipment[row.product_name];
    // 기존 항목이 없거나, 현재 항목의 deploy_date가 더 최신인 경우 업데이트
    if (!existing || 
        (row.deploy_date && (!existing.deploy_date || row.deploy_date > existing.deploy_date))) {
        uniqueEquipment[row.product_name] = row;
    }
});
```

---

## ✅ 수정 결과

| 항목 | 수정 전 | 수정 후 |
|------|---------|---------|
| ILIAD#5 | 부산사무실 (입고) | 한양대병원 (출고) ✅ |
| ILIAD#6 | 부산사무실 (입고) | 실제 배치 병원 (출고) ✅ |
| 데이터 일관성 | ❌ 불일치 | ✅ 일치 |

---

## 📂 수정된 파일

| 파일 | 변경 내용 |
|------|-----------|
| [lending-routes.js](file:///c:/Users/user/.gemini/antigravity/scratch/medical-inventory-system/routes/lending-routes.js#L1330-L1365) | SQL 쿼리에 `deploy_date` 추가, 중복 제거 로직 수정 |

---

## 🎓 교훈

1. **중복 제거 시 정렬 기준 명확화**: 단순 "첫 번째 발견" 대신 비즈니스 로직에 맞는 기준(최신 날짜) 사용
2. **API 간 로직 일관성**: 같은 데이터를 다루는 API들은 동일한 중복 제거 로직 적용 필요
3. **SQL 정렬과 애플리케이션 로직 동기화**: SQL ORDER BY와 코드 내 비교 로직이 일치해야 예측 가능한 결과 보장
