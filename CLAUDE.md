# CLAUDE.md - 금양메디칼 의료기기 재고관리 시스템

## 프로젝트 개요
금양메디칼의 의료기기(수술용 장비) 입출고 및 재고 관리 웹 시스템.
병원별 장비 배치, 출고/입고 처리, 리포트 생성, CEO 대시보드 등을 제공.

## 기술 스택
- **Frontend**: React 18 (CRA), CSS3
- **Backend**: Node.js, Express.js
- **Database**: SQLite3 (파일: `database/inventory.db`)
- **배포**: AWS EC2 (Ubuntu), Nginx, PM2, Let's Encrypt SSL
- **도메인**: `keumyang.cloud` (가비아 등록, Elastic IP 연결)

## 프로젝트 구조
```
server.js                    # Express 서버 진입점 (포트 5000)
routes/
  lending-routes.js          # 장비 대여/이동/리포트 API
  hospital-routes.js         # 병원 관리 API
database/
  inventory.db               # SQLite DB
  schema.sql                 # 스키마 정의
client/src/
  pages/                     # 데스크톱 페이지
    ReportPage.js             # 리포트 (인쇄, 특이사항, 섹션 선택)
    CEODashboardPage.js       # CEO 대시보드
    LendingPage.js            # 장비 대여 관리
  pages/mobile/              # 모바일 페이지
    SalesInOutRegisterPage.js # 입출고 등록 (핵심 페이지)
    MobileReportPage.js       # 모바일 리포트
    SalesStatusDashboard.js   # 영업팀 현황판
  styles/
    main.css                  # 데스크톱 스타일
    mobile.css                # 모바일 스타일
```

## 주요 DB 테이블
- `products` - 제품(장비) 정보
- `hospitals` - 병원 목록 (id=2는 부산사무실=입고 상태)
- `lending_items` - 장비 대여 현황
- `lending_movements` - 장비 이동 기록 (moved_by 담당자)
- `staff_members` - 담당자 관리 (이름, 활성 상태)
- `report_notes` - 리포트 특이사항 (기간별 저장)

## 개발 워크플로우
```
로컬 코드 수정 → localhost:3000 핫서버 확인 → git push → AWS에서 git pull & npm run build & pm2 restart
```

## 빌드 & 실행
```bash
# 로컬 프론트엔드 개발 서버
cd client && npm start          # localhost:3000

# AWS 배포
ssh ubuntu@3.35.128.229
cd ~/medical-inventory-system
git pull origin clean-main
cd client && npm run build
pm2 restart all
```

## API 엔드포인트 요약
- `GET/POST /api/staff` - 담당자 조회/추가
- `GET /api/lending/items` - 장비 목록
- `POST /api/lending/move` - 장비 이동 처리
- `GET /api/lending/report/transaction-summary` - 병원별 수술 건수
- `GET /api/lending/report/equipment-status` - 장비 입출고 현황
- `GET /api/lending/report/sales-status` - 영업팀 현황판
- `GET/POST /api/lending/report/note` - 리포트 특이사항

## 주의사항
- `hospital_id = 2`는 부산사무실 (입고 상태 판별 기준)
- 장비 중복 제거 로직: `product_name` 기준 최신 `deploy_date` 유지
- 프론트엔드 `.env.local`의 `REACT_APP_API_URL`은 `https://keumyang.cloud`
- 인쇄 시 `handlePrint()`에서 새 창 생성 후 커스텀 HTML 렌더링
- 제외 필터(병원/장비)는 localStorage, 특이사항은 DB 저장
