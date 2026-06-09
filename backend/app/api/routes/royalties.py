from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.services.subscription_access import is_artist_pro
from app.core.database import get_db
from app.models.royalty import Royalty
from app.models.user import User

router = APIRouter(prefix="/royalties", tags=["royalties"])


class RoyaltyOut(BaseModel):
    id: int
    track_id: int
    period_month: str
    supporter_count: int
    play_weight: float
    earned_amount: float
    status: str

    model_config = {"from_attributes": True}


@router.get("/me", response_model=List[RoyaltyOut])
async def my_royalties(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[RoyaltyOut]:
    if not is_artist_pro(user):
        return []
    r = await db.execute(
        select(Royalty).where(Royalty.artist_id == user.id).order_by(Royalty.period_month.desc()).limit(100)
    )
    return [RoyaltyOut.model_validate(x) for x in r.scalars().all()]


@router.get("/me/summary")
async def my_royalties_summary(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if not is_artist_pro(user):
        return {"pending_rub": 0, "paid_rub": 0, "entries": 0}
    r = await db.execute(select(Royalty).where(Royalty.artist_id == user.id))
    rows = list(r.scalars().all())
    pending = sum(float(x.earned_amount or 0) for x in rows if x.status == "pending")
    paid = sum(float(x.earned_amount or 0) for x in rows if x.status == "paid")
    return {"pending_rub": round(pending, 2), "paid_rub": round(paid, 2), "entries": len(rows)}
