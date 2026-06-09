from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_pro_user, get_current_user
from app.core.database import get_db
from app.models.donation import Donation
from app.models.like import Like
from app.models.repost import Repost
from app.models.royalty import Royalty
from app.models.track import Track
from app.models.track_play import TrackPlay
from app.models.user import User
from app.services.subscription_access import is_artist_pro

router = APIRouter(prefix="/analytics", tags=["analytics"])


class WaveDashboard(BaseModel):
    wave_coefficient: float
    top_fans_anonymous: List[dict]
    payout_forecast_rub: float
    plays_series: List[dict[str, Any]]


@router.get("/wave", response_model=WaveDashboard)
async def wave_dashboard(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_pro_user),
) -> WaveDashboard:
    """Дашборд «Волна» — агрегаты по трекам артиста."""
    tr = await db.execute(select(Track.id).where(Track.user_id == user.id))
    track_ids = [row[0] for row in tr.all()]
    if not track_ids:
        return WaveDashboard(
            wave_coefficient=0,
            top_fans_anonymous=[],
            payout_forecast_rub=0,
            plays_series=[],
        )
    since = datetime.now(timezone.utc) - timedelta(days=30)
    plays = await db.execute(
        select(func.count())
        .select_from(TrackPlay)
        .where(TrackPlay.track_id.in_(track_ids), TrackPlay.created_at >= since)
    )
    play_count = plays.scalar_one() or 0
    coeff = min(100.0, float(play_count) ** 0.5)

    series: List[dict[str, Any]] = []
    for i in range(13, -1, -1):
        day_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        day_plays = await db.execute(
            select(func.count())
            .select_from(TrackPlay)
            .where(
                TrackPlay.track_id.in_(track_ids),
                TrackPlay.created_at >= day_start,
                TrackPlay.created_at < day_end,
            )
        )
        series.append(
            {"date": day_start.strftime("%Y-%m-%d"), "plays": int(day_plays.scalar_one() or 0)}
        )

    # Top fans: реальные слушатели, отсортированные по числу прослушиваний
    top_fans_q = await db.execute(
        select(User.id, User.username, User.display_name, User.avatar_url, func.count().label("plays"))
        .select_from(TrackPlay)
        .join(User, User.id == TrackPlay.listener_id)
        .where(
            TrackPlay.track_id.in_(track_ids),
            TrackPlay.created_at >= since,
            TrackPlay.listener_id.isnot(None),
        )
        .group_by(User.id, User.username, User.display_name, User.avatar_url)
        .order_by(func.count().desc())
        .limit(5)
    )
    top_fans = [
        {
            "username": row.username,
            "display_name": row.display_name or row.username,
            "avatar": row.avatar_url,
            "plays": row.plays,
            "level": "Суперфанат" if row.plays >= 50 else "Фанат" if row.plays >= 20 else "Поклонник",
        }
        for row in top_fans_q.all()
    ]

    return WaveDashboard(
        wave_coefficient=round(coeff, 2),
        top_fans_anonymous=top_fans,
        payout_forecast_rub=round(coeff * 12.5, 2),
        plays_series=list(reversed(series)),
    )


@router.get("/plays")
async def plays_summary(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_pro_user),
) -> dict:
    """Расширенная статистика прослушиваний для Pro артистов."""
    tr = await db.execute(select(Track.id).where(Track.user_id == user.id))
    ids = [r[0] for r in tr.all()]
    if not ids:
        return {"total": 0, "daily": []}
    
    c = await db.execute(select(func.count()).select_from(TrackPlay).where(TrackPlay.track_id.in_(ids)))
    total = c.scalar_one() or 0
    
    fourteen_days_ago = datetime.now(timezone.utc) - timedelta(days=14)
    daily = await db.execute(
        select(
            func.date_trunc('day', TrackPlay.created_at).label('day'),
            func.count().label('count'),
        )
        .where(
            TrackPlay.track_id.in_(ids),
            TrackPlay.created_at >= fourteen_days_ago,
        )
        .group_by(func.date_trunc('day', TrackPlay.created_at))
        .order_by(func.date_trunc('day', TrackPlay.created_at))
    )
    
    return {
        "total": total,
        "daily": [
            {"date": row.day.isoformat(), "plays": row.count}
            for row in daily.all()
        ],
    }


@router.get("/my-basic-stats")
async def my_basic_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Базовая статистика для всех пользователей."""
    tr = await db.execute(select(Track.id).where(Track.user_id == user.id))
    ids = [r[0] for r in tr.all()]
    if not ids:
        return {"total": 0}
    c = await db.execute(select(func.count()).select_from(TrackPlay).where(TrackPlay.track_id.in_(ids)))
    return {"total": c.scalar_one() or 0}


@router.get("/studio")
async def studio_dashboard(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Единый дашборд для страницы Студии. Возвращает всё одной ручкой."""
    result: dict = {}

    # --- Треки ---
    tr = await db.execute(
        select(Track)
        .options(selectinload(Track.user))
        .where(Track.user_id == user.id)
        .order_by(Track.created_at.desc())
    )
    tracks = list(tr.scalars().all())
    track_ids = [t.id for t in tracks]
    result["total_tracks"] = len(tracks)
    result["tracks"] = [
        {
            "id": t.id,
            "title": t.title,
            "genre": t.genre,
            "plays_count": t.plays_count or 0,
            "likes_count": t.likes_count or 0,
            "reposts_count": t.reposts_count or 0,
            "comments_count": t.comments_count or 0,
            "cover_url": t.cover_url,
            "is_public": t.is_public,
            "duration_seconds": t.duration_seconds or 0,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in tracks
    ]

    # --- Суммарные метрики ---
    total_plays = sum(t.plays_count or 0 for t in tracks)
    total_likes = sum(t.likes_count or 0 for t in tracks)
    total_reposts = sum(t.reposts_count or 0 for t in tracks)
    total_comments = sum(t.comments_count or 0 for t in tracks)
    result["total_plays"] = total_plays
    result["total_likes"] = total_likes
    result["total_reposts"] = total_reposts
    result["total_comments"] = total_comments

    # --- Подписчики ---
    result["followers_count"] = 0
    try:
        f = await db.execute(
            select(func.count())
            .select_from(text("follows"))
            .where(text("following_id = :uid")), {"uid": user.id}
        )
        result["followers_count"] = f.scalar_one() or 0
    except Exception:
        pass

    # --- Pro-расширения ---
    is_pro = is_artist_pro(user)
    result["is_pro"] = is_pro

    if is_pro and track_ids:
        # Дневные прослушивания (14 дней)
        fourteen_days_ago = datetime.now(timezone.utc) - timedelta(days=14)
        daily = await db.execute(
            select(
                func.date_trunc("day", TrackPlay.created_at).label("day"),
                func.count().label("count"),
            )
            .where(TrackPlay.track_id.in_(track_ids), TrackPlay.created_at >= fourteen_days_ago)
            .group_by(text("day"))
            .order_by(text("day"))
        )
        result["plays_daily"] = [
            {"date": str(row[0].date()), "plays": row[1]}
            for row in daily.all()
        ]

        # Роялти
        rq = await db.execute(select(Royalty).where(Royalty.artist_id == user.id))
        roy_rows = list(rq.scalars().all())
        result["royalties"] = {
            "pending_rub": round(sum(float(x.earned_amount or 0) for x in roy_rows if x.status == "pending"), 2),
            "paid_rub": round(sum(float(x.earned_amount or 0) for x in roy_rows if x.status == "paid"), 2),
        }

        # Донаты
        total_rub = await db.execute(
            select(func.coalesce(func.sum(Donation.amount_rub), 0)).where(Donation.artist_id == user.id)
        )
        total_cnt = await db.execute(
            select(func.count()).select_from(Donation).where(Donation.artist_id == user.id)
        )
        month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_rub = await db.execute(
            select(func.coalesce(func.sum(Donation.amount_rub), 0))
            .where(Donation.artist_id == user.id, Donation.created_at >= month_start)
        )
        month_cnt = await db.execute(
            select(func.count()).select_from(Donation)
            .where(Donation.artist_id == user.id, Donation.created_at >= month_start)
        )
        result["donations"] = {
            "total_rub": round(float(total_rub.scalar_one() or 0), 2),
            "total_count": int(total_cnt.scalar_one() or 0),
            "this_month_rub": round(float(month_rub.scalar_one() or 0), 2),
            "this_month_count": int(month_cnt.scalar_one() or 0),
        }

        # Волна (упрощённо)
        play_count_30 = await db.execute(
            select(func.count()).select_from(TrackPlay)
            .where(TrackPlay.track_id.in_(track_ids), TrackPlay.created_at >= datetime.now(timezone.utc) - timedelta(days=30))
        )
        pc = play_count_30.scalar_one() or 0
        coeff = min(100.0, float(pc) ** 0.5)
        result["wave"] = {
            "coefficient": round(coeff, 2),
            "forecast_rub": round(coeff * 12.5, 2),
        }
    else:
        result["plays_daily"] = []
        result["donations"] = {"total_rub": 0, "total_count": 0, "this_month_rub": 0, "this_month_count": 0}
    if not is_pro:
        result["royalties"] = {"pending_rub": 0, "paid_rub": 0}

    return result


@router.get("/detailed")
async def detailed_analytics(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_pro_user),
) -> dict:
    """Максимально подробная аналитика для Pro артистов."""
    tr = await db.execute(
        select(Track).where(Track.user_id == user.id).order_by(Track.created_at.desc())
    )
    tracks = list(tr.scalars().all())
    track_ids = [t.id for t in tracks]

    if not track_ids:
        return {"empty": True, "message": "Нет треков для анализа"}

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # --- 1. Plays over time (30 дней) ---
    days_30 = today_start - timedelta(days=29)
    daily_plays = await db.execute(
        select(
            func.date_trunc("day", TrackPlay.created_at).label("day"),
            func.count().label("cnt"),
            func.coalesce(func.avg(TrackPlay.listened_seconds), 0).label("avg_sec"),
            func.count().filter(TrackPlay.is_complete.is_(True)).label("completions"),
        )
        .where(TrackPlay.track_id.in_(track_ids), TrackPlay.created_at >= days_30)
        .group_by(text("day"))
        .order_by(text("day"))
    )
    plays_over_time = [
        {
            "date": str(row[0].date()),
            "plays": row[1],
            "avg_seconds": round(float(row[2]), 1),
            "completions": row[3],
        }
        for row in daily_plays.all()
    ]

    # --- 2. Plays by source ---
    src_data = await db.execute(
        select(TrackPlay.source, func.count())
        .where(TrackPlay.track_id.in_(track_ids))
        .group_by(TrackPlay.source)
        .order_by(func.count().desc())
    )
    plays_by_source = {row[0]: row[1] for row in src_data.all()}

    # --- 3. Per-track detailed breakdown ---
    tracks_breakdown = []
    for t in tracks:
        tp = await db.execute(
            select(
                func.count(),
                func.coalesce(func.avg(TrackPlay.listened_seconds), 0),
                func.count().filter(TrackPlay.is_complete.is_(True)),
            )
            .where(TrackPlay.track_id == t.id)
        )
        play_count, avg_listen, completions = tp.one()
        completion_rate = round(completions / play_count * 100, 1) if play_count else 0
        tracks_breakdown.append({
            "id": t.id,
            "title": t.title,
            "plays": t.plays_count or 0,
            "likes": t.likes_count or 0,
            "reposts": t.reposts_count or 0,
            "comments": t.comments_count or 0,
            "cover_url": t.cover_url,
            "is_public": t.is_public,
            "genre": t.genre,
            "avg_listen_seconds": round(float(avg_listen), 1),
            "completion_rate": completion_rate,
            "engagement_rate": round((t.likes_count or 0) / max(t.plays_count or 1, 1) * 100, 2),
        })

    # --- 4. Growth (this week vs last week) ---
    this_week_start = today_start - timedelta(days=today_start.weekday())
    last_week_start = this_week_start - timedelta(days=7)
    plays_this_week = await db.execute(
        select(func.count()).select_from(TrackPlay)
        .where(TrackPlay.track_id.in_(track_ids), TrackPlay.created_at >= this_week_start)
    )
    plays_last_week = await db.execute(
        select(func.count()).select_from(TrackPlay)
        .where(
            TrackPlay.track_id.in_(track_ids),
            TrackPlay.created_at >= last_week_start,
            TrackPlay.created_at < this_week_start,
        )
    )
    pw = int(plays_this_week.scalar_one() or 0)
    lw = int(plays_last_week.scalar_one() or 0)
    growth_pct = round((pw - lw) / max(lw, 1) * 100, 1)

    # --- 5. Total aggregated ---
    total_plays_db = await db.execute(
        select(func.count()).select_from(TrackPlay).where(TrackPlay.track_id.in_(track_ids))
    )
    total_plays = int(total_plays_db.scalar_one() or 0)
    total_likes = sum(t.likes_count or 0 for t in tracks)
    total_reposts = sum(t.reposts_count or 0 for t in tracks)
    total_comments = sum(t.comments_count or 0 for t in tracks)

    # --- 6. Followers ---
    try:
        f = await db.execute(
            select(func.count()).select_from(text("follows"))
            .where(text("following_id = :uid")), {"uid": user.id}
        )
        followers_count = f.scalar_one() or 0
    except Exception:
        followers_count = 0

    # --- 7. Best day ---
    best_day = max(plays_over_time, key=lambda x: x["plays"]) if plays_over_time else None

    # --- 8. Donations (pro) ---
    don_total = await db.execute(
        select(func.coalesce(func.sum(Donation.amount_rub), 0)).where(Donation.artist_id == user.id)
    )
    don_cnt = await db.execute(
        select(func.count()).select_from(Donation).where(Donation.artist_id == user.id)
    )
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    don_month = await db.execute(
        select(func.coalesce(func.sum(Donation.amount_rub), 0))
        .where(Donation.artist_id == user.id, Donation.created_at >= month_start)
    )
    don_month_cnt = await db.execute(
        select(func.count()).select_from(Donation)
        .where(Donation.artist_id == user.id, Donation.created_at >= month_start)
    )

    # --- 9. Royalties ---
    rq = await db.execute(select(Royalty).where(Royalty.artist_id == user.id))
    roy_rows = list(rq.scalars().all())

    # --- 10. Wave ---
    play_count_30 = await db.execute(
        select(func.count()).select_from(TrackPlay)
        .where(TrackPlay.track_id.in_(track_ids), TrackPlay.created_at >= now - timedelta(days=30))
    )
    pc30 = play_count_30.scalar_one() or 0
    coeff = min(100.0, float(pc30) ** 0.5)

    # --- 11. Likes/reposts over time (last 30 days) ---
    likes_30 = await db.execute(
        select(func.count())
        .select_from(Like)
        .where(Like.track_id.in_(track_ids), Like.created_at >= now - timedelta(days=30))
    )
    reposts_30 = await db.execute(
        select(func.count())
        .select_from(Repost)
        .where(Repost.track_id.in_(track_ids), Repost.created_at >= now - timedelta(days=30))
    )

    return {
        "summary": {
            "total_tracks": len(tracks),
            "total_plays": total_plays,
            "total_likes": total_likes,
            "total_reposts": total_reposts,
            "total_comments": total_comments,
            "followers_count": followers_count,
            "engagement_rate": round(total_likes / max(total_plays, 1) * 100, 2),
            "avg_plays_per_track": round(total_plays / max(len(tracks), 1), 1),
        },
        "plays_over_time": plays_over_time,
        "plays_by_source": plays_by_source,
        "growth": {
            "plays_this_week": pw,
            "plays_last_week": lw,
            "change_pct": growth_pct,
            "direction": "up" if growth_pct > 0 else ("down" if growth_pct < 0 else "flat"),
        },
        "best_day": best_day,
        "top_tracks": sorted(tracks_breakdown, key=lambda x: x["plays"], reverse=True)[:10],
        "tracks_breakdown": tracks_breakdown,
        "donations": {
            "total_rub": round(float(don_total.scalar_one() or 0), 2),
            "total_count": int(don_cnt.scalar_one() or 0),
            "this_month_rub": round(float(don_month.scalar_one() or 0), 2),
            "this_month_count": int(don_month_cnt.scalar_one() or 0),
        },
        "royalties": {
            "pending_rub": round(sum(float(x.earned_amount or 0) for x in roy_rows if x.status == "pending"), 2),
            "paid_rub": round(sum(float(x.earned_amount or 0) for x in roy_rows if x.status == "paid"), 2),
        },
        "wave": {
            "coefficient": round(coeff, 2),
            "forecast_rub": round(coeff * 12.5, 2),
        },
        "recent_engagement": {
            "likes_30_days": int(likes_30.scalar_one() or 0),
            "reposts_30_days": int(reposts_30.scalar_one() or 0),
        },
    }
