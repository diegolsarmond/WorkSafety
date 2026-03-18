# Script PowerShell para iniciar apenas o backend via Docker

$ErrorActionPreference = "Stop"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  WorkSafety - Backend Only (Docker)  " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Funcao para verificar se Docker esta disponivel
function Test-DockerAvailable {
    try {
        # Tentar executar docker ps
        $result = & cmd /c "docker ps 2>&1"
        if ($result -match "CONTAINER" -or $result -match "REPOSITORY") {
            return $true
        }
        # Verifica se erro eh de daemon
        if ($result -match "daemon" -or $result -match "running") {
            Write-Host "Docker encontrado, mas o daemon nao esta rodando." -ForegroundColor Yellow
            return $false
        }
        return $false
    } catch {
        return $false
    }
}

# Verificar Docker
if (-not (Test-DockerAvailable)) {
    Write-Host "ERRO: Docker nao esta disponivel." -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifique se:" -ForegroundColor Yellow
    Write-Host "  1. Docker Desktop esta instalado" -ForegroundColor White
    Write-Host "  2. Docker Desktop esta rodando (inicie o aplicativo)" -ForegroundColor White
    Write-Host "  3. Docker esta no PATH do sistema" -ForegroundColor White
    Write-Host ""
    Write-Host "Tentando alternativa com 'docker' diretamente..." -ForegroundColor Gray
    
    # Tentar verificar via Get-Command
    $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
    if ($dockerCmd) {
        Write-Host "Docker encontrado em: $($dockerCmd.Source)" -ForegroundColor Green
    } else {
        Write-Host "Docker nao encontrado no PATH. Instale o Docker Desktop." -ForegroundColor Red
        exit 1
    }
}

Write-Host "OK - Docker detectado" -ForegroundColor Green
Write-Host ""

# Navegar para o diretorio do script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "Iniciando servicos de backend..." -ForegroundColor Yellow
Write-Host "  - PostgreSQL" -ForegroundColor Gray
Write-Host "  - Redis" -ForegroundColor Gray
Write-Host "  - Django Backend" -ForegroundColor Gray
Write-Host "  - Celery Worker" -ForegroundColor Gray
Write-Host ""

# Iniciar apenas os servicos de backend usando cmd
cmd /c "docker-compose -f infra/docker-compose.yml up -d db redis backend worker"

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERRO ao iniciar containers (codigo: $LASTEXITCODE)" -ForegroundColor Red
    Write-Host "Tentando comando alternativo..." -ForegroundColor Yellow
    
    # Tentar com docker compose (nova sintaxe)
    cmd /c "docker compose -f infra/docker-compose.yml up -d db redis backend worker"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRO: Nao foi possivel iniciar os containers" -ForegroundColor Red
        exit 1
    }
}

Write-Host "" 
Write-Host "OK - Backend iniciado!" -ForegroundColor Green
Write-Host ""
Write-Host "URLs:" -ForegroundColor Cyan
Write-Host "  API:       http://localhost:8000" -ForegroundColor White
Write-Host "  Postgres:  localhost:5432" -ForegroundColor White
Write-Host "  Redis:     localhost:6379" -ForegroundColor White
Write-Host ""
Write-Host "Logs:  docker-compose -f infra/docker-compose.yml logs -f" -ForegroundColor Gray
Write-Host "Parar: docker-compose -f infra/docker-compose.yml down" -ForegroundColor Gray
Write-Host ""
Write-Host "Dica: Rode 'npm run dev' na pasta frontend/" -ForegroundColor Yellow
