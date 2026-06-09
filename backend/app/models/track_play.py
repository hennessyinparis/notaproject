import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TrackPlaySource(str, enum.Enum):
    FEED = "feed"
    SEARCH = "search"
    PROFILE = "profile"
    EMBED = "embed"


class TrackPlay(Base):
    __tablename__ = "track_plays"

    __table_args__ = (
        Index('ix_track_plays_created_at', 'created_at'),
        Index('ix_track_plays_track_id_created_at', 'track_id', 'created_at'),
        Index('ix_track_plays_listener_id_track_id', 'listener_id', 'track_id'),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    track_id: Mapped[int] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"), index=True)
    listener_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    listened_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    is_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String(32), default=TrackPlaySource.FEED.value)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
