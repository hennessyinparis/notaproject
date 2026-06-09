from typing import List, Optional

from pydantic import BaseModel

from app.schemas.track import TrackPublic


class SuggestedArtist(BaseModel):
    id: int
    username: str
    display_name: str
    avatar_url: Optional[str] = None
    is_verified: bool = False
    public_tracks_count: int = 0


class FeedResponse(BaseModel):
    following_count: int
    tracks: List[TrackPublic]
