"""Настройка структурированного логирования для проекта.

Использует стандартный logging с JSON-форматом для продакшена.
В dev режиме использует читаемый формат с цветами.
"""
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Dict

from app.core.config import get_settings


class JSONFormatter(logging.Formatter):
    """JSON-форматер для структурированного логирования."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        if record.exc_info and record.exc_info[0]:
            log_entry["exception"] = self.formatException(record.exc_info)

        if hasattr(record, "extra"):
            log_entry["extra"] = record.extra

        return json.dumps(log_entry, ensure_ascii=False)


def setup_logging() -> None:
    """Настройка логирования для всего приложения."""
    settings = get_settings()
    is_dev = "localhost" in settings.BASE_URL or "127.0.0.1" in settings.BASE_URL

    # Корневой логгер
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO if not is_dev else logging.DEBUG)

    # Очищаем существующие handler'ы
    root_logger.handlers.clear()

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    if is_dev:
        console_handler.setFormatter(
            logging.Formatter(
                "%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d | %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
        )
    else:
        console_handler.setFormatter(JSONFormatter())
    console_handler.setLevel(logging.DEBUG if is_dev else logging.INFO)
    root_logger.addHandler(console_handler)

    # Настройка уровней для сторонних библиотек
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("celery").setLevel(logging.WARNING)

    logger = logging.getLogger(__name__)
    logger.info("Logging initialized", extra={"dev_mode": is_dev})


class RequestLoggingMiddleware:
    """Middleware для логирования HTTP запросов."""

    async def __call__(self, request, call_next):
        import time

        start = time.time()
        response = await call_next(request)
        duration = time.time() - start

        logger = logging.getLogger("api")
        logger.info(
            f"{request.method} {request.url.path} -> {response.status_code} ({duration:.3f}s)"
        )

        return response
