from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.follow import Follow
from app.models.track import Track
from app.models.user import User
from app.schemas.track import TrackPublic

router = APIRouter(prefix="/feed", tags=["feed"])


@router.get("", response_model=List[TrackPublic])
async def feed(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    cursor: int | None = Query(None, description="id последнего трека для курсора"),
    limit: int = Query(20, le=50),
) -> List[Track]:
    fr = await db.execute(select(Follow.following_id).where(Follow.follower_id == user.id))
    following_ids = list(fr.scalars().all())
    if not following_ids:
        return []
    q = (
        select(Track)
        .where(Track.user_id.in_(following_ids), Track.is_public.is_(True))
        .options(selectinload(Track.user))
        .order_by(Track.created_at.desc(), Track.id.desc())
        .limit(limit)
    )
    if cursor is not None:
        q = q.where(Track.id < cursor)
    r = await db.execute(q)
    return list(r.scalars().all())
