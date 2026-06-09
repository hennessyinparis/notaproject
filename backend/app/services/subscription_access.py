"""Проверка активных подписок слушателя и артиста."""

from datetime import datetime, timezone

from app.models.user import ArtistSubscriptionType, User, UserSubscriptionType


def _subscription_active(user: User) -> bool:
    exp = user.subscription_expires_at
    if exp is None:
        return False
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    return exp > datetime.now(timezone.utc)


def is_premium_listener(user: User | None) -> bool:
    if user is None or user.is_admin:
        return False
    sub = user.subscription_type or UserSubscriptionType.FREE.value
    artist_sub = user.artist_subscription_type or ArtistSubscriptionType.BASIC.value
    # Plus, Student, или Artist Pro — все считаются платными слушателями
    if sub not in (UserSubscriptionType.PLUS.value, UserSubscriptionType.STUDENT.value) and artist_sub != ArtistSubscriptionType.PRO.value:
        return False
    return _subscription_active(user)


def is_artist_pro(user: User | None) -> bool:
    if user is None:
        return False
    if (user.artist_subscription_type or ArtistSubscriptionType.BASIC.value) != ArtistSubscriptionType.PRO.value:
        return False
    return _subscription_active(user)


def is_free_listener(user: User | None) -> bool:
    return not is_premium_listener(user) and not is_artist_pro(user)
