from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager


def normalize_email(email):
    if not email:
        return ""
    return email.strip().lower()


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **kwargs):
        if not email:
            raise ValueError("Email é obrigatório.")
        email = self.normalize_email(email)
        user = self.model(email=email, **kwargs)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **kwargs):
        kwargs.setdefault("is_staff", True)
        kwargs.setdefault("is_superuser", True)
        return self.create_user(email, password, **kwargs)


class User(AbstractUser):
    """User with email as main identifier (login)."""
    username = None
    email = models.EmailField("email", unique=True)
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

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
