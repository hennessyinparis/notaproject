from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class TrackBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    genre: Optional[str] = None
    tags: Optional[List[str]] = None
    mood: Optional[str] = None
    is_public: bool = True
    is_downloadable: bool = False
    allow_comments: bool = True
    bpm: Optional[float] = None
    key_signature: Optional[str] = None


class TrackCreate(TrackBase):
    pass


class TrackUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    genre: Optional[str] = None
    tags: Optional[List[str]] = None
    mood: Optional[str] = None
    is_public: Optional[bool] = None
    is_downloadable: Optional[bool] = None
    allow_comments: Optional[bool] = None
    bpm: Optional[float] = None
    key_signature: Optional[str] = None


class TrackArtistBrief(BaseModel):
    id: int
    username: str
    display_name: str
    avatar_url: Optional[str] = None
    is_verified: bool

    model_config = {"from_attributes": True}


class TrackPublic(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str] = None
    genre: Optional[str] = None
    tags: Optional[List[str]] = None
    mood: Optional[str] = None
    file_url: str
    file_size: int
    duration_seconds: float
    waveform_data: Optional[Any] = None
    cover_url: Optional[str] = None
    plays_count: int
    likes_count: int
    reposts_count: int
    comments_count: int
    is_public: bool
    is_downloadable: bool
    allow_comments: bool
    bpm: Optional[float] = None
    key_signature: Optional[str] = None
    created_at: datetime
    published_at: Optional[datetime] = None
    user: Optional[TrackArtistBrief] = None

    model_config = {"from_attributes": True}


class TrackPlayReport(BaseModel):
    listened_seconds: float
    is_complete: bool = False
    source: str = "feed"
