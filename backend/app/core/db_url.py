"""Нормализация DATABASE_URL: asyncpg-драйвер и localhost → 127.0.0.1 (Windows / IPv6)."""

import re
from urllib.parse import urlparse, urlunparse


def normalize_database_url(url: str) -> str:
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    parsed = urlparse(url)
    if parsed.hostname == "localhost":
        netloc = re.sub(r"@localhost(?=:|$)", "@127.0.0.1", parsed.netloc)
        parsed = parsed._replace(netloc=netloc)
        url = urlunparse(parsed)
    return url
