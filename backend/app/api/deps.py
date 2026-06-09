from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

security = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Optional[User]:
    if not credentials or not credentials.credentials:
        return None
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        return None
    sub = payload.get("sub")
    if not sub:
        return None
    result = await db.execute(select(User).where(User.id == int(sub)))
    u = result.scalar_one_or_none()
    if u and u.is_blocked:
        return None
    return u


async def get_current_user(
    user: Annotated[Optional[User], Depends(get_current_user_optional)],
) -> User:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется авторизация")
    return user


async def get_current_pro_user(user: Annotated[User, Depends(get_current_user)]) -> User:
    from app.services.subscription_access import is_artist_pro

    if not is_artist_pro(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется активная подписка «Артист Про»")
    return user


async def get_current_admin_user(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуются права администратора")
    return user


def ensure_not_admin(target: User, viewer: Optional[User]) -> None:
    """Если целевой пользователь — админ, а зритель — не админ, возвращаем 404."""
    if target.is_admin and (not viewer or not viewer.is_admin):
        raise HTTPException(status_code=404, detail="Пользователь не найден")
