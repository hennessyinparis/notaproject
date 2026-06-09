"""Обогащение уведомлений данными об актёре и сущности."""

from __future__ import annotations

from typing import List, Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message
from app.models.notification import Notification
from app.models.playlist import Playlist
from app.models.donation import Donation
from app.models.report import Report
from app.models.track import Track
from app.models.user import User


class ActorBrief:
    __slots__ = ("id", "username", "display_name", "avatar_url")

    def __init__(self, user: User) -> None:
        self.id = user.id
        self.username = user.username
        self.display_name = user.display_name
        self.avatar_url = user.avatar_url


async def enrich_notifications(
    db: AsyncSession,
    notifications: Sequence[Notification],
) -> list[dict]:
    if not notifications:
        return []

    actor_ids = {n.actor_id for n in notifications if n.actor_id}
    actors: dict[int, User] = {}
    if actor_ids:
        r = await db.execute(select(User).where(User.id.in_(actor_ids)))
        actors = {u.id: u for u in r.scalars().all()}

    message_ids = [n.entity_id for n in notifications if n.entity_type == "message" and n.entity_id]
    playlist_ids = [
        n.entity_id
        for n in notifications
        if n.entity_type in ("playlist_invite", "playlist") and n.entity_id
    ]
    track_ids = [n.entity_id for n in notifications if n.entity_type == "track" and n.entity_id]
    report_ids = [
        n.entity_id
        for n in notifications
        if n.entity_type in ("report_resolved", "report_dismissed") and n.entity_id
    ]
    donation_ids = [n.entity_id for n in notifications if n.entity_type == "donation" and n.entity_id]

    messages: dict[int, Message] = {}
    if message_ids:
        r = await db.execute(select(Message).where(Message.id.in_(message_ids)))
        messages = {m.id: m for m in r.scalars().all()}

    playlists: dict[int, Playlist] = {}
    if playlist_ids:
        r = await db.execute(select(Playlist).where(Playlist.id.in_(playlist_ids)))
        playlists = {p.id: p for p in r.scalars().all()}

    tracks: dict[int, Track] = {}
    if track_ids:
        r = await db.execute(select(Track).where(Track.id.in_(track_ids)))
        tracks = {t.id: t for t in r.scalars().all()}

    reports: dict[int, Report] = {}
    if report_ids:
        r = await db.execute(select(Report).where(Report.id.in_(report_ids)))
        reports = {rp.id: rp for rp in r.scalars().all()}

    donations: dict[int, Donation] = {}
    if donation_ids:
        r = await db.execute(select(Donation).where(Donation.id.in_(donation_ids)))
        donations = {d.id: d for d in r.scalars().all()}

    out: list[dict] = []
    for n in notifications:
        actor = actors.get(n.actor_id) if n.actor_id else None
        entity_title: Optional[str] = None
        preview: Optional[str] = None

        if n.entity_type == "message" and n.entity_id:
            msg = messages.get(n.entity_id)
            if msg:
                preview = _preview(msg.text)
        elif n.entity_type in ("playlist_invite", "playlist") and n.entity_id:
            pl = playlists.get(n.entity_id)
            if pl:
                entity_title = pl.title
        elif n.entity_type == "track" and n.entity_id:
            tr = tracks.get(n.entity_id)
            if tr:
                entity_title = tr.title
        elif n.entity_type in ("report_resolved", "report_dismissed") and n.entity_id:
            rp = reports.get(n.entity_id)
            if rp:
                reason_labels = {
                    "copyright": "нарушение авторских прав",
                    "spam": "спам",
                    "abuse": "оскорбления",
                    "inappropriate": "неприемлемый контент",
                    "other": "другое",
                }
                type_labels = {
                    "track": "Трек",
                    "comment": "Комментарий",
                    "user": "Пользователь",
                    "playlist": "Плейлист",
                }
                reason = reason_labels.get(rp.reason, rp.reason)
                target_type = type_labels.get(rp.report_type, rp.report_type)
                if n.type == "report_resolved":
                    entity_title = f"{target_type} заблокирован"
                    preview = f"Причина: {reason}"
                else:
                    entity_title = "Жалоба отклонена"
                    preview = f"Жалоба на {target_type.lower()} отклонена. Причина: {reason}"
        elif n.entity_type == "donation" and n.entity_id:
            d = donations.get(n.entity_id)
            if d:
                entity_title = f"Донат {d.amount_rub:.0f} ₽"
                preview = (d.message or "Без сообщения")[:120]

        out.append(
            {
                "id": n.id,
                "type": n.type,
                "actor_id": n.actor_id,
                "actor": (
                    {
                        "id": actor.id,
                        "username": actor.username,
                        "display_name": actor.display_name,
                        "avatar_url": actor.avatar_url,
                    }
                    if actor
                    else None
                ),
                "entity_id": n.entity_id,
                "entity_type": n.entity_type,
                "entity_title": entity_title,
                "preview": preview,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
        )
    return out


def _preview(text: str, limit: int = 120) -> str:
    s = (text or "").strip()
    if len(s) <= limit:
        return s
    return s[: limit - 1].rstrip() + "…"
