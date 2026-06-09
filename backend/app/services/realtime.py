"""Push real-time events to connected clients."""

from __future__ import annotations

from typing import Any

from app.models.notification import Notification
from app.schemas.message import MessageOut
from app.services.notification_enrich import enrich_notifications
from app.services.ws_manager import ws_manager


async def _notification_payload(db, notification: Notification) -> dict[str, Any]:
    enriched = await enrich_notifications(db, [notification])
    if enriched:
        return enriched[0]
    return {
        "id": notification.id,
        "type": notification.type,
        "actor_id": notification.actor_id,
        "entity_id": notification.entity_id,
        "entity_type": notification.entity_type,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat() if notification.created_at else None,
    }


async def push_notification(db, user_id: int, notification: Notification) -> None:
    payload = await _notification_payload(db, notification)
    await ws_manager.send_json(user_id, {"type": "notification", "payload": payload})


async def push_message(
    user_id: int,
    *,
    peer_username: str,
    message: MessageOut,
) -> None:
    await ws_manager.send_json(
        user_id,
        {
            "type": "message",
            "payload": {
                "peer_username": peer_username,
                "message": message.model_dump(mode="json"),
            },
        },
    )


async def push_conversations_updated(user_id: int) -> None:
    await ws_manager.send_json(user_id, {"type": "conversations_updated", "payload": {}})
