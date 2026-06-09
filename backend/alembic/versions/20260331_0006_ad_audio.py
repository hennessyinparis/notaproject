"""add ad audio fields

Revision ID: 20260331_0006
Revises: 20260331_0005
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260331_0006"
down_revision: Union[str, None] = "20260331_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("ads", sa.Column("audio_url", sa.String(), nullable=True))
    op.add_column("ads", sa.Column("duration_seconds", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("ads", "duration_seconds")
    op.drop_column("ads", "audio_url")
