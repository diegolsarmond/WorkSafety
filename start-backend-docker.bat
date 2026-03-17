@echo off
chcp 65001 >nul
echo ======================================
echo   WorkSafety - Backend Only (Docker)
echo ======================================
echo.

:: Mudar para pasta do script
cd /d "%~dp0"

echo Verificando Docker...
:CHECK_DOCKER
docker ps >nul 2>&1
if errorlevel 1 (
    echo Docker nao esta pronto ainda. Aguardando...
    timeout /t 3 /nobreak >nul
    goto CHECK_DOCKER
)

echo OK - Docker esta rodando
echo.
echo Iniciando apenas o backend (sem frontend)...
echo   - PostgreSQL (porta 5432)
echo   - Redis      (porta 6379)
echo   - Django API (porta 8000)
echo   - Celery Worker
echo.

docker-compose -f infra/docker-compose.yml up -d db redis backend worker

if errorlevel 1 (
    echo.
    echo ERRO ao iniciar containers!
    echo Verifique se nao ha portas em uso (5432, 6379, 8000)
    pause
    exit /b 1
)

echo.
echo ======================================
echo   BACKEND INICIADO COM SUCESSO!
echo ======================================
echo.
echo URLs disponiveis:
echo   API:       http://localhost:8000
echo   Postgres:  localhost:5432
echo   Redis:     localhost:6379
echo.
echo Comandos uteis:
echo   Ver logs:  docker-compose -f infra/docker-compose.yml logs -f
echo   Parar:     docker-compose -f infra/docker-compose.yml down
echo.
echo Proximo passo - Inicie o frontend:
echo   cd frontend ^&^& npm run dev
echo.
pause
