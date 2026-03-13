@echo off
chcp 65001 >nul
echo ===================================
echo   WorkSafety - Celery Worker
echo ===================================
echo.

cd /d D:\DATAPrev\WorkSafety\backend

echo 🔄 Ativando ambiente virtual...
call venv\Scripts\activate.bat

echo 🤖 Iniciando Celery Worker...
celery -A config worker -l info

pause
