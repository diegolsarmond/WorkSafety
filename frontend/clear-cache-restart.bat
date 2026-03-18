@echo off
echo Clearing caches and restarting WorkSafety frontend...

:: Kill any running node processes on port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a 2>nul
    echo Stopped process PID: %%a
)

:: Clear npm cache
echo Clearing npm cache...
npm cache clean --force 2>nul

:: Remove .vite cache if exists
if exist ".vite" (
    rmdir /s /q ".vite" 2>nul
    echo Cleared .vite cache
)

:: Clear dist folder
if exist "dist" (
    rmdir /s /q "dist" 2>nul
    echo Cleared dist folder
)

:: Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

echo Starting development server...
npm run dev
