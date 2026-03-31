from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import (
    analytics,
    auth,
    comments,
    feed,
    messages,
    notifications,
    playlists,
    search,
    subscriptions,
    tracks,
    users,
)
from app.core.config import get_settings
from app.services.media import ensure_media_dirs

settings = get_settings()
settings.MEDIA_DIR.mkdir(parents=True, exist_ok=True)
ensure_media_dirs()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Нота API", version="0.1.0", lifespan=lifespan)

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
app.include_router(feed.router, prefix=api_prefix)
app.include_router(messages.router, prefix=api_prefix)
app.include_router(notifications.router, prefix=api_prefix)
app.include_router(subscriptions.router, prefix=api_prefix)
app.include_router(analytics.router, prefix=api_prefix)

app.mount("/media", StaticFiles(directory=str(settings.MEDIA_DIR.resolve())), name="media")


@app.get("/health")
async def health():
    return {"status": "ok"}
