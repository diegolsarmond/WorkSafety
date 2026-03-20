#!/usr/bin/env python3
"""
DIAGNOSTICO: Report Download via Nginx
Teste se /worksafety/api/reports/*/download/ funciona
"""

import requests
import subprocess
import json
import sys
import os
from pathlib import Path

print("=" * 60)
print("DIAGNOSTICO: Report Download via Nginx")
print("=" * 60)

backendUrl = "http://localhost:8000"
nginxUrl = "http://localhost:3000"

# [1] Check if docker is running
print("\n[1] Verificando se Docker esta rodando...")
result = subprocess.run(["docker", "ps", "--filter", "name=backend", "--format", "{{.Names}}"], 
                       capture_output=True, text=True)
if result.returncode == 0 and result.stdout.strip():
    print("OK - Docker container 'backend' esta rodando")
else:
    print("ERRO - Docker nao esta rodando")
    sys.exit(1)

# [2] List existing reports
print("\n[2] Listando relatorios existentes...")
mediaPath = Path("backend/media/reports/2026/03")
if mediaPath.exists():
    reports = list(mediaPath.glob("*.pdf"))
    print(f"OK - Encontrados {len(reports)} PDFs em {mediaPath}")
    if reports:
        print(f"    Primeiro: {reports[0].name}")
        reportIds = [int(r.name.split('_')[2]) for r in reports[:5]]
        print(f"    IDs existentes: {reportIds}")
else:
    print(f"ERRO - Pasta {mediaPath} nao encontrada")

# [3] Test backend directly
print("\n[3] Testando acesso direto ao backend...")
if reports:
    testReportId = reportIds[0]
    url = f"{backendUrl}/api/reports/{testReportId}/download/"
    print(f"    GET {url}")
    try:
        resp = requests.get(url, timeout=5, allow_redirects=False)
        print(f"    Status: {resp.status_code}")
        if resp.status_code == 200:
            print("    OK - Download funciona no backend!")
        elif resp.status_code == 404:
            print("    ERRO - Report nao encontrado no backend")
        else:
            print(f"    ERRO - Resposta inesperada: {resp.status_code}")
    except Exception as e:
        print(f"    ERRO - Nao conseguiu conectar ao backend: {e}")

# [4] Test via Nginx
print("\n[4] Testando acesso via Nginx (/worksafety/api/)...")
if reports:
    url = f"{nginxUrl}/worksafety/api/reports/{testReportId}/download/"
    print(f"    GET {url}")
    try:
        resp = requests.get(url, timeout=5, allow_redirects=False)
        print(f"    Status: {resp.status_code}")
        if resp.status_code == 200:
            print("    OK - Download funciona via Nginx!")
        elif resp.status_code == 404:
            print("    ERRO - 404 via Nginx (problema no rewrite ou backend)")
            print("\n    Detalhes:")
            print(f"    Content-Length: {resp.headers.get('Content-Length', 'N/A')}")
            if resp.text:
                print(f"    Response: {resp.text[:200]}")
        else:
            print(f"    ERRO - Status {resp.status_code}")
    except Exception as e:
        print(f"    ERRO - Nao conseguiu conectar via Nginx: {e}")

# [5] Test simple API endpoint via both paths
print("\n[5] Testando endpoint simples (/api/reports/) para comparacao...")
try:
    # Direto
    resp1 = requests.get(f"{backendUrl}/api/reports/", timeout=5)
    print(f"    Backend /api/reports/: {resp1.status_code}")
except Exception as e:
    print(f"    Backend erro: {e}")

try:
    # Via Nginx
    resp2 = requests.get(f"{nginxUrl}/worksafety/api/reports/", timeout=5)
    print(f"    Nginx /worksafety/api/reports/: {resp2.status_code}")
except Exception as e:
    print(f"    Nginx erro: {e}")

# [6] Check Nginx config
print("\n[6] Verificando configuracao do Nginx...")
configPath = Path("infra/nginx-local.conf")
if configPath.exists():
    content = configPath.read_text()
    if "location /worksafety/api/" in content:
        print("    OK - Config /worksafety/api/ encontrada")
        # Find the rewrite line
        for i, line in enumerate(content.split('\n')):
            if '/worksafety/api/' in line:
                for j in range(max(0, i-2), min(len(content.split('\n')), i+5)):
                    print(f"        {content.split(chr(10))[j]}")
                break
    else:
        print("    ERRO - Config /worksafety/api/ nao encontrada")
else:
    print(f"    ERRO - {configPath} nao encontrado")

print("\n" + "=" * 60)
print("RESUMO DO DIAGNOSTICO")
print("=" * 60)
print("""
Se AMBOS os testes funcionaram (status 200):
  -> Problema resolvido!

Se BACKEND funciona mas NGINX nao (404):
  -> Problema no Nginx:
     1. Rewrite pode nao estar sendo aplicado
     2. proxy_pass pode estar incorreto
     3. Nginx pode estar usando config desatualizada

Se NENHUM dos dois funciona:
  -> Problema no Django ou arquivo ausente

PROXIMOS PASSOS:
1. Verifique logs do Nginx:
   docker-compose logs nginx | grep 404

2. Verifique logs do Django:
   docker-compose logs backend | grep download

3. Force reload do Nginx:
   docker-compose restart nginx

4. Valide a config do Nginx:
   docker-compose exec nginx nginx -t
""")
