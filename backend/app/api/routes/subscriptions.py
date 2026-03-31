from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.subscription import Subscription
from app.models.user import ArtistSubscriptionType, User, UserSubscriptionType
from app.schemas.user import UserPublic

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


class PurchaseBody(BaseModel):
    plan: str = Field(..., description="listener_plus | listener_student | artist_pro")
    payment_method: str = "card"


@router.post("/purchase", response_model=UserPublic)
async def purchase(
    body: PurchaseBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    """Имитация оплаты: один активный платный план — при смене второй сбрасывается."""
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=30)

    if body.plan == "listener_plus":
        user.subscription_type = UserSubscriptionType.PLUS.value
        user.artist_subscription_type = ArtistSubscriptionType.BASIC.value
        user.subscription_expires_at = expires
    elif body.plan == "listener_student":
        user.subscription_type = UserSubscriptionType.STUDENT.value
        user.artist_subscription_type = ArtistSubscriptionType.BASIC.value
        user.subscription_expires_at = expires
    elif body.plan == "artist_pro":
        user.artist_subscription_type = ArtistSubscriptionType.PRO.value
        user.subscription_type = UserSubscriptionType.FREE.value
        user.subscription_expires_at = expires
    else:
        raise HTTPException(status_code=400, detail="Неизвестный план")

    sub = Subscription(
        user_id=user.id,
        plan_type=body.plan,
        billing_cycle="monthly",
        price_paid=299.0 if "plus" in body.plan else 149.0 if "student" in body.plan else 599.0,
        expires_at=expires,
        is_active=True,
        payment_method=body.payment_method,
    )
    db.add(sub)
    await db.flush()
    return UserPublic.model_validate(user, from_attributes=True)


@router.post("/cancel", response_model=UserPublic)
async def cancel_subscription(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    """Отмена платной подписки — возврат к бесплатному тарифу для слушателя и базовому для артиста."""
    user.subscription_type = UserSubscriptionType.FREE.value
    user.artist_subscription_type = ArtistSubscriptionType.BASIC.value
    user.subscription_expires_at = None
    await db.flush()
    return UserPublic.model_validate(user, from_attributes=True)
