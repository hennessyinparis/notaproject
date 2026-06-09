import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SubscriptionPlanType(str, enum.Enum):
    LISTENER_PLUS = "listener_plus"
    LISTENER_STUDENT = "listener_student"
    ARTIST_PRO = "artist_pro"


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    plan_type: Mapped[str] = mapped_column(String(64))
    billing_cycle: Mapped[str] = mapped_column(String(32), default="monthly")
    price_paid: Mapped[float] = mapped_column(Float, default=0.0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    payment_method: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    payment_transaction_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
