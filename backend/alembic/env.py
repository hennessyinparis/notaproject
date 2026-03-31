import os
import sys

os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlalchemy.engine import Connection
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings
from app.core.db_url import normalize_database_url


class Base(DeclarativeBase):
    pass


from app.models import (  # noqa: F401
    Comment,
    Follow,
    Like,
    Message,
    Notification,
    Playlist,
    PlaylistTrack,
    Repost,
    Royalty,
    Subscription,
    Track,
    TrackPlay,
    User,
)

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    settings = get_settings()
    url = normalize_database_url(settings.DATABASE_URL)
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


def _sync_url(url: str) -> str:
    # Alembic migrations are more stable using a sync driver.
    # We use psycopg2 for compatibility.
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


def run_sync_migrations() -> None:
    settings = get_settings()
    url = _sync_url(normalize_database_url(settings.DATABASE_URL))
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = url + "?client_encoding=utf8"
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        do_run_migrations(connection)


def run_migrations_online() -> None:
    run_sync_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
