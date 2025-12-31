# 🏥 의약품 재고관리 시스템 MVP

Claude Code CLI로 개발된 웹 기반 의약품 재고관리 시스템입니다.

![시스템 미리보기](https://via.placeholder.com/800x400/667eea/ffffff?text=Medical+Inventory+System)

## ✨ 주요 기능

### 🔍 **바코드 스캔**
- 웹 카메라를 이용한 실시간 바코드 스캔
- EAN-13, Code128 등 주요 바코드 형식 지원
- 수동 바코드 입력 옵션

### 📦 **입출고 관리**
- 직관적인 입고/출고 처리
- 실시간 재고 수량 업데이트
- 재고 부족 시 자동 경고

### 📋 **바이오로직(소모품) 관리**
- 입고, 출고, 재고현황의 완전한 워크플로우 지원
- 창구(Location)별 재고 관리
- 유통기한 기반 상태 관리 (🔴 임박, 🟡 주의, 🟢 정상)
- GS1-128 및 DataMatrix 유통기한 자동 추출

### 📊 **재고 현황**
- 전체 제품 및 바이오로직 재고 현황 조회
- 최신 입고순 및 유통기한순 자동 정렬
- 삭제 모드를 통한 간편한 재고 정리

### ⚠️ **안전재고 알림**
- 안전재고 이하 제품 자동 감지
- 우선순위별 알림 표시
- 권장 발주량 자동 계산

### 📋 **거래 이력**
- 모든 입출고 내역 추적
- 거래 통계 및 분석
- 필터링 및 검색 기능

## 🛠️ 기술 스택

- **Frontend**: React 18 + CSS3
- **Backend**: Node.js + Express
- **Database**: SQLite3
- **Barcode**: QuaggaJS
- **HTTP Client**: Axios

## 📋 시스템 요구사항

- **Node.js**: 16.0 이상
- **웹 브라우저**: Chrome, Firefox, Safari (최신 버전)
- **카메라**: 바코드 스캔을 위한 웹캠 (선택사항)

## 🚀 빠른 시작

### 1️⃣ 자동 설치 (권장)

**Windows:**
```bash
install.bat
```

**Mac/Linux:**
```bash
chmod +x install.sh
./install.sh
```

### 2️⃣ 수동 설치

```bash
# 1. 저장소 클론
git clone <repository-url>
cd medical-inventory-system

# 2. 백엔드 의존성 설치
npm install

# 3. 프론트엔드 의존성 설치
cd client
npm install
cd ..

# 4. 데이터베이스 초기화
npm run init-db
```

### 3️⃣ 시스템 실행

**옵션 A: 자동 실행 스크립트**
```bash
# Windows
start.bat

# Mac/Linux
chmod +x start.sh
./start.sh
```

**옵션 B: 수동 실행**
```bash
# 터미널 1: 백엔드 서버
npm run dev

# 터미널 2: 프론트엔드 서버
cd client
npm start
```

### 4️⃣ 접속

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

## 📱 사용법

### 🔸 제품 입고
1. "입고" 페이지로 이동
2. 바코드 스캔 또는 수동 입력
3. 입고 수량 입력
4. "입고 처리" 버튼 클릭

### 🔸 제품 출고
1. "출고" 페이지로 이동
2. 바코드 스캔 또는 수동 입력
3. 출고 수량 입력 (재고 확인)
4. "출고 처리" 버튼 클릭

### 🔸 재고 현황 확인
1. "재고현황" 페이지에서 전체 제품 조회
2. 검색창으로 특정 제품 찾기
3. 컬럼 클릭으로 정렬

### 🔸 알림 확인
1. "알림" 페이지에서 저재고 제품 확인
2. 우선순위에 따른 발주 계획 수립

## 🗄️ 데이터베이스 구조

```sql
-- 제품 마스터
products (
  id INTEGER PRIMARY KEY,
  barcode TEXT UNIQUE,
  name TEXT,
  current_stock INTEGER,
  safety_stock INTEGER,
  unit_price REAL,
  category TEXT -- 'EQUIPMENT', 'BIOLOGIC' 등
)

-- 창구/위치 정보
channels (
  id INTEGER PRIMARY KEY,
  name TEXT,
  code TEXT UNIQUE
)

-- 바이오로직 상세 재고 (Lending Items)
lending_items (
  id INTEGER PRIMARY KEY,
  product_id INTEGER,
  channel_id INTEGER,
  batch_id INTEGER,
  quantity INTEGER,
  expiration_date TEXT,
  lot_number TEXT,
  serial_number TEXT,
  status TEXT
)

-- 입출고 및 배치 로그 (Lending Movements)
lending_movements (
  id INTEGER PRIMARY KEY,
  lending_item_id INTEGER,
  type TEXT, -- 'IN', 'OUT'
  quantity INTEGER,
  channel_id INTEGER,
  hospital_id INTEGER,
  created_at DATETIME
)
```

## 🔧 설정

### 환경 변수
```bash
# .env 파일 (선택사항)
PORT=5000
DB_PATH=./database/inventory.db
```

### 포트 변경
- 백엔드: `server.js`에서 `PORT` 변수 수정
- 프론트엔드: `client/package.json`의 `proxy` 설정 확인

## 🎯 MVP 범위

### ✅ 포함된 기능
- 웹 카메라 및 모바일 카메라 바코드 스캔
- GS1-128 / DataMatrix 파싱 및 유통기한 자동 인식
- 창구별 바이오로직 입출고 및 재고 관리
- 유통기한 상태 알림 (D-Day 계산)
- 기구/장비 등록 및 수리 내역 관리

### ❌ 향후 버전 (제외)
- 이메일/SMS 알림
- 실시간 대시보드 고도화 (현재는 요약 정보 위주)
- 다중 사용자 세부 권한 (Role-based)

## 🚨 문제 해결

### 카메라 접근 오류
```bash
# HTTPS 환경에서만 카메라 접근 가능
# 개발 환경에서는 localhost는 예외 적용됨
```

### 데이터베이스 오류
```bash
# 데이터베이스 재초기화
npm run init-db
```

### 포트 충돌
```bash
# 실행 중인 프로세스 확인
netstat -ano | findstr :3000
netstat -ano | findstr :5000

# 프로세스 종료 (Windows)
taskkill /PID <PID번호> /F
```

### 의존성 오류
```bash
# node_modules 삭제 후 재설치
rm -rf node_modules package-lock.json
npm install

# 프론트엔드도 동일하게
cd client
rm -rf node_modules package-lock.json
npm install
```

## 📦 빌드 및 배포

### 프로덕션 빌드
```bash
# 프론트엔드 빌드
cd client
npm run build
cd ..

# 서버 시작 (빌드된 파일 제공)
npm start
```

### Docker 배포 (선택사항)
```dockerfile
# Dockerfile 예시
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .
RUN cd client && npm install && npm run build

EXPOSE 5000
CMD ["npm", "start"]
```

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참고하세요.

## 👨‍💻 개발자

- **개발 도구**: Claude Code CLI
- **개발 기간**: 3개월 MVP
- **아키텍처**: 풀스택 웹 애플리케이션

## 📞 지원

문제나 질문이 있으시면 Issues 탭에서 문의해주세요.

---

**🎉 Claude Code CLI로 개발된 실용적인 재고관리 시스템입니다!**
