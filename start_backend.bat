@echo off
chcp 65001 >nul
echo ===================================
echo   WorkSafety - Backend Startup
echo ===================================
echo.

cd /d D:\DATAPrev\WorkSafety\backend

if not exist venv (
    echo 📦 Criando ambiente virtual...
    python -m venv venv
)

echo 🔄 Ativando ambiente virtual...
call venv\Scripts\activate.bat

echo 📥 Instalando dependências...
pip install -r requirements.txt

echo ✅ Pronto! Iniciando Django...
python manage.py runserver

pause
