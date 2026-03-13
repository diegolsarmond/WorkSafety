# Implementação LGPD/GDPR - Conformidade de Privacidade

## Resumo

Esta implementação adiciona conformidade com LGPD (Lei Geral de Proteção de Dados) e GDPR (General Data Protection Regulation) ao sistema WorkSafety, garantindo que dados pessoais em evidências (imagens) sejam tratados de acordo com as regulamentações.

## Critérios de Aceite Atendidos

### 1. Base Legal por Avaliação ✅

- Campo `legal_basis` em `RiskAssessment` com as seguintes opções:
  - `consent` - Consentimento do titular
  - `legitimate_interest` - Interesse legítimo (padrão)
  - `legal_obligation` - Cumprimento de obrigação legal
  - `contract` - Execução de contrato
  - `public_interest` - Missão de interesse público
  - `vital_interest` - Proteção da vida

- Campo `legal_basis_notes` para justificativa adicional

- Base legal exposta em:
  - Serializers (list, detail, create/update)
  - Admin Django
  - Relatórios PDF (dados de compliance)

### 2. Anonimização de Evidências ✅

- **Serviço de Anonimização** (`assessments/anonymization.py`):
  - Detecção de rostos usando OpenCV Haar Cascade
  - Anonimização via blur, pixelate ou blackout
  - TODO explícito para placas de veículos
  - Flag `ANONYMIZATION_BLOCK_PLATES` para ambientes que exigem

- **Pipeline de Upload** (`EvidenceUploadView`):
  - Anonimização síncrona por padrão
  - Fallback para processamento assíncrono via Celery
  - Arquivo persistido já está anonimizado

- **Task Celery** (`anonymize_evidence_task`):
  - Processamento assíncrono para casos de erro
  - Batch processing para reprocessamento em lote

- **Campos de Rastreamento** no modelo `Evidence`:
  - `is_anonymized` - Indica se foi processada
  - `anonymized_at` - Timestamp da anonimização
  - `anonymization_status` - Estado do processo (pending/processing/completed/failed/skipped)
  - `original_file_hash` - SHA-256 do arquivo original (para auditoria)

### 3. Logs e Auditoria ✅

- **Modelo `EvidenceAnonymizationLog`**:
  - Registro de todas as operações de anonimização
  - Contadores de rostos/placas detectados e anonimizados
  - Duração do processamento
  - Usuário que executou
  - Mensagens de erro

- **Integração com PDF**:
  - Verificação de anonimização antes de gerar PDF
  - Dados de compliance LGPD incluídos no relatório
  - Garantia de que imagens no PDF estão anonimizadas

### 4. Minimização de Dados ✅

- Hash do arquivo original armazenado apenas para auditoria
- Arquivo final é sempre a versão anonimizada
- Logs detalhados para rastreabilidade
- Configurações para desabilitar anonimização em desenvolvimento

## Configurações

Adicione ao `settings.py` ou via variáveis de ambiente:

```python
# Habilitar/desabilitar anonimização (default: True)
ANONYMIZATION_ENABLED = True

# Bloquear upload se placas não forem anonimizadas (default: False)
ANONYMIZATION_BLOCK_PLATES = False

# Método de anonimização: 'blur', 'pixelate', 'blackout' (default: 'blur')
ANONYMIZATION_METHOD = 'blur'

# Tamanho do kernel de blur (deve ser ímpar, default: 51)
ANONYMIZATION_BLUR_KERNEL = 51
```

## Dependências

Adicionada ao `requirements.txt`:
```
opencv-python>=4.9.0
```

## Migrações

Arquivo: `assessments/migrations/0014_lgpd_privacy_compliance.py`

Inclui:
- Campos `legal_basis` e `legal_basis_notes` em RiskAssessment
- Campos de anonimização em Evidence
- Criação do modelo EvidenceAnonymizationLog
- Índices para performance de consultas

## Testes

Arquivo: `assessments/tests/test_privacy_lgpd.py`

Cobertura:
- Modelos (LegalBasis, Evidence anonymization fields)
- Serviço de anonimização
- Serializers
- Integração com upload
- Auditoria e logs

Execute com:
```bash
cd backend
python manage.py test assessments.tests.test_privacy_lgpd
```

## Admin Django

Atualizado para incluir:
- Campos LGPD em RiskAssessment
- Status de anonimização em Evidence
- Inline de logs de anonimização
- Filtros e buscas adicionais

## API Endpoints

### Upload de Evidências
```
POST /api/assessments/{id}/upload/
```

Agora inclui processo automático de anonimização.

### Dados de Avaliação
```
GET /api/assessments/{id}/
```

Retorna campos `legal_basis`, `legal_basis_display`, `legal_basis_notes`.

### Evidências
Todas as respostas de evidência incluem:
- `is_anonymized`
- `anonymization_status`
- `anonymized_at`
- `privacy_status` (resumo)

## TODOs e Limitações

1. **Anonimização de Placas**: 
   - Não implementada atualmente
   - Sempre retorna 0 detectados
   - Flag `ANONYMIZATION_BLOCK_PLATES` disponível para ambientes que exigem
   - Sugestões para implementação futura:
     - Treinar modelo Haar Cascade customizado
     - Usar OCR (Tesseract/EasyOCR)
     - Modelo de deep learning (YOLO)

2. **Performance**:
   - Anonimização síncrona pode adicionar latência ao upload
   - Para grandes volumes, considere aumentar workers do Celery

3. **Precisão**:
   - Haar Cascade pode não detectar todos os rostos
   - Falsos positivos são possíveis
   - Recomenda-se validação humana periódica

## Segurança

- Arquivos originais não são mantidos (apenas hash para auditoria)
- URLs públicas sempre apontam para versão anonimizada
- Logs detalhados permitem rastreabilidade completa
- Configurações sensíveis via environment variables

## Compatibilidade

- Mantém compatibilidade com código existente
- Campos novos têm valores padrão sensíveis
- Anonimização pode ser desabilitada via configuração
- Fallbacks implementados para erros de processamento
