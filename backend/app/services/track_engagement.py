"""Добавляет к трекам is_liked / is_reposted для текущего зрителя."""

from typing import List, Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.like import Like
from app.models.repost import Repost
from app.models.track import Track
from app.schemas.track import TrackPublic


async def enrich_tracks_public(
    db: AsyncSession,
    tracks: Sequence[Track],
    viewer_id: Optional[int],
) -> List[TrackPublic]:
    if not tracks:
        return []
    ids = [t.id for t in tracks]
    liked: set[int] = set()
    reposted: set[int] = set()
    if viewer_id is not None:
        lr = await db.execute(
            select(Like.track_id).where(
                Like.user_id == viewer_id,
                Like.track_id.isnot(None),
                Like.track_id.in_(ids),
            )
        )
        liked = set(lr.scalars().all())
        rr = await db.execute(
            select(Repost.track_id).where(Repost.user_id == viewer_id, Repost.track_id.in_(ids))
        )
        reposted = set(rr.scalars().all())
    out: List[TrackPublic] = []
    for t in tracks:
        base = TrackPublic.model_validate(t, from_attributes=True)
        out.append(
            base.model_copy(
                update={
                    "is_liked": t.id in liked,
                    "is_reposted": t.id in reposted,
                }
            )
        )
    return out
