from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import delete, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_admin_user
from app.core.database import get_db
from app.models.ad import Ad
from app.models.audit_log import AuditLog
from app.models.comment import Comment
from app.models.donation import Donation
from app.models.message import Message
from app.models.playlist import Playlist
from app.models.report import Report, ReportReason, ReportStatus
from app.models.subscription import Subscription
from app.models.track import Track
from app.models.user import User
from app.schemas.ad import AdAdmin
from app.schemas.donation import AdminDonationOut, AdminDonationStats
from app.schemas.track import TrackPublic
from app.schemas.user import UserPublic
from app.services.audit import log_audit

_reason_labels = {
    "copyright": "Нарушение авторских прав",
    "spam": "Спам",
    "abuse": "Оскорбления",
    "inappropriate": "Неприемлемый контент",
    "other": "Другое",
}


class BlockedTrackOut(BaseModel):
    id: int
    title: str
    user_id: int
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime
    plays_count: Optional[int] = 0
    genre: Optional[str] = None
    cover_url: Optional[str] = None
    report_reason: Optional[str] = None
    report_reason_label: Optional[str] = None
    report_created_at: Optional[datetime] = None
    report_id: Optional[int] = None


class BlockedUserOut(BaseModel):
    id: int
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    email: Optional[str] = None
    is_admin: bool = False
    is_verified: bool = False
    created_at: datetime
    report_reason: Optional[str] = None
    report_reason_label: Optional[str] = None
    report_created_at: Optional[datetime] = None
    report_id: Optional[int] = None
from app.services.audio_meta import get_duration_seconds
from app.services.media import resolve_media_path, save_ad_audio, save_cover

router = APIRouter(prefix="/admin", tags=["admin"])


class SubscriptionRevenue(BaseModel):
    total_revenue: float
    active_subscriptions: int
    by_plan: dict[str, float]
    count_by_plan: dict[str, int]


class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    username: Optional[str] = None
    action_type: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/audit-logs", response_model=List[AuditLogOut])
async def admin_audit_logs(
    user_id: Optional[int] = None,
    action_type: Optional[str] = None,
    entity_type: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    ip_address: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> List[AuditLog]:
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    if user_id is not None:
        stmt = stmt.where(AuditLog.user_id == user_id)
    if action_type:
        stmt = stmt.where(AuditLog.action_type == action_type)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if date_from:
        stmt = stmt.where(AuditLog.created_at >= date_from)
    if date_to:
        stmt = stmt.where(AuditLog.created_at <= date_to)
    if ip_address:
        stmt = stmt.where(AuditLog.ip_address == ip_address)
    stmt = stmt.offset(offset).limit(limit)
    r = await db.execute(stmt)
    return list(r.scalars().all())


@router.get("/subscription-revenue")
async def admin_subscription_revenue(
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionRevenue:
    total_result = await db.execute(
        select(func.coalesce(func.sum(Subscription.price_paid), 0)).where(
            Subscription.is_active.is_(True)
        )
    )
    total_revenue = float(total_result.scalar_one() or 0)

    count_result = await db.execute(
        select(func.count())
        .select_from(Subscription)
        .where(Subscription.is_active.is_(True))
    )
    active_subscriptions = int(count_result.scalar_one() or 0)

    plan_result = await db.execute(
        select(
            Subscription.plan_type,
            func.coalesce(func.sum(Subscription.price_paid), 0),
            func.count(),
        )
        .where(Subscription.is_active.is_(True))
        .group_by(Subscription.plan_type)
    )
    by_plan: dict[str, float] = {}
    count_by_plan: dict[str, int] = {}
    for plan_type, amount, cnt in plan_result.all():
        by_plan[str(plan_type)] = float(amount or 0)
        count_by_plan[str(plan_type)] = int(cnt or 0)

    return SubscriptionRevenue(
        total_revenue=total_revenue,
        active_subscriptions=active_subscriptions,
        by_plan=by_plan,
        count_by_plan=count_by_plan,
    )


class AdminCommentRow(BaseModel):
    id: int
    text: str
    created_at: datetime
    user_id: int
    username: str
    display_name: str
    track_id: int
    track_title: str


@router.get("/stats")
async def admin_stats(
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    users_count = (await db.execute(select(func.count()).select_from(User))).scalar_one() or 0
    tracks_count = (await db.execute(select(func.count()).select_from(Track))).scalar_one() or 0
    total_plays = (await db.execute(select(func.coalesce(func.sum(Track.plays_count), 0)))).scalar_one() or 0
    blocked_users = (
        await db.execute(select(func.count()).select_from(User).where(User.is_blocked.is_(True)))
    ).scalar_one() or 0
    verified_users = (
        await db.execute(select(func.count()).select_from(User).where(User.is_verified.is_(True)))
    ).scalar_one() or 0
    admin_users = (
        await db.execute(select(func.count()).select_from(User).where(User.is_admin.is_(True)))
    ).scalar_one() or 0
    comments_count = (await db.execute(select(func.count()).select_from(Comment))).scalar_one() or 0
    playlists_count = (await db.execute(select(func.count()).select_from(Playlist))).scalar_one() or 0
    messages_count = (await db.execute(select(func.count()).select_from(Message))).scalar_one() or 0
    public_tracks = (
        await db.execute(select(func.count()).select_from(Track).where(Track.is_public.is_(True)))
    ).scalar_one() or 0
    hidden_tracks = (
        await db.execute(select(func.count()).select_from(Track).where(Track.is_public.is_(False)))
    ).scalar_one() or 0
    reports_pending = (
        await db.execute(select(func.count()).select_from(Report).where(Report.status == ReportStatus.PENDING.value))
    ).scalar_one() or 0
    reports_resolved = (
        await db.execute(select(func.count()).select_from(Report).where(Report.status == ReportStatus.RESOLVED.value))
    ).scalar_one() or 0
    reports_dismissed = (
        await db.execute(select(func.count()).select_from(Report).where(Report.status == ReportStatus.DISMISSED.value))
    ).scalar_one() or 0
    users_today = (
        await db.execute(
            select(func.count()).select_from(User).where(func.date(User.created_at) == func.current_date())
        )
    ).scalar_one() or 0
    donations_total = (
        await db.execute(select(func.coalesce(func.sum(Donation.amount_rub), 0)))
    ).scalar_one() or 0
    donations_count = (
        await db.execute(select(func.count()).select_from(Donation))
    ).scalar_one() or 0
    return {
        "users_count": users_count,
        "tracks_count": tracks_count,
        "total_plays": int(total_plays),
        "blocked_users_count": int(blocked_users),
        "verified_users_count": int(verified_users),
        "admin_users_count": int(admin_users),
        "comments_count": int(comments_count),
        "playlists_count": int(playlists_count),
        "messages_count": int(messages_count),
        "public_tracks_count": int(public_tracks),
        "hidden_tracks_count": int(hidden_tracks),
        "reports_pending_count": int(reports_pending),
        "reports_resolved_count": int(reports_resolved),
        "reports_dismissed_count": int(reports_dismissed),
        "users_today_count": int(users_today),
        "donations_total_rub": round(float(donations_total), 2),
        "donations_total_count": int(donations_count),
    }


@router.get("/stats/detailed")
async def admin_stats_detailed(
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    top_tracks_raw = await db.execute(
        select(Track)
        .options(selectinload(Track.user))
        .where(Track.is_public.is_(True))
        .order_by(Track.plays_count.desc().nulls_last())
        .limit(5)
    )
    top_tracks = []
    for t in top_tracks_raw.scalars().all():
        owner = t.user
        top_tracks.append({
            "id": t.id,
            "title": t.title,
            "plays": t.plays_count or 0,
            "artist": owner.username if owner else None,
            "artist_display": owner.display_name if owner else None,
            "cover_url": t.cover_url,
        })

    recent_users_raw = await db.execute(
        select(User).where(User.is_admin.is_(False)).order_by(User.created_at.desc()).limit(5)
    )
    recent_users = []
    for u in recent_users_raw.scalars().all():
        track_count = (await db.execute(
            select(func.count()).select_from(Track).where(Track.user_id == u.id)
        )).scalar_one() or 0
        recent_users.append({
            "id": u.id,
            "username": u.username,
            "display_name": u.display_name,
            "avatar_url": u.avatar_url,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "tracks_count": int(track_count),
        })

    return {
        "top_tracks": top_tracks,
        "recent_users": recent_users,
    }


@router.get("/subscriptions/list")
async def admin_subscriptions_list(
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    r = await db.execute(
        select(Subscription, User)
        .join(User, User.id == Subscription.user_id)
        .where(Subscription.is_active.is_(True))
        .order_by(Subscription.started_at.desc())
        .limit(200)
    )
    out = []
    for sub, user in r.all():
        out.append({
            "id": sub.id,
            "user_id": sub.user_id,
            "username": user.username,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
            "plan_type": sub.plan_type,
            "price_paid": float(sub.price_paid or 0),
            "created_at": sub.started_at.isoformat() if sub.started_at else None,
            "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
        })
    return out


@router.get("/users", response_model=List[UserPublic])
async def admin_users(
    limit: int = 50,
    offset: int = 0,
    q: Optional[str] = None,
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> List[User]:
    stmt = select(User).order_by(User.created_at.desc()).offset(max(offset, 0)).limit(min(limit, 200))
    if q and q.strip():
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(User.username.ilike(term), User.display_name.ilike(term), User.email.ilike(term))
        )
    r = await db.execute(stmt)
    return list(r.scalars().all())


@router.patch("/users/{user_id}/verify")
async def toggle_verify_user(
    user_id: int,
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    r = await db.execute(select(User).where(User.id == user_id))
    u = r.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    u.is_verified = not u.is_verified
    await db.flush()
    return {"ok": True, "is_verified": u.is_verified}


@router.get("/student-verifications")
async def list_student_verifications(
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    r = await db.execute(
        select(User)
        .where(User.student_verification_status == "pending")
        .order_by(User.created_at.desc())
    )
    users = r.scalars().all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "display_name": u.display_name,
            "doc_url": u.student_verification_doc_url,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.patch("/users/{user_id}/student-verification")
async def set_student_verification(
    user_id: int,
    body: dict,
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    status = (body.get("status") or "").strip()
    if status not in ("approved", "rejected", "pending", "none"):
        raise HTTPException(status_code=400, detail="status: approved | rejected | pending | none")
    r = await db.execute(select(User).where(User.id == user_id))
    u = r.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    u.student_verification_status = status
    await db.flush()
    return {"ok": True, "student_verification_status": u.student_verification_status}


@router.patch("/users/{user_id}/block")
async def toggle_block_user(
    user_id: int,
    request: Request,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if user_id == admin_user.id:
        raise HTTPException(status_code=400, detail="Нельзя заблокировать самого себя")
    r = await db.execute(select(User).where(User.id == user_id))
    u = r.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    u.is_blocked = not u.is_blocked
    if u.is_blocked:
        u.is_admin = False
    await db.flush()
    action = "user_block" if u.is_blocked else "user_unblock"
    await log_audit(
        db,
        user_id=admin_user.id,
        username=admin_user.username,
        action_type=action,
        entity_type="user",
        entity_id=user_id,
        details={"target_username": u.username, "target_display_name": u.display_name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return {"ok": True, "is_blocked": u.is_blocked}


@router.patch("/users/{user_id}/admin", response_model=dict)
async def toggle_user_admin(
    user_id: int,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if user_id == admin_user.id:
        raise HTTPException(
            status_code=400, detail="Измените права другого пользователя; свой аккаунт не переключается здесь"
        )
    r = await db.execute(select(User).where(User.id == user_id))
    u = r.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if u.is_blocked:
        raise HTTPException(status_code=400, detail="Нельзя назначить администратором заблокированного пользователя")

    new_admin = not u.is_admin
    if u.is_admin and not new_admin:
        others = (
            await db.execute(
                select(func.count()).select_from(User).where(User.is_admin.is_(True), User.id != u.id)
            )
        ).scalar_one() or 0
        if others == 0:
            raise HTTPException(status_code=400, detail="Нельзя снять последнего администратора")

    u.is_admin = new_admin
    await db.flush()
    return {"ok": True, "is_admin": u.is_admin}


@router.get("/tracks", response_model=List[TrackPublic])
async def admin_tracks(
    limit: int = 40,
    offset: int = 0,
    q: Optional[str] = None,
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> List[Track]:
    stmt = (
        select(Track)
        .options(selectinload(Track.user))
        .order_by(Track.created_at.desc())
        .offset(max(offset, 0))
        .limit(min(limit, 100))
    )
    if q and q.strip():
        stmt = stmt.where(Track.title.ilike(f"%{q.strip()}%"))
    r = await db.execute(stmt)
    return list(r.scalars().all())


@router.patch("/tracks/{track_id}", response_model=TrackPublic)
async def admin_update_track(
    track_id: int,
    body: dict,
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> Track:
    r = await db.execute(select(Track).options(selectinload(Track.user)).where(Track.id == track_id))
    t = r.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")
    allowed = {"title", "description", "genre", "mood", "tags", "is_public", "is_downloadable", "allow_comments"}
    for k, v in body.items():
        if k in allowed:
            setattr(t, k, v)
    await db.flush()
    await db.refresh(t)
    return t


@router.patch("/tracks/{track_id}/visibility")
async def admin_toggle_track_visibility(
    track_id: int,
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    r = await db.execute(select(Track).where(Track.id == track_id))
    t = r.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")
    t.is_public = not t.is_public
    await db.flush()
    return {"ok": True, "is_public": t.is_public}


@router.delete("/tracks/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_track(
    track_id: int,
    request: Request,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    r = await db.execute(select(Track).options(selectinload(Track.user)).where(Track.id == track_id))
    t = r.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Трек не найден")
    file_path = resolve_media_path(t.file_url)
    cover_path = resolve_media_path(t.cover_url) if t.cover_url else None
    await db.execute(delete(Track).where(Track.id == track_id))
    for p in (file_path, cover_path):
        if p and p.exists():
            try:
                p.unlink()
            except OSError:
                pass
    await log_audit(
        db,
        user_id=admin_user.id,
        username=admin_user.username,
        action_type="track_delete",
        entity_type="track",
        entity_id=track_id,
        details={"title": t.title, "owner_id": t.user_id, "owner_username": t.user.username if t.user else None},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )


@router.get("/tracks/blocked", response_model=List[BlockedTrackOut])
async def admin_blocked_tracks(
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    stmt = (
        select(Track)
        .options(selectinload(Track.user))
        .where(Track.is_public.is_(False))
        .order_by(Track.created_at.desc())
        .limit(100)
    )
    r = await db.execute(stmt)
    tracks = r.scalars().all()

    out: List[dict] = []
    for t in tracks:
        owner = t.user
        report_r = await db.execute(
            select(Report)
            .where(
                Report.report_type == "track",
                Report.target_id == t.id,
                Report.status == ReportStatus.RESOLVED.value,
            )
            .order_by(Report.created_at.desc())
            .limit(1)
        )
        report = report_r.scalar_one_or_none()
        out.append(
            {
                "id": t.id,
                "title": t.title,
                "user_id": t.user_id,
                "username": owner.username if owner else "",
                "display_name": owner.display_name if owner else None,
                "avatar_url": owner.avatar_url if owner else None,
                "created_at": t.created_at,
                "plays_count": t.plays_count or 0,
                "genre": t.genre,
                "cover_url": t.cover_url,
                "report_reason": report.reason if report else None,
                "report_reason_label": _reason_labels.get(report.reason) if report else None,
                "report_created_at": report.created_at if report else None,
                "report_id": report.id if report else None,
            }
        )
    return out


@router.get("/users/blocked", response_model=List[BlockedUserOut])
async def admin_blocked_users(
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    r = await db.execute(
        select(User).where(User.is_blocked.is_(True)).order_by(User.created_at.desc()).limit(100)
    )
    users = r.scalars().all()

    out: List[dict] = []
    for u in users:
        report_r = await db.execute(
            select(Report)
            .where(
                Report.report_type == "user",
                Report.target_id == u.id,
                Report.status == ReportStatus.RESOLVED.value,
            )
            .order_by(Report.created_at.desc())
            .limit(1)
        )
        report = report_r.scalar_one_or_none()
        out.append(
            {
                "id": u.id,
                "username": u.username,
                "display_name": u.display_name,
                "avatar_url": u.avatar_url,
                "email": u.email,
                "is_admin": u.is_admin or False,
                "is_verified": u.is_verified or False,
                "created_at": u.created_at,
                "report_reason": report.reason if report else None,
                "report_reason_label": _reason_labels.get(report.reason) if report else None,
                "report_created_at": report.created_at if report else None,
                "report_id": report.id if report else None,
            }
        )
    return out


@router.get("/comments", response_model=List[AdminCommentRow])
async def admin_comments(
    limit: int = 50,
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> List[AdminCommentRow]:
    lim = min(max(limit, 1), 100)
    rows = (
        await db.execute(
            select(Comment, User.username, User.display_name, Track.title)
            .join(User, User.id == Comment.user_id)
            .join(Track, Track.id == Comment.track_id)
            .order_by(Comment.created_at.desc())
            .limit(lim)
        )
    ).all()
    out: List[AdminCommentRow] = []
    for c, username, display_name, track_title in rows:
        out.append(
            AdminCommentRow(
                id=c.id,
                text=c.text,
                created_at=c.created_at,
                user_id=c.user_id,
                username=username,
                display_name=display_name,
                track_id=c.track_id,
                track_title=track_title,
            )
        )
    return out


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_comment(
    comment_id: int,
    request: Request,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    c = (await db.execute(select(Comment).where(Comment.id == comment_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    track_id = c.track_id
    tr = (await db.execute(select(Track).where(Track.id == track_id))).scalar_one_or_none()
    if not tr:
        raise HTTPException(status_code=404, detail="Трек не найден")
    await db.delete(c)
    await db.flush()
    cnt = (
        await db.execute(select(func.count()).select_from(Comment).where(Comment.track_id == track_id))
    ).scalar_one() or 0
    tr.comments_count = int(cnt)
    await db.flush()
    await log_audit(
        db,
        user_id=admin_user.id,
        username=admin_user.username,
        action_type="comment_delete",
        entity_type="comment",
        entity_id=comment_id,
        details={"track_id": track_id, "comment_text": c.text[:200] if c.text else None},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )


@router.get("/ads", response_model=list[AdAdmin])
async def admin_list_ads(
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Ad).order_by(Ad.id.desc()))
    return result.scalars().all()


@router.post("/ads", response_model=AdAdmin, status_code=status.HTTP_201_CREATED)
async def admin_create_ad(
    title: str = Form(...),
    link: str = Form(...),
    active: bool = Form(True),
    cover: UploadFile = File(...),
    audio: UploadFile = File(...),
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    cover_raw = await cover.read()
    if not cover_raw:
        raise HTTPException(status_code=400, detail="Обложка обязательна")
    ext = ".jpg"
    if cover.filename and "." in cover.filename:
        ext = "." + cover.filename.rsplit(".", 1)[-1].lower()
    image_url = save_cover(cover_raw, ext)

    audio_raw = await audio.read()
    if not audio_raw:
        raise HTTPException(status_code=400, detail="Аудиофайл обязателен")
    audio_url, disk_path = save_ad_audio(audio_raw, audio.filename or "ad.mp3")
    duration = get_duration_seconds(disk_path)

    ad = Ad(
        title=title.strip(),
        image_url=image_url,
        audio_url=audio_url,
        link=link.strip(),
        active=active,
        duration_seconds=duration or None,
    )
    db.add(ad)
    await db.flush()
    await db.refresh(ad)
    return ad


@router.patch("/ads/{ad_id}", response_model=AdAdmin)
async def admin_update_ad(
    ad_id: int,
    title: str | None = Form(None),
    link: str | None = Form(None),
    active: bool | None = Form(None),
    cover: UploadFile | None = File(None),
    audio: UploadFile | None = File(None),
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    ad = await db.get(Ad, ad_id)
    if not ad:
        raise HTTPException(status_code=404, detail="Реклама не найдена")
    if title is not None:
        ad.title = title.strip()
    if link is not None:
        ad.link = link.strip()
    if active is not None:
        ad.active = active
    if cover and cover.filename:
        raw = await cover.read()
        if raw:
            ext = ".jpg"
            if "." in cover.filename:
                ext = "." + cover.filename.rsplit(".", 1)[-1].lower()
            ad.image_url = save_cover(raw, ext)
    if audio and audio.filename:
        raw = await audio.read()
        if raw:
            audio_url, disk_path = save_ad_audio(raw, audio.filename)
            ad.audio_url = audio_url
            ad.duration_seconds = get_duration_seconds(disk_path) or None
    await db.flush()
    await db.refresh(ad)
    return ad


@router.patch("/ads/{ad_id}/toggle", response_model=AdAdmin)
async def admin_toggle_ad(
    ad_id: int,
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    ad = await db.get(Ad, ad_id)
    if not ad:
        raise HTTPException(status_code=404, detail="Реклама не найдена")
    ad.active = not ad.active
    await db.flush()
    await db.refresh(ad)
    return ad


@router.delete("/ads/{ad_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_ad(
    ad_id: int,
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    ad = await db.get(Ad, ad_id)
    if not ad:
        raise HTTPException(status_code=404, detail="Реклама не найдена")
    for url in (ad.image_url, ad.audio_url):
        if url:
            path = resolve_media_path(url)
            if path and path.is_file():
                path.unlink(missing_ok=True)
    await db.delete(ad)
    await db.flush()


@router.get("/donations", response_model=List[AdminDonationOut])
async def admin_list_donations(
    limit: int = 50,
    offset: int = 0,
    artist_id: Optional[int] = None,
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    stmt = (
        select(Donation, User)
        .outerjoin(User, User.id == Donation.donor_id)
        .order_by(Donation.created_at.desc())
        .offset(max(offset, 0))
        .limit(min(limit, 200))
    )
    if artist_id:
        stmt = stmt.where(Donation.artist_id == artist_id)
    rows = await db.execute(stmt)
    out = []
    for d, donor in rows.all():
        artist = await db.get(User, d.artist_id)
        out.append(
            AdminDonationOut(
                id=d.id,
                amount_rub=d.amount_rub,
                message=d.message,
                is_anonymous=d.is_anonymous,
                created_at=d.created_at.isoformat(),
                donor_id=d.donor_id,
                donor_username=donor.username if donor else None,
                donor_display_name=donor.display_name if donor and not d.is_anonymous else ("Аноним" if d.is_anonymous else None),
                artist_id=d.artist_id,
                artist_username=artist.username if artist else None,
                artist_display_name=artist.display_name if artist else None,
            )
        )
    return out


@router.get("/donations/stats", response_model=AdminDonationStats)
async def admin_donation_stats(
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> AdminDonationStats:

    total_rub = await db.execute(
        select(func.coalesce(func.sum(Donation.amount_rub), 0))
    )
    total_count = await db.execute(
        select(func.count()).select_from(Donation)
    )

    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_rub = await db.execute(
        select(func.coalesce(func.sum(Donation.amount_rub), 0))
        .where(Donation.created_at >= month_start)
    )
    month_count = await db.execute(
        select(func.count()).select_from(Donation)
        .where(Donation.created_at >= month_start)
    )

    top = await db.execute(
        select(User.display_name, User.username, func.sum(Donation.amount_rub), func.count())
        .join(Donation, Donation.artist_id == User.id)
        .group_by(User.id, User.display_name, User.username)
        .order_by(func.sum(Donation.amount_rub).desc())
        .limit(5)
    )
    top_artists = [
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
        .where(Donation.created_at >= days_30)
        .group_by(text("day"))
        .order_by(text("day"))
    )
    daily_chart = [
        {"date": str(row[0].date()), "total_rub": round(float(row[1]), 2), "count": int(row[2])}
        for row in chart.all()
    ]

    return AdminDonationStats(
        total_rub=round(float(total_rub.scalar_one() or 0), 2),
        total_count=int(total_count.scalar_one() or 0),
        this_month_rub=round(float(month_rub.scalar_one() or 0), 2),
        this_month_count=int(month_count.scalar_one() or 0),
        top_artists=top_artists,
        daily_chart=daily_chart,
    )


@router.delete("/donations/{donation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_donation(
    donation_id: int,
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    d = await db.get(Donation, donation_id)
    if not d:
        raise HTTPException(status_code=404, detail="Донат не найден")
    await db.delete(d)


@router.delete("/subscriptions/{subscription_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_cancel_subscription(
    subscription_id: int,
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    from datetime import timezone
    from sqlalchemy import update as sa_update
    from app.models.user import ArtistSubscriptionType, UserSubscriptionType

    sub = await db.get(Subscription, subscription_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Подписка не найдена")

    sub.is_active = False
    sub.expires_at = datetime.now(timezone.utc)

    u = await db.get(User, sub.user_id)
    if u:
        u.subscription_type = UserSubscriptionType.FREE.value
        u.artist_subscription_type = ArtistSubscriptionType.BASIC.value
        u.subscription_expires_at = datetime.now(timezone.utc)

    await db.flush()
