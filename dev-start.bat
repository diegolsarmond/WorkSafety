@echo off
REM Quick Development Setup Script for WorkSafety

if "%1"=="" (
    echo Usage: dev-start.bat [dev|prod|stop]
    echo.
    echo  dev     - Start backend in Docker + frontend HMR dev server
    echo  prod    - Start everything via Docker (production)
    echo  stop    - Stop all containers
    exit /b 1
)

if "%1"=="dev" (
    echo.
    echo ========================================
    echo Starting Backend (Docker)...
    echo ========================================
    echo.
    docker-compose -f infra/docker-compose.yml up db redis backend worker -d
    
    echo.
    echo ========================================
    echo Backend started! Now run in another terminal:
    echo   cd frontend
    echo   npm run dev
    echo ========================================
    echo.
    exit /b 0
)

if "%1"=="prod" (
    echo.
    echo ========================================
    echo Starting Full Stack (Docker - Production)
    echo ========================================
    echo.
    docker-compose -f infra/docker-compose.yml up -d --build
    
    echo.
    echo ========================================
    echo Production stack started!
    echo Access: http://localhost:3000/worksafety/
    echo ========================================
    echo.
    exit /b 0
)

if "%1"=="stop" (
    echo.
    echo Stopping all containers...
    docker-compose -f infra/docker-compose.yml down
    echo Done.
    exit /b 0
)

echo Invalid command: %1
exit /b 1
