# Development Setup - Rápido & Produção

## 🚀 Desenvolvimento Local (RECOMENDADO)

### Setup Inicial
```powershell
# Apenas UMA VEZ para instalar dependências
cd d:\DATAPrev\WorkSafety\frontend
npm install

cd d:\DATAPrev\WorkSafety\WorkSafetyWeb
npm install
```

### Backend + Frontend Local
```powershell
# Terminal 1: Backend em Docker
cd d:\DATAPrev\WorkSafety
docker-compose -f infra/docker-compose.yml up db redis backend worker

# Terminal 2: Frontend Dev Server (HMR automático)
cd d:\DATAPrev\WorkSafety\frontend
npm run dev
```

**Acessa:** http://localhost:3000/worksafety/

**Benefícios:**
- ✅ HMR instantâneo (mudanças aparecem em <1s)
- ✅ Console errors/warnings em tempo real
- ✅ Sem rebuild Docker
- ✅ Muito mais rápido iteração

---

## 🐳 Produção via Docker

### Build & Run
```powershell
cd d:\DATAPrev\WorkSafety

# Primeira execução (demora mais, ~5-10min)
docker-compose -f infra/docker-compose.yml up -d --build

# Próximas execuções (rápido, ~30s - usa cache)
docker-compose -f infra/docker-compose.yml up -d
```

**Acessa:** http://localhost:3000/worksafety/

---

## 📋 Comparação Rápida

| Aspecto | Dev Local | Docker |
|---------|-----------|--------|
| **Speed** | ⚡ Instantâneo | 🐢 5-10min primeiro build |
| **HMR** | ✅ Sim | ❌ Não |
| **Início** | 5s | 30-60s |
| **Para** | Desenvolvimento | Produção/Staging |
| **Cache** | N/A | ✅ Reutiliza |

---

## 🛠️ Troubleshooting

### Frontend não conecta com backend local
```powershell
# Verificar se backend está rodando
docker ps | findstr backend
```

### Clear cache Docker (força rebuild)
```powershell
docker system prune -a
docker-compose -f infra/docker-compose.yml down -v
docker-compose -f infra/docker-compose.yml up -d --build
```

### Limpar node_modules local
```powershell
cd d:\DATAPrev\WorkSafety\frontend
rm -r node_modules
npm install
```

---

## 📝 Notas
- Backend sempre roda via Docker (mais fácil)
- Frontend pode rodar local (dev) ou Docker (produção)
- Base path sempre `/worksafety/` para consistência
- Encryption key está em `frontend/.env` (VITE_STORAGE_KEY)
