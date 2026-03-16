"""
Django base settings. Load .env from backend root when running locally.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from backend directory (parent of config)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")
DEBUG = os.environ.get("DEBUG", "false").lower() in ("1", "true", "yes")
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1,200.152.38.136,inovacao.dataprev.gov.br").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    "accounts",
    "assessments",
    "configurations",
    "reports",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # [NEW] Produção: serve estáticos
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# CORS
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "https://inovacao.dataprev.gov.br",
    "http://inovacao.dataprev.gov.br",
    "http://200.152.38.136:8000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]

# CSRF trusted origins (necessário para frontend HTTPS -> backend HTTP)
CSRF_TRUSTED_ORIGINS = [
    "https://inovacao.dataprev.gov.br",
    "http://inovacao.dataprev.gov.br",
    "http://200.152.38.136:8000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

# Database: prefer DATABASE_URL (e.g. postgres://user:pass@host:port/dbname)
# Use SQLite for tests when TESTING=1 so tests run without Postgres
if os.environ.get("TESTING") == "1":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    _db_url = os.environ.get("DATABASE_URL", "")
    if _db_url and _db_url.startswith("postgres://"):
        _db_url = _db_url.replace("postgres://", "postgresql://", 1)
    if _db_url:
        import re
        _match = re.match(
            r"postgresql://(?P<user>[^:]+):(?P<password>[^@]+)@(?P<host>[^:]+):(?P<port>\d+)/(?P<name>\w+)",
            _db_url,
        )
        if _match:
            _g = _match.groupdict()
            DATABASES = {
                "default": {
                    "ENGINE": "django.db.backends.postgresql",
                    "NAME": _g["name"],
                    "USER": _g["user"],
                    "PASSWORD": _g["password"],
                    "HOST": _g["host"],
                    "PORT": _g["port"],
                }
            }
        else:
            DATABASES = {
                "default": {
                    "ENGINE": "django.db.backends.postgresql",
                    "NAME": os.environ.get("POSTGRES_DB", "worksafety"),
                    "USER": os.environ.get("POSTGRES_USER", "worksafety"),
                    "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "worksafety"),
                    "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
                    "PORT": os.environ.get("POSTGRES_PORT", "5432"),
                }
            }
    else:
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "NAME": os.environ.get("POSTGRES_DB", "worksafety"),
                "USER": os.environ.get("POSTGRES_USER", "worksafety"),
                "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "worksafety"),
                "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
                "PORT": os.environ.get("POSTGRES_PORT", "5432"),
            }
        }

AUTH_USER_MODEL = "accounts.User"

# JWT (Simple JWT) – configurable timeout
from datetime import timedelta
_access_min = int(os.environ.get("ACCESS_TOKEN_LIFETIME_MINUTES", "60"))
_refresh_days = int(os.environ.get("REFRESH_TOKEN_LIFETIME_DAYS", "7"))
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=_access_min),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=_refresh_days),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# Lockout
LOCKOUT_MAX_ATTEMPTS = int(os.environ.get("LOCKOUT_MAX_ATTEMPTS", "5"))
LOCKOUT_MINUTES = int(os.environ.get("LOCKOUT_MINUTES", "15"))

# REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# Spectacular (OpenAPI/Swagger)
SPECTACULAR_SETTINGS = {
    "TITLE": "WorkSafety API",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SERVE_PUBLIC": True,
    "COMPONENT_SPLIT_REQUEST": False,
    "SCHEMA_PATH_PREFIX": r"/api/",
    "SCHEMA_PATH_PREFIX_TRIM": False,
    # Desabilitar validação estrita para evitar erros 500
    "PREPROCESSING_HOOKS": [],
    "POSTPROCESSING_HOOKS": [],
}

# Default primary key
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# i18n / static (minimal for API)
LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# [NEW] Produção: WhiteNoise para arquivos estáticos
if not DEBUG:
    STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Password reset (F17.4) — expiração do token em segundos (Django PasswordResetTokenGenerator)
PASSWORD_RESET_TIMEOUT = int(os.environ.get("PASSWORD_RESET_TIMEOUT", "3600"))  # 1h default

# Email (MVP: console backend para reset de senha)
EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend",
)
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "noreply@worksafety.local")

# Segurança F4.4 — baseline para produção (TLS via reverse proxy)
# Em produção: definir SECURE_HTTPS=1 e usar proxy com TLS 1.2+ que envia X-Forwarded-Proto: https
_SECURE_HTTPS = os.environ.get("SECURE_HTTPS", "0").lower() in ("1", "true", "yes")
if _SECURE_HTTPS:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = True

# Celery Configuration
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_ENABLE_UTC = True

# AI Service Configuration
AI_SERVICE_ENABLED = os.environ.get("AI_SERVICE_ENABLED", "true").lower() in ("1", "true", "yes")
AI_SERVICE_TIMEOUT = int(os.environ.get("AI_SERVICE_TIMEOUT", "30"))
AI_SERVICE_MOCK_MODE = os.environ.get("AI_SERVICE_MOCK_MODE", "true").lower() in ("1", "true", "yes")
AI_SERVICE_BASE_URL = os.environ.get("AI_SERVICE_BASE_URL", "")
AI_SERVICE_API_KEY = os.environ.get("AI_SERVICE_API_KEY", "")

# Logging: invalid login attempts
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
        },
    },
    "loggers": {
        "accounts": {
            "handlers": ["console"],
            "level": "INFO",
        },
        "assessments": {
            "handlers": ["console"],
            "level": "INFO",
        },
    },
}
