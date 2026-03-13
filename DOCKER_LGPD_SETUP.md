# Setup LGPD/GDPR no Docker

## 1. Rebuild da Imagem (necessário - OpenCV)

Como adicionamos `opencv-python` como dependência, é necessário rebuild da imagem Docker:

```bash
cd d:\DATAPrev\WorkSafety\infra
docker-compose down
docker-compose up -d --build
```

Isso vai:
- Instalar as bibliotecas de sistema necessárias para OpenCV
- Instalar `opencv-python` no container
- Subir todos os serviços

## 2. Aplicar Migrações

```bash
cd d:\DATAPrev\WorkSafety\infra
docker-compose exec backend python manage.py migrate
```

## 3. Verificar se tudo subiu corretamente

```bash
cd d:\DATAPrev\WorkSafety\infra
docker-compose ps
```

Deve mostrar:
```
NAME                STATUS
docker-db-1         Up
docker-redis-1      Up
docker-backend-1    Up
docker-worker-1     Up
```

## 4. Verificar logs do Worker (Celery)

O worker deve mostrar as novas tasks de anonimização:

```bash
cd d:\DATAPrev\WorkSafety\infra
docker-compose logs worker | grep "anonymize"
```

Deve aparecer:
```
[tasks]
  . assessments.tasks.anonymize_evidence_task
  . assessments.tasks.batch_anonymize_assessment_evidences
```

## 5. Executar Testes

```bash
cd d:\DATAPrev\WorkSafety\infra
docker-compose exec backend python manage.py test assessments.tests.test_privacy_lgpd -v 2
```

## 6. Verificar no Admin

Acesse: http://localhost:8000/admin/

Novos campos visíveis:
- **RiskAssessment**: campos "Base legal LGPD" e "Notas da base legal"
- **Evidence**: campos "Anonimizado", "Status da anonimização", "Anonimizado em"
- **EvidenceAnonymizationLog**: novo modelo de auditoria

## Comandos Úteis

### Ver logs de anonimização em tempo real
```bash
cd d:\DATAPrev\WorkSafety\infra
docker-compose logs -f worker | grep -i "anonymiz\|privacy\|lgpd"
```

### Testar upload de imagem com anonimização
```bash
# Fazer login e obter token primeiro
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "seu@email.com", "password": "sua_senha"}'

# Upload de imagem
curl -X POST http://localhost:8000/api/assessments/1/upload/ \
  -H "Authorization: Bearer <seu_token>" \
  -F "images=@foto_teste.jpg"
```

### Verificar status das evidências
```bash
curl http://localhost:8000/api/assessments/1/ \
  -H "Authorization: Bearer <seu_token>"
```

Deve retornar:
```json
{
  "evidences": [{
    "is_anonymized": true,
    "anonymization_status": "completed",
    "privacy_status": {
      "is_anonymized": true,
      "anonymization_status": "completed"
    }
  }],
  "legal_basis": "legitimate_interest",
  "legal_basis_display": "Interesse legítimo"
}
```

## Troubleshooting

### Erro: "ImportError: libGL.so.1: cannot open shared object file"

Isso significa que o rebuild não foi feito corretamente:

```bash
cd d:\DATAPrev\WorkSafety\infra
docker-compose down
docker-compose build --no-cache backend worker
docker-compose up -d
```

### Worker não aparece nos logs

```bash
cd d:\DATAPrev\WorkSafety\infra
docker-compose restart worker
docker-compose logs -f worker
```

### Limpar tudo e recomeçar

```bash
cd d:\DATAPrev\WorkSafety\infra
docker-compose down -v
docker-compose up -d --build
```

## Configurações Opcionais

Para desabilitar anonimização em desenvolvimento, adicione ao `backend/.env`:

```
ANONYMIZATION_ENABLED=false
```

E restart os containers:
```bash
cd d:\DATAPrev\WorkSafety\infra
docker-compose restart backend worker
```
