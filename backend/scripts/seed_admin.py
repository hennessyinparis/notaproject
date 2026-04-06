"""
Создаёт или обновляет пользователя-администратора.
Запуск из каталога backend (с активированным venv):

    python scripts/seed_admin.py

Нужен рабочий DATABASE_URL в .env.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import ArtistSubscriptionType, User, UserSubscriptionType

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "12345678"
ADMIN_EMAIL = "admin@notaproject.local"
ADMIN_DISPLAY_NAME = "Admin"


async def main() -> None:
    async with AsyncSessionLocal() as session:
        r = await session.execute(select(User).where(User.username == ADMIN_USERNAME))
        u = r.scalar_one_or_none()
        pw = get_password_hash(ADMIN_PASSWORD)
        if u:
            u.password_hash = pw
            u.is_admin = True
            u.is_blocked = False
            if not u.email:
                u.email = ADMIN_EMAIL
        else:
            taken = await session.execute(select(User.id).where(User.email == ADMIN_EMAIL))
            if taken.scalar_one_or_none():
                raise SystemExit(
                    f"Email {ADMIN_EMAIL} уже занят другим пользователем. "
                    "Удали или смени email в скрипте."
                )
            session.add(
                User(
                    username=ADMIN_USERNAME,
                    email=ADMIN_EMAIL,
                    password_hash=pw,
                    display_name=ADMIN_DISPLAY_NAME,
                    is_artist=True,
                    is_admin=True,
                    subscription_type=UserSubscriptionType.FREE.value,
                    artist_subscription_type=ArtistSubscriptionType.BASIC.value,
                )
            )
        await session.commit()
    print(f"Готово. Логин: {ADMIN_USERNAME}, пароль: {ADMIN_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(main())
