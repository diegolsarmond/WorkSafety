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
