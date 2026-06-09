"""Публичные объявления для бесплатных слушателей."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import FileResponse

from app.core.database import get_db
from app.models.ad import Ad
from app.schemas.ad import AdPublic
from app.services.media import resolve_media_path

router = APIRouter(prefix="/ads", tags=["ads"])


def _to_public(ad: Ad) -> AdPublic | None:
    if not ad.audio_url:
        return None
    return AdPublic(
        id=ad.id,
        title=ad.title,
        image_url=ad.image_url,
        audio_url=ad.audio_url,
        link=ad.link,
        duration_seconds=ad.duration_seconds,
    )


@router.get("/", response_model=list[AdPublic])
async def list_ads(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Ad).where(Ad.active.is_(True), Ad.audio_url.isnot(None)).order_by(Ad.id.desc())
    )
    out: list[AdPublic] = []
    for ad in result.scalars().all():
        pub = _to_public(ad)
        if pub:
            out.append(pub)
    return out


@router.get("/{ad_id}/stream")
async def stream_ad(ad_id: int, db: AsyncSession = Depends(get_db)):
    ad = await db.get(Ad, ad_id)
    if not ad or not ad.active or not ad.audio_url:
        raise HTTPException(status_code=404, detail="Ad not found")
    path = resolve_media_path(ad.audio_url)
    if not path or not path.is_file():
        raise HTTPException(status_code=404, detail="Audio file missing")
    media = "audio/mpeg"
    if path.suffix.lower() in (".wav",):
        media = "audio/wav"
    elif path.suffix.lower() in (".ogg",):
        media = "audio/ogg"
    elif path.suffix.lower() in (".m4a", ".mp4"):
        media = "audio/mp4"
    return FileResponse(path, media_type=media)
