from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.rate_limit import limiter, RateLimits
from app.models.report import Report, ReportReason, ReportType
from app.models.user import User

router = APIRouter(prefix="/reports", tags=["reports"])


class ReportCreate(BaseModel):
    report_type: str = Field(pattern=r"^(track|comment|user|playlist)$")
    target_id: int
    reason: str = Field(pattern=r"^(copyright|spam|abuse|inappropriate|other)$")
    description: Optional[str] = Field(None, max_length=2000)


class ReportOut(BaseModel):
    id: int
    report_type: str
    target_id: int
    reason: str
    description: Optional[str]
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


@router.post("", response_model=ReportOut, status_code=201)
@limiter.limit(RateLimits.REPORT_CREATE)
async def create_report(
    request: Request,
    body: ReportCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ReportOut:
    if user.is_admin:
        raise HTTPException(status_code=403, detail="Администраторы не могут отправлять жалобы")

    existing = await db.execute(
        select(Report).where(
            Report.reporter_id == user.id,
            Report.report_type == body.report_type,
            Report.target_id == body.target_id,
            Report.status == "pending",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Вы уже отправили жалобу на этот объект, дождитесь рассмотрения")

    report = Report(
        reporter_id=user.id,
        report_type=body.report_type,
        target_id=body.target_id,
        reason=body.reason,
        description=body.description,
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)
    return ReportOut.model_validate(report)


@router.get("", response_model=List[ReportOut])
async def list_my_reports(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[ReportOut]:
    r = await db.execute(
        select(Report)
        .where(Report.reporter_id == user.id)
        .order_by(Report.created_at.desc())
        .limit(50)
    )
    return [ReportOut.model_validate(x) for x in r.scalars().all()]


@router.get("/{report_id}", response_model=ReportOut)
async def get_my_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ReportOut:
    r = await db.execute(
        select(Report).where(Report.id == report_id, Report.reporter_id == user.id)
    )
    report = r.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Жалоба не найдена")
    return ReportOut.model_validate(report)
