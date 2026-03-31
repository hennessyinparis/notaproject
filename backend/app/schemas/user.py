from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    city: Optional[str] = None
    website: Optional[str] = None
    avatar_url: Optional[str] = None


class UserPublic(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    display_name: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    city: Optional[str] = None
    website: Optional[str] = None
    is_verified: bool
    is_admin: bool = False
    is_blocked: bool = False
    subscription_type: str
    artist_subscription_type: str
    subscription_expires_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    type: str
