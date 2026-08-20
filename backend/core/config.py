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
from pydantic import field_validator
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

    supabase_url: str = "https://lcorsvdtqtqpyxiizfyn.supabase.co"
    supabase_api: str = "sb_publishable_mAJrU7-c8_7kCuvhl9ApiQ_I7HFLFkU"
    # Keep credentials in environment variables (or .env), never in source code.
    gemini_api_key_atharva: str = ""
    token_encryption_key: str = "wQUQ7nxnIIYOxfTLTTHoxGn3Jim3376wnxUTGqKaEFA="

    gemini_api_key_krish: str = ""  # krish-api //krish-api
    gemini_api_key: str = ""  # krish-api //krish-api
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

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_set(cls, v: str) -> str:
        if not v or v in ("your-secret-key-change-in-production", "your-production-secret-key"):
            import secrets
            import logging
            logger = logging.getLogger("backend.core.config")
            logger.warning("[Security] SECRET_KEY not set in environment. Auto-generating secure token for this session.")
            return secrets.token_urlsafe(32)
        return v


    class Config:
        env_file = ("backend/core/.env", ".env")
        extra = "ignore"


@lru_cache()
def get_settings():
    return Settings()


settings = get_settings()
