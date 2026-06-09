"""
Rate limiting middleware для защиты от DDoS и злоупотреблений.
Использует slowapi для ограничения частоты запросов.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from typing import Callable
import logging

logger = logging.getLogger(__name__)

# Инициализация limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["1000/hour"],  # Общий лимит по умолчанию
    storage_uri="memory://",  # В продакшене использовать Redis
    strategy="fixed-window",
)


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    Обработчик превышения лимита запросов.
    """
    logger.warning(
        f"Rate limit exceeded: {request.client.host} - {request.url.path} - {exc.detail}"
    )
    
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Слишком много запросов. Пожалуйста, подождите немного.",
            "retry_after": getattr(exc, "retry_after", 60),
        },
        headers={
            "Retry-After": str(getattr(exc, "retry_after", 60)),
        },
    )


# Предопределенные лимиты для разных типов операций
class RateLimits:
    """Константы лимитов для различных операций"""
    
    # Аутентификация
    AUTH_REGISTER = "5/hour"          # Регистрация - 5 попыток в час
    AUTH_LOGIN = "10/minute"          # Вход - 10 попыток в минуту
    AUTH_FORGOT_PASSWORD = "3/hour"   # Сброс пароля - 3 раза в час
    AUTH_RESET_PASSWORD = "5/hour"    # Установка нового пароля - 5 раз в час
    
    # Загрузка контента
    UPLOAD_TRACK = "10/hour"          # Загрузка треков - 10 в час
    UPLOAD_AVATAR = "5/hour"          # Загрузка аватара - 5 в час
    
    # Социальные действия
    LIKE_ACTION = "100/minute"        # Лайки - 100 в минуту
    COMMENT_CREATE = "30/hour"        # Комментарии - 30 в час
    MESSAGE_SEND = "60/hour"          # Сообщения - 60 в час
    FOLLOW_ACTION = "50/hour"         # Подписки - 50 в час
    
    # Отчеты и жалобы
    REPORT_CREATE = "5/hour"          # Жалобы - 5 в час
    
    # Прослушивания
    TRACK_PLAY = "200/hour"           # Отчеты о прослушивании - 200 в час
    
    # Поиск
    SEARCH = "100/minute"             # Поиск - 100 в минуту
    
    # Покупки
    SUBSCRIPTION_PURCHASE = "3/hour"  # Покупка подписок - 3 в час
    
    # Общие операции чтения
    READ_GENERAL = "300/minute"       # Чтение данных - 300 в минуту


def get_user_identifier(request: Request) -> str:
    """
    Получает идентификатор пользователя для rate limiting.
    Использует user_id из токена если доступен, иначе IP адрес.
    """
    # Попытка получить user_id из state (устанавливается в auth middleware)
    user = getattr(request.state, "user", None)
    if user and hasattr(user, "id"):
        return f"user:{user.id}"
    
    # Fallback на IP адрес
    return get_remote_address(request)


def create_limiter_with_redis(redis_url: str) -> Limiter:
    """
    Создает limiter с использованием Redis для distributed rate limiting.
    Используется в продакшене когда несколько инстансов backend.
    """
    return Limiter(
        key_func=get_user_identifier,
        default_limits=["1000/hour"],
        storage_uri=redis_url,
        strategy="fixed-window",
    )
