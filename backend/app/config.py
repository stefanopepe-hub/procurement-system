import os
from pydantic_settings import BaseSettings
from pydantic import validator
from typing import List


_DEFAULT_SECRET = "CHANGE-ME-IN-PRODUCTION-use-secrets-token-urlsafe-32"


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Procurement System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # SECURITY — read from environment; fallback is only for local dev
    SECRET_KEY: str = os.environ.get("SECRET_KEY", _DEFAULT_SECRET)
    JWT_SECRET_KEY: str = os.environ.get("JWT_SECRET_KEY", _DEFAULT_SECRET)

    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:80", "https://believable-stillness-production-466d.up.railway.app"]

    # Database
    DATABASE_URL: str = "postgresql://procurement:procurement@db:5432/procurement_db"

    # JWT
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Email
    SMTP_HOST: str = "smtp.example.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = "noreply@telethon.it"
    SMTP_PASSWORD: str = ""
    SMTP_TLS: bool = True
    EMAIL_FROM: str = "noreply@telethon.it"
    EMAIL_ALBO_FORNITORI: str = "albofornitori@telethon.it"

    # App base URL (used in email survey links)
    APP_BASE_URL: str = "http://localhost:3000"

    # Alyante Integration
    ALYANTE_API_URL: str = "http://alyante-stub:8001"
    ALYANTE_API_KEY: str = ""        # Set to require API key on webhook
    ALYANTE_ENABLED: bool = False

    # Non Conformità tool webhook
    NC_API_KEY: str = ""             # Set to require API key on webhook

    # AI Contract Analysis (Anthropic Claude)
    ANTHROPIC_API_KEY: str = ""      # Set to enable AI contract analysis

    # Upload
    UPLOAD_DIR: str = "/app/uploads"
    MAX_UPLOAD_SIZE_MB: int = 50

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    @validator('SECRET_KEY')
    def warn_default_secret_key(cls, v, values):
        if v == _DEFAULT_SECRET:
            import warnings
            warnings.warn(
                "SECRET_KEY usa il valore di default! Impostare una chiave sicura in produzione.",
                stacklevel=2,
            )
        return v

    @validator('JWT_SECRET_KEY')
    def warn_default_jwt_secret_key(cls, v, values):
        if v == _DEFAULT_SECRET:
            import warnings
            warnings.warn(
                "JWT_SECRET_KEY usa il valore di default! Impostare una chiave sicura in produzione.",
                stacklevel=2,
            )
        return v

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
