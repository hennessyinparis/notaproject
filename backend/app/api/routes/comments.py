from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.comment import Comment
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

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    timestamp_seconds: float = 0
    parent_id: Optional[int] = None


@router.get("/track/{track_id}", response_model=List[CommentOut])
async def list_comments(track_id: int, db: AsyncSession = Depends(get_db)) -> List[CommentOut]:
    r = await db.execute(
        select(Comment).where(Comment.track_id == track_id).order_by(Comment.timestamp_seconds, Comment.created_at)
    )
    comments = list(r.scalars().all())
    out: List[CommentOut] = []
    for c in comments:
        ur = await db.execute(select(User).where(User.id == c.user_id))
        u = ur.scalar_one_or_none()
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
    from app.models.like import Like
    r = await db.execute(select(Comment).where(Comment.id == comment_id))
    c = r.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    existing = await db.execute(
        select(Like).where(Like.user_id == user.id, Like.track_id == c.track_id)
    )
    if existing.scalar_one_or_none():
        return {"liked": True, "likes_count": c.likes_count}
    like = Like(user_id=user.id, track_id=c.track_id)
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
    from app.models.like import Like
    r = await db.execute(select(Comment).where(Comment.id == comment_id))
    c = r.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    existing = await db.execute(
        select(Like).where(Like.user_id == user.id, Like.track_id == c.track_id)
    )
    like = existing.scalar_one_or_none()
    if like:
        await db.delete(like)
        c.likes_count = max(0, c.likes_count - 1)
        await db.flush()
    return {"liked": False, "likes_count": c.likes_count}
