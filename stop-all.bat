@echo off
echo ========================================
echo 모든 서버 종료 중...
echo ========================================

taskkill /FI "WindowTitle eq Backend Server*" /T /F 2>nul
taskkill /FI "WindowTitle eq Frontend Server*" /T /F 2>nul
taskkill /FI "WindowTitle eq ngrok Tunnel*" /T /F 2>nul

echo.
echo 모든 서버가 종료되었습니다.
echo.
pause
