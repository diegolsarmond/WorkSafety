from django.db import models
from django.contrib.auth.models import AbstractUser


def normalize_email(email):
    if not email:
        return ""
    return email.strip().lower()


class User(AbstractUser):
    """User with email as main identifier (login)."""
    username = None
    email = models.EmailField("email", unique=True)
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def save(self, *args, **kwargs):
        self.email = normalize_email(self.email)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.email


class LoginAttempt(models.Model):
    """Lockout tracking for existing users only (OneToOne per user)."""
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="login_attempt",
    )
    failed_count = models.PositiveIntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    locked_until = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "tentativa de login"
        verbose_name_plural = "tentativas de login"
