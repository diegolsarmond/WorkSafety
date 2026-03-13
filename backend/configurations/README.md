# Configurações Administrativas

Este app Django (`configurations`) implementa as funcionalidades F16.1, F16.2, F16.3 e F16.6 do sistema WorkSafety.

## Funcionalidades Implementadas

### F16.1 - Tipos de Avaliação (`AssessmentType`)
- Cadastrar, editar e desativar tipos de avaliação
- Endpoint: `/api/admin/assessment-types/`
- Campos: `name`, `description`, `active`

### F16.2 - Tipos de Ambiente (`EnvironmentType`)
- Cadastrar, editar e desativar tipos de ambiente (canteiro, mina, fábrica, etc.)
- Endpoint: `/api/admin/environment-types/`
- Campos: `name`, `description`, `active`
- Tipos de ambiente são selecionáveis na criação de avaliações

### F16.3 - Tipos de Risco (`RiskType`)
- Cadastrar, editar e desativar tipos de risco
- Endpoint: `/api/admin/risk-types/`
- Campos: `name`, `description`, `active`
- Tipos de risco são utilizados na classificação das inferências da IA

### F16.6 - Thresholds da IA (`AIThreshold`)
- Configurar o limiar mínimo de confiança para classificações automáticas
- Endpoint: `/api/admin/ai-thresholds/`
- Valor padrão: 60%
- Alterações são registradas em log de auditoria
- Endpoints específicos:
  - `GET /api/admin/ai-thresholds/confidence/current/` - Obter threshold atual
  - `PUT /api/admin/ai-thresholds/confidence/` - Atualizar threshold

### Log de Auditoria (`AuditLog`)
- Registra todas as alterações nas configurações
- Endpoint: `/api/admin/audit-logs/`
- Ações registradas: CREATE, UPDATE, DELETE, DEACTIVATE, ACTIVATE
- Campos: `entity_type`, `entity_id`, `action`, `previous_value`, `new_value`, `performed_by`, `timestamp`

## Permissões

- **Leitura (GET)**: Qualquer usuário autenticado
- **Escrita (POST, PUT, PATCH, DELETE)**: Apenas administradores (`is_staff=True`)

## Endpoints

### Assessment Types
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/admin/assessment-types/` | Listar tipos de avaliação |
| POST | `/api/admin/assessment-types/` | Criar tipo de avaliação |
| GET | `/api/admin/assessment-types/{id}/` | Obter tipo específico |
| PATCH | `/api/admin/assessment-types/{id}/` | Atualizar tipo |
| DELETE | `/api/admin/assessment-types/{id}/` | Excluir tipo |
| POST | `/api/admin/assessment-types/{id}/deactivate/` | Desativar tipo |
| POST | `/api/admin/assessment-types/{id}/activate/` | Ativar tipo |

### Environment Types
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/admin/environment-types/` | Listar tipos de ambiente |
| POST | `/api/admin/environment-types/` | Criar tipo de ambiente |
| GET | `/api/admin/environment-types/{id}/` | Obter tipo específico |
| PATCH | `/api/admin/environment-types/{id}/` | Atualizar tipo |
| DELETE | `/api/admin/environment-types/{id}/` | Excluir tipo |
| POST | `/api/admin/environment-types/{id}/deactivate/` | Desativar tipo |
| POST | `/api/admin/environment-types/{id}/activate/` | Ativar tipo |

### Risk Types
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/admin/risk-types/` | Listar tipos de risco |
| POST | `/api/admin/risk-types/` | Criar tipo de risco |
| GET | `/api/admin/risk-types/{id}/` | Obter tipo específico |
| PATCH | `/api/admin/risk-types/{id}/` | Atualizar tipo |
| DELETE | `/api/admin/risk-types/{id}/` | Excluir tipo |
| POST | `/api/admin/risk-types/{id}/deactivate/` | Desativar tipo |
| POST | `/api/admin/risk-types/{id}/activate/` | Ativar tipo |

### AI Thresholds
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/admin/ai-thresholds/` | Listar thresholds |
| GET | `/api/admin/ai-thresholds/{id}/` | Obter threshold específico |
| GET | `/api/admin/ai-thresholds/confidence/current/` | Obter threshold atual |
| PUT | `/api/admin/ai-thresholds/confidence/` | Atualizar threshold |

### Audit Logs
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/admin/audit-logs/` | Listar logs de auditoria |
| GET | `/api/admin/audit-logs/{id}/` | Obter log específico |

### Filtros
- `?include_inactive=true` - Incluir entidades inativas nas listagens
- `?entity_type=AssessmentType` - Filtrar logs por tipo de entidade
- `?action=create` - Filtrar logs por ação

## Exemplos de Uso

### Criar um tipo de avaliação
```bash
curl -X POST http://localhost:8000/api/admin/assessment-types/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Auditoria", "description": "Auditoria completa"}'
```

### Atualizar threshold da IA
```bash
curl -X PUT http://localhost:8000/api/admin/ai-thresholds/confidence/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"threshold_value": 75.00}'
```

### Desativar um tipo
```bash
curl -X POST http://localhost:8000/api/admin/assessment-types/1/deactivate/ \
  -H "Authorization: Bearer <token>"
```

## Testes

Execute os testes com:
```bash
cd backend
python manage.py test configurations.tests
```

## Documentação da API

Acesse a documentação interativa (Swagger UI) em:
```
http://localhost:8000/api/docs/
```
