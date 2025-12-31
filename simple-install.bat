@echo off
chcp 65001 >nul
echo System Environment Check...

echo.
echo === Node.js Version Check ===
node --version
npm --version

echo.
echo === Current Directory Files ===
dir

echo.
echo === package.json Check ===
if exist package.json (
    echo package.json file exists
) else (
    echo package.json file missing
)

echo.
echo === client folder Check ===
if exist client (
    echo client folder exists
    cd client
    if exist package.json (
        echo client/package.json file exists
    ) else (
        echo client/package.json file missing
    )
    cd ..
) else (
    echo client folder missing
)

echo.
echo === Installing Backend Dependencies ===
echo Installing backend dependencies...
npm install

if %errorlevel% equ 0 (
    echo Backend dependencies installed successfully
) else (
    echo Backend dependencies installation failed
    echo Error code: %errorlevel%
    pause
    exit /b 1
)

echo.
echo Installing frontend dependencies...
cd client
npm install

if %errorlevel% equ 0 (
    echo Frontend dependencies installed successfully
    cd ..
) else (
    echo Frontend dependencies installation failed
    echo Error code: %errorlevel%
    cd ..
    pause
    exit /b 1
)

echo.
echo Initializing database...
npm run init-db

if %errorlevel% equ 0 (
    echo Database initialization successful
) else (
    echo Database initialization failed
    echo Error code: %errorlevel%
)

echo.
echo Installation Complete! Run the following commands:
echo 1. npm run dev (backend server)
echo 2. In new terminal: cd client && npm start (frontend)

pause
