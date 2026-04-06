from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_admin_user
from app.core.database import get_db
from app.models.comment import Comment
from app.models.message import Message
from app.models.playlist import Playlist
from app.models.track import Track
from app.models.user import User
from app.schemas.track import TrackPublic
from app.schemas.user import UserPublic
from app.services.media import resolve_media_path

router = APIRouter(prefix="/admin", tags=["admin"])


class AdminCommentRow(BaseModel):
    id: int
    text: str
    created_at: datetime
    user_id: int
    username: str
    display_name: str
    track_id: int
    track_title: str


@router.get("/stats")
async def admin_stats(
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    users_count = (await db.execute(select(func.count()).select_from(User))).scalar_one() or 0
    tracks_count = (await db.execute(select(func.count()).select_from(Track))).scalar_one() or 0
    total_plays = (await db.execute(select(func.coalesce(func.sum(Track.plays_count), 0)))).scalar_one() or 0
    blocked_users = (
        await db.execute(select(func.count()).select_from(User).where(User.is_blocked.is_(True)))
    ).scalar_one() or 0
    verified_users = (
        await db.execute(select(func.count()).select_from(User).where(User.is_verified.is_(True)))
    ).scalar_one() or 0
    admin_users = (
        await db.execute(select(func.count()).select_from(User).where(User.is_admin.is_(True)))
    ).scalar_one() or 0
    comments_count = (await db.execute(select(func.count()).select_from(Comment))).scalar_one() or 0
    playlists_count = (await db.execute(select(func.count()).select_from(Playlist))).scalar_one() or 0
    messages_count = (await db.execute(select(func.count()).select_from(Message))).scalar_one() or 0
    public_tracks = (
        await db.execute(select(func.count()).select_from(Track).where(Track.is_public.is_(True)))
    ).scalar_one() or 0
    hidden_tracks = (
        await db.execute(select(func.count()).select_from(Track).where(Track.is_public.is_(False)))
    ).scalar_one() or 0
    return {
        "users_count": users_count,
        "tracks_count": tracks_count,
        "total_plays": int(total_plays),
        "blocked_users_count": int(blocked_users),
        "verified_users_count": int(verified_users),
        "admin_users_count": int(admin_users),
        "comments_count": int(comments_count),
        "playlists_count": int(playlists_count),
        "messages_count": int(messages_count),
        "public_tracks_count": int(public_tracks),
        "hidden_tracks_count": int(hidden_tracks),
    }


@router.get("/users", response_model=List[UserPublic])
async def admin_users(
    limit: int = 50,
    q: Optional[str] = None,
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> List[User]:
    stmt = select(User).order_by(User.created_at.desc()).limit(min(limit, 200))
    if q and q.strip():
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(User.username.ilike(term), User.display_name.ilike(term), User.email.ilike(term))
        )
    r = await db.execute(stmt)
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
    if u.is_blocked:
        u.is_admin = False
    await db.flush()
    return {"ok": True, "is_blocked": u.is_blocked}


@router.patch("/users/{user_id}/admin", response_model=dict)
async def toggle_user_admin(
    user_id: int,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if user_id == admin_user.id:
        raise HTTPException(
            status_code=400, detail="Измените права другого пользователя; свой аккаунт не переключается здесь"
        )
    r = await db.execute(select(User).where(User.id == user_id))
    u = r.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if u.is_blocked:
        raise HTTPException(status_code=400, detail="Нельзя назначить администратором заблокированного пользователя")

    new_admin = not u.is_admin
    if u.is_admin and not new_admin:
        others = (
            await db.execute(
                select(func.count()).select_from(User).where(User.is_admin.is_(True), User.id != u.id)
            )
        ).scalar_one() or 0
        if others == 0:
            raise HTTPException(status_code=400, detail="Нельзя снять последнего администратора")

    u.is_admin = new_admin
    await db.flush()
    return {"ok": True, "is_admin": u.is_admin}


@router.get("/tracks", response_model=List[TrackPublic])
async def admin_tracks(
    limit: int = 40,
    offset: int = 0,
    q: Optional[str] = None,
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> List[Track]:
    stmt = (
        select(Track)
        .options(selectinload(Track.user))
        .order_by(Track.created_at.desc())
        .offset(max(offset, 0))
        .limit(min(limit, 100))
    )
    if q and q.strip():
        stmt = stmt.where(Track.title.ilike(f"%{q.strip()}%"))
    r = await db.execute(stmt)
    return list(r.scalars().all())


@router.patch("/tracks/{track_id}/visibility")
async def admin_toggle_track_visibility(
    track_id: int,
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    r = await db.execute(select(Track).where(Track.id == track_id))
    t = r.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")
    t.is_public = not t.is_public
    await db.flush()
    return {"ok": True, "is_public": t.is_public}


@router.delete("/tracks/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_track(
    track_id: int,
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    r = await db.execute(select(Track).where(Track.id == track_id))
    t = r.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")
    path = resolve_media_path(t.file_url)
    await db.execute(delete(Track).where(Track.id == track_id))
    if path and path.exists():
        try:
            path.unlink()
        except OSError:
            pass


@router.get("/comments", response_model=List[AdminCommentRow])
async def admin_comments(
    limit: int = 50,
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> List[AdminCommentRow]:
    lim = min(max(limit, 1), 100)
    rows = (
        await db.execute(
            select(Comment, User.username, User.display_name, Track.title)
            .join(User, User.id == Comment.user_id)
            .join(Track, Track.id == Comment.track_id)
            .order_by(Comment.created_at.desc())
            .limit(lim)
        )
    ).all()
    out: List[AdminCommentRow] = []
    for c, username, display_name, track_title in rows:
        out.append(
            AdminCommentRow(
                id=c.id,
                text=c.text,
                created_at=c.created_at,
                user_id=c.user_id,
                username=username,
                display_name=display_name,
                track_id=c.track_id,
                track_title=track_title,
            )
        )
    return out


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_comment(
    comment_id: int,
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    c = (await db.execute(select(Comment).where(Comment.id == comment_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    track_id = c.track_id
    tr = (await db.execute(select(Track).where(Track.id == track_id))).scalar_one_or_none()
    if not tr:
        raise HTTPException(status_code=404, detail="Трек не найден")
    await db.delete(c)
    cnt = (
        await db.execute(select(func.count()).select_from(Comment).where(Comment.track_id == track_id))
    ).scalar_one() or 0
    tr.comments_count = int(cnt)
    await db.flush()
