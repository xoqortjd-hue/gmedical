@echo off
echo 🔍 시스템 환경 확인 중...

echo.
echo === Node.js 버전 확인 ===
node --version
npm --version

echo.
echo === 현재 디렉토리 파일 목록 ===
dir

echo.
echo === package.json 확인 ===
if exist package.json (
    echo ✅ package.json 파일 존재
) else (
    echo ❌ package.json 파일 없음
)

echo.
echo === client 폴더 확인 ===
if exist client (
    echo ✅ client 폴더 존재
    cd client
    if exist package.json (
        echo ✅ client/package.json 파일 존재
    ) else (
        echo ❌ client/package.json 파일 없음
    )
    cd ..
) else (
    echo ❌ client 폴더 없음
)

echo.
echo === 의존성 설치 시작 ===
echo 백엔드 의존성 설치 중...
npm install

if %errorlevel% equ 0 (
    echo ✅ 백엔드 의존성 설치 성공
) else (
    echo ❌ 백엔드 의존성 설치 실패
    echo 오류 코드: %errorlevel%
    pause
    exit /b 1
)

echo.
echo 프론트엔드 의존성 설치 중...
cd client
npm install

if %errorlevel% equ 0 (
    echo ✅ 프론트엔드 의존성 설치 성공
    cd ..
) else (
    echo ❌ 프론트엔드 의존성 설치 실패
    echo 오류 코드: %errorlevel%
    cd ..
    pause
    exit /b 1
)

echo.
echo 데이터베이스 초기화 중...
npm run init-db

if %errorlevel% equ 0 (
    echo ✅ 데이터베이스 초기화 성공
) else (
    echo ❌ 데이터베이스 초기화 실패
    echo 오류 코드: %errorlevel%
)

echo.
echo 🎉 설치 완료! 다음 명령어로 실행하세요:
echo 1. npm run dev (백엔드 서버)
echo 2. 새 터미널에서: cd client && npm start (프론트엔드)

pause
