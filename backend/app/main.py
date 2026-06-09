from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.routes import (
    ads,
    admin,
    admin_reports,
    analytics,
    auth,
    comments,
    donations,
    feed,
    messages,
    notifications,
    playlists,
    reports,
    royalties,
    search,
    subscriptions,
    tracks,
    users,
    ws,
)
from app.core.config import get_settings
from app.services.media import ensure_media_dirs
from app.core.rate_limit import limiter, rate_limit_exceeded_handler
from app.core.logging_config import setup_logging
from app.core.security_middleware import SecurityHeadersMiddleware

settings = get_settings()
settings.MEDIA_DIR.mkdir(parents=True, exist_ok=True)
ensure_media_dirs()

# Инициализация логирования
setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    import logging
    logger = logging.getLogger(__name__)
    logger.info("Starting Нота API server")
    yield
    logger.info("Shutting down Нота API server")


app = FastAPI(title="Нота API", version="0.1.0", lifespan=lifespan)

# Подключение rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Security headers middleware (должен быть первым)
app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_prefix = "/api"
app.include_router(auth.router, prefix=api_prefix)
app.include_router(users.router, prefix=api_prefix)
app.include_router(tracks.router, prefix=api_prefix)
app.include_router(search.router, prefix=api_prefix)
app.include_router(playlists.router, prefix=api_prefix)
app.include_router(comments.router, prefix=api_prefix)
app.include_router(donations.router, prefix=api_prefix)
app.include_router(feed.router, prefix=api_prefix)
app.include_router(messages.router, prefix=api_prefix)
app.include_router(notifications.router, prefix=api_prefix)
app.include_router(subscriptions.router, prefix=api_prefix)
app.include_router(analytics.router, prefix=api_prefix)
app.include_router(royalties.router, prefix=api_prefix)
app.include_router(ads.router, prefix=api_prefix)
app.include_router(admin.router, prefix=api_prefix)
app.include_router(admin_reports.router, prefix=api_prefix)
app.include_router(reports.router, prefix=api_prefix)
app.include_router(ws.router, prefix=api_prefix)

app.mount("/media", StaticFiles(directory=str(settings.MEDIA_DIR.resolve())), name="media")


@app.get("/health")
async def health():
    import logging
    logger = logging.getLogger(__name__)
    
    health_status = {"status": "ok", "version": "0.1.0"}
    
    # Проверка БД
    try:
        from app.core.database import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            from sqlalchemy import text
            await session.execute(text("SELECT 1"))
        health_status["database"] = "ok"
    except Exception as e:
        health_status["database"] = f"error: {str(e)[:50]}"
        health_status["status"] = "degraded"
        logger.error(f"Health check - database: {e}")
    
    # Проверка Redis
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=3)
        await r.ping()
        await r.aclose()
        health_status["redis"] = "ok"
    except Exception as e:
        health_status["redis"] = f"error: {str(e)[:50]}"
        health_status["status"] = "degraded"
        logger.warning(f"Health check - Redis: {e}")
    
    return health_status
