from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Like(Base):
    __tablename__ = "likes"
    __table_args__ = (
        CheckConstraint(
            "(track_id IS NOT NULL AND playlist_id IS NULL) OR (track_id IS NULL AND playlist_id IS NOT NULL)",
            name="ck_like_one_target",
        ),
        UniqueConstraint("user_id", "track_id", name="uq_like_user_track"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    track_id: Mapped[int | None] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"), nullable=True)
    playlist_id: Mapped[int | None] = mapped_column(
        ForeignKey("playlists.id", ondelete="CASCADE"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
