from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserBase(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)
    accept_terms: bool = Field(description="Принято пользовательское соглашение")
    accept_content_responsibility: bool = Field(
        description="Принята ответственность за пользовательский контент"
    )

    @field_validator("accept_terms", "accept_content_responsibility")
    @classmethod
    def must_accept(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Необходимо принять условия")
        return v


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    city: Optional[str] = None
    website: Optional[str] = None
    avatar_url: Optional[str] = None
    messages_privacy: Optional[str] = Field(None, pattern=r"^(everyone|followers|nobody)$")
    profile_visibility: Optional[str] = Field(None, pattern=r"^(public|followers|private)$")


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
    student_verification_status: str = "none"
    messages_privacy: str = "everyone"
    profile_visibility: str = "public"
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    type: str
