from pydantic import BaseModel


class AdPublic(BaseModel):
    id: int
    title: str
    image_url: str
    audio_url: str
    link: str
    duration_seconds: float | None = None

    class Config:
        from_attributes = True


class AdAdmin(BaseModel):
    id: int
    title: str
    image_url: str
    audio_url: str | None
    link: str
    active: bool
    duration_seconds: float | None = None

    class Config:
        from_attributes = True
