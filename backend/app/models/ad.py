from sqlalchemy import Boolean, Column, Float, Integer, String

from app.models.base import Base


class Ad(Base):
    __tablename__ = "ads"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    image_url = Column(String, nullable=False)
    audio_url = Column(String, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    link = Column(String, nullable=False)
    active = Column(Boolean, default=True)