from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, case, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.message import Message
from app.models.notification import Notification, NotificationType
from app.models.track import Track
from app.models.user import User
from app.schemas.message import ConversationOut, MessageCreate, MessageOut, TrackShort, UserShort

router = APIRouter(prefix="/messages", tags=["messages"])


@router.get("/conversations", response_model=list[ConversationOut])
async def get_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ConversationOut]:
    other_user = case(
        (Message.sender_id == current_user.id, Message.receiver_id),
        else_=Message.sender_id,
    ).label("other_user_id")
    subq = (
        select(
            other_user,
            func.max(Message.created_at).label("last_time"),
            func.sum(
                case(
                    (
                        and_(Message.receiver_id == current_user.id, Message.is_read.is_(False)),
                        1,
                    ),
                    else_=0,
                )
            ).label("unread_count"),
        )
        .where(or_(Message.sender_id == current_user.id, Message.receiver_id == current_user.id))
        .group_by(other_user)
        .subquery()
    )
    rows = await db.execute(
        select(User, subq.c.last_time, subq.c.unread_count)
        .join(subq, User.id == subq.c.other_user_id)
        .order_by(subq.c.last_time.desc())
    )
    result: list[ConversationOut] = []
    for user, last_time, unread_count in rows.all():
        last_msg_q = await db.execute(
            select(Message.text, Message.track_id, Track.title)
            .outerjoin(Track, Track.id == Message.track_id)
            .where(
                or_(
                    and_(Message.sender_id == current_user.id, Message.receiver_id == user.id),
                    and_(Message.sender_id == user.id, Message.receiver_id == current_user.id),
                )
            )
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        row = last_msg_q.one_or_none()
        if row:
            text, tid, ttitle = row
            if text and text.strip():
                last_message = text
            elif tid and ttitle:
                last_message = f"Трек · {ttitle}"
            else:
                last_message = text or ""
        else:
            last_message = ""
        result.append(
            ConversationOut(
                user=UserShort.model_validate(user),
                last_message=last_message,
                last_time=last_time,
                unread_count=int(unread_count or 0),
            )
        )
    return result


@router.get("/{username}", response_model=list[MessageOut])
async def get_messages(
    username: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MessageOut]:
    other = (
        await db.execute(select(User).where(User.username == username))
    ).scalar_one_or_none()
    if not other:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    rows = await db.execute(
        select(Message, Track)
        .outerjoin(Track, Track.id == Message.track_id)
        .where(
            or_(
                and_(Message.sender_id == current_user.id, Message.receiver_id == other.id),
                and_(Message.sender_id == other.id, Message.receiver_id == current_user.id),
            )
        )
        .order_by(Message.created_at.asc())
    )
    out: list[MessageOut] = []
    for msg, track in rows.all():
        out.append(
            MessageOut(
                id=msg.id,
                sender_id=msg.sender_id,
                text=msg.text,
                track_id=msg.track_id,
                track=TrackShort.model_validate(track) if track else None,
                is_read=msg.is_read,
                created_at=msg.created_at,
                is_mine=msg.sender_id == current_user.id,
            )
        )
    return out


@router.post("/{username}", response_model=MessageOut)
async def send_message(
    username: str,
    body: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageOut:
    if not body.text.strip() and not body.track_id:
        raise HTTPException(status_code=400, detail="Пустое сообщение")
    other = (
        await db.execute(select(User).where(User.username == username))
    ).scalar_one_or_none()
    if not other:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    msg = Message(
        sender_id=current_user.id,
        receiver_id=other.id,
        text=body.text.strip(),
        track_id=body.track_id,
        is_read=False,
    )
    db.add(msg)
    db.add(
        Notification(
            user_id=other.id,
            type=NotificationType.MENTION.value,
            actor_id=current_user.id,
            entity_id=msg.id,
            entity_type="message",
        )
    )
    await db.flush()
    track = None
    if msg.track_id:
        track = (
            await db.execute(select(Track).where(Track.id == msg.track_id))
        ).scalar_one_or_none()
    return MessageOut(
        id=msg.id,
        sender_id=msg.sender_id,
        text=msg.text,
        track_id=msg.track_id,
        track=TrackShort.model_validate(track) if track else None,
        is_read=msg.is_read,
        created_at=msg.created_at,
        is_mine=True,
    )


@router.put("/{username}/read")
async def mark_read(
    username: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    other = (
        await db.execute(select(User).where(User.username == username))
    ).scalar_one_or_none()
    if not other:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    await db.execute(
        update(Message)
        .where(Message.sender_id == other.id, Message.receiver_id == current_user.id, Message.is_read.is_(False))
        .values(is_read=True)
    )
    return {"ok": True}


@router.delete("/{message_id}")
async def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    msg = (await db.execute(select(Message).where(Message.id == message_id))).scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Сообщение не найдено")
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Нельзя удалить чужое сообщение")
    await db.delete(msg)
    return {"ok": True}
