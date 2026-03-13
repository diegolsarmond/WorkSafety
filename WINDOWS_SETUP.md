# Setup no Windows (PowerShell)

## 🔴 Problemas Comuns

### 1. Redis já está rodando
A porta 6379 já está em uso porque o Redis já está rodando no Docker. ✅ **Não precisa fazer nada!**

### 2. Comando 'celery' não encontrado
O ambiente virtual Python não está criado ou ativado.

---

## ✅ Passo a Passo

### Passo 1: Preparar Backend (execute no PowerShell)

```powershell
# Entrar na pasta do backend
cd D:\DATAPrev\WorkSafety\backend

# Criar ambiente virtual (só primeira vez)
python -m venv venv

# Ativar ambiente virtual
.\venv\Scripts\Activate.ps1

# Instalar dependências
pip install -r requirements.txt
```

---

### Passo 2: Iniciar Celery Worker (Terminal 1)

```powershell
cd D:\DATAPrev\WorkSafety\backend
.\venv\Scripts\Activate.ps1
celery -A config worker -l info
```

**Deve aparecer:**
```
[tasks]
  . assessments.tasks.process_assessment
  . assessments.tasks.reprocess_assessment

[INFO] Connected to redis://localhost:6379/0
```

---

### Passo 3: Iniciar Django (Terminal 2)

```powershell
cd D:\DATAPrev\WorkSafety\backend
.\venv\Scripts\Activate.ps1
python manage.py runserver
```

---

### Passo 4: Iniciar Frontend (Terminal 3)

```powershell
cd D:\DATAPrev\WorkSafety\frontend
npm run dev
```

---

## 🚀 Script Automático

Execute no PowerShell como Administrador:

```powershell
# Permitir execução de scripts
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Executar script de setup
cd D:\DATAPrev\WorkSafety
.\START_WINDOWS.ps1
```

---

## 🧪 Testando

1. Acesse http://localhost:3000
2. Faça login
3. Crie uma nova inspeção com fotos
4. Acompanhe nos logs:
   - **Terminal Celery**: Deve mostrar "Processing assessment X"
   - **Terminal Django**: Requisições HTTP
   - **Navegador**: Tela de "AI Analysis in Progress"

---

## ❗ Troubleshooting

### "python não é reconhecido"
Instale o Python 3.10+ do https://python.org e marque "Add to PATH"

### "npm não é reconhecido"
Instale o Node.js do https://nodejs.org

### "Erro de permissão no PowerShell"
Execute: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

### Redis parou de funcionar
```powershell
docker ps
# Se não aparecer, inicie:
docker run -d -p 6379:6379 redis:alpine
```
