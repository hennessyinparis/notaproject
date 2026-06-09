from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.follow import Follow
from app.models.track import Track
from app.models.user import User
from app.schemas.feed import FeedResponse, SuggestedArtist
from app.schemas.track import TrackPublic
from app.services.track_engagement import enrich_tracks_public

router = APIRouter(prefix="/feed", tags=["feed"])


@router.get("", response_model=FeedResponse)
async def feed(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    cursor: int | None = Query(None, description="id последнего трека для курсора"),
    limit: int = Query(20, le=50),
) -> FeedResponse:
    fr = await db.execute(select(Follow.following_id).where(Follow.follower_id == user.id))
    following_ids = list(fr.scalars().all())
    following_count = len(following_ids)

    if not following_ids:
        return FeedResponse(following_count=0, tracks=[])

    q = (
        select(Track)
        .join(Track.user)
        .where(
            Track.user_id.in_(following_ids),
            Track.is_public.is_(True),
            User.is_admin.is_(False),
        )
        .options(selectinload(Track.user))
        .order_by(Track.created_at.desc(), Track.id.desc())
        .limit(limit)
    )
    if cursor is not None:
        q = q.where(Track.id < cursor)
    r = await db.execute(q)
    tracks = list(r.scalars().all())
    enriched = await enrich_tracks_public(db, tracks, user.id)
    return FeedResponse(following_count=following_count, tracks=enriched)


@router.get("/suggestions", response_model=List[SuggestedArtist])
async def feed_suggestions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(8, le=20),
) -> List[SuggestedArtist]:
    """Артисты с публичными треками, на которых пользователь ещё не подписан."""
    fr = await db.execute(select(Follow.following_id).where(Follow.follower_id == user.id))
    following_ids = set(fr.scalars().all())
    following_ids.add(user.id)

    track_count = func.count(Track.id).label("tc")
    q = (
        select(User, track_count)
        .join(Track, Track.user_id == User.id)
        .where(
            Track.is_public.is_(True),
            User.is_blocked.is_(False),
            User.is_deleted.is_(False),
            User.is_admin.is_(False),
        )
        .group_by(User.id)
        .having(track_count > 0)
        .order_by(track_count.desc(), User.id.desc())
        .limit(limit * 3)
    )
    rows = (await db.execute(q)).all()
    out: List[SuggestedArtist] = []
    for u, tc in rows:
        if u.id in following_ids:
            continue
        out.append(
            SuggestedArtist(
                id=u.id,
                username=u.username,
                display_name=u.display_name,
                avatar_url=u.avatar_url,
                is_verified=u.is_verified,
                public_tracks_count=int(tc or 0),
            )
        )
        if len(out) >= limit:
            break
    return out
