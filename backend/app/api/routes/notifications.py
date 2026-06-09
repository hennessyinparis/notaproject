from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.services.notification_enrich import enrich_notifications

router = APIRouter(prefix="/notifications", tags=["notifications"])


class ActorBriefOut(BaseModel):
    id: int
    username: str
    display_name: str
    avatar_url: Optional[str] = None


class NotificationOut(BaseModel):
    id: int
    type: str
    actor_id: int | None
    actor: ActorBriefOut | None = None
    entity_id: int | None
    entity_type: str | None
    entity_title: str | None = None
    preview: str | None = None
    is_read: bool
    created_at: datetime


@router.get("", response_model=List[NotificationOut])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 50,
) -> List[NotificationOut]:
    r = await db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    items = [
        n
        for n in r.scalars().all()
        if n.type not in (
            NotificationType.REPORT_DISMISSED.value,
            NotificationType.REPORT_UPDATE.value,
            NotificationType.REPORT_RESOLVED.value,
        )
    ]
    enriched = await enrich_notifications(db, items)
    return [NotificationOut.model_validate(x) for x in enriched]


@router.post("/read-all")
async def mark_all_read(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    await db.execute(update(Notification).where(Notification.user_id == user.id).values(is_read=True))
    return {"ok": True}


@router.get("/unread-count")
async def unread_count(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    r = await db.execute(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user.id, Notification.is_read.is_(False))
    )
    return {"count": r.scalar_one() or 0}
