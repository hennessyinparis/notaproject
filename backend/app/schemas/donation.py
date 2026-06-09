from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DonateBody(BaseModel):
    amount_rub: float = Field(..., gt=0, le=100_000)
    message: Optional[str] = Field(None, max_length=500)
    is_anonymous: bool = False


class DonationOut(BaseModel):
    id: int
    amount_rub: float
    message: Optional[str]
    donor_display_name: Optional[str]
    donor_username: Optional[str] = None
    is_anonymous: bool = False
    created_at: str

    model_config = {"from_attributes": True}


class DonationStats(BaseModel):
    total_rub: float
    total_count: int
    this_month_rub: float
    this_month_count: int
    top_donors: list[dict]
    daily_chart: list[dict]


class AdminDonationOut(BaseModel):
    id: int
    amount_rub: float
    message: Optional[str]
    is_anonymous: bool = False
    created_at: str
    donor_id: Optional[int] = None
    donor_username: Optional[str] = None
    donor_display_name: Optional[str] = None
    artist_id: int
    artist_username: Optional[str] = None
    artist_display_name: Optional[str] = None


class AdminDonationStats(BaseModel):
    total_rub: float
    total_count: int
    this_month_rub: float
    this_month_count: int
    top_artists: list[dict]
    daily_chart: list[dict]
