"""
Production settings. Uses base and enforces secure defaults.
"""
from .base import *  # noqa: F401, F403

DEBUG = False

# WhiteNoise for static files in production
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
