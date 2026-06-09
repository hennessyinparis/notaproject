from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://nota_user:nota_pass@127.0.0.1:5433/nota_db"
    SECRET_KEY: str = "nota-production-change-me-in-env-abc123xyz"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    REDIS_URL: str = "redis://localhost:6379"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    MEDIA_DIR: Path = Path("media")
    BASE_URL: str = "http://localhost:8000"

    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Email (SMTP)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: str = "noreply@nota.app"

    # Security
    CSP_ENABLED: bool = True
    RATE_LIMIT_ENABLED: bool = True

    # Upload limits
    MAX_TRACK_SIZE_MB: int = 200
    MAX_COVER_SIZE_MB: int = 10
    MAX_AVATAR_SIZE_MB: int = 5

    # Subscription prices (RUB)
    PRICE_LISTENER_PLUS_RUB: float = 299.0
    PRICE_LISTENER_STUDENT_RUB: float = 149.0
    PRICE_ARTIST_PRO_RUB: float = 599.0

    # Royalties
    ROYALTY_PER_COMPLETE_PLAY_RUB: float = 0.05

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
