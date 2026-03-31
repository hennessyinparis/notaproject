from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.playlist import Playlist, PlaylistTrack
from app.models.playlist import PlaylistCollaborator
from app.models.message import Message
from app.models.notification import Notification, NotificationType
from app.models.track import Track
from app.models.user import User
from app.schemas.track import TrackPublic

router = APIRouter(prefix="/playlists", tags=["playlists"])


class PlaylistOut(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    is_public: bool
    is_album: bool
    plays_count: int
    likes_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class PlaylistCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    is_public: bool = True
    is_album: bool = False


@router.post("", response_model=PlaylistOut)
async def create_playlist(
    body: PlaylistCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Playlist:
    p = Playlist(
        user_id=user.id,
        title=body.title,
        description=body.description,
        is_public=body.is_public,
        is_album=body.is_album,
    )
    db.add(p)
    await db.flush()
    await db.refresh(p)
    return p


@router.get("/{playlist_id}", response_model=PlaylistOut)
async def get_playlist(playlist_id: int, db: AsyncSession = Depends(get_db)) -> Playlist:
    r = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    p = r.scalar_one_or_none()
    if not p or not p.is_public:
        raise HTTPException(status_code=404, detail="Плейлист не найден")
    return p


@router.get("/{playlist_id}/tracks", response_model=List[TrackPublic])
async def playlist_tracks(playlist_id: int, db: AsyncSession = Depends(get_db)) -> List[Track]:
    pr = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    p = pr.scalar_one_or_none()
    if not p or not p.is_public:
        raise HTTPException(status_code=404, detail="Плейлист не найден")
    r = await db.execute(
        select(Track)
        .join(PlaylistTrack, PlaylistTrack.track_id == Track.id)
        .where(PlaylistTrack.playlist_id == playlist_id, Track.is_public.is_(True))
        .options(selectinload(Track.user))
        .order_by(PlaylistTrack.position)
    )
    return list(r.scalars().all())


@router.get("/mine", response_model=List[PlaylistOut])
async def my_playlists(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[Playlist]:
    r = await db.execute(select(Playlist).where(Playlist.user_id == user.id).order_by(Playlist.created_at.desc()))
    return list(r.scalars().all())


@router.post("/{playlist_id}/tracks/{track_id}")
async def add_track_to_playlist(
    playlist_id: int,
    track_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    pr = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    p = pr.scalar_one_or_none()
    is_collab = (
        await db.execute(
            select(PlaylistCollaborator).where(
                PlaylistCollaborator.playlist_id == playlist_id,
                PlaylistCollaborator.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if not p or (p.user_id != user.id and not is_collab):
        raise HTTPException(status_code=404, detail="Плейлист не найден")
    tr = await db.execute(select(Track).where(Track.id == track_id))
    t = tr.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")
    max_pos = await db.execute(
        select(func.coalesce(func.max(PlaylistTrack.position), 0)).where(PlaylistTrack.playlist_id == playlist_id)
    )
    pos = int(max_pos.scalar_one() or 0) + 1
    db.add(PlaylistTrack(playlist_id=playlist_id, track_id=track_id, position=pos))
    return {"ok": True}


@router.get("/{playlist_id}/collaborators", response_model=list[dict])
async def get_collaborators(
    playlist_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    p = (await db.execute(select(Playlist).where(Playlist.id == playlist_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Плейлист не найден")
    rows = await db.execute(
        select(PlaylistCollaborator, User)
        .join(User, User.id == PlaylistCollaborator.user_id)
        .where(PlaylistCollaborator.playlist_id == playlist_id)
    )
    return [
        {
            "user_id": u.id,
            "username": u.username,
            "display_name": u.display_name,
            "avatar_url": u.avatar_url,
            "role": c.role,
        }
        for c, u in rows.all()
    ]


@router.post("/{playlist_id}/invite")
async def invite_collaborator(
    playlist_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    username = (body.get("username") or "").strip()
    p = (await db.execute(select(Playlist).where(Playlist.id == playlist_id))).scalar_one_or_none()
    if not p or p.user_id != user.id:
        raise HTTPException(status_code=404, detail="Плейлист не найден")
    target = (await db.execute(select(User).where(User.username == username))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    invite_text = f"Приглашение в совместный плейлист: {p.title}"
    db.add(Message(sender_id=user.id, receiver_id=target.id, text=invite_text, is_read=False))
    db.add(
        Notification(
            user_id=target.id,
            type=NotificationType.MENTION.value,
            actor_id=user.id,
            entity_id=playlist_id,
            entity_type="playlist_invite",
        )
    )
    return {"ok": True}


@router.post("/{playlist_id}/collaborators")
async def add_collaborator(
    playlist_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    role = (body.get("role") or "editor").strip()
    exists = (
        await db.execute(
            select(PlaylistCollaborator).where(
                PlaylistCollaborator.playlist_id == playlist_id,
                PlaylistCollaborator.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if exists:
        return {"ok": True}
    db.add(PlaylistCollaborator(playlist_id=playlist_id, user_id=user.id, role=role))
    return {"ok": True}


@router.delete("/{playlist_id}/collaborators/{user_id}")
async def remove_collaborator(
    playlist_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    p = (await db.execute(select(Playlist).where(Playlist.id == playlist_id))).scalar_one_or_none()
    if not p or p.user_id != user.id:
        raise HTTPException(status_code=404, detail="Плейлист не найден")
    row = (
        await db.execute(
            select(PlaylistCollaborator).where(
                PlaylistCollaborator.playlist_id == playlist_id,
                PlaylistCollaborator.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if row:
        await db.delete(row)
    return {"ok": True}
