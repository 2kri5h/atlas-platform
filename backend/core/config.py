import os
from typing import Any
import bcrypt

# Patch passlib compatibility with bcrypt >= 4.0
if not hasattr(bcrypt, "__about__"):
    bcrypt.__about__ = type("about", (), {"__version__": getattr(bcrypt, "__version__", "4.0.0")})

if hasattr(bcrypt, "hashpw") and not getattr(bcrypt, "_hashpw_patched", False):
    _orig_hashpw = bcrypt.hashpw
    def _safe_hashpw(password, salt):
        if isinstance(password, bytes) and len(password) > 72:
            password = password[:72]
        return _orig_hashpw(password, salt)
    bcrypt.hashpw = _safe_hashpw
    bcrypt._hashpw_patched = True

from pydantic_settings import BaseSettings
from pydantic import field_validator, model_validator
from functools import lru_cache


def _clean_env_val(val: Any, prefix: str = "") -> str:
    """Clean environment variable values that may have been pasted with key names, quotes or newlines."""
    if not val:
        return ""
    v = str(val).strip().strip('"').strip("'").strip()
    if prefix and v.lower().startswith(f"{prefix.lower()}="):
        v = v[len(prefix) + 1:].strip().strip('"').strip("'").strip()
    elif "=" in v and not (v.startswith("http://") or v.startswith("https://") or v.startswith("sqlite") or v.startswith("postgresql")):
        parts = v.split("=", 1)
        if parts[0].replace("_", "").isalnum():
            v = parts[1].strip().strip('"').strip("'").strip()
    return v


class Settings(BaseSettings):
    PROJECT_NAME: str = "ATLAS Platform"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    DATABASE_URL: str = "sqlite:///./data/itsp.db"
    AI_DATABASE_URL: str = "sqlite:///./data/itsp.db"
    AI_SUPABASE_URL: str = ""
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    CORS_ORIGINS: str = "*"
    AUTO_SEED_ON_STARTUP: bool = True

    supabase_url: str = ""
    supabase_api: str = ""
    # Keep credentials in environment variables (or .env), never in source code.
    gemini_api_key_atharva: str = ""
    token_encryption_key: str = ""
    # "development" (default) allows insecure fallbacks with warnings;
    # "production" fails fast on missing secrets.
    ENVIRONMENT: str = "development"

    gemini_api_key_krish: str = ""  # krish-api //krish-api
    gemini_api_key: str = ""  # krish-api //krish-api
    # Reminder engine: SMTP + cron secret
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True
    REMINDER_FROM: str = ""
    CRON_SECRET: str = ""  # required to hit /api/internal/cron/* endpoints

    # Google OAuth 2.0 Credentials (for Gmail, Google Drive, Google Calendar)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""

    @property
    def GOOGLE_CLIENT_ID(self) -> str:
        raw = self.google_client_id or os.environ.get("GOOGLE_CLIENT_ID", "")
        return _clean_env_val(raw, "GOOGLE_CLIENT_ID")

    @property
    def GOOGLE_CLIENT_SECRET(self) -> str:
        raw = self.google_client_secret or os.environ.get("GOOGLE_CLIENT_SECRET", "")
        return _clean_env_val(raw, "GOOGLE_CLIENT_SECRET")

    @property
    def GOOGLE_REDIRECT_URI(self) -> str:
        raw = self.google_redirect_uri or os.environ.get("GOOGLE_REDIRECT_URI", "")
        clean = _clean_env_val(raw, "GOOGLE_REDIRECT_URI")
        if clean:
            return clean
        if self.ENVIRONMENT.lower() == "production" or (self.DATABASE_URL and not self.DATABASE_URL.startswith("sqlite")):
            return "https://atlas-platform-gamma.vercel.app/integrations/google/callback"
        return "http://localhost:3000/integrations/google/callback"

    # Use the lower-latency Flash-Lite model for interactive mentor chat.
    GEMINI_MODEL: str = "gemini-3.1-flash-lite"


    @property
    def GEMINI_API_KEY(self) -> str:
        raw = self.gemini_api_key or self.gemini_api_key_krish or self.gemini_api_key_atharva or os.environ.get("GEMINI_API_KEY", "")
        return _clean_env_val(raw, "GEMINI_API_KEY")

    @property
    def GEMINI_API_KEY_KRISH(self) -> str:
        raw = self.gemini_api_key_krish or self.gemini_api_key or os.environ.get("GEMINI_API_KEY_KRISH", "")
        return _clean_env_val(raw, "GEMINI_API_KEY_KRISH")

    @property
    def GEMINI_API_KEY_ATHARVA(self) -> str:
        raw = self.gemini_api_key_atharva or os.environ.get("GEMINI_API_KEY_ATHARVA", "")
        return _clean_env_val(raw, "GEMINI_API_KEY_ATHARVA")

    @property
    def cors_origins_list(self) -> list:
        if not self.CORS_ORIGINS or self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        origins = [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        # Ensure native mobile Capacitor WebView origins are permitted
        for cap_origin in ("https://localhost", "capacitor://localhost"):
            if cap_origin not in origins:
                origins.append(cap_origin)
        return origins

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def sanitize_database_url(cls, v: str) -> str:
        v = _clean_env_val(v, "DATABASE_URL")
        if not v:
            return "sqlite:///./data/itsp.db"
        # Standardize legacy postgres:// to postgresql:// for SQLAlchemy 2.0
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql://", 1)
        return v

    @field_validator("SECRET_KEY", mode="before")
    @classmethod
    def sanitize_secret_key(cls, v: str) -> str:
        return _clean_env_val(v, "SECRET_KEY")

    @model_validator(mode="after")
    def enforce_secret_key_policy(self):
        """Fail fast in production; warn + auto-generate in development.

        With multiple gunicorn/uvicorn workers each process would otherwise generate
        a different key, causing random JWT validation failures across requests.
        """
        insecure = not self.SECRET_KEY or self.SECRET_KEY in (
            "your-secret-key-change-in-production",
            "your-production-secret-key",
        )
        if not insecure:
            return self

        is_production = (
            self.ENVIRONMENT.lower() == "production"
            or (self.DATABASE_URL and not self.DATABASE_URL.startswith("sqlite"))
        )
        if is_production:
            raise RuntimeError(
                "[Security] SECRET_KEY must be set in the environment when running in "
                "production (ENVIRONMENT=production or a non-sqlite DATABASE_URL). "
                "With multiple workers each process would otherwise generate a different "
                "key, causing random JWT validation failures across requests."
            )

        import secrets
        import logging
        logger = logging.getLogger("backend.core.config")
        logger.warning(
            "[Security] SECRET_KEY not set in environment. Auto-generating secure token "
            "for this session (dev only). Tokens will be invalidated on restart."
        )
        self.SECRET_KEY = secrets.token_urlsafe(32)
        return self

    class Config:
        env_file = ("backend/core/.env", ".env")
        extra = "ignore"


@lru_cache()
def get_settings():
    return Settings()


settings = get_settings()
