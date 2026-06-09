from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin_user
from app.core.database import get_db
from app.models.comment import Comment
from app.models.notification import Notification, NotificationType
from app.models.playlist import Playlist
from app.models.report import Report, ReportStatus
from app.models.track import Track
from app.models.user import User
from app.services.realtime import push_notification

router = APIRouter(prefix="/admin/reports", tags=["admin-reports"])

_reason_labels = {
    "copyright": "Нарушение авторских прав",
    "spam": "Спам",
    "abuse": "Оскорбления",
    "inappropriate": "Неприемлемый контент",
    "other": "Другое",
}

_type_labels = {
    "track": "Трек",
    "comment": "Комментарий",
    "user": "Пользователь",
    "playlist": "Плейлист",
}


class AdminReportOut(BaseModel):
    id: int
    report_type: str
    target_id: int
    reason: str
    description: Optional[str]
    status: str
    admin_notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    reporter_id: int
    reporter_username: str
    reporter_display: Optional[str]
    reporter_avatar: Optional[str]
    target_details: Optional[Dict[str, Any]] = None
    target_user_report_count: int = 0
    reporter_report_count: int = 0

    model_config = {"from_attributes": True}


class AdminReportUpdate(BaseModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None


async def _fetch_target_details(report: Report, db: AsyncSession) -> Optional[Dict[str, Any]]:
    if report.report_type == "track":
        r = await db.execute(select(Track).where(Track.id == report.target_id))
        t = r.scalar_one_or_none()
        if t:
            owner = await db.get(User, t.user_id)
            return {
                "title": t.title,
                "artist": owner.username if owner else None,
                "artist_display": owner.display_name if owner else None,
                "artist_avatar": owner.avatar_url if owner else None,
                "artist_url": f"/artist/{owner.username}" if owner else None,
                "url": f"/track/{t.id}",
            }
    elif report.report_type == "comment":
        r = await db.execute(select(Comment).where(Comment.id == report.target_id))
        c = r.scalar_one_or_none()
        if c:
            author = await db.get(User, c.user_id)
            tr = await db.execute(select(Track).where(Track.id == c.track_id))
            t = tr.scalar_one_or_none()
            return {
                "text": c.text[:200] + ("…" if len(c.text) > 200 else ""),
                "author": author.username if author else None,
                "author_display": author.display_name if author else None,
                "author_avatar": author.avatar_url if author else None,
                "author_url": f"/artist/{author.username}" if author else None,
                "track_title": t.title if t else None,
                "track_url": f"/track/{c.track_id}" if t else None,
            }
    elif report.report_type == "user":
        r = await db.execute(select(User).where(User.id == report.target_id))
        u = r.scalar_one_or_none()
        if u:
            return {
                "username": u.username,
                "display_name": u.display_name,
                "avatar": u.avatar_url,
                "url": f"/artist/{u.username}",
            }
    elif report.report_type == "playlist":
        r = await db.execute(select(Playlist).where(Playlist.id == report.target_id))
        p = r.scalar_one_or_none()
        if p:
            owner = await db.get(User, p.user_id)
            return {
                "title": p.title,
                "owner": owner.username if owner else None,
                "owner_display": owner.display_name if owner else None,
                "owner_avatar": owner.avatar_url if owner else None,
                "owner_url": f"/artist/{owner.username}" if owner else None,
                "url": f"/playlist/{p.id}",
            }
    return None


async def _get_target_owner_id(report: Report, db: AsyncSession) -> Optional[int]:
    if report.report_type == "track":
        r = await db.execute(select(Track).where(Track.id == report.target_id))
        t = r.scalar_one_or_none()
        return t.user_id if t else None
    elif report.report_type == "comment":
        r = await db.execute(select(Comment).where(Comment.id == report.target_id))
        c = r.scalar_one_or_none()
        return c.user_id if c else None
    elif report.report_type == "user":
        return report.target_id
    elif report.report_type == "playlist":
        r = await db.execute(select(Playlist).where(Playlist.id == report.target_id))
        p = r.scalar_one_or_none()
        return p.user_id if p else None
    return None


async def _count_reports_against_user(user_id: int, db: AsyncSession) -> int:
    """Count reports against this user (direct user reports + reports on their content)."""
    track_ids_r = await db.execute(select(Track.id).where(Track.user_id == user_id))
    track_ids = [row[0] for row in track_ids_r.all()]
    playlist_ids_r = await db.execute(select(Playlist.id).where(Playlist.user_id == user_id))
    playlist_ids = [row[0] for row in playlist_ids_r.all()]
    comment_ids_r = await db.execute(select(Comment.id).where(Comment.user_id == user_id))
    comment_ids = [row[0] for row in comment_ids_r.all()]

    conditions = [Report.report_type == "user", Report.target_id == user_id]
    if track_ids:
        conditions.append((Report.report_type == "track") & Report.target_id.in_(track_ids))
    if comment_ids:
        conditions.append((Report.report_type == "comment") & Report.target_id.in_(comment_ids))
    if playlist_ids:
        conditions.append((Report.report_type == "playlist") & Report.target_id.in_(playlist_ids))

    r = await db.execute(select(func.count()).select_from(Report).where(or_(*conditions)))
    return r.scalar_one() or 0


async def _apply_resolution(report: Report, db: AsyncSession) -> None:
    if report.report_type == "track":
        r = await db.execute(select(Track).where(Track.id == report.target_id))
        t = r.scalar_one_or_none()
        if t:
            t.is_public = False
    elif report.report_type == "comment":
        r = await db.execute(select(Comment).where(Comment.id == report.target_id))
        c = r.scalar_one_or_none()
        if c:
            tr = await db.execute(select(Track).where(Track.id == c.track_id))
            t = tr.scalar_one_or_none()
            await db.delete(c)
            if t:
                cnt_r = await db.execute(
                    select(func.count()).select_from(Comment).where(Comment.track_id == t.id)
                )
                t.comments_count = int(cnt_r.scalar_one() or 0)
    elif report.report_type == "user":
        r = await db.execute(select(User).where(User.id == report.target_id))
        u = r.scalar_one_or_none()
        if u:
            u.is_blocked = True
            u.is_admin = False
    elif report.report_type == "playlist":
        r = await db.execute(select(Playlist).where(Playlist.id == report.target_id))
        p = r.scalar_one_or_none()
        if p:
            p.is_public = False


def _build_out(report: Report, reporter: User, target_details: Optional[Dict[str, Any]],
               target_user_report_count: int = 0, reporter_report_count: int = 0) -> AdminReportOut:
    return AdminReportOut(
        id=report.id,
        report_type=report.report_type,
        target_id=report.target_id,
        reason=report.reason,
        description=report.description,
        status=report.status,
        admin_notes=report.admin_notes,
        created_at=report.created_at,
        updated_at=report.updated_at,
        reporter_id=report.reporter_id,
        reporter_username=reporter.username if reporter else "deleted",
        reporter_display=reporter.display_name if reporter else None,
        reporter_avatar=reporter.avatar_url if reporter else None,
        target_details=target_details,
        target_user_report_count=target_user_report_count,
        reporter_report_count=reporter_report_count,
    )


@router.get("", response_model=List[AdminReportOut])
async def admin_list_reports(
    status: Optional[str] = Query(None, pattern=r"^(pending|reviewed|dismissed|resolved)$"),
    report_type: Optional[str] = Query(None, pattern=r"^(track|comment|user|playlist)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> List[AdminReportOut]:
    stmt = select(Report)
    if status:
        stmt = stmt.where(Report.status == status)
    if report_type:
        stmt = stmt.where(Report.report_type == report_type)
    stmt = stmt.order_by(Report.created_at.desc()).offset(offset).limit(limit)
    r = await db.execute(stmt)
    reports = list(r.scalars().all())
    out: List[AdminReportOut] = []
    for report in reports:
        reporter = await db.get(User, report.reporter_id)
        details = await _fetch_target_details(report, db)
        target_owner_id = await _get_target_owner_id(report, db)
        target_count = await _count_reports_against_user(target_owner_id, db) if target_owner_id else 0
        reporter_count = (await db.execute(
            select(func.count()).select_from(Report).where(Report.reporter_id == report.reporter_id)
        )).scalar_one() or 0
        out.append(_build_out(report, reporter, details, target_count, reporter_count))
    return out


@router.get("/{report_id}", response_model=AdminReportOut)
async def admin_get_report(
    report_id: int,
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> AdminReportOut:
    r = await db.execute(select(Report).where(Report.id == report_id))
    report = r.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Жалоба не найдена")
    reporter = await db.get(User, report.reporter_id)
    details = await _fetch_target_details(report, db)
    target_owner_id = await _get_target_owner_id(report, db)
    target_count = await _count_reports_against_user(target_owner_id, db) if target_owner_id else 0
    reporter_count = (await db.execute(
        select(func.count()).select_from(Report).where(Report.reporter_id == report.reporter_id)
    )).scalar_one() or 0
    return _build_out(report, reporter, details, target_count, reporter_count)


@router.patch("/{report_id}", response_model=AdminReportOut)
async def admin_update_report(
    report_id: int,
    body: AdminReportUpdate,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> AdminReportOut:
    r = await db.execute(select(Report).where(Report.id == report_id))
    report = r.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Жалоба не найдена")

    old_status = report.status
    if body.status is not None:
        if body.status not in [s.value for s in ReportStatus]:
            raise HTTPException(status_code=400, detail="Некорректный статус")
        report.status = body.status

    if body.admin_notes is not None:
        report.admin_notes = body.admin_notes

    await db.flush()
    await db.refresh(report)

    if body.status == "resolved" and old_status != "resolved":
        await _apply_resolution(report, db)
        await db.flush()

        target_owner_id = await _get_target_owner_id(report, db)
        if target_owner_id and target_owner_id != report.reporter_id:
            existing = await db.execute(
                select(Notification.id).where(
                    Notification.user_id == target_owner_id,
                    Notification.entity_id == report.id,
                    Notification.type == NotificationType.REPORT_RESOLVED.value,
                )
            )
            if existing.scalar_one_or_none() is None:
                notif = Notification(
                    user_id=target_owner_id,
                    type=NotificationType.REPORT_RESOLVED.value,
                    actor_id=admin_user.id,
                    entity_id=report.id,
                    entity_type="report_resolved",
                    is_read=False,
                )
                db.add(notif)
                await db.flush()
                await push_notification(db, target_owner_id, notif)

    reporter = await db.get(User, report.reporter_id)
    details = await _fetch_target_details(report, db)
    target_owner_id = await _get_target_owner_id(report, db)
    target_count = await _count_reports_against_user(target_owner_id, db) if target_owner_id else 0
    reporter_count = (await db.execute(
        select(func.count()).select_from(Report).where(Report.reporter_id == report.reporter_id)
    )).scalar_one() or 0
    return _build_out(report, reporter, details, target_count, reporter_count)
