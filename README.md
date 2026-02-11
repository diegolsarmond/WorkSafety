# WorkSafety

Monorepo do projeto WorkSafety (prevenção / segurança no trabalho).

## Estrutura

- **backend/** — API Django (REST, JWT, auth, lockout). Ver [backend/README.md](backend/README.md).
- **infra/** — Docker Compose (PostgreSQL + backend).
- **documentacao/** — Documentos de visão e planejamento.

## Subir o backend localmente

```bash
cd infra
docker compose up -d
```

Depois crie um usuário e teste o login conforme [backend/README.md](backend/README.md).
