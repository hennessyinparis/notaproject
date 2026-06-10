"""YooKassa payment integration service."""

import uuid
from decimal import Decimal
from typing import Optional

from yookassa import Configuration, Payment as YooKassaPayment
from yookassa.domain.notification import WebhookNotification

from app.core.config import get_settings

settings = get_settings()

# Configure YooKassa with test credentials
Configuration.configure(
    settings.YOOKASSA_SHOP_ID,
    settings.YOOKASSA_SECRET_KEY
)


async def create_subscription_payment(
    user_id: int,
    amount: Decimal,
    subscription_type: str,
    return_url: str,
) -> dict:
    """Create YooKassa payment for subscription.
    
    Returns:
        {
            "payment_id": str,
            "status": str,
            "confirmation_url": str,
            "amount": str,
            "currency": str
        }
    """
    idempotence_key = str(uuid.uuid4())
    
    payment = YooKassaPayment.create(
        {
            "amount": {
                "value": str(amount),
                "currency": "RUB"
            },
            "confirmation": {
                "type": "redirect",
                "return_url": return_url
            },
            "capture": True,
            "description": f"Подписка Нота {subscription_type}",
            "metadata": {
                "user_id": str(user_id),
                "subscription_type": subscription_type,
                "idempotence_key": idempotence_key
            }
        },
        idempotence_key
    )
    
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[YooKassa] Payment created: id={payment.id}, status={payment.status}, return_url={return_url}, confirmation_url={payment.confirmation.confirmation_url}")
    return {
        "payment_id": payment.id,
        "status": payment.status,
        "confirmation_url": payment.confirmation.confirmation_url,
        "amount": str(payment.amount.value),
        "currency": payment.amount.currency,
        "metadata": payment.metadata
    }


async def get_payment(payment_id: str) -> dict:
    """Get payment info from YooKassa."""
    payment = YooKassaPayment.find_one(payment_id)
    return {
        "id": payment.id,
        "status": payment.status,
        "paid": payment.paid,
        "amount": str(payment.amount.value) if payment.amount else None,
        "metadata": payment.metadata
    }


async def parse_webhook(data: dict) -> dict:
    """Parse webhook notification from YooKassa."""
    notification = WebhookNotification(data)
    payment = notification.object
    return {
        "payment_id": payment.id,
        "status": payment.status,
        "paid": payment.paid,
        "metadata": payment.metadata
    }


async def cancel_payment(payment_id: str) -> dict:
    """Cancel a pending payment."""
    payment = YooKassaPayment.cancel(payment_id)
    return {
        "id": payment.id,
        "status": payment.status,
        "paid": payment.paid
    }
