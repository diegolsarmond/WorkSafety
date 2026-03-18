@echo off
echo Parando backend...

cd /d "%~dp0"
docker-compose -f infra/docker-compose.yml down

echo OK - Backend parado
pause
