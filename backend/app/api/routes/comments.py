from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_current_user_optional
from app.core.database import get_db
from app.models.comment import Comment
from app.models.comment_like import CommentLike
from app.models.track import Track
from app.models.user import User

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
    timestamp_seconds: float = 0
    parent_id: Optional[int] = None


@router.get("/track/{track_id}", response_model=List[CommentOut])
async def list_comments(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
) -> List[CommentOut]:
    r = await db.execute(
        select(Comment).where(Comment.track_id == track_id).order_by(Comment.timestamp_seconds, Comment.created_at)
    )
    comments = list(r.scalars().all())
    out: List[CommentOut] = []
    for c in comments:
        ur = await db.execute(select(User).where(User.id == c.user_id))
        u = ur.scalar_one_or_none()
        is_liked = False
        if user:
            lr = await db.execute(
                select(CommentLike).where(CommentLike.comment_id == c.id, CommentLike.user_id == user.id)
            )
            is_liked = lr.scalar_one_or_none() is not None
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
                is_liked=is_liked,
            )
        )
    return out


@router.post("/track/{track_id}", response_model=CommentOut)
async def create_comment(
    track_id: int,
    body: CommentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CommentOut:
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
    t.comments_count += 1
    await db.flush()
    await db.refresh(c)
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
    c.likes_count += 1
    await db.flush()
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
        c.likes_count = max(0, c.likes_count - 1)
        await db.flush()
    return {"liked": False, "likes_count": c.likes_count}


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
    tr.comments_count = max(0, tr.comments_count - 1)
    await db.flush()
    return {"ok": True}
