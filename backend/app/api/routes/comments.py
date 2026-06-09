from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.api.deps import ensure_not_admin, get_current_user, get_current_user_optional
from app.core.database import get_db
from app.core.rate_limit import limiter, RateLimits
from app.models.comment import Comment
from app.models.comment_like import CommentLike
from app.models.notification import Notification, NotificationType
from app.models.track import Track
from app.models.user import User
from app.services.realtime import push_notification

router = APIRouter(prefix="/comments", tags=["comments"])


class CommentOut(BaseModel):
    id: int
    user_id: int
    track_id: int
    text: str
    timestamp_seconds: float
    parent_id: Optional[int] = None
    likes_count: int
    created_at: datetime
    author_username: Optional[str] = None
    author_display: Optional[str] = None
    author_avatar: Optional[str] = None
    is_liked: bool = False

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    timestamp_seconds: float = Field(default=0, ge=0, le=86400)
    parent_id: Optional[int] = None


@router.get("/track/{track_id}", response_model=List[CommentOut])
async def list_comments(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
    limit: int = 50,
    offset: int = 0,
) -> List[CommentOut]:
    # Загружаем комментарии с пользователями через eager loading (исправление N+1)
    r = await db.execute(
        select(Comment)
        .options(selectinload(Comment.user))
        .where(Comment.track_id == track_id)
        .order_by(Comment.timestamp_seconds, Comment.created_at)
        .limit(min(limit, 100))
        .offset(offset)
    )
    comments = list(r.scalars().all())
    
    # Загружаем лайки пользователя одним запросом (исправление N+1)
    liked_comment_ids: set = set()
    if user and comments:
        lr = await db.execute(
            select(CommentLike.comment_id).where(
                CommentLike.comment_id.in_([c.id for c in comments]),
                CommentLike.user_id == user.id,
            )
        )
        liked_comment_ids = {row[0] for row in lr.all()}
    
    out: List[CommentOut] = []
    for c in comments:
        u = c.user  # Используем eager loaded user
        if u and u.is_admin and (not user or not user.is_admin):
            continue
        out.append(
            CommentOut(
                id=c.id,
                user_id=c.user_id,
                track_id=c.track_id,
                text=c.text,
                timestamp_seconds=c.timestamp_seconds,
                parent_id=c.parent_id,
                likes_count=c.likes_count,
                created_at=c.created_at,
                author_username=u.username if u else None,
                author_display=u.display_name if u else None,
                author_avatar=u.avatar_url if u else None,
                is_liked=c.id in liked_comment_ids,
            )
        )
    return out


@router.post("/track/{track_id}", response_model=CommentOut)
@limiter.limit(RateLimits.COMMENT_CREATE)
async def create_comment(
    request: Request,
    track_id: int,
    body: CommentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CommentOut:
    if user.is_admin:
        raise HTTPException(status_code=403, detail="Администраторы не могут оставлять комментарии")
    tr = await db.execute(select(Track).where(Track.id == track_id))
    t = tr.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")
    if not t.allow_comments:
        raise HTTPException(status_code=403, detail="Комментарии отключены")

    c = Comment(
        user_id=user.id,
        track_id=track_id,
        text=body.text,
        timestamp_seconds=body.timestamp_seconds,
        parent_id=body.parent_id,
    )
    db.add(c)
    
    # Атомарное увеличение счетчика комментариев
    from sqlalchemy import update
    await db.execute(
        update(Track)
        .where(Track.id == track_id)
        .values(comments_count=Track.comments_count + 1)
    )
    await db.flush()
    await db.refresh(c)
    if t.user_id and t.user_id != user.id:
        notif = Notification(
            user_id=t.user_id, type=NotificationType.TRACK_COMMENTED.value,
            actor_id=user.id, entity_id=c.id, entity_type="comment",
        )
        db.add(notif)
        await db.flush()
        await push_notification(db, t.user_id, notif)
    return CommentOut(
        id=c.id,
        user_id=c.user_id,
        track_id=c.track_id,
        text=c.text,
        timestamp_seconds=c.timestamp_seconds,
        parent_id=c.parent_id,
        likes_count=c.likes_count,
        created_at=c.created_at,
        author_username=user.username,
        author_display=user.display_name,
        author_avatar=user.avatar_url,
    )


@router.post("/{comment_id}/like")
async def like_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    r = await db.execute(select(Comment).where(Comment.id == comment_id))
    c = r.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    existing = await db.execute(
        select(CommentLike).where(CommentLike.user_id == user.id, CommentLike.comment_id == c.id)
    )
    if existing.scalar_one_or_none():
        return {"liked": True, "likes_count": c.likes_count}
    like = CommentLike(user_id=user.id, comment_id=c.id)
    db.add(like)

    # Атомарное увеличение счетчика лайков комментариев
    from sqlalchemy import update
    await db.execute(
        update(Comment)
        .where(Comment.id == comment_id)
        .values(likes_count=Comment.likes_count + 1)
    )
    await db.flush()
    await db.refresh(c)

    if c.user_id and c.user_id != user.id:
        notif = Notification(
            user_id=c.user_id,
            type=NotificationType.TRACK_LIKED.value,
            actor_id=user.id,
            entity_id=c.id,
            entity_type="comment",
        )
        db.add(notif)
        await db.flush()
        await push_notification(db, c.user_id, notif)

    return {"liked": True, "likes_count": c.likes_count}


@router.delete("/{comment_id}/like")
async def unlike_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    r = await db.execute(select(Comment).where(Comment.id == comment_id))
    c = r.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    existing = await db.execute(
        select(CommentLike).where(CommentLike.user_id == user.id, CommentLike.comment_id == c.id)
    )
    like = existing.scalar_one_or_none()
    if like:
        await db.delete(like)
        
        # Атомарное уменьшение счетчика лайков комментариев
        from sqlalchemy import update
        await db.execute(
            update(Comment)
            .where(Comment.id == comment_id)
            .values(likes_count=Comment.likes_count - 1)
        )
        await db.flush()
        await db.refresh(c)
        
    return {"liked": False, "likes_count": c.likes_count}


class CommentUpdate(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


@router.patch("/{comment_id}", response_model=CommentOut)
async def edit_comment(
    comment_id: int,
    body: CommentUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CommentOut:
    r = await db.execute(select(Comment).where(Comment.id == comment_id))
    c = r.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    if c.user_id != user.id:
        raise HTTPException(status_code=403, detail="Нет прав")
    c.text = body.text
    await db.flush()
    await db.refresh(c)
    au = (await db.execute(select(User).where(User.id == c.user_id))).scalar_one_or_none()
    return CommentOut(
        id=c.id,
        user_id=c.user_id,
        track_id=c.track_id,
        text=c.text,
        timestamp_seconds=c.timestamp_seconds,
        parent_id=c.parent_id,
        likes_count=c.likes_count,
        created_at=c.created_at,
        author_username=au.username if au else None,
        author_display=au.display_name if au else None,
        author_avatar=au.avatar_url if au else None,
        is_liked=False,
    )


@router.delete("/{comment_id}")
async def delete_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    c = (await db.execute(select(Comment).where(Comment.id == comment_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    tr = (await db.execute(select(Track).where(Track.id == c.track_id))).scalar_one_or_none()
    if not tr:
        raise HTTPException(status_code=404, detail="Трек не найден")
    if c.user_id != user.id and tr.user_id != user.id:
        raise HTTPException(status_code=403, detail="Нет прав")
    await db.delete(c)
    await db.execute(
        update(Track)
        .where(Track.id == c.track_id, Track.comments_count > 0)
        .values(comments_count=Track.comments_count - 1)
    )
    await db.flush()
    return {"ok": True}
