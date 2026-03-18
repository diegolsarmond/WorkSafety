@echo off
echo ======================================
echo   WorkSafety - Backend Only (Docker)
echo ======================================
echo.

:: Mudar para pasta do script
cd /d "%~dp0"

echo Verificando Docker...
docker ps >nul 2>&1
if errorlevel 1 (
    echo.
    echo ============================================
    echo  ATENCAO: Docker nao esta rodando!
    echo ============================================
    echo.
    echo Certifique-se de que:
    echo  1. Docker Desktop esta instalado
    echo  2. Docker Desktop foi iniciado
    echo.
    echo Inicie o Docker Desktop e tente novamente.
    echo.
    pause
    exit /b 1
)

echo OK - Docker esta rodando
echo.
echo Iniciando apenas o backend:
echo   - PostgreSQL ( porta 5432)
echo   - Redis      ( porta 6379)
echo   - Django API ( porta 8000)
echo   - Celery Worker
echo.
echo Aguarde...
echo.

docker-compose -f infra/docker-compose.yml up -d db redis backend worker

if errorlevel 1 (
    echo.
    echo ERRO ao iniciar containers!
    pause
    exit /b 1
)

echo.
echo ======================================
echo   BACKEND INICIADO COM SUCESSO!
echo ======================================
echo.
echo Acesse:
echo   API:  http://localhost:8000
echo.
echo Outros comandos:
echo   Ver logs:  docker-compose -f infra/docker-compose.yml logs -f
echo   Parar:     docker-compose -f infra/docker-compose.yml down
echo.
echo Agora inicie o frontend:
echo   cd frontend
echo   npm run dev
echo.
pause
