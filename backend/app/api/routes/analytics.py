from datetime import datetime, timedelta, timezone
from typing import Any, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_pro_user, get_current_user
from app.core.database import get_db
from app.models.track import Track
from app.models.track_play import TrackPlay
from app.models.user import User

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
    series = [{"date": (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d"), "plays": max(0, play_count // 30 - i * 2)} for i in range(14)]
    return WaveDashboard(
        wave_coefficient=round(coeff, 2),
        top_fans_anonymous=[{"level": "Поклонник", "avatar": None} for _ in range(min(5, max(1, play_count // 10)))],
        payout_forecast_rub=round(coeff * 12.5, 2),
        plays_series=list(reversed(series)),
    )


@router.get("/plays")
async def plays_summary(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_pro_user),
) -> dict:
    tr = await db.execute(select(Track.id).where(Track.user_id == user.id))
    ids = [r[0] for r in tr.all()]
    if not ids:
        return {"total": 0}
    c = await db.execute(select(func.count()).select_from(TrackPlay).where(TrackPlay.track_id.in_(ids)))
    return {"total": c.scalar_one() or 0}


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
