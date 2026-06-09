import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class NotificationType(str, enum.Enum):
    NEW_FOLLOWER = "new_follower"
    TRACK_LIKED = "track_liked"
    TRACK_REPOSTED = "track_reposted"
    TRACK_COMMENTED = "track_commented"
    NEW_TRACK_FROM_FOLLOWING = "new_track_from_following"
    NEW_MESSAGE = "new_message"
    PLAYLIST_INVITE = "playlist_invite"
    MENTION = "mention"
    ROYALTY_EARNED = "royalty_earned"
    REPORT_UPDATE = "report_update"
    REPORT_RESOLVED = "report_resolved"
    REPORT_DISMISSED = "report_dismissed"
    DONATION_RECEIVED = "donation_received"


class Notification(Base):
    __tablename__ = "notifications"

    __table_args__ = (
        Index('ix_notifications_created_at', 'created_at'),
        Index('ix_notifications_user_id_created_at', 'user_id', 'created_at'),
        Index('ix_notifications_user_id_is_read', 'user_id', 'is_read'),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(64), index=True)
    actor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    entity_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    entity_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
