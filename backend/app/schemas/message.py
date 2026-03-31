from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

class UserShort(BaseModel):
    id: int
    username: str
    display_name: str
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class TrackShort(BaseModel):
    id: int
    title: str
    cover_url: Optional[str] = None
    duration_seconds: float

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    text: str = Field(default="", max_length=3000)
    track_id: Optional[int] = None


class MessageOut(BaseModel):
    id: int
    sender_id: int
    text: str
    track_id: Optional[int] = None
    track: Optional[TrackShort] = None
    is_read: bool
    created_at: datetime
    is_mine: bool


class ConversationOut(BaseModel):
    user: UserShort
    last_message: str
    last_time: datetime
    unread_count: int
