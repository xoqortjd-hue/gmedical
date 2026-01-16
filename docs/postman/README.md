# 📮 Postman API 문서 관리

이 폴더는 금양메디칼 시스템 API의 Postman 컬렉션과 문서를 관리하기 위한 공간입니다.

## 📂 폴더 구조

```
docs/postman/
├── README.md              # 이 파일
├── reports/               # API별 상세 문서
│   └── lending_report.md  # 리포트 API 명세
├── bugs/                  # 버그 수정 기록
│   └── 2026-01-15_equipment_status_inconsistency.md
└── collections/           # Postman 컬렉션 JSON (추후 추가)
```

## 📝 관리 목적

- API 변경 사항을 문서화하여 프론트엔드/백엔드 개발 간의 싱크 유지
- 새로운 기능 개발 시 API 명세를 미리 정의하여 혼선 방지 (API First Design)
- Postman 컬렉션을 공유하여 테스트 자동화 및 협업 효율성 증대
- **버그 수정 기록**을 통한 동일 문제 재발 방지

## 🔗 주요 API 문서 목차

### 1. 리포트 관련 API
- `GET /api/lending/report/counts` - 업체/병원 이행 완료 건수
- `GET /api/lending/report/equipment-status` - 장비 입출고 현황 (이동 경로 포함)
- `GET /api/lending/report/sales-status` - 영업팀 장비 현황판

### 2. 렌딩(대여) 관련 API
- `GET /api/lending/items` - 대여 아이템 목록 조회
- `POST /api/lending/deploy` - 장비 배치

---

## 🐛 버그 수정 기록

| 날짜 | 제목 | 원인 |
|------|------|------|
| 2026-01-15 | [장비 상태 데이터 불일치](bugs/2026-01-15_equipment_status_inconsistency.md) | 중복 제거 시 최신 날짜 미사용 |

---

**최종 수정일**: 2026-01-15
**작성자**: AI Assistant
