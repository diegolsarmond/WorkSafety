"""
Login and lockout logic. Only persists LoginAttempt for existing users.
"""
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from django.conf import settings
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, LoginAttempt

logger = logging.getLogger("accounts")


def normalize_email(email: str) -> str:
    if not email or not isinstance(email, str):
        return ""
    return email.strip().lower()


def _log_invalid_attempt(user_id: Optional[int], identifier_hash: Optional[str]) -> None:
    """Log failed attempt without PII. Prefer user_id when available, else hash."""
    if user_id is not None:
        logger.warning("Invalid login attempt for user_id=%s", user_id)
    elif identifier_hash:
        logger.warning("Invalid login attempt for identifier_hash=%s", identifier_hash)
    else:
        logger.warning("Invalid login attempt (no identifier)")


def login(email: str, password: str) -> dict:
    """
    Authenticate by email/password with lockout. Returns dict with keys:
    - success: bool
    - status: 'ok' | 'invalid_credentials' | 'locked'
    - data: tokens + user (if ok) or None
    - status_code: 200 | 401 | 429
    """
    email = normalize_email(email)
    if not email or not password:
        return {
            "success": False,
            "status": "invalid_credentials",
            "data": None,
            "status_code": 401,
        }

    # 1) Find user by email (only existing users get lockout records)
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        _log_invalid_attempt(None, hashlib.sha256(email.encode()).hexdigest()[:16])
        return {
            "success": False,
            "status": "invalid_credentials",
            "data": None,
            "status_code": 401,
        }

    # 2) Check lockout for this user
    attempt, _ = LoginAttempt.objects.get_or_create(user=user, defaults={"failed_count": 0})
    now = datetime.now(timezone.utc)
    if attempt.locked_until and attempt.locked_until > now:
        return {
            "success": False,
            "status": "locked",
            "data": None,
            "status_code": 429,
        }

    # 3) Validate password
    if not authenticate(request=None, username=email, password=password):
        # Django authenticate with custom user: username is email
        attempt.failed_count += 1
        attempt.last_attempt_at = now
        if attempt.failed_count >= getattr(settings, "LOCKOUT_MAX_ATTEMPTS", 5):
            lock_minutes = getattr(settings, "LOCKOUT_MINUTES", 15)
            attempt.locked_until = now + timedelta(minutes=lock_minutes)
        attempt.save(update_fields=["failed_count", "last_attempt_at", "locked_until"])
        _log_invalid_attempt(user.id, None)
        return {
            "success": False,
            "status": "invalid_credentials",
            "data": None,
            "status_code": 401,
        }

    # 4) Success: reset lockout and issue tokens
    attempt.failed_count = 0
    attempt.last_attempt_at = None
    attempt.locked_until = None
    attempt.save(update_fields=["failed_count", "last_attempt_at", "locked_until"])

    refresh = RefreshToken.for_user(user)
    data = {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": {"id": user.id, "email": user.email},
    }
    return {
        "success": True,
        "status": "ok",
        "data": data,
        "status_code": 200,
    }
