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
        return self.google_client_id

    @property
    def GOOGLE_CLIENT_SECRET(self) -> str:
        return self.google_client_secret

    @property
    def GOOGLE_REDIRECT_URI(self) -> str:
        return self.google_redirect_uri or "http://localhost:3000/integrations/google/callback"

    # Use the lower-latency Flash-Lite model for interactive mentor chat.
    GEMINI_MODEL: str = "gemini-3.1-flash-lite"


    @property
    def GEMINI_API_KEY(self) -> str:
        return self.gemini_api_key or self.gemini_api_key_krish or self.gemini_api_key_atharva

    @property
    def GEMINI_API_KEY_KRISH(self) -> str:
        return self.gemini_api_key_krish or self.gemini_api_key

    @property
    def GEMINI_API_KEY_ATHARVA(self) -> str:
        return self.gemini_api_key_atharva

    @property
    def cors_origins_list(self) -> list:
        if not self.CORS_ORIGINS or self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @field_validator("DATABASE_URL")
    @classmethod
    def sanitize_database_url(cls, v: str) -> str:
        if not v:
            return "sqlite:///./data/itsp.db"
        # Standardize legacy postgres:// to postgresql:// for SQLAlchemy 2.0
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql://", 1)
        return v

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
