"""Полное удаление аккаунта и медиа."""

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.track import Track
from app.models.user import User
from app.services.media import resolve_media_path


async def delete_user_fully(db: AsyncSession, user: User) -> None:
    tr = await db.execute(select(Track).where(Track.user_id == user.id))
    for track in tr.scalars().all():
        for url in (track.file_url, track.cover_url):
            path = resolve_media_path(url) if url else None
            if path and path.exists():
                try:
                    path.unlink()
                except OSError:
                    pass
    if user.avatar_url:
        av = resolve_media_path(user.avatar_url)
        if av and av.exists():
            try:
                av.unlink()
            except OSError:
                pass
    await db.execute(delete(Track).where(Track.user_id == user.id))
    await db.delete(user)
    await db.flush()
