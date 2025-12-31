@echo off
echo ========================================
echo 의약품 재고관리 시스템 시작
echo ========================================
echo.

echo [1/3] 백엔드 서버 시작 중...
start "Backend Server" cmd /k "cd /d %~dp0 && npm run dev"
timeout /t 5 /nobreak > nul

echo [2/3] 프론트엔드 서버 시작 중...
start "Frontend Server" cmd /k "cd /d %~dp0client && npm start"
timeout /t 10 /nobreak > nul

echo [3/3] Cloudflare 터널 시작 중...
start "Cloudflare Tunnel" cmd /k "cd /d %~dp0 && .\cloudflared.exe tunnel --url http://localhost:3000"

echo.
echo ========================================
echo 모든 서버가 시작되었습니다!
echo ========================================
echo.
echo [중요] Cloudflare Tunnel 터미널에서 HTTPS URL을 확인하세요.
echo 예: https://xxx-xxx-xxx.trycloudflare.com
echo.
echo 해당 URL + /mobile/home 으로 모바일 접속
echo.
pause

