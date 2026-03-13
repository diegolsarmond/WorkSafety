# PowerShell Script para iniciar o WorkSafety no Windows
# Execute: .\START_WINDOWS.ps1

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  WorkSafety - Startup Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se Python está instalado
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python encontrado: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python não encontrado!" -ForegroundColor Red
    Write-Host "Por favor, instale o Python 3.10+ e adicione ao PATH" -ForegroundColor Yellow
    exit 1
}

# Entrar na pasta backend
Set-Location backend

# Criar ambiente virtual se não existir
if (-Not (Test-Path "venv")) {
    Write-Host "📦 Criando ambiente virtual..." -ForegroundColor Yellow
    python -m venv venv
}

# Ativar ambiente virtual
Write-Host "🔄 Ativando ambiente virtual..." -ForegroundColor Yellow
& .\venv\Scripts\Activate.ps1

# Instalar dependências
Write-Host "📥 Instalando dependências..." -ForegroundColor Yellow
pip install -r requirements.txt --quiet

Write-Host ""
Write-Host "==================================" -ForegroundColor Green
Write-Host "  Setup completo!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""
Write-Host "Para iniciar os serviços, execute em TERMINAIS SEPARADOS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "TERMINAL 1 - Celery Worker:" -ForegroundColor Yellow
Write-Host "  cd backend" -ForegroundColor White
Write-Host "  .\venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "  celery -A config worker -l info" -ForegroundColor White
Write-Host ""
Write-Host "TERMINAL 2 - Django Server:" -ForegroundColor Yellow
Write-Host "  cd backend" -ForegroundColor White
Write-Host "  .\venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "  python manage.py runserver" -ForegroundColor White
Write-Host ""
Write-Host "TERMINAL 3 - Frontend:" -ForegroundColor Yellow
Write-Host "  cd frontend" -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""
