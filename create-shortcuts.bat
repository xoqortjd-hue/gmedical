@echo off
chcp 65001 > nul
echo ========================================
echo Creating Desktop Shortcuts...
echo ========================================
echo.

set DESKTOP=%USERPROFILE%\Desktop
set SOURCE_DIR=%~dp0

echo [1/2] Creating START shortcut...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%DESKTOP%\START-Server.lnk'); $s.TargetPath = '%SOURCE_DIR%start-all.bat'; $s.WorkingDirectory = '%SOURCE_DIR%'; $s.IconLocation = 'shell32.dll,137'; $s.Save()"

echo [2/2] Creating STOP shortcut...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%DESKTOP%\STOP-Server.lnk'); $s.TargetPath = '%SOURCE_DIR%stop-all.bat'; $s.WorkingDirectory = '%SOURCE_DIR%'; $s.IconLocation = 'shell32.dll,132'; $s.Save()"

echo.
echo ========================================
echo Desktop shortcuts created!
echo ========================================
echo.
echo Check your desktop:
echo   - START-Server.lnk
echo   - STOP-Server.lnk
echo.
pause
