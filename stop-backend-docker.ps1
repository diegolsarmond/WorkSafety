# Script para parar o backend
Write-Host "Parando backend..." -ForegroundColor Yellow

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

& docker-compose -f infra/docker-compose.yml down

if ($LASTEXITCODE -eq 0) {
    Write-Host "OK - Backend parado" -ForegroundColor Green
} else {
    Write-Host "Aviso: Possivel erro ao parar" -ForegroundColor Yellow
}
