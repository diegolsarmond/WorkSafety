#!/bin/bash
# WorkSafety - Production Quick Start Script
# Use este script para iniciar rápido o ambiente de produção

set -e

echo "=========================================="
echo "  WorkSafety Production Quick Start"
echo "=========================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se estamos no diretório correto
if [ ! -f "infra/docker-compose.prod.yml" ]; then
    echo -e "${RED}❌ Erro: Execute este script da raiz do projeto WorkSafety${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Pre-checks...${NC}"

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker não está instalado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker encontrado${NC}"

# Verificar Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose não está instalado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose encontrado${NC}"

# Verificar arquivos de configuração
echo ""
echo -e "${YELLOW}🔍 Verificando arquivos de configuração...${NC}"

if [ ! -f "backend/.env.prod" ]; then
    echo -e "${RED}❌ backend/.env.prod não encontrado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ backend/.env.prod encontrado${NC}"

if [ ! -f "infra/docker-compose.prod.yml" ]; then
    echo -e "${RED}❌ infra/docker-compose.prod.yml não encontrado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ docker-compose.prod.yml encontrado${NC}"

if [ ! -f "infra/nginx-prod.conf" ]; then
    echo -e "${RED}❌ infra/nginx-prod.conf não encontrado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ nginx-prod.conf encontrado${NC}"

echo ""
echo -e "${YELLOW}⚠️  SEGURANÇA: Verifique antes de continuar...${NC}"
echo ""
echo "  1. Você atualizou SECRET_KEY em backend/.env.prod?"
echo "  2. Você alterou POSTGRES_PASSWORD para uma senha forte?"
echo "  3. Você configurou EMAIL_HOST_USER e EMAIL_HOST_PASSWORD?"
echo "  4. Você tem OLIMPIA_API_KEY da Dataprev?"
echo ""
read -p "  Deseja continuar? (s/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo -e "${YELLOW}Abortado. Configure .env.prod e tente novamente.${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}🔨 Building Docker images...${NC}"
docker-compose -f infra/docker-compose.prod.yml build --parallel

echo ""
echo -e "${YELLOW}🚀 Iniciando serviços...${NC}"
docker-compose -f infra/docker-compose.prod.yml up -d

echo ""
echo -e "${YELLOW}⏳ Aguardando banco de dados estar pronto...${NC}"
sleep 10

echo ""
echo -e "${YELLOW}📊 Status dos serviços:${NC}"
docker-compose -f infra/docker-compose.prod.yml ps

echo ""
echo -e "${YELLOW}🔄 Aplicando migrações do banco...${NC}"
docker-compose -f infra/docker-compose.prod.yml exec -T backend python manage.py migrate

echo ""
echo -e "${YELLOW}📁 Coletando arquivos estáticos...${NC}"
docker-compose -f infra/docker-compose.prod.yml exec -T backend python manage.py collectstatic --noinput

echo ""
echo -e "${GREEN}✅ Deployment realizado com sucesso!${NC}"
echo ""
echo "=========================================="
echo "  Próximos Passos:"
echo "=========================================="
echo ""
echo "1. Criar superusuário (admin):"
echo "   docker-compose -f infra/docker-compose.prod.yml exec backend python manage.py createsuperuser"
echo ""
echo "2. Verificar logs:"
echo "   docker-compose -f infra/docker-compose.prod.yml logs -f"
echo ""
echo "3. Acessar a aplicação:"
echo "   http://200.152.38.136:3000/worksafety/"
echo "   http://200.152.38.136:3000/admin/"
echo ""
echo "4. Verificar health checks:"
echo "   curl http://localhost:3000/health"
echo "   curl http://localhost:8000/api/health/"
echo ""
echo "=========================================="
