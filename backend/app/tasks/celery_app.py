"""Точка входа Celery (фоновая обработка аудио, уведомления)."""

from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "nota",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.task_routes = {"app.tasks.audio.*": {"queue": "audio"}}


@celery_app.task(name="nota.ping")
def ping() -> str:
    return "pong"
