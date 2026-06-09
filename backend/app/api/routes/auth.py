import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr, Field
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
from app.core.config import get_settings
from app.core.rate_limit import limiter, RateLimits
from app.models.password_reset import PasswordResetToken
from app.models.user import ArtistSubscriptionType, User, UserSubscriptionType
from app.schemas.user import TokenPair, UserCreate, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/username-available")
async def username_available(
    username: str = Query(..., min_length=3, max_length=50), db: AsyncSession = Depends(get_db)
) -> dict:
    """Проверка свободности логина до отправки формы (как на SoundCloud)."""
    u = username.strip()
    if len(u) < 3:
        return {"available": False}
    try:
        r = await db.execute(select(User.id).where(User.username == u))
    except ProgrammingError as e:
        if (h := _db_schema_http(e)):
            raise h from e
        raise
    except OperationalError as e:
        raise HTTPException(
            status_code=503,
            detail="Не удаётся подключиться к PostgreSQL. Проверьте DATABASE_URL в .env.",
        ) from e
    taken = r.scalar_one_or_none() is not None
    return {"available": not taken}


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


class ForgotPasswordBody(BaseModel):
    email: EmailStr


class ResetPasswordBody(BaseModel):
    token: str = Field(min_length=16)
    new_password: str = Field(min_length=8, max_length=128)


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@router.post("/register", response_model=UserPublic)
@limiter.limit(RateLimits.AUTH_REGISTER)
async def register(request: Request, data: UserCreate, db: AsyncSession = Depends(get_db)) -> User:
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
@limiter.limit(RateLimits.AUTH_LOGIN)
async def login(request: Request, body: LoginBody, db: AsyncSession = Depends(get_db)) -> TokenPair:
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
    
    # Защита от Timing Attack: используем dummy hash чтобы время проверки было одинаковым
    import hashlib
    dummy_hash = get_password_hash("dummy_timing_attack_protection")
    stored_hash = user.password_hash if user else dummy_hash
    password_valid = verify_password(body.password, stored_hash)
    
    # Уменьшаем точность timing: если пароль неверный, все равно выполняем лишнюю операцию
    import secrets
    _timing_protection = secrets.compare_digest(str(user.id if user else 0), str(user.id if user else 0))
    
    if not user or not password_valid:
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
    if user.is_blocked:
        raise HTTPException(status_code=403, detail="Аккаунт заблокирован администратором")
    access = create_access_token({"sub": str(user.id)})
    refresh = create_refresh_token({"sub": str(user.id)})
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/forgot-password")
@limiter.limit(RateLimits.AUTH_FORGOT_PASSWORD)
async def forgot_password(request: Request, body: ForgotPasswordBody, db: AsyncSession = Depends(get_db)) -> dict:
    """Создаёт токен сброса. В dev возвращает токен; в prod нужна отправка email."""
    result = await db.execute(select(User).where(User.email == str(body.email)))
    user = result.scalar_one_or_none()
    if not user:
        return {"ok": True, "message": "Если email зарегистрирован, инструкция отправлена"}
    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_reset_token(raw_token)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    db.add(PasswordResetToken(user_id=user.id, token_hash=token_hash, expires_at=expires))
    await db.flush()
    settings = get_settings()
    reset_path = f"/reset-password?token={raw_token}"
    payload: dict = {"ok": True, "message": "Если email зарегистрирован, инструкция отправлена"}
    if "localhost" in settings.BASE_URL or "127.0.0.1" in settings.BASE_URL:
        payload["dev_reset_url"] = reset_path
        payload["dev_token"] = raw_token
    return payload


@router.post("/reset-password")
@limiter.limit(RateLimits.AUTH_RESET_PASSWORD)
async def reset_password(request: Request, body: ResetPasswordBody, db: AsyncSession = Depends(get_db)) -> dict:
    token_hash = _hash_reset_token(body.token)
    row = (
        await db.execute(
            select(PasswordResetToken).where(
                PasswordResetToken.token_hash == token_hash,
                PasswordResetToken.used_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=400, detail="Недействительный или просроченный токен")
    exp = row.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Токен истёк")
    user = await db.get(User, row.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="Пользователь не найден")
    user.password_hash = get_password_hash(body.new_password)
    row.used_at = datetime.now(timezone.utc)
    await db.flush()
    return {"ok": True}
