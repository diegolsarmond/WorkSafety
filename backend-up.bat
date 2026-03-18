@echo off
cd /d "%~dp0"
docker-compose -f infra/docker-compose.yml up -d db redis backend worker
if errorlevel 1 pause
