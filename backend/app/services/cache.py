"""Redis caching service for performance optimization.

Используется для:
- Кэширования популярных треков
- Кэширования профилей
- Кэширования результатов поиска
- Rate limiting (в production)
- Session management
"""
import json
import logging
from datetime import timedelta
from typing import Any, Callable, Optional, TypeVar

from app.core.config import get_settings

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Типы кэша с TTL
class CacheTTL:
    TRENDING_TRACKS = timedelta(minutes=5)
    USER_PROFILE = timedelta(minutes=2)
    TRACK_DETAILS = timedelta(minutes=10)
    SEARCH_RESULTS = timedelta(minutes=1)
    FOLLOW_STATUS = timedelta(minutes=1)
    LIKE_STATUS = timedelta(minutes=1)


class RedisCache:
    """Сервис кэширования на основе Redis."""

    def __init__(self):
        self._redis = None
        self._enabled = False

    async def _get_redis(self):
        """Ленивое подключение к Redis."""
        if self._redis is None:
            try:
                import redis.asyncio as aioredis
                settings = get_settings()
                self._redis = aioredis.from_url(
                    settings.REDIS_URL,
                    socket_connect_timeout=2,
                    decode_responses=True,
                )
                await self._redis.ping()
                self._enabled = True
                logger.info("Redis cache initialized")
            except Exception as e:
                logger.warning(f"Redis unavailable, cache disabled: {e}")
                self._enabled = False
        return self._redis

    async def get(self, key: str) -> Optional[str]:
        """Получает значение из кэша."""
        if not self._enabled:
            return None
        try:
            r = await self._get_redis()
            return await r.get(key)
        except Exception as e:
            logger.debug(f"Cache get error: {e}")
            return None

    async def set(self, key: str, value: str, ttl: timedelta = timedelta(minutes=5)) -> bool:
        """Устанавливает значение в кэш."""
        if not self._enabled:
            return False
        try:
            r = await self._get_redis()
            await r.setex(key, int(ttl.total_seconds()), value)
            return True
        except Exception as e:
            logger.debug(f"Cache set error: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """Удаляет значение из кэша."""
        if not self._enabled:
            return False
        try:
            r = await self._get_redis()
            await r.delete(key)
            return True
        except Exception as e:
            logger.debug(f"Cache delete error: {e}")
            return False

    async def get_or_set(
        self,
        key: str,
        factory: Callable[[], T],
        ttl: timedelta = timedelta(minutes=5),
        serializer: Callable[[T], str] = json.dumps,
        deserializer: Callable[[str], T] = json.loads,
    ) -> T:
        """Получает из кэша или создает через factory."""
        cached = await self.get(key)
        if cached is not None:
            try:
                return deserializer(cached)
            except (json.JSONDecodeError, TypeError):
                pass

        value = await factory() if hasattr(factory, '__awaitable_') else factory()
        
        try:
            await self.set(key, serializer(value), ttl)
        except Exception as e:
            logger.debug(f"Cache set error: {e}")

        return value

    async def invalidate_pattern(self, pattern: str) -> int:
        """Инвалидирует кэш по паттерну (например, track:*)."""
        if not self._enabled:
            return 0
        try:
            r = await self._get_redis()
            cursor = 0
            deleted = 0
            while True:
                cursor, keys = await r.scan(cursor=cursor, match=pattern, count=100)
                if keys:
                    await r.delete(*keys)
                    deleted += len(keys)
                if cursor == 0:
                    break
            return deleted
        except Exception as e:
            logger.debug(f"Cache invalidate error: {e}")
            return 0

    async def close(self):
        """Закрывает соединение с Redis."""
        if self._redis:
            await self._redis.aclose()
            self._redis = None


# Singleton instance
cache = RedisCache()

# Ключи кэша
def cache_key_trending() -> str: return "tracks:trending"
def cache_key_track(track_id: int) -> str: return f"track:{track_id}"
def cache_key_user_profile(username: str) -> str: return f"user:profile:{username}"
def cache_key_search(query: str) -> str: return f"search:{query}"
def cache_key_follow_status(follower_id: int, following_id: int) -> str: return f"follow:{follower_id}:{following_id}"
def cache_key_like_status(user_id: int, track_id: int) -> str: return f"like:{user_id}:{track_id}"
