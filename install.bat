@echo off
echo 🚀 의약품 재고관리 시스템 설치 시작...

REM 1. 백엔드 의존성 설치
echo 📦 백엔드 의존성 설치 중...
call npm install
if %errorlevel% neq 0 (
    echo ❌ 백엔드 의존성 설치 실패
    exit /b 1
)

REM 2. 프론트엔드 의존성 설치
echo 📦 프론트엔드 의존성 설치 중...
cd client
call npm install
if %errorlevel% neq 0 (
    echo ❌ 프론트엔드 의존성 설치 실패
    exit /b 1
)
cd ..

REM 3. 데이터베이스 초기화
echo 🗄️ 데이터베이스 초기화 중...
call npm run init-db
if %errorlevel% neq 0 (
    echo ❌ 데이터베이스 초기화 실패
    exit /b 1
)

echo ✅ 설치 완료!
echo.
echo 🎉 실행 방법:
echo   1. 백엔드 서버: npm run dev
echo   2. 프론트엔드 (새 명령 프롬프트): cd client ^&^& npm start
echo   3. 브라우저에서 http://localhost:3000 접속
echo.
echo 📚 더 자세한 정보는 README.md를 참고하세요

pause
