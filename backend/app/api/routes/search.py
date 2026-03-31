from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
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
async def search_all(
    q: str = Query("", min_length=0, max_length=200),
    db: AsyncSession = Depends(get_db),
) -> SearchResults:
    if not q.strip():
        return SearchResults(tracks=[], users=[], playlists=[])
    term = f"%{q.strip()}%"
    tr = await db.execute(
        select(Track)
        .where(Track.is_public.is_(True), or_(Track.title.ilike(term), Track.genre.ilike(term)))
        .options(selectinload(Track.user))
        .limit(20)
    )
    tracks = list(tr.scalars().all())
    ur = await db.execute(select(User).where(User.username.ilike(term)).limit(10))
    users = [
        {"id": u.id, "username": u.username, "display_name": u.display_name, "avatar_url": u.avatar_url}
        for u in ur.scalars().all()
    ]
    pr = await db.execute(select(Playlist).where(Playlist.is_public.is_(True), Playlist.title.ilike(term)).limit(10))
    playlists = [
        {"id": p.id, "title": p.title, "cover_url": p.cover_url, "user_id": p.user_id}
        for p in pr.scalars().all()
    ]
    return SearchResults(tracks=tracks, users=users, playlists=playlists)
