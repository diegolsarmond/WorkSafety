"""
Local/dev settings. Uses base and overrides for development.
"""
from .base import *  # noqa: F401, F403

DEBUG = True
ALLOWED_HOSTS = ["*"]

# Desabilitar USE_X_FORWARDED_HOST em desenvolvimento
# Evita erros quando proxies enviam X-Forwarded-Host inválido (ex: "_")
USE_X_FORWARDED_HOST = False
