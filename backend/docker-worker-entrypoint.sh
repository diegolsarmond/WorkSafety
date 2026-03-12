#!/bin/sh
# Entrypoint para o worker Celery

echo "Waiting for database..."
while ! python -c "import socket; s = socket.socket(socket.AF_INET, socket.SOCK_STREAM); s.connect(('${POSTGRES_HOST:-db}', ${POSTGRES_PORT:-5432})); s.close()" 2>/dev/null; do
  sleep 1
done
echo "Database is ready!"

echo "Waiting for Redis..."
while ! python -c "import socket; s = socket.socket(socket.AF_INET, socket.SOCK_STREAM); s.connect(('${REDIS_HOST:-redis}', ${REDIS_PORT:-6379})); s.close()" 2>/dev/null; do
  sleep 1
done
echo "Redis is ready!"

# Executar comando passado como argumento (ou padrão)
exec "$@"
