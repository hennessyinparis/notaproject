import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.core.rate_limit import limiter, RateLimits
from app.models.subscription import Subscription
from app.models.user import ArtistSubscriptionType, User, UserSubscriptionType
from app.schemas.user import UserPublic
from app.services.audit import log_audit

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


class PurchaseBody(BaseModel):
    plan: str = Field(..., description="listener_plus | listener_student | artist_pro")
    payment_method: str = "card"


@router.post("/purchase", response_model=UserPublic)
@limiter.limit(RateLimits.SUBSCRIPTION_PURCHASE)
async def purchase(
    request: Request,
    body: PurchaseBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    if user.is_admin:
        raise HTTPException(status_code=403, detail="Действие недоступно для администратора")
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=30)

    # Защита от race condition: блокируем строку пользователя
    from sqlalchemy import text
    await db.execute(
        text("SELECT 1 FROM users WHERE id = :uid FOR UPDATE"),
        {"uid": user.id}
    )

    # Проверяем нет ли уже активной подписки
    active_sub = await db.execute(
        select(Subscription).where(
            Subscription.user_id == user.id,
            Subscription.is_active.is_(True)
        )
    )
    if active_sub.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="У вас уже есть активная подписка"
        )

    if body.plan == "listener_student":
        if getattr(user, "student_verification_status", "none") != "approved":
            raise HTTPException(
                status_code=403,
                detail="Сначала подтвердите статус студента (загрузите документ при оформлении подписки)",
            )

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

    from sqlalchemy import update

    await db.execute(
        update(Subscription)
        .where(Subscription.user_id == user.id, Subscription.is_active.is_(True))
        .values(is_active=False)
    )

    settings = get_settings()
    plan_prices = {
        "listener_plus": settings.PRICE_LISTENER_PLUS_RUB,
        "listener_student": settings.PRICE_LISTENER_STUDENT_RUB,
        "artist_pro": settings.PRICE_ARTIST_PRO_RUB,
    }
    price = plan_prices.get(body.plan, 0.0)

    txn_id = f"mock_{secrets.token_hex(8)}"
    sub = Subscription(
        user_id=user.id,
        plan_type=body.plan,
        billing_cycle="monthly",
        price_paid=price,
        expires_at=expires,
        is_active=True,
        payment_method=body.payment_method,
        payment_transaction_id=txn_id,
    )
    db.add(sub)
    await db.flush()
    await log_audit(
        db,
        user_id=user.id,
        username=user.username,
        action_type="subscription_purchase",
        entity_type="subscription",
        entity_id=sub.id,
        details={"plan": body.plan, "price_paid": price, "transaction_id": txn_id},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return UserPublic.model_validate(user, from_attributes=True)


@router.post("/cancel", response_model=UserPublic)
async def cancel_subscription(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    if user.is_admin:
        raise HTTPException(status_code=403, detail="Действие недоступно для администратора")
    from sqlalchemy import update

    user.subscription_type = UserSubscriptionType.FREE.value
    user.artist_subscription_type = ArtistSubscriptionType.BASIC.value
    user.subscription_expires_at = datetime.now(timezone.utc)  # Истекает немедленно
    await db.execute(
        update(Subscription)
        .where(Subscription.user_id == user.id, Subscription.is_active.is_(True))
        .values(is_active=False)
    )
    await db.flush()
    return UserPublic.model_validate(user, from_attributes=True)
