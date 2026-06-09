from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.follow import Follow
from app.models.user import User


async def can_send_message(db: AsyncSession, sender: User, recipient: User) -> bool:
    if recipient.is_blocked or recipient.is_deleted:
        return False
    if sender.is_blocked or sender.is_deleted:
        return False
    privacy = getattr(recipient, "messages_privacy", "everyone") or "everyone"
    if privacy == "everyone":
        return True
    if privacy == "nobody":
        return False
    if privacy == "followers":
        row = await db.execute(
            select(Follow.id).where(
                Follow.follower_id == sender.id,
                Follow.following_id == recipient.id,
            )
        )
        return row.scalar_one_or_none() is not None
    return True
