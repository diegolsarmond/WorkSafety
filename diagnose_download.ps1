# ==========================================
# DIAGNÓSTICO DE PROBLEMA: /worksafety/api/reports/*/download/
# ==========================================

Write-Host "╔═══════════════════════════════════════════════════╗"
Write-Host "║ DIAGNÓSTICO: Report Download via Nginx         ║"
Write-Host "╚═══════════════════════════════════════════════════╝" -ForegroundColor Cyan

$baseUrl = "http://localhost:3000"
$backendUrl = "http://localhost:8000"

# ==========================================
# 1. VERIFICAR SE DOCKER ESTÁ RODANDO
# ==========================================
Write-Host "`n[1] Verificando se Docker está rodando..." -ForegroundColor Yellow
docker ps --filter "name=backend" --format "{{.Status}}"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker não está rodando. Inicie com: docker-compose up -d" -ForegroundColor Red
    exit 1
}

# ==========================================
# 2. LISTAR RELATÓRIOS EXISTENTES
# ==========================================
Write-Host "`n[2] Listando relatórios existentes no banco..." -ForegroundColor Yellow

$reportList = @"
curl -s "$backendUrl/api/reports/" `
  -H "Authorization: Bearer YOUR_TOKEN_HERE" | python -m json.tool
"@

Write-Host "Comando para listar relatórios (requer autenticação):"
Write-Host $reportList -ForegroundColor Gray

# Tenta sem autenticação para ver a resposta
Write-Host "`nTentando listar relatórios sem autenticação..."
$response = curl -s -w "`n%{http_code}" "$backendUrl/api/reports/" 2>&1
$statusCode = $response[-1]
$body = $response[0..($response.Count-2)] -join "`n"

Write-Host "Status: $statusCode"
if ($statusCode -eq "200" -or $statusCode -eq "401") {
    Write-Host "✓ Endpoint /api/reports/ está respondendo"
    if ($statusCode -eq "401") {
        Write-Host "  (Requer autenticação, o que é esperado)" -ForegroundColor Gray
    }
} else {
    Write-Host "❌ Erro ao acessar /api/reports/: Status $statusCode" -ForegroundColor Red
}

# ==========================================
# 3. TENTAR ACESSAR REPORT DIRETO NO BACKEND
# ==========================================
Write-Host "`n[3] Testando acesso direto ao backend..." -ForegroundColor Yellow

# Tenta com report_id = 1 (provavelmente existe)
Write-Host "Testando: GET $backendUrl/api/reports/1/download/"
$response = curl -s -w "`n%{http_code}" "$backendUrl/api/reports/1/download/" 2>&1
$statusCode = $response[-1]

Write-Host "Status: $statusCode"
if ($statusCode -eq "200") {
    Write-Host "✓ Download funciona no backend!" -ForegroundColor Green
} elseif ($statusCode -eq "404") {
    Write-Host "❌ Report 1 não encontrado" -ForegroundColor Red
    Write-Host "   (Procure um report_id que exista)" -ForegroundColor Gray
} else {
    Write-Host "❌ Erro: $statusCode" -ForegroundColor Red
}

# ==========================================
# 4. TENTAR ACESSAR VIA NGINX /worksafety/api/
# ==========================================
Write-Host "`n[4] Testando acesso via Nginx (/worksafety/api/)..." -ForegroundColor Yellow

Write-Host "Testando: GET $baseUrl/worksafety/api/reports/1/download/"
$response = curl -s -w "`n%{http_code}" "$baseUrl/worksafety/api/reports/1/download/" 2>&1
$statusCode = $response[-1]

Write-Host "Status: $statusCode"
if ($statusCode -eq "200") {
    Write-Host "✓ Download funciona via Nginx!" -ForegroundColor Green
} elseif ($statusCode -eq "404") {
    Write-Host "❌ ERRO 404 via Nginx (rewrite pode estar quebrado)" -ForegroundColor Red
    Write-Host "   Backend retornou: Status code 404" -ForegroundColor Red
} elseif ($statusCode -eq "000") {
    Write-Host "❌ Erro de conexão (Nginx pode não estar rodando)" -ForegroundColor Red
} else {
    Write-Host "❌ Erro HTTP: $statusCode" -ForegroundColor Red
}

# ==========================================
# 5. VERIFICAR LOGS DO NGINX
# ==========================================
Write-Host "`n[5] Últimas requisições nos logs do Nginx..." -ForegroundColor Yellow

Write-Host "`nComando para ver logs em tempo real:"
Write-Host "docker-compose logs -f nginx" -ForegroundColor Gray

Write-Host "`nÚltimos logs (últimas 20 linhas):"
docker-compose logs --tail=20 nginx 2>&1 | Where-Object { $_ -like "*404*" -or $_ -like "*download*" -or $_ -like "*worksafety*" }

# ==========================================
# 6. VERIFICAR LOGS DO DJANGO
# ==========================================
Write-Host "`n[6] Últimas requisições nos logs do Django..." -ForegroundColor Yellow

Write-Host "`nComando para ver logs em tempo real:"
Write-Host "docker-compose logs -f backend" -ForegroundColor Gray

Write-Host "`nÚltimos logs (últimas 30 linhas):"
docker-compose logs --tail=30 backend 2>&1 | Where-Object { $_ -like "*404*" -or $_ -like "*download*" -or $_ -like "*reports*" }

# ==========================================
# 7. VERIFICAR CONFIGURAÇÃO DO NGINX
# ==========================================
Write-Host "`n[7] Analisando configuração do Nginx..." -ForegroundColor Yellow

Write-Host "`nConfigurações relevantes encontradas:"

Write-Host "`n  a) Location /api/ (direto):" -ForegroundColor Cyan
Write-Host '     proxy_pass http://backend/api/;' -ForegroundColor Gray

Write-Host "`n  b) Location /worksafety/api/ (via rewrite):" -ForegroundColor Cyan
Write-Host '     rewrite ^/worksafety/api/(.*)$ /api/$1 break;' -ForegroundColor Gray
Write-Host '     proxy_pass http://backend;' -ForegroundColor Gray

Write-Host "`n  📌 PROBLEMA IDENTIFICADO:" -ForegroundColor Red
Write-Host "     A rewrite está correta, MAS verificar se:" -ForegroundColor Yellow
Write-Host "     1. Nginx está com a config atualizada?" -ForegroundColor Gray
Write-Host "     2. O proxy_pass http://backend sem /api/ está correto?" -ForegroundColor Gray
Write-Host "     3. Existe conflito com outras locations?" -ForegroundColor Gray

# ==========================================
# 8. VERIFICAR ARQUIVO NO DISCO
# ==========================================
Write-Host "`n[8] Verificando se arquivos existem no disco..." -ForegroundColor Yellow

$mediaPath = "backend/media/reports/2026/03"
if (Test-Path $mediaPath) {
    $files = Get-ChildItem $mediaPath -Filter "*.pdf"
    Write-Host "✓ Pasta $mediaPath existe"
    Write-Host "  Relatórios encontrados: $($files.Count)"
    
    if ($files.Count -gt 0) {
        Write-Host "  Primeiro relatório: $($files[0].Name)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Nenhum PDF encontrado nesta pasta" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Pasta $mediaPath não encontrada" -ForegroundColor Red
}

# ==========================================
# 9. VERIFICAR PERMISSÕES NO DOCKER
# ==========================================
Write-Host "`n[9] Verificando permissões dentro do Docker..." -ForegroundColor Yellow

Write-Host "`nComande para verificar inside the container:"
Write-Host "docker-compose exec backend ls -la /app/media/reports/2026/03/" -ForegroundColor Gray

Write-Host "`nOu check se /app/media está montado:"
Write-Host "docker-compose exec backend mount | grep media" -ForegroundColor Gray

# ==========================================
# RESUMO
# ==========================================
Write-Host "`n╔═══════════════════════════════════════════════════╗"
Write-Host "║ PRÓXIMAS AÇÕES                                    ║"
Write-Host "╚═══════════════════════════════════════════════════╝" -ForegroundColor Cyan

Write-Host @"

📋 CHECKLIST A VERIFICAR:

1. ✓ Docker rodando?
   - docker-compose ps

2. ✓ Nginx em pé?
   - Tenta http://localhost:3000/health (deve retornar 200)

3. ✓ Backend em pé?
   - curl http://localhost:8000/api/reports/ (pode ser 401, mas não 502)

4. ✓ Relatórios existem?
   - Procurar um que REALMENTE existe e tentar acessar

5. ✓ Nginx reescrita está funcionando?
   - Verificar nos logs se "/worksafety/api/..." virou "/api/..."

COMANDO DE TESTE FINAL (substitua REPORT_ID por um existente):

  # Direto no backend (sem Nginx)
  curl -v "http://localhost:8000/api/reports/REPORT_ID/download/"

  # Via Nginx com rewrite
  curl -v "http://localhost:3000/worksafety/api/reports/REPORT_ID/download/"

Se uma funciona e outra não, o problema é no Nginx!
"@ -ForegroundColor Cyan

Write-Host "`nPara logs contínuos:"
Write-Host "  Nginx:  docker-compose logs -f nginx" -ForegroundColor Gray
Write-Host "  Django: docker-compose logs -f backend" -ForegroundColor Gray
