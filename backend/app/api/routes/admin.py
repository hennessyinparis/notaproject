from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin_user
from app.core.database import get_db
from app.models.track import Track
from app.models.user import User
from app.schemas.user import UserPublic

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
async def admin_stats(
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    users_count = (await db.execute(select(func.count()).select_from(User))).scalar_one() or 0
    tracks_count = (await db.execute(select(func.count()).select_from(Track))).scalar_one() or 0
    total_plays = (await db.execute(select(func.coalesce(func.sum(Track.plays_count), 0)))).scalar_one() or 0
    return {"users_count": users_count, "tracks_count": tracks_count, "total_plays": int(total_plays)}


@router.get("/users", response_model=List[UserPublic])
async def admin_users(
    limit: int = 50,
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> List[User]:
    r = await db.execute(select(User).order_by(User.created_at.desc()).limit(min(limit, 200)))
    return list(r.scalars().all())


@router.patch("/users/{user_id}/verify")
async def toggle_verify_user(
    user_id: int,
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    r = await db.execute(select(User).where(User.id == user_id))
    u = r.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    u.is_verified = not u.is_verified
    await db.flush()
    return {"ok": True, "is_verified": u.is_verified}


@router.patch("/users/{user_id}/block")
async def toggle_block_user(
    user_id: int,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if user_id == admin_user.id:
        raise HTTPException(status_code=400, detail="Нельзя заблокировать самого себя")
    r = await db.execute(select(User).where(User.id == user_id))
    u = r.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    u.is_blocked = not u.is_blocked
    await db.flush()
    return {"ok": True, "is_blocked": u.is_blocked}
