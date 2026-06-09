from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, contains_eager

from app.api.deps import get_current_user_optional
from app.core.database import get_db
from app.core.rate_limit import RateLimits, limiter
from app.models.playlist import Playlist
from app.models.track import Track
from app.models.user import User
from app.schemas.track import TrackPublic

router = APIRouter(prefix="/search", tags=["search"])


class SearchResults(BaseModel):
    tracks: List[TrackPublic]
    users: List[dict]
    playlists: List[dict]


@router.get("", response_model=SearchResults)
@limiter.limit(RateLimits.SEARCH)
async def search_all(
    request: Request,
    q: str = Query("", min_length=0, max_length=200),
    db: AsyncSession = Depends(get_db),
    viewer: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
) -> SearchResults:
    if not q.strip():
        return SearchResults(tracks=[], users=[], playlists=[])
    term = f"%{q.strip()}%"
    tr = await db.execute(
        select(Track)
        .join(Track.user)
        .where(
            Track.is_public.is_(True),
            User.is_admin.is_(False),
            User.is_deleted.is_(False),
            User.is_blocked.is_(False),
            or_(Track.title.ilike(term), Track.genre.ilike(term)),
        )
        .options(selectinload(Track.user))
        .limit(20)
    )
    tracks = list(tr.scalars().all())
    user_filter = [
        User.is_deleted.is_(False),
        User.is_blocked.is_(False),
        or_(User.username.ilike(term), User.display_name.ilike(term)),
    ]
    if not viewer or not viewer.is_admin:
        user_filter.append(User.is_admin.is_(False))
    if viewer:
        user_filter.append(User.id != viewer.id)
    ur = await db.execute(
        select(User).where(and_(*user_filter)).limit(10)
    )
    users = [
        {"id": u.id, "username": u.username, "display_name": u.display_name, "avatar_url": u.avatar_url}
        for u in ur.scalars().all()
    ]
    pr = await db.execute(
        select(Playlist)
        .join(User, User.id == Playlist.user_id)
        .options(contains_eager(Playlist.user))
        .where(
            Playlist.is_public.is_(True),
            User.is_admin.is_(False),
            User.is_deleted.is_(False),
            User.is_blocked.is_(False),
            or_(Playlist.title.ilike(term), User.username.ilike(term), User.display_name.ilike(term)),
        )
        .limit(10)
    )
    playlists = [
        {
            "id": p.id,
            "title": p.title,
            "cover_url": p.cover_url,
            "user_id": p.user_id,
            "owner_name": p.user.username if p.user else None,
        }
        for p in pr.scalars().all()
    ]
    return SearchResults(tracks=tracks, users=users, playlists=playlists)
