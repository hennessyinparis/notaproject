from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_user_optional
from app.core.database import get_db
from app.models.donation import Donation
from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.schemas.donation import DonateBody, DonationOut, DonationStats
from app.services.realtime import push_notification
from app.services.subscription_access import is_artist_pro

router = APIRouter(prefix="/donations", tags=["donations"])


@router.post("/{username}", response_model=dict)
async def donate_to_artist(
    username: str,
    body: DonateBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if user.is_admin:
        raise HTTPException(status_code=403, detail="Недоступно")
    if user.is_blocked:
        raise HTTPException(status_code=403, detail="Ваш аккаунт заблокирован")
    artist = (await db.execute(select(User).where(User.username == username))).scalar_one_or_none()
    if not artist or artist.is_deleted or artist.is_blocked:
        raise HTTPException(status_code=404, detail="Артист не найден")
    if artist.is_admin:
        raise HTTPException(status_code=404, detail="Артист не найден")
    if not is_artist_pro(artist):
        raise HTTPException(status_code=403, detail="Донаты доступны только артистам с подпиской Артист Про")
    if artist.id == user.id:
        raise HTTPException(status_code=400, detail="Нельзя задонатить себе")

    donation = Donation(
        donor_id=user.id,
        artist_id=artist.id,
        amount_rub=round(body.amount_rub, 2),
        message=(body.message or "").strip() or None,
        is_anonymous=body.is_anonymous,
    )
    db.add(donation)
    await db.flush()

    notif = Notification(
        user_id=artist.id,
        type=NotificationType.DONATION_RECEIVED.value,
        actor_id=user.id,
        entity_id=donation.id,
        entity_type="donation",
    )
    db.add(notif)
    await db.flush()
    await push_notification(db, artist.id, notif)

    return {"ok": True, "donation_id": donation.id}


@router.get("/artist/{username}/summary")
async def artist_donation_summary(
    username: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    artist = (await db.execute(select(User).where(User.username == username))).scalar_one_or_none()
    if not artist or artist.is_deleted or artist.is_blocked or artist.is_admin:
        raise HTTPException(status_code=404, detail="Артист не найден")
    if not is_artist_pro(artist):
        return {"accepts_donations": False, "total_rub": 0, "count": 0}
    total = await db.execute(
        select(func.coalesce(func.sum(Donation.amount_rub), 0)).where(Donation.artist_id == artist.id)
    )
    count = await db.execute(select(func.count()).select_from(Donation).where(Donation.artist_id == artist.id))
    return {
        "accepts_donations": True,
        "total_rub": round(float(total.scalar_one() or 0), 2),
        "count": int(count.scalar_one() or 0),
    }


@router.get("/me/received", response_model=List[DonationOut])
async def my_received_donations(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[DonationOut]:
    if not is_artist_pro(user):
        return []
    rows = await db.execute(
        select(Donation, User)
        .outerjoin(User, User.id == Donation.donor_id)
        .where(Donation.artist_id == user.id)
        .order_by(Donation.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    out: List[DonationOut] = []
    for d, donor in rows.all():
        if d.is_anonymous:
            dn = "Аноним"
            du = None
        else:
            dn = donor.display_name if donor else "Аноним"
            du = donor.username if donor else None
        out.append(
            DonationOut(
                id=d.id,
                amount_rub=d.amount_rub,
                message=d.message,
                donor_display_name=dn,
                donor_username=du,
                is_anonymous=d.is_anonymous,
                created_at=d.created_at.isoformat(),
            )
        )
    return out


@router.get("/me/received/stats", response_model=DonationStats)
async def my_donation_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DonationStats:
    if not is_artist_pro(user):
        return DonationStats(total_rub=0, total_count=0, this_month_rub=0, this_month_count=0, top_donors=[], daily_chart=[])

    total_rub = await db.execute(
        select(func.coalesce(func.sum(Donation.amount_rub), 0)).where(Donation.artist_id == user.id)
    )
    total_count = await db.execute(
        select(func.count()).select_from(Donation).where(Donation.artist_id == user.id)
    )

    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_rub = await db.execute(
        select(func.coalesce(func.sum(Donation.amount_rub), 0))
        .where(Donation.artist_id == user.id, Donation.created_at >= month_start)
    )
    month_count = await db.execute(
        select(func.count()).select_from(Donation)
        .where(Donation.artist_id == user.id, Donation.created_at >= month_start)
    )

    top = await db.execute(
        select(User.display_name, User.username, func.sum(Donation.amount_rub), func.count())
        .join(Donation, Donation.donor_id == User.id)
        .where(Donation.artist_id == user.id, Donation.is_anonymous.is_(False))
        .group_by(User.id, User.display_name, User.username)
        .order_by(func.sum(Donation.amount_rub).desc())
        .limit(5)
    )
    top_donors = [
        {"display_name": name, "username": uname, "total_rub": round(float(rub), 2), "count": int(cnt)}
        for name, uname, rub, cnt in top.all()
    ]

    days_30 = datetime.now(timezone.utc) - timedelta(days=30)
    chart = await db.execute(
        select(
            func.date_trunc("day", Donation.created_at).label("day"),
            func.coalesce(func.sum(Donation.amount_rub), 0),
            func.count(),
        )
        .where(Donation.artist_id == user.id, Donation.created_at >= days_30)
        .group_by(text("day"))
        .order_by(text("day"))
    )
    daily_chart = [
        {"date": str(row[0].date()), "total_rub": round(float(row[1]), 2), "count": int(row[2])}
        for row in chart.all()
    ]

    return DonationStats(
        total_rub=round(float(total_rub.scalar_one() or 0), 2),
        total_count=int(total_count.scalar_one() or 0),
        this_month_rub=round(float(month_rub.scalar_one() or 0), 2),
        this_month_count=int(month_count.scalar_one() or 0),
        top_donors=top_donors,
        daily_chart=daily_chart,
    )
