import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class RoyaltyStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"


class Royalty(Base):
    __tablename__ = "royalties"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    artist_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    track_id: Mapped[int] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"), index=True)
    period_month: Mapped[str] = mapped_column(String(7))  # YYYY-MM
    supporter_count: Mapped[int] = mapped_column(Integer, default=0)
    play_weight: Mapped[float] = mapped_column(Float, default=0.0)
    bonus_multiplier: Mapped[float] = mapped_column(Float, default=1.0)
    earned_amount: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(32), default=RoyaltyStatus.PENDING.value)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
