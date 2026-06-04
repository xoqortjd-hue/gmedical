# 금양 단톡방 대화 → AWS 자동분석·반영 설계

**작성일**: 2026-06-04
**상태**: 설계 승인됨 (사용자 텔레그램 승인 msg_id 968, 17:00 스케줄 확정)
**대상 시스템**: medical-inventory-system (keumyang.cloud), dispatch-bot(카톡 캡처), 클로드 코드 스케줄

---

## 1. 목표

금양 단톡방의 하루치 대화를 매일 업무마감 전(17:00) 자동 분석하여
**장비 입출고 / 수리요청·완료 / 특이사항**을 추출하고, AWS 금양관리도구의
"검토 대기함"에 후보(proposal)로 올린다. 사용자가 웹에서 검토·수정·승인하면
그때 비로소 실제 운영 데이터(repair_records / lending_movements / report_notes)에 반영된다.

핵심 원칙: **운영 DB에 자동으로 직접 쓰지 않는다. 사람이 승인한 것만 반영한다.**

## 2. 확정 결정 (브레인스토밍 결과)

| 항목 | 결정 |
|---|---|
| 쓰기 모델 | 추출 → 제안 → **사람 승인 후 반영** |
| 대상 이벤트 | 수리요청/완료, 특이사항, 장비 입출고 (3종 전부) |
| 승인 UX | 텔레그램 알림 + 웹 검토화면 |
| 실행 주기 | 매일 **17:00**(업무마감 전) 1회 |
| 분석 주체 | **클로드 코드 자체**(스케줄 실행). 외부 LLM API 키 불필요 |
| 추가 비용 | 없음 (현재 구독 내), API 키 없음 |

## 3. 아키텍처 / 데이터 흐름

```
[매일 17:00 — 클로드 코드 스케줄 실행]
  1) dispatch-bot/kakao_export.py "금양메디칼"  → 오늘 대화 txt (NAS, 기존 자산)
  2) parse_export()로 메시지 파싱 → 오늘 날짜 필터
  3) 클로드 코드가 직접 대화 분석:
       각 메시지/스레드 → { 유형, 장비명(원문), 병원(원문), 액션, 사유,
                            수리업체, 원문, 신뢰도, 매핑후보(product_id/hospital_id) }
  4) AWS POST /api/inbox/proposals 로 PENDING 제안 일괄 등록 (중복 해시 가드)
  5) 텔레그램 알림: "📋 금양 단톡방 N건 검토 대기 → <검토함 링크>"
        │
  6) 사용자 웹 '검토 대기함'(/mobile/sales/inbox) 접속
       카드별: 원문 대화 + 추출결과 + 장비/병원 드롭다운(수정 가능)
       [승인] → 실제 반영(아래 5절) / [거부] / [수정 후 승인]
```

## 4. 신규 구성요소 (기존 코드 보존 — 새 테이블·새 파일만)

### 4.1 DB (medical-inventory-system, 기존 테이블 ALTER 없음)
신규 테이블 `chat_proposals`:
- `id` INTEGER PK
- `source_room` TEXT — 단톡방 이름 (예: 금양메디칼)
- `message_date` TEXT — 대화 날짜 YYYY-MM-DD
- `raw_text` TEXT — 추출 근거가 된 원문(스레드)
- `raw_hash` TEXT UNIQUE — 중복 등록 방지(원문+날짜 해시)
- `event_type` TEXT CHECK(REPAIR / MOVE / NOTE)
- `extracted_json` TEXT — 추출 구조화 결과(JSON 문자열)
- `mapped_product_id` INTEGER NULL — 매핑된 장비(있으면)
- `mapped_hospital_id` INTEGER NULL — 매핑된 병원(있으면)
- `confidence` REAL — 0~1 신뢰도
- `status` TEXT CHECK(PENDING / APPLIED / REJECTED) DEFAULT 'PENDING'
- `applied_ref` TEXT NULL — 반영 후 생성된 레코드 식별(예: repair_records.id)
- `created_at`, `applied_at` DATETIME

### 4.2 백엔드 API (server.js)
- `POST /api/inbox/proposals` — 후보 일괄 등록. body: `{ proposals: [...] }`. raw_hash 중복은 무시(스킵 카운트 반환).
- `GET /api/inbox/proposals?status=PENDING` — 검토함 목록 (제품·병원명 조인해서 표시용 포함).
- `PATCH /api/inbox/proposals/:id/apply` — 승인. body로 사용자가 교정한 `event_type, mapped_product_id, mapped_hospital_id, 필드들` 수신.
  서버가 event_type에 따라 실제 반영:
  - REPAIR → `repair_records` INSERT (기존 POST /api/repairs 로직 재사용)
  - NOTE → `report_notes` 해당 기간 note에 append (기존 note 로직 재사용)
  - MOVE → `lending_movements`/`lending_items` 이동 (기존 lending move 로직 재사용)
  반영 성공 시 status=APPLIED, applied_ref 기록.
- `PATCH /api/inbox/proposals/:id/reject` — status=REJECTED.
- 모든 쿼리 파라미터 바인딩, try-catch, 내부정보 비노출.

### 4.3 프론트엔드 (React)
신규 모바일 페이지 `client/src/pages/mobile/SalesInboxPage.js` → 라우트 `/mobile/sales/inbox`
- PENDING 제안 카드 리스트
- 카드: 유형 배지(수리/입출고/특이사항), 원문 대화 펼쳐보기, 신뢰도 표시(낮으면 ⚠️)
- 장비 드롭다운(products), 병원 드롭다운(hospitals) — LLM 매핑 프리필, 수정 가능
- MOVE 유형은 장비·병원 둘 다 선택돼야 [승인] 활성화
- [승인]/[거부] 버튼, 처리 후 목록에서 제거
- 네비/현황판에서 "검토 N건" 배지로 진입 유도

### 4.4 분석기 (클로드 코드 스케줄)
- 별도 파이썬 LLM 스크립트 없음. 클로드 코드가 스케줄 실행되어:
  1. kakao_export.py 호출(기존)
  2. parse_export로 파싱(기존 함수 재사용)
  3. 대화 직접 분석 → 제안 JSON 생성
  4. POST /api/inbox/proposals
  5. 텔레그램 알림
- 스케줄: 클로드 코드 /schedule(또는 CronCreate) 매일 17:00.
- 실행 프롬프트(루틴)는 이 파이프라인을 수행하도록 고정.

## 5. 엔티티 매핑 방식

- **장비**: products 테이블 이름과 대화 속 표현을 매칭. 부분일치/별칭 우선, 불명확하면 mapped_product_id=NULL로 두고 신뢰도 낮춤 → 사용자가 드롭다운으로 확정.
- **병원**: hospitals 테이블과 매칭. 부산사무실(id=2)=입고 기준은 기존 규칙 유지.
- **수리(REPAIR)**: repair_records.product_name은 자유 텍스트라 매핑 실패해도 원문 그대로 등록 가능(난이도 낮음).
- **특이사항(NOTE)**: 매핑 불필요, 텍스트만.

## 6. 오류 처리

- 카톡 잠금/PC꺼짐 → kakao_export.py 기존 재시도(5분×6)+텔레그램 알림 재사용.
- 분석 결과 0건 → "오늘 추출 항목 없음" 텔레그램 보고 후 종료.
- 저신뢰 추출 → 등록하되 ⚠️ 표시. 어차피 전부 수동 승인이라 오반영 없음.
- 중복 → raw_hash UNIQUE로 차단(같은 대화 재분석해도 중복 제안 없음).
- apply 중 실제 반영 실패 → status는 PENDING 유지, 에러 메시지 반환(부분 반영 방지).

## 7. 보안 / 가드레일 부합

- 운영 DB 자동 직접쓰기 없음(제안→승인). 입출고는 사람이 장비·병원 최종 확정.
- 기존 gmedical 테이블 ALTER/DROP 없음, 새 테이블만 추가.
- SQL 파라미터 바인딩. 시크릿 하드코딩 없음.
- North Star(시스템=보조도구) 유지, 의료법·본업 영향 최소.
- 환자정보 미취급(장비·병원·수리 메타데이터만).

## 8. 테스트

- parse_export: 기존 검증됨(실 단톡방 txt).
- 추출 정확도: 과거 금양 단톡방 txt 1~2일치로 샘플 추출 → 사람 눈으로 정확도 확인.
- inbox API: PENDING 등록 → 중복 스킵 → apply(REPAIR/NOTE/MOVE) → APPLIED 전이, 실제 레코드 생성 확인.
- 웹 페이지: 제안 표시·교정·승인/거부 동작.
- 스케줄: 17:00 1회 수동 트리거로 엔드투엔드 1회 검증 후 활성화.

## 9. 범위 밖 (YAGNI)

- 다중 단톡방 동시 분석(우선 금양메디칼 1개).
- 자동 승인/자동 반영(전부 수동 승인 유지).
- 과거 누적 대화 일괄 마이그레이션.
- 입출고 외 재고수량 직접 조정.

## 10. 전제조건

- 17:00 시점에 PC 켜짐 + 카카오톡 PC앱 로그인·잠금해제(기존 백업과 동일 조건).
- Anthropic API 키: **불필요**(클로드 코드가 분석 주체).

## 11. 구현 순서(요약)

1. chat_proposals 테이블 + inbox API (백엔드)
2. SalesInboxPage 웹 검토화면 (프론트)
3. 엔드투엔드 수동 1회 테스트(과거 txt로 제안 등록→승인→반영)
4. 매일 17:00 스케줄 등록 + 가동
