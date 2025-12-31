@echo off
echo 🏥 의약품 재고관리 시스템 시작...

REM 데이터베이스 확인
if not exist "database\inventory.db" (
    echo ⚠️ 데이터베이스가 없습니다. 초기화를 실행합니다...
    call npm run init-db
)

echo 🔄 시스템 시작 중...
echo.
echo 📝 다음 단계를 따라주세요:
echo   1. 이 창에서 백엔드 서버가 시작됩니다
echo   2. 새 명령 프롬프트 창을 열어주세요
echo   3. 새 창에서: cd client ^&^& npm start 실행
echo   4. 브라우저에서 http://localhost:3000 접속
echo.
echo 🖥️ 백엔드 서버 시작 중... (포트 5000)

REM 백엔드 서버 시작
call npm run dev
