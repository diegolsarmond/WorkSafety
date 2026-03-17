# Script para verificar status
Write-Host "Containers WorkSafety:" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host ""

& docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>&1 | Select-String "infra-"

Write-Host ""
Write-Host "Ultimos logs:" -ForegroundColor Cyan
Write-Host ""
& docker-compose -f infra/docker-compose.yml logs --tail=5 2>&1
