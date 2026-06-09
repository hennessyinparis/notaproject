import os
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status, Request
from sqlalchemy import delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from starlette.responses import FileResponse

from app.api.deps import get_current_user, get_current_user_optional
from app.core.config import get_settings
from app.core.database import get_db
from app.core.rate_limit import limiter, RateLimits
from app.models.follow import Follow
from app.models.notification import Notification, NotificationType
from app.models.track import Track
from app.models.user import User
from app.services.audit import log_audit
from app.services.royalties import accrue_royalty_on_complete_play
from app.services.subscription_access import is_premium_listener
from app.schemas.track import TrackCreate, TrackPlayReport, TrackPublic, TrackUpdate
from app.services.audio_meta import get_duration_seconds, waveform_for_db
from app.services.media import resolve_media_path, save_cover, save_uploaded_track
from app.services.realtime import push_notification
from app.services.track_engagement import enrich_tracks_public
from app.services.file_validation import validate_audio_file, validate_image_file
from app.tasks.audio import generate_waveform_task

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
        .join(Track.user)
        .where(Track.is_public.is_(True), Track.is_deleted.is_(False), User.is_admin.is_(False))
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
        .join(Track.user)
        .where(Track.is_public.is_(True), Track.is_deleted.is_(False), User.is_admin.is_(False))
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
    if t.user and t.user.is_admin and (not user or not user.is_admin):
        raise HTTPException(status_code=404, detail="Трек не найден")
    enriched = await enrich_tracks_public(db, [t], user.id if user else None)
    return enriched[0]


@router.post("", response_model=TrackPublic, status_code=status.HTTP_201_CREATED)
@limiter.limit(RateLimits.UPLOAD_TRACK)
async def upload_track(
    request: Request,
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    genre: Optional[str] = Form(None),
    mood: Optional[str] = Form(None),
    tags: Optional[str] = Form("[]"),
    is_public: bool = Form(True),
    is_downloadable: bool = Form(False),
    allow_comments: bool = Form(True),
    rights_confirmed: bool = Form(...),
    cover: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Track:
    import json

    if user.is_admin:
        raise HTTPException(status_code=403, detail="Администраторы не могут загружать треки")
    from app.services.subscription_access import is_artist_pro
    if not is_artist_pro(user):
        raise HTTPException(
            status_code=403,
            detail="Загрузка треков доступна только для подписчиков Артист Про",
        )
    if not rights_confirmed:
        raise HTTPException(
            status_code=400,
            detail="Подтвердите права на загружаемый контент и ответственность за публикацию",
        )
    tags_list = json.loads(tags) if tags else []

    raw = await file.read()
    
    # Валидация аудио файла (защита от вредоносных файлов)
    safe_filename, mime_type = validate_audio_file(raw, file.filename or "track.mp3", max_size_mb=200)

    file_url, disk_path = save_uploaded_track(raw, safe_filename)
    duration = get_duration_seconds(disk_path)

    cover_url = None
    if cover and cover.filename:
        cover_content = await cover.read()
        
        # Валидация изображения обложки
        safe_cover_name, cover_mime = validate_image_file(cover_content, cover.filename, max_size_mb=10)
        ext = Path(safe_cover_name).suffix.lower() or ".jpg"
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
        waveform_data=None,  # Waveform will be generated in background
        is_public=is_public,
        is_downloadable=is_downloadable,
        allow_comments=allow_comments,
        original_filename=file.filename,
        published_at=datetime.now(timezone.utc),
    )
    db.add(track)
    await db.flush()
    
    try:
        generate_waveform_task.delay(track.id, str(disk_path))
    except Exception:
        import logging

        logging.getLogger(__name__).warning(
            "Celery недоступен — синхронная генерация waveform для трека %s", track.id
        )
        track.waveform_data = waveform_for_db(disk_path)
        await db.flush()

    if is_public:
        followers = await db.execute(
            select(Follow.follower_id).where(Follow.following_id == user.id)
        )
        for (follower_id,) in followers.all():
            if follower_id == user.id:
                continue
            notif = Notification(
                user_id=follower_id,
                type=NotificationType.NEW_TRACK_FROM_FOLLOWING.value,
                actor_id=user.id,
                entity_id=track.id,
                entity_type="track",
            )
            db.add(notif)
            await db.flush()
            await push_notification(db, follower_id, notif)

    await db.refresh(track, attribute_names=["user"])
    r2 = await db.execute(select(Track).options(selectinload(Track.user)).where(Track.id == track.id))
    await log_audit(
        db,
        user_id=user.id,
        username=user.username,
        action_type="track_upload",
        entity_type="track",
        entity_id=track.id,
        details={"title": track.title, "genre": track.genre, "is_public": is_public},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
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
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    r = await db.execute(select(Track).where(Track.id == track_id))
    t = r.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")
    if t.user_id != user.id:
        raise HTTPException(status_code=403, detail="Нет прав")
    # Soft delete: помечаем как удалённый, не удаляем файлы
    t.is_deleted = True
    t.deleted_at = datetime.now(timezone.utc)
    t.deleted_by = user.id
    t.is_public = False
    await db.flush()
    await log_audit(
        db,
        user_id=user.id,
        username=user.username,
        action_type="track_delete",
        entity_type="track",
        entity_id=track_id,
        details={"title": t.title, "soft_delete": True},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )


@router.get("/{track_id}/stream")
async def stream_track(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
) -> FileResponse:
    r = await db.execute(select(Track).options(selectinload(Track.user)).where(Track.id == track_id))
    t = r.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")
    if not t.is_public and (user is None or user.id != t.user_id):
        raise HTTPException(status_code=404, detail="Трек не найден")
    if t.user and t.user.is_admin and (not user or not user.is_admin):
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

    quality = "high" if user and is_premium_listener(user) else "standard"
    response = FileResponse(
        path,
        media_type=media,
        filename=path.name,
        stat_result=os.stat(path),
    )
    response.headers["X-Audio-Quality"] = quality
    return response


@router.get("/{track_id}/download")
async def download_track(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FileResponse:
    if user.is_admin:
        raise HTTPException(status_code=403, detail="Недоступно")
    if not is_premium_listener(user):
        raise HTTPException(status_code=403, detail="Скачивание доступно с подпиской Нота Плюс или Студент")
    r = await db.execute(select(Track).options(selectinload(Track.user)).where(Track.id == track_id))
    t = r.scalar_one_or_none()
    if not t or not t.is_public or not t.is_downloadable:
        raise HTTPException(status_code=404, detail="Скачивание недоступно")
    if t.user and t.user.is_admin:
        raise HTTPException(status_code=404, detail="Трек не найден")
    path = resolve_media_path(t.file_url)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="Файл не найден")
    ext = path.suffix or ".mp3"
    safe_name = "".join(c if c.isalnum() or c in " -_" else "_" for c in t.title)[:80] + ext
    return FileResponse(path, media_type="audio/mpeg", filename=safe_name)


@router.post("/{track_id}/play")
@limiter.limit(RateLimits.TRACK_PLAY)
async def report_play(
    request: Request,
    track_id: int,
    body: TrackPlayReport,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
) -> dict:
    from app.models.track_play import TrackPlay

    r = await db.execute(select(Track).options(selectinload(Track.user)).where(Track.id == track_id))
    t = r.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")
    if t.user and t.user.is_admin and (not user or not user.is_admin):
        raise HTTPException(status_code=404, detail="Трек не найден")

    if not user or not user.is_admin:
        play = TrackPlay(
            track_id=track_id,
            listener_id=user.id if user else None,
            listened_seconds=body.listened_seconds,
            is_complete=body.is_complete,
            source=body.source,
        )
        db.add(play)
        
        # Инкрементируем общий счетчик прослушиваний для всех
        play_incr = {"plays_count": Track.plays_count + 1}
        
        # Платные прослушивания: только зарегистрированные пользователи с активной подпиской
        is_paid = False
        if user and body.is_complete:
            # Проверяем активную подписку (Plus, Student, Artist Pro — все платные)
            from app.services.subscription_access import is_premium_listener
            if is_premium_listener(user):
                is_paid = True
                play_incr["paid_plays_count"] = Track.paid_plays_count + 1
        
        await db.execute(update(Track).where(Track.id == track_id).values(**play_incr))
        
        # Роялти только за платные прослушивания от подписчиков
        if is_paid:
            await accrue_royalty_on_complete_play(db, t, user)
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
@limiter.limit(RateLimits.LIKE_ACTION)
async def like_track(
    request: Request,
    track_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if user.is_admin:
        raise HTTPException(status_code=403, detail="Действие недоступно для администратора")
    from app.models.like import Like

    r = await db.execute(select(Track).options(selectinload(Track.user)).where(Track.id == track_id))
    t = r.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")
    if t.user and t.user.is_admin and not user.is_admin:
        raise HTTPException(status_code=404, detail="Трек не найден")
    if t.user_id == user.id:
        raise HTTPException(status_code=400, detail="Нельзя лайкнуть собственный трек")

    existing = await db.execute(
        select(Like).where(Like.user_id == user.id, Like.track_id == track_id)
    )
    if existing.scalar_one_or_none():
        return {"liked": True, "likes_count": t.likes_count}

    like = Like(user_id=user.id, track_id=track_id)
    db.add(like)
    
    try:
        await db.flush()
    except IntegrityError:
        # Race condition: другой запрос уже создал лайк
        await db.rollback()
        return {"liked": True, "likes_count": t.likes_count}
    
    # Атомарное увеличение счетчика
    await db.execute(
        update(Track)
        .where(Track.id == track_id)
        .values(likes_count=Track.likes_count + 1)
    )
    await db.flush()
    await db.refresh(t)
    
    if t.user_id and t.user_id != user.id and not user.is_admin:
        notif = Notification(
            user_id=t.user_id, type=NotificationType.TRACK_LIKED.value,
            actor_id=user.id, entity_id=track_id, entity_type="track",
        )
        db.add(notif)
        await db.flush()
        await push_notification(db, t.user_id, notif)
    return {"liked": True, "likes_count": t.likes_count}


@router.delete("/{track_id}/like")
async def unlike_track(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if user.is_admin:
        raise HTTPException(status_code=403, detail="Действие недоступно для администратора")
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
        
        # Атомарное уменьшение счетчика (защита от race condition)
    
        await db.execute(
            update(Track)
            .where(Track.id == track_id)
            .values(likes_count=Track.likes_count - 1)
        )
        await db.flush()
        await db.refresh(t)
        
    return {"liked": False, "likes_count": t.likes_count}


@router.post("/{track_id}/repost")
@limiter.limit(RateLimits.LIKE_ACTION)
async def repost_track(
    request: Request,
    track_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if user.is_admin:
        raise HTTPException(status_code=403, detail="Действие недоступно для администратора")
    from app.models.repost import Repost

    r = await db.execute(select(Track).options(selectinload(Track.user)).where(Track.id == track_id))
    t = r.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")
    if t.user and t.user.is_admin and not user.is_admin:
        raise HTTPException(status_code=404, detail="Трек не найден")
    if t.user_id == user.id:
        raise HTTPException(status_code=400, detail="Нельзя репостить собственный трек")

    existing = await db.execute(
        select(Repost).where(Repost.user_id == user.id, Repost.track_id == track_id)
    )
    if existing.scalar_one_or_none():
        return {"reposted": True, "reposts_count": t.reposts_count}

    repost = Repost(user_id=user.id, track_id=track_id)
    db.add(repost)
    
    try:
        await db.flush()
    except IntegrityError:
        # Race condition: другой запрос уже создал репост
        await db.rollback()
        return {"reposted": True, "reposts_count": t.reposts_count}
    
    # Атомарное увеличение счетчика репостов

    await db.execute(
        update(Track)
        .where(Track.id == track_id)
        .values(reposts_count=Track.reposts_count + 1)
    )
    await db.flush()
    await db.refresh(t)
    
    if t.user_id and t.user_id != user.id and not user.is_admin:
        notif = Notification(
            user_id=t.user_id, type=NotificationType.TRACK_REPOSTED.value,
            actor_id=user.id, entity_id=track_id, entity_type="track",
        )
        db.add(notif)
        await db.flush()
        await push_notification(db, t.user_id, notif)
    return {"reposted": True, "reposts_count": t.reposts_count}


@router.delete("/{track_id}/repost")
async def unrepost_track(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if user.is_admin:
        raise HTTPException(status_code=403, detail="Действие недоступно для администратора")
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
        
        # Атомарное уменьшение счетчика репостов
    
        await db.execute(
            update(Track)
            .where(Track.id == track_id)
            .values(reposts_count=Track.reposts_count - 1)
        )
        await db.flush()
        await db.refresh(t)
        
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


@router.get("/{track_id}/related", response_model=List[TrackPublic])
async def get_related_tracks(
    track_id: int,
    limit: int = 8,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
) -> List[TrackPublic]:
    t = (
        await db.execute(select(Track).options(selectinload(Track.user)).where(Track.id == track_id))
    ).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")
    if not t.is_public and (user is None or user.id != t.user_id):
        raise HTTPException(status_code=404, detail="Трек не найден")

    stmt = (
        select(Track)
        .join(Track.user)
        .options(selectinload(Track.user))
        .where(Track.id != track_id, Track.is_public.is_(True), Track.is_deleted.is_(False), User.is_admin.is_(False))
        .limit(min(limit, 50))
        .order_by(Track.created_at.desc())
    )
    if t.genre:
        stmt = stmt.where(
            or_(Track.genre == t.genre, Track.user_id == t.user_id)
        )
    else:
        stmt = stmt.where(Track.user_id == t.user_id)

    r = await db.execute(stmt)
    related = list(r.scalars().all())
    enriched = await enrich_tracks_public(db, related, user.id if user else None)
    return enriched


@router.get("/{track_id}/reposted")
async def track_reposted_status(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    from app.models.repost import Repost

    t = (await db.execute(select(Track).options(selectinload(Track.user)).where(Track.id == track_id))).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")
    if t.user and t.user.is_admin and not user.is_admin:
        raise HTTPException(status_code=404, detail="Трек не найден")
    reposted = (
        await db.execute(select(Repost).where(Repost.user_id == user.id, Repost.track_id == track_id))
    ).scalar_one_or_none() is not None
    return {"reposted": reposted}