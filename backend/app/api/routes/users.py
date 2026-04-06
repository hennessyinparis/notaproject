from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_current_user_optional
from app.models.follow import Follow
from app.models.like import Like
from app.models.repost import Repost
from app.models.track import Track
from app.models.track_play import TrackPlay
from app.models.user import User
from app.schemas.track import TrackPublic
from app.schemas.user import UserPublic, UserUpdate
from app.core.database import get_db
from app.services.media import save_cover
from app.services.track_engagement import enrich_tracks_public

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserPublic)
async def me(user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(user)


@router.get("/me/tracks", response_model=List[TrackPublic])
async def my_tracks(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[TrackPublic]:
    q = (
        select(Track)
        .where(Track.user_id == user.id)
        .options(selectinload(Track.user))
        .order_by(Track.created_at.desc())
    )
    r = await db.execute(q)
    tracks = list(r.scalars().all())
    return await enrich_tracks_public(db, tracks, user.id)


@router.get("/me/liked-tracks", response_model=List[TrackPublic])
async def my_liked_tracks(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[TrackPublic]:
    q = (
        select(Track)
        .join(Like, Like.track_id == Track.id)
        .where(Like.user_id == user.id, Track.is_public.is_(True))
        .options(selectinload(Track.user))
        .order_by(Like.created_at.desc())
    )
    r = await db.execute(q)
    tracks = list(r.scalars().all())
    enriched = await enrich_tracks_public(db, tracks, user.id)
    # Все треки в этом списке по определению лайкнуты — явно для клиента.
    return [t.model_copy(update={"is_liked": True}) for t in enriched]


@router.get("/me/reposted-tracks", response_model=List[TrackPublic])
async def my_reposted_tracks(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[TrackPublic]:
    q = (
        select(Track)
        .join(Repost, Repost.track_id == Track.id)
        .where(Repost.user_id == user.id, Track.is_public.is_(True))
        .options(selectinload(Track.user))
        .order_by(Repost.created_at.desc())
    )
    r = await db.execute(q)
    tracks = list(r.scalars().all())
    enriched = await enrich_tracks_public(db, tracks, user.id)
    return [t.model_copy(update={"is_reposted": True}) for t in enriched]


@router.patch("/me", response_model=UserPublic)
async def update_me(
    data: UserUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> UserPublic:
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(user, k, v)
    await db.flush()
    return UserPublic.model_validate(user)


@router.post("/me/avatar", response_model=UserPublic)
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserPublic:
    content = await file.read()
    ext = (file.filename or ".jpg").split(".")[-1].lower() or "jpg"
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    url = save_cover(content, ext)
    user.avatar_url = url
    await db.flush()
    return UserPublic.model_validate(user, from_attributes=True)


@router.get("/{username}", response_model=UserPublic)
async def get_by_username(username: str, db: AsyncSession = Depends(get_db)) -> UserPublic:
    r = await db.execute(select(User).where(User.username == username))
    u = r.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user_data = UserPublic.model_validate(u, from_attributes=True)
    user_data.email = None
    return user_data


@router.get("/{username}/stats")
async def user_artist_stats(username: str, db: AsyncSession = Depends(get_db)) -> dict:
    """Публичная сводка для профиля артиста: слушатели за 30 дней, суммарные прослушивания и вовлечённость."""
    ur = await db.execute(select(User).where(User.username == username))
    u = ur.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    track_filter = Track.user_id == u.id
    total_plays = (
        await db.execute(
            select(func.coalesce(func.sum(Track.plays_count), 0)).where(track_filter, Track.is_public.is_(True))
        )
    ).scalar_one() or 0
    total_likes_received = (
        await db.execute(
            select(func.coalesce(func.sum(Track.likes_count), 0)).where(track_filter, Track.is_public.is_(True))
        )
    ).scalar_one() or 0
    total_reposts_received = (
        await db.execute(
            select(func.coalesce(func.sum(Track.reposts_count), 0)).where(track_filter, Track.is_public.is_(True))
        )
    ).scalar_one() or 0

    since = datetime.now(timezone.utc) - timedelta(days=30)
    monthly_listeners = (
        await db.execute(
            select(func.count(func.distinct(TrackPlay.listener_id)))
            .select_from(TrackPlay)
            .join(Track, Track.id == TrackPlay.track_id)
            .where(
                Track.user_id == u.id,
                Track.is_public.is_(True),
                TrackPlay.created_at >= since,
                TrackPlay.listener_id.isnot(None),
            )
        )
    ).scalar_one() or 0

    return {
        "monthly_listeners": int(monthly_listeners),
        "total_plays": int(total_plays),
        "total_likes_received": int(total_likes_received),
        "total_reposts_received": int(total_reposts_received),
        "public_tracks_count": (
            await db.execute(select(func.count()).select_from(Track).where(track_filter, Track.is_public.is_(True)))
        ).scalar_one()
        or 0,
    }


@router.get("/{username}/liked-tracks", response_model=List[TrackPublic])
async def user_public_liked_tracks(
    username: str,
    limit: int = 40,
    db: AsyncSession = Depends(get_db),
    viewer: Optional[User] = Depends(get_current_user_optional),
) -> List[TrackPublic]:
    ur = await db.execute(select(User).where(User.username == username))
    u = ur.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    lim = max(1, min(limit, 80))
    q = (
        select(Track)
        .join(Like, Like.track_id == Track.id)
        .where(Like.user_id == u.id, Track.is_public.is_(True))
        .options(selectinload(Track.user))
        .order_by(Like.created_at.desc())
        .limit(lim)
    )
    r = await db.execute(q)
    tracks = list(r.scalars().all())
    enriched = await enrich_tracks_public(db, tracks, viewer.id if viewer else None)
    return [t.model_copy(update={"is_liked": True}) for t in enriched]


@router.get("/{username}/reposted-tracks", response_model=List[TrackPublic])
async def user_public_reposted_tracks(
    username: str,
    limit: int = 40,
    db: AsyncSession = Depends(get_db),
    viewer: Optional[User] = Depends(get_current_user_optional),
) -> List[TrackPublic]:
    ur = await db.execute(select(User).where(User.username == username))
    u = ur.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    lim = max(1, min(limit, 80))
    q = (
        select(Track)
        .join(Repost, Repost.track_id == Track.id)
        .where(Repost.user_id == u.id, Track.is_public.is_(True))
        .options(selectinload(Track.user))
        .order_by(Repost.created_at.desc())
        .limit(lim)
    )
    r = await db.execute(q)
    tracks = list(r.scalars().all())
    enriched = await enrich_tracks_public(db, tracks, viewer.id if viewer else None)
    return [t.model_copy(update={"is_reposted": True}) for t in enriched]


@router.get("/{username}/tracks", response_model=List[TrackPublic])
async def user_tracks(
    username: str,
    db: AsyncSession = Depends(get_db),
    viewer: Optional[User] = Depends(get_current_user_optional),
) -> List[TrackPublic]:
    ur = await db.execute(select(User).where(User.username == username))
    u = ur.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    q = (
        select(Track)
        .where(Track.user_id == u.id, Track.is_public.is_(True))
        .options(selectinload(Track.user))
        .order_by(Track.created_at.desc())
    )
    r = await db.execute(q)
    tracks = list(r.scalars().all())
    return await enrich_tracks_public(db, tracks, viewer.id if viewer else None)


@router.post("/{username}/follow")
async def follow_user(
    username: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    ur = await db.execute(select(User).where(User.username == username))
    target = ur.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if target.id == user.id:
        raise HTTPException(status_code=400, detail="Нельзя подписаться на себя")
    existing = await db.execute(
        select(Follow).where(Follow.follower_id == user.id, Follow.following_id == target.id)
    )
    if existing.scalar_one_or_none():
        return {"following": True}
    db.add(Follow(follower_id=user.id, following_id=target.id))
    return {"following": True}


@router.delete("/{username}/follow")
async def unfollow_user(
    username: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    ur = await db.execute(select(User).where(User.username == username))
    target = ur.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    await db.execute(delete(Follow).where(Follow.follower_id == user.id, Follow.following_id == target.id))
    return {"following": False}


@router.get("/{username}/is-following")
async def is_following_user(
    username: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    ur = await db.execute(select(User).where(User.username == username))
    target = ur.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    existing = await db.execute(
        select(Follow).where(Follow.follower_id == user.id, Follow.following_id == target.id)
    )
    return {"is_following": existing.scalar_one_or_none() is not None}


@router.get("/{username}/followers/count")
async def followers_count(username: str, db: AsyncSession = Depends(get_db)) -> dict:
    ur = await db.execute(select(User).where(User.username == username))
    u = ur.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    r = await db.execute(select(func.count()).select_from(Follow).where(Follow.following_id == u.id))
    return {"count": r.scalar_one() or 0}


@router.get("/{username}/following/count")
async def following_count(username: str, db: AsyncSession = Depends(get_db)) -> dict:
    ur = await db.execute(select(User).where(User.username == username))
    u = ur.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    r = await db.execute(select(func.count()).select_from(Follow).where(Follow.follower_id == u.id))
    return {"count": r.scalar_one() or 0}


@router.get("/{username}/followers", response_model=List[UserPublic])
async def list_followers(username: str, db: AsyncSession = Depends(get_db)) -> List[UserPublic]:
    ur = await db.execute(select(User).where(User.username == username))
    u = ur.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    q = (
        select(User)
        .join(Follow, Follow.follower_id == User.id)
        .where(Follow.following_id == u.id)
        .order_by(User.display_name.asc())
    )
    r = await db.execute(q)
    rows = list(r.scalars().all())
    out: List[UserPublic] = []
    for row in rows:
        pub = UserPublic.model_validate(row, from_attributes=True)
        pub.email = None
        out.append(pub)
    return out


@router.get("/{username}/following", response_model=List[UserPublic])
async def list_following(username: str, db: AsyncSession = Depends(get_db)) -> List[UserPublic]:
    ur = await db.execute(select(User).where(User.username == username))
    u = ur.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    q = (
        select(User)
        .join(Follow, Follow.following_id == User.id)
        .where(Follow.follower_id == u.id)
        .order_by(User.display_name.asc())
    )
    r = await db.execute(q)
    rows = list(r.scalars().all())
    out: List[UserPublic] = []
    for row in rows:
        pub = UserPublic.model_validate(row, from_attributes=True)
        pub.email = None
        out.append(pub)
    return out
