# 📊 리포트 API 명세

**작성일**: 2026-01-15  
**관련 기능**: 데스크톱 리포트 페이지, 인쇄 기능

---

## 1. 장비 입출고 현황 조회

전체 장비의 현재 위치 및 최근 이동 경로를 조회합니다.

- **Endpoint**: `GET /api/lending/report/equipment-status`
- **Description**: 중복 제거된 장비 목록과 포맷팅된 이동 경로를 반환합니다.

### Response Example

```json
[
  {
    "lending_item_id": 101,
    "product_name": "LP케이지셋트#3",
    "serial_number": "SN12345",
    "current_hospital": "부산사무실",
    "movement_date": "2026-01-15T10:00:00.000Z",
    "moved_by": "System",
    "movement_path": "유원메지텍 (12-15) → 부산사무실 (12-19) → 서울튼튼"
  }
]
```

### Logic Detail
- **중복 제거**: `product_name` 기준으로 그룹핑하여 가장 최근 데이터 1건만 반환
- **이동 경로**: 최근 2건의 이동 기록과 현재 위치를 조합
  - 날짜 표시는 `(MM-DD)` 형식
  - 현재 위치에는 날짜 표시 안 함

---

## 2. 영업팀 현황판 조회

영업팀 모바일 대시보드와 동일한 데이터를 데스크톱 현황판용으로 조회합니다.

- **Endpoint**: `GET /api/lending/report/sales-status`
- **Description**: 장비별 입고/출고 상태를 반환합니다.

### Response Example

```json
[
  {
    "baseName": "지니어스",
    "count": 5,
    "items": [
      {
        "name": "지니어스#1",
        "status": "inbound", // 입고 (녹색)
        "hospital": "부산사무실"
      },
      {
        "name": "지니어스#2",
        "status": "outbound", // 출고 (빨간색)
        "hospital": "해운대백병원"
      }
    ]
  }
]
```

---

## 3. 이행 완료 건수 조회

특정 기간 동안의 업체/병원별 이행(반납/회수 등) 완료 건수를 집계합니다.

- **Endpoint**: `GET /api/lending/report/counts`
- **Query Params**:
  - `period`: 'weekly' | 'monthly' (default: 'weekly')

### Response Example

```json
{
  "list": [
    { "name": "한양대학교", "count": 3 },
    { "name": "부산대병원", "count": 1 }
  ],
  "totalCount": 4
}
```
