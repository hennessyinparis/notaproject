from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.exc import ProgrammingError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from app.models.user import ArtistSubscriptionType, User, UserSubscriptionType
from app.schemas.user import TokenPair, UserCreate, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])

SCHEMA_HINT = (
    "База не совпадает с текущим кодом. В каталоге backend выполните: alembic upgrade head"
)


def _db_schema_http(exc: Exception) -> HTTPException | None:
    msg = (str(getattr(exc, "orig", exc)) or str(exc)).lower()
    if "undefinedcolumn" in msg or "does not exist" in msg or "no column" in msg:
        return HTTPException(status_code=503, detail=SCHEMA_HINT)
    return None


class LoginBody(BaseModel):
    username: str = Field(..., description="Имя пользователя или email")
    password: str


class RefreshBody(BaseModel):
    refresh_token: str


@router.post("/register", response_model=UserPublic)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)) -> User:
    try:
        existing = await db.execute(
            select(User).where(or_(User.username == data.username, User.email == str(data.email)))
        )
    except ProgrammingError as e:
        if (h := _db_schema_http(e)):
            raise h from e
        raise
    except OperationalError as e:
        raise HTTPException(
            status_code=503,
            detail="Не удаётся подключиться к PostgreSQL. Проверьте, что сервер БД запущен и DATABASE_URL в .env верный.",
        ) from e
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Пользователь с таким именем или email уже есть")

    user = User(
        username=data.username,
        email=str(data.email),
        password_hash=get_password_hash(data.password),
        display_name=data.username,
        is_artist=True,
        subscription_type=UserSubscriptionType.FREE.value,
        artist_subscription_type=ArtistSubscriptionType.BASIC.value,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenPair)
async def login(body: LoginBody, db: AsyncSession = Depends(get_db)) -> TokenPair:
    try:
        result = await db.execute(
            select(User).where(or_(User.username == body.username, User.email == body.username))
        )
    except ProgrammingError as e:
        if (h := _db_schema_http(e)):
            raise h from e
        raise
    except OperationalError as e:
        raise HTTPException(
            status_code=503,
            detail="Не удаётся подключиться к PostgreSQL. Проверьте, что сервер БД запущен и DATABASE_URL в .env верный.",
        ) from e
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверные учётные данные")
    if user.is_blocked:
        raise HTTPException(status_code=403, detail="Аккаунт заблокирован администратором")

    access = create_access_token({"sub": str(user.id)})
    refresh = create_refresh_token({"sub": str(user.id)})
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenPair)
async def refresh_tokens(body: RefreshBody, db: AsyncSession = Depends(get_db)) -> TokenPair:
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Недействительный refresh")
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Недействительный refresh")
    try:
        result = await db.execute(select(User).where(User.id == int(sub)))
    except ProgrammingError as e:
        if (h := _db_schema_http(e)):
            raise h from e
        raise
    except OperationalError as e:
        raise HTTPException(
            status_code=503,
            detail="Не удаётся подключиться к PostgreSQL. Проверьте DATABASE_URL и что сервер БД запущен.",
        ) from e
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    access = create_access_token({"sub": str(user.id)})
    refresh = create_refresh_token({"sub": str(user.id)})
    return TokenPair(access_token=access, refresh_token=refresh)
