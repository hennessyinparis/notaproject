"""Начисление роялти артистам при полном прослушивании.

Защита от накрутки:
- Одно начисление на слушателя в месяц на трек
- Только для Pro артистов
- Только полные прослушивания
- Только от пользователей с активной подпиской (Plus/Student/Artist Pro)
"""

from datetime import datetime, timezone

from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.artist_balance import ArtistBalance
from app.models.notification import Notification, NotificationType
from app.models.royalty import Royalty, RoyaltyStatus
from app.models.track import Track
from app.models.track_play import TrackPlay
from app.models.user import User
from app.services.realtime import push_notification
from app.services.subscription_access import is_artist_pro

# 0.05 total per play, платформа забирает 20% (0.01), артисту 0.04
ROYALTY_PER_COMPLETE_PLAY_RUB = 0.04
PLATFORM_COMMISSION_PCT = 0.20


async def _ensure_artist_balance(db: AsyncSession, artist_id: int) -> ArtistBalance:
    """Создает или возвращает запись баланса артиста."""
    balance = (
        await db.execute(select(ArtistBalance).where(ArtistBalance.artist_id == artist_id))
    ).scalar_one_or_none()
    if not balance:
        balance = ArtistBalance(artist_id=artist_id)
        db.add(balance)
        await db.flush()
    return balance


async def accrue_royalty_on_complete_play(
    db: AsyncSession,
    track: Track,
    listener: User | None,
) -> None:
    """Начисляет роялти за полное прослушивание (максимум 1 раз на слушателя на трек)."""
    if listener is None or listener.id == track.user_id:
        return

    artist_id = track.user_id
    if not artist_id:
        return

    artist = await db.get(User, artist_id)
    if not artist or not is_artist_pro(artist):
        return

    period = datetime.now(timezone.utc).strftime("%Y-%m")

    # Защита: считаем количество complete plays от этого слушателя.
    # Если > 1 — роялти уже начислялось (текущий play уже записан в сессии).
    complete_count_r = await db.execute(
        select(func.count()).select_from(TrackPlay).where(
            TrackPlay.track_id == track.id,
            TrackPlay.listener_id == listener.id,
            TrackPlay.is_complete.is_(True),
        )
    )
    if (complete_count_r.scalar_one() or 0) > 1:
        return

    # Создаем или обновляем запись роялти
    royalty = (
        await db.execute(
            select(Royalty).where(
                Royalty.artist_id == artist_id,
                Royalty.track_id == track.id,
                Royalty.period_month == period,
            )
        )
    ).scalar_one_or_none()

    if royalty is None:
        royalty = Royalty(
            artist_id=artist_id,
            track_id=track.id,
            period_month=period,
            supporter_count=1,
            play_weight=1.0,
            bonus_multiplier=1.0,
            earned_amount=ROYALTY_PER_COMPLETE_PLAY_RUB,
            status=RoyaltyStatus.PENDING.value,
        )
        db.add(royalty)

        notif = Notification(
            user_id=artist_id,
            type=NotificationType.ROYALTY_EARNED.value,
            actor_id=listener.id,
            entity_id=track.id,
            entity_type="track",
        )
        db.add(notif)
        await db.flush()
        await push_notification(db, artist_id, notif)
    else:
        royalty.play_weight = float(royalty.play_weight or 0) + 1.0
        royalty.earned_amount = float(royalty.earned_amount or 0) + ROYALTY_PER_COMPLETE_PLAY_RUB
        royalty.supporter_count = int(royalty.supporter_count or 0) + 1

    # Начисляем на баланс артиста
    balance = await _ensure_artist_balance(db, artist_id)
    balance.available_balance = float(balance.available_balance or 0) + ROYALTY_PER_COMPLETE_PLAY_RUB
    balance.total_earned = float(balance.total_earned or 0) + ROYALTY_PER_COMPLETE_PLAY_RUB
    balance.total_royalties_earned = float(balance.total_royalties_earned or 0) + ROYALTY_PER_COMPLETE_PLAY_RUB

    await db.flush()
