"""Одноразовый скрипт: удаляет все данные, созданные админами (треки, лайки,
репосты, подписки, комментарии, плейлисты, сообщения и т.д.).

Запуск:
  cd backend
  venv/Scripts/python -m app.scripts.cleanup_admin_data
"""

import asyncio

from sqlalchemy import delete, select, text

from app.core.database import AsyncSessionLocal
from app.models.comment import Comment
from app.models.comment_like import CommentLike
from app.models.follow import Follow
from app.models.like import Like
from app.models.message import Message
from app.models.notification import Notification
from app.models.playlist import Playlist, PlaylistCollaborator, PlaylistLike
from app.models.report import Report
from app.models.repost import Repost
from app.models.royalty import Royalty
from app.models.subscription import Subscription
from app.models.track import Track
from app.models.track_play import TrackPlay
from app.models.user import User


async def cleanup():
    async with AsyncSessionLocal() as db:
        r = await db.execute(select(User).where(User.is_admin.is_(True)))
        admins = r.scalars().all()

        if not admins:
            print("Нет администраторов в базе.")
            return

        admin_ids = [u.id for u in admins]
        print(f"Найдено {len(admins)} администраторов: {[u.username for u in admins]}")

        deletions = [
            ("треков", Track, Track.user_id),
            ("лайков треков", Like, Like.user_id),
            ("репостов", Repost, Repost.user_id),
            ("комментариев", Comment, Comment.user_id),
            ("лайков комментариев", CommentLike, CommentLike.user_id),
            ("плейлистов", Playlist, Playlist.user_id),
            ("лайков плейлистов", PlaylistLike, PlaylistLike.user_id),
            ("коллабораций", PlaylistCollaborator, PlaylistCollaborator.user_id),
            ("подписок", Subscription, Subscription.user_id),
            ("сообщений (отправитель)", Message, Message.sender_id),
            ("сообщений (получатель)", Message, Message.receiver_id),
            ("уведомлений (получатель)", Notification, Notification.user_id),
            ("уведомлений (источник)", Notification, Notification.actor_id),
            ("жалоб", Report, Report.reporter_id),
            ("прослушиваний", TrackPlay, TrackPlay.listener_id),
            ("роялти", Royalty, Royalty.artist_id),
            ("подписок (подписчик)", Follow, Follow.follower_id),
            ("подписок (цель)", Follow, Follow.following_id),
        ]

        total = 0
        for label, model, column in deletions:
            stmt = delete(model).where(column.in_(admin_ids))
            r = await db.execute(stmt)
            count = r.rowcount
            if count:
                print(f"  Удалено {count} {label}")
                total += count

        await db.commit()
        print(f"\nИтого удалено записей: {total}")
        print("Готово.")


if __name__ == "__main__":
    asyncio.run(cleanup())
