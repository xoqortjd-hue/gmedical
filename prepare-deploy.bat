@echo off
echo ========================================
echo  의약품 재고관리 시스템 - 배포 준비
echo ========================================

echo.
echo 1. node_modules 폴더 정리...
if exist node_modules rmdir /s /q node_modules
if exist client\node_modules rmdir /s /q client\node_modules

echo 2. 빌드 파일 정리...
if exist client\build rmdir /s /q client\build
if exist database\inventory.db del database\inventory.db

echo 3. 로그 파일 정리...
del /q *.log 2>nul

echo.
echo ========================================
echo  배포 준비 완료!
echo ========================================
echo.
echo 다음 단계:
echo 1. 이 폴더를 GitHub에 업로드하세요
echo 2. 또는 압축하여 공유하세요
echo.
echo GitHub 사용법:
echo - git add .
echo - git commit -m "Ready for deployment"
echo - git push origin main
echo.
pause
