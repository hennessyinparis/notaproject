from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.models.base import Base


def get_sync_database_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql://", 1)
    if url.startswith("postgresql+psycopg2://"):
        return url.replace("postgresql+psycopg2://", "postgresql://", 1)
    return url


settings = get_settings()
sync_url = get_sync_database_url(settings.DATABASE_URL) + "?client_encoding=utf8"

engine = create_engine(sync_url, echo=False, pool_pre_ping=True)

SyncSessionLocal = sessionmaker(
    engine,
    expire_on_commit=False,
    autoflush=False,
)
