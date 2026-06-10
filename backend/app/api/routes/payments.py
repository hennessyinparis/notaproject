from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_user_optional
from app.core.config import get_settings
from app.core.database import get_db
from app.models.payment import Payment
from app.models.subscription import Subscription, SubscriptionPlanType
from app.models.user import User, UserSubscriptionType, ArtistSubscriptionType
from app.services.audit import log_audit
from app.services.yookassa_service import create_subscription_payment, get_payment, parse_webhook

router = APIRouter(prefix="/payments", tags=["payments"])

settings = get_settings()

# Subscription prices
SUBSCRIPTION_PRICES = {
    "plus": Decimal("299.00"),
    "student": Decimal("149.00"),
    "artist_pro": Decimal("599.00"),
}

SUBSCRIPTION_TYPES = {
    "plus": UserSubscriptionType.PLUS,
    "student": UserSubscriptionType.STUDENT,
    "artist_pro": None,  # Special handling for artist_pro
}

SUBSCRIPTION_TYPE_MAP = {
    "listener_plus": "plus",
    "listener_student": "student",
    "artist_pro": "artist_pro",
    "plus": "plus",
    "student": "student",
}

ARTIST_SUBSCRIPTION_TYPES = {
    "artist_pro": ArtistSubscriptionType.PRO,
}

SUBSCRIPTION_DAYS = {
    "plus": 30,
    "student": 30,
    "artist_pro": 30,
}


@router.post("/create", response_model=dict)
async def create_payment(
    request: Request,
    subscription_type: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Create a new YooKassa payment for subscription."""
    if not settings.YOOKASSA_SHOP_ID or not settings.YOOKASSA_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="Payment system not configured. Please set YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY."
        )

    subscription_type = SUBSCRIPTION_TYPE_MAP.get(subscription_type, subscription_type)

    if subscription_type not in SUBSCRIPTION_PRICES:
        raise HTTPException(status_code=400, detail="Invalid subscription type")

    # Check if already has active subscription of this type
    if subscription_type != "artist_pro":
        if user.subscription_type == SUBSCRIPTION_TYPES[subscription_type].value:
            if user.subscription_expires_at and user.subscription_expires_at > datetime.now(timezone.utc):
                raise HTTPException(status_code=400, detail="Already have active subscription")
    else:
        if user.artist_subscription_type == ArtistSubscriptionType.PRO.value:
            if user.subscription_expires_at and user.subscription_expires_at > datetime.now(timezone.utc):
                raise HTTPException(status_code=400, detail="Already have active Artist Pro subscription")

    amount = SUBSCRIPTION_PRICES[subscription_type]

    # Create payment record in database first to get id for return_url
    payment = Payment(
        user_id=user.id,
        subscription_type=subscription_type,
        amount=amount,
        currency="RUB",
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    db.add(payment)
    await db.flush()

    return_url = f"{settings.FRONTEND_URL}/payments/return?payment_id={payment.id}"
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[YooKassa] Creating payment for user={user.id}, return_url={return_url}")

    # Create YooKassa payment
    yookassa_result = await create_subscription_payment(
        user_id=user.id,
        amount=amount,
        subscription_type=subscription_type,
        return_url=return_url,
    )

    # Update with YooKassa payment id
    payment.yookassa_payment_id = yookassa_result["payment_id"]
    payment.status = yookassa_result["status"]
    payment.payment_metadata = yookassa_result.get("metadata", {})

    await log_audit(
        db=db,
        user_id=user.id,
        username=user.username,
        action_type="payment_created",
        entity_type="payment",
        entity_id=payment.id,
        details={"subscription_type": subscription_type, "amount": str(amount), "payment_id": yookassa_result["payment_id"]},
        ip_address=request.client.host if request.client else None,
    )

    return {
        "payment_id": payment.id,
        "yookassa_payment_id": yookassa_result["payment_id"],
        "confirmation_url": yookassa_result["confirmation_url"],
        "amount": str(amount),
        "currency": "RUB",
        "status": yookassa_result["status"],
    }


@router.get("/{payment_id}/status", response_model=dict)
async def check_payment_status(
    payment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Check payment status and update subscription if paid."""
    payment = await db.get(Payment, payment_id)
    if not payment or payment.user_id != user.id:
        raise HTTPException(status_code=404, detail="Payment not found")

    if not settings.YOOKASSA_SHOP_ID or not settings.YOOKASSA_SECRET_KEY:
        return {
            "payment_id": payment.id,
            "status": payment.status,
            "amount": str(payment.amount),
            "subscription_type": payment.subscription_type,
        }

    # Try to check with YooKassa, but fallback to DB status if YooKassa fails
    try:
        yookassa_info = await get_payment(payment.yookassa_payment_id)
        
        # Update payment status if changed
        if yookassa_info["status"] != payment.status:
            payment.status = yookassa_info["status"]
            if yookassa_info["status"] == "succeeded":
                payment.paid_at = datetime.now(timezone.utc)
                
                # Activate subscription
                days = SUBSCRIPTION_DAYS.get(payment.subscription_type, 30)
                expires_at = datetime.now(timezone.utc) + timedelta(days=days)
                
                if payment.subscription_type == "artist_pro":
                    user.artist_subscription_type = ArtistSubscriptionType.PRO.value
                else:
                    user.subscription_type = SUBSCRIPTION_TYPES[payment.subscription_type].value
                
                user.subscription_expires_at = expires_at
                
                await log_audit(
                    db=db,
                    user_id=user.id,
                    username=user.username,
                    action_type="payment_succeeded",
                    entity_type="payment",
                    entity_id=payment.id,
                    details={"subscription_type": payment.subscription_type, "amount": str(payment.amount)},
                    ip_address=None,
                )
            await db.commit()
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"YooKassa status check failed for payment {payment.id}: {e}")
        # Fallback to DB status, don't crash the endpoint

    return {
        "payment_id": payment.id,
        "status": payment.status,
        "amount": str(payment.amount),
        "subscription_type": payment.subscription_type,
        "user": {
            "id": user.id,
            "username": user.username,
            "subscription_type": user.subscription_type,
            "subscription_expires_at": user.subscription_expires_at.isoformat() if user.subscription_expires_at else None,
            "artist_subscription_type": user.artist_subscription_type,
        }
    }


@router.post("/webhook", response_model=dict)
async def payment_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Receive YooKassa webhook notifications."""
    data = await request.json()
    
    try:
        notification = await parse_webhook(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid webhook: {str(e)}")
    
    yookassa_payment_id = notification["payment_id"]
    status = notification["status"]
    # Find payment in database
    payment_result = await db.execute(
        select(Payment).where(Payment.yookassa_payment_id == yookassa_payment_id)
    )
    payment = payment_result.scalar_one_or_none()
    
    if not payment:
        return {"status": "ok", "message": "Payment not found"}
    
    # Update status
    if status != payment.status:
        payment.status = status
        if status == "succeeded":
            payment.paid_at = datetime.now(timezone.utc)
            
            # Activate subscription
            user = await db.get(User, payment.user_id)
            if user:
                days = SUBSCRIPTION_DAYS.get(payment.subscription_type, 30)
                expires_at = datetime.now(timezone.utc) + timedelta(days=days)
                
                if payment.subscription_type == "artist_pro":
                    user.artist_subscription_type = ArtistSubscriptionType.PRO.value
                else:
                    user.subscription_type = SUBSCRIPTION_TYPES[payment.subscription_type].value
                
                user.subscription_expires_at = expires_at
                
                # Create subscription record
                sub = Subscription(
                    user_id=user.id,
                    plan_type=payment.subscription_type,
                    amount=payment.amount,
                    is_active=True,
                    expires_at=expires_at,
                )
                db.add(sub)
                
                await log_audit(
                    db=db,
                    user_id=user.id,
                    username=user.username,
                    action_type="payment_succeeded_webhook",
                    entity_type="payment",
                    entity_id=payment.id,
                    details={"subscription_type": payment.subscription_type, "amount": str(payment.amount)},
                )
        
        await db.flush()
    
    return {"status": "ok"}


@router.get("/my", response_model=list[dict])
async def my_payments(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    """Get user's payment history."""
    result = await db.execute(
        select(Payment)
        .where(Payment.user_id == user.id)
        .order_by(Payment.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    payments = result.scalars().all()
    
    return [
        {
            "id": p.id,
            "subscription_type": p.subscription_type,
            "amount": str(p.amount),
            "currency": p.currency,
            "status": p.status,
            "created_at": p.created_at.isoformat(),
            "paid_at": p.paid_at.isoformat() if p.paid_at else None,
        }
        for p in payments
    ]
