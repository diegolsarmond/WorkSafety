# WorkSafety - Docker Cheat Sheet

## 🚀 Comandos Rápidos

### Subir TUDO (com o Worker Celery novo)
```bash
cd infra
docker-compose up -d --build
```

### Ver se está rodando
```bash
docker-compose ps
```

**Deve mostrar:**
```
NAME                STATUS
docker-db-1         Up
docker-redis-1      Up
docker-backend-1    Up
docker-worker-1     Up   <- IMPORTANTE!
```

---

## 🐛 Se o Worker não estiver rodando

### Opção 1: Subir só o worker
```bash
cd infra
docker-compose up -d worker
```

### Opção 2: Rebuild e subir tudo
```bash
cd infra
docker-compose down
docker-compose up -d --build
```

### Opção 3: Ver logs do worker
```bash
cd infra
docker-compose logs -f worker
```

---

## 📊 Logs Úteis

### Ver logs do Worker (Celery)
```bash
cd infra
docker-compose logs -f worker
```

**Deve aparecer:**
```
[tasks]
  . assessments.tasks.process_assessment
  . assessments.tasks.reprocess_assessment
  . assessments.tasks.cleanup_stalled_processes
  . reports.tasks.generate_report
  
[INFO] Connected to redis://redis:6379/0
[INFO] worker ready
```

### Ver logs do Backend (Django)
```bash
cd infra
docker-compose logs -f backend
```

### Ver logs de TUDO
```bash
cd infra
docker-compose logs -f
```

---

## 🔄 Reiniciar após mudanças no código

### Backend/Python mudou:
```bash
cd infra
docker-compose restart backend worker
```

### Frontend mudou:
```bash
cd frontend
npm run dev
```

---

## 🧪 Testar o Fluxo Completo

1. **Subir tudo:**
   ```bash
   cd infra
   docker-compose up -d --build
   ```

2. **Verificar worker:**
   ```bash
   docker-compose ps
   # Deve mostrar worker como "Up"
   ```

3. **Ver logs do worker:**
   ```bash
   docker-compose logs -f worker
   ```

4. **Acessar app:** http://localhost:3000

5. **Fazer uma inspeção com fotos**

6. **Ver no log do worker:**
   ```
   [INFO] Starting AI processing for assessment 123
   [INFO] Assessment 123 processed successfully. Found 2 risks.
   ```

---

## 📄 Geração de Relatórios PDF (BE-03)

### Verificar se a task está carregada
```bash
cd infra
docker-compose logs worker | grep "reports.tasks.generate_report"
# Deve mostrar: . reports.tasks.generate_report
```

### Gerar relatório via API
```bash
# Requer autenticação admin
curl -X POST http://localhost:8000/api/admin/assessments/1/generate-report/ \
  -H "Authorization: Bearer <seu_token>"

# Resposta:
# {"message": "Report generation queued successfully", "report_id": 1, "task_id": "...", "status": "generating"}
```

### Ver logs da geração de relatório
```bash
cd infra
docker-compose logs -f worker | grep "PDF\|report"
```

**Log esperado:**
```
[INFO] Starting PDF generation for report 1
[INFO] Report 1 generated successfully in 3.45s (2 evidences)
[INFO] PDF Generation Performance: 3.45s for 2 images (target: 15s for 10 images)
```

### Listar relatórios
```bash
curl http://localhost:8000/api/admin/reports/ \
  -H "Authorization: Bearer <seu_token>"
```

---

## ❌ Parar tudo

```bash
cd infra
docker-compose down
```

---

## 🆘 Troubleshooting

### "worker keeps restarting"
```bash
docker-compose logs worker
# Verifique se o Redis está acessível
```

### "Cannot connect to Redis"
Verifique se o serviço redis está healthy:
```bash
docker-compose ps
```

### Limpar tudo e recomeçar
```bash
cd infra
docker-compose down -v  # -v remove volumes
docker-compose up -d --build
```
