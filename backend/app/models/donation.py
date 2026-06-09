from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Donation(Base):
    __tablename__ = "donations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    donor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    artist_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    amount_rub: Mapped[float] = mapped_column(Float)
    message: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
