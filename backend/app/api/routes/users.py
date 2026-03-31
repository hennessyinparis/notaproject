from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.models.follow import Follow
from app.models.track import Track
from app.models.user import User
from app.schemas.track import TrackPublic
from app.schemas.user import UserPublic, UserUpdate
from app.core.database import get_db
from app.services.media import save_cover

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserPublic)
async def me(user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(user)


@router.get("/me/tracks", response_model=List[TrackPublic])
async def my_tracks(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[Track]:
    q = (
        select(Track)
        .where(Track.user_id == user.id)
        .options(selectinload(Track.user))
        .order_by(Track.created_at.desc())
    )
    r = await db.execute(q)
    return list(r.scalars().all())


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


@router.get("/{username}/tracks", response_model=List[TrackPublic])
async def user_tracks(username: str, db: AsyncSession = Depends(get_db)) -> List[Track]:
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
    return list(r.scalars().all())


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
