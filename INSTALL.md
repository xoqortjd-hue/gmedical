# 의약품 재고관리 시스템 - 설치 가이드

## 빠른 설치 (다른 컴퓨터)

### 1. 저장소 복제
```bash
git clone https://github.com/your-username/medical-inventory-system.git
cd medical-inventory-system
```

### 2. 자동 설치 및 실행
**Windows:**
```bash
install.bat
start.bat
```

**Mac/Linux:**
```bash
chmod +x install.sh start.sh
./install.sh
./start.sh
```

### 3. 수동 설치 (단계별)
```bash
# 1. 백엔드 의존성 설치
npm install

# 2. 프론트엔드 의존성 설치
cd client
npm install
cd ..

# 3. 데이터베이스 초기화
npm run init-db

# 4. 백엔드 실행 (터미널 1)
npm run dev

# 5. 프론트엔드 실행 (터미널 2)
cd client && npm start
```

### 4. 접속
- 백엔드: http://localhost:5000
- 프론트엔드: http://localhost:3000

## 시스템 요구사항
- Node.js 16.0 이상
- npm 8.0 이상
- 웹 브라우저 (Chrome, Firefox, Safari)

## 문제 해결
- Node.js 미설치: https://nodejs.org 에서 LTS 버전 다운로드
- 권한 오류: 관리자 권한으로 명령 프롬프트 실행
- 포트 충돌: package.json에서 포트 변경

## 추가 설정
- 하드웨어 바코드 스캐너: USB 연결 후 자동 인식
- 데이터베이스 백업: database/inventory.db 파일 복사
- 환경 변수: .env 파일로 포트 및 설정 변경

## 지원
문제 발생시 GitHub Issues에 문의하세요.
