import os
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from starlette.responses import FileResponse

from app.api.deps import get_current_user, get_current_user_optional
from app.core.config import get_settings
from app.core.database import get_db
from app.models.track import Track
from app.models.user import User
from app.schemas.track import TrackCreate, TrackPlayReport, TrackPublic, TrackUpdate
from app.services.audio_meta import get_duration_seconds, waveform_for_db
from app.services.media import resolve_media_path, save_cover, save_uploaded_track
from app.services.track_engagement import enrich_tracks_public

router = APIRouter(prefix="/tracks", tags=["tracks"])


def _track_to_public(t: Track) -> TrackPublic:
    return TrackPublic.model_validate(t, from_attributes=True)


@router.get("/trending", response_model=List[TrackPublic])
async def trending(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
) -> List[Track]:
    q = (
        select(Track)
        .where(Track.is_public.is_(True))
        .options(selectinload(Track.user))
        .order_by(Track.plays_count.desc())
        .limit(min(limit, 50))
    )
    r = await db.execute(q)
    return list(r.scalars().all())


@router.get("/new", response_model=List[TrackPublic])
async def new_releases(limit: int = 20, db: AsyncSession = Depends(get_db)) -> List[Track]:
    q = (
        select(Track)
        .where(Track.is_public.is_(True))
        .options(selectinload(Track.user))
        .order_by(Track.created_at.desc())
        .limit(min(limit, 50))
    )
    r = await db.execute(q)
    return list(r.scalars().all())


@router.get("/{track_id}", response_model=TrackPublic)
async def get_track(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
) -> TrackPublic:
    r = await db.execute(select(Track).options(selectinload(Track.user)).where(Track.id == track_id))
    t = r.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")
    if not t.is_public and (user is None or user.id != t.user_id):
        raise HTTPException(status_code=404, detail="Трек не найден")
    enriched = await enrich_tracks_public(db, [t], user.id if user else None)
    return enriched[0]


@router.post("", response_model=TrackPublic, status_code=status.HTTP_201_CREATED)
async def upload_track(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    genre: Optional[str] = Form(None),
    mood: Optional[str] = Form(None),
    tags: Optional[str] = Form("[]"),
    is_public: bool = Form(True),
    is_downloadable: bool = Form(False),
    allow_comments: bool = Form(True),
    cover: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Track:
    import json
    tags_list = json.loads(tags) if tags else []

    raw = await file.read()
    if len(raw) > 200 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Файл слишком большой")

    file_url, disk_path = save_uploaded_track(raw, file.filename or "track.mp3")
    duration = get_duration_seconds(disk_path)
    wf = waveform_for_db(disk_path)

    cover_url = None
    if cover and cover.filename:
        cover_content = await cover.read()
        ext = Path(cover.filename).suffix.lower() or ".jpg"
        cover_url = save_cover(cover_content, ext)

    track = Track(
        user_id=user.id,
        title=title,
        description=description,
        genre=genre,
        mood=mood,
        tags=tags_list,
        file_url=file_url,
        cover_url=cover_url,
        file_size=len(raw),
        duration_seconds=duration,
        waveform_data=wf,
        is_public=is_public,
        is_downloadable=is_downloadable,
        allow_comments=allow_comments,
        original_filename=file.filename,
        published_at=datetime.now(timezone.utc),
    )
    db.add(track)
    await db.flush()
    await db.refresh(track, attribute_names=["user"])
    r2 = await db.execute(select(Track).options(selectinload(Track.user)).where(Track.id == track.id))
    return r2.scalar_one()


@router.patch("/{track_id}", response_model=TrackPublic)
async def update_track(
    track_id: int,
    data: TrackUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Track:
    r = await db.execute(select(Track).options(selectinload(Track.user)).where(Track.id == track_id))
    t = r.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")
    if t.user_id != user.id:
        raise HTTPException(status_code=403, detail="Нет прав")

    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(t, k, v)
    await db.flush()
    return t


@router.delete("/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_track(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    r = await db.execute(select(Track).where(Track.id == track_id))
    t = r.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")
    if t.user_id != user.id:
        raise HTTPException(status_code=403, detail="Нет прав")
    path = resolve_media_path(t.file_url)
    await db.execute(delete(Track).where(Track.id == track_id))
    if path and path.exists():
        try:
            path.unlink()
        except OSError:
            pass


@router.get("/{track_id}/stream")
async def stream_track(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
) -> FileResponse:
    r = await db.execute(select(Track).where(Track.id == track_id))
    t = r.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")
    if not t.is_public and (user is None or user.id != t.user_id):
        raise HTTPException(status_code=404, detail="Трек не найден")

    path = resolve_media_path(t.file_url)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="Файл не найден на сервере")

    media = "audio/mpeg"
    if path.suffix.lower() in (".wav",):
        media = "audio/wav"
    elif path.suffix.lower() in (".ogg",):
        media = "audio/ogg"
    elif path.suffix.lower() in (".m4a", ".mp4"):
        media = "audio/mp4"

    return FileResponse(
        path,
        media_type=media,
        filename=path.name,
        stat_result=os.stat(path),
    )


@router.post("/{track_id}/play")
async def report_play(
    track_id: int,
    body: TrackPlayReport,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
) -> dict:
    from app.models.track_play import TrackPlay

    r = await db.execute(select(Track).where(Track.id == track_id))
    t = r.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")

    play = TrackPlay(
        track_id=track_id,
        listener_id=user.id if user else None,
        listened_seconds=body.listened_seconds,
        is_complete=body.is_complete,
        source=body.source,
    )
    db.add(play)
    t.plays_count += 1
    return {"ok": True}


@router.post("/{track_id}/cover", response_model=TrackPublic)
async def upload_cover(
    track_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Track:
    r = await db.execute(select(Track).options(selectinload(Track.user)).where(Track.id == track_id))
    t = r.scalar_one_or_none()
    if not t or t.user_id != user.id:
        raise HTTPException(status_code=404, detail="Трек не найден")

    raw = await file.read()
    ext = Path(file.filename or ".jpg").suffix.lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"
    url = save_cover(raw, ext)
    t.cover_url = url
    await db.flush()
    return t


@router.post("/{track_id}/like")
async def like_track(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    from app.models.like import Like

    r = await db.execute(select(Track).where(Track.id == track_id))
    t = r.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")

    existing = await db.execute(
        select(Like).where(Like.user_id == user.id, Like.track_id == track_id)
    )
    if existing.scalar_one_or_none():
        return {"liked": True, "likes_count": t.likes_count}

    like = Like(user_id=user.id, track_id=track_id)
    db.add(like)
    t.likes_count += 1
    await db.flush()
    return {"liked": True, "likes_count": t.likes_count}


@router.delete("/{track_id}/like")
async def unlike_track(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    from app.models.like import Like

    r = await db.execute(select(Track).where(Track.id == track_id))
    t = r.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")

    existing = await db.execute(
        select(Like).where(Like.user_id == user.id, Like.track_id == track_id)
    )
    like = existing.scalar_one_or_none()
    if like:
        await db.delete(like)
        t.likes_count = max(0, t.likes_count - 1)
        await db.flush()
    return {"liked": False, "likes_count": t.likes_count}


@router.post("/{track_id}/repost")
async def repost_track(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    from app.models.repost import Repost

    r = await db.execute(select(Track).where(Track.id == track_id))
    t = r.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")

    existing = await db.execute(
        select(Repost).where(Repost.user_id == user.id, Repost.track_id == track_id)
    )
    if existing.scalar_one_or_none():
        return {"reposted": True, "reposts_count": t.reposts_count}

    repost = Repost(user_id=user.id, track_id=track_id)
    db.add(repost)
    t.reposts_count += 1
    await db.flush()
    return {"reposted": True, "reposts_count": t.reposts_count}


@router.delete("/{track_id}/repost")
async def unrepost_track(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    from app.models.repost import Repost

    r = await db.execute(select(Track).where(Track.id == track_id))
    t = r.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")

    existing = await db.execute(
        select(Repost).where(Repost.user_id == user.id, Repost.track_id == track_id)
    )
    repost = existing.scalar_one_or_none()
    if repost:
        await db.delete(repost)
        t.reposts_count = max(0, t.reposts_count - 1)
        await db.flush()
    return {"reposted": False, "reposts_count": t.reposts_count}


@router.get("/{track_id}/liked")
async def track_liked_status(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    from app.models.like import Like

    t = (await db.execute(select(Track).where(Track.id == track_id))).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")
    liked = (
        await db.execute(select(Like).where(Like.user_id == user.id, Like.track_id == track_id))
    ).scalar_one_or_none() is not None
    return {"liked": liked, "likes_count": t.likes_count}


@router.get("/{track_id}/reposted")
async def track_reposted_status(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    from app.models.repost import Repost

    t = (await db.execute(select(Track).where(Track.id == track_id))).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")
    reposted = (
        await db.execute(select(Repost).where(Repost.user_id == user.id, Repost.track_id == track_id))
    ).scalar_one_or_none() is not None
    return {"reposted": reposted}
