"""
Local/dev settings. Uses base and overrides for development.
"""
from .base import *  # noqa: F401, F403

DEBUG = True
ALLOWED_HOSTS = ["*"]
