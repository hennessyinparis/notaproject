"""add playlist_likes table

Revision ID: 20260604_0007
Revises: 20260331_0006
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260604_0007"
down_revision: Union[str, None] = "20260331_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "playlist_likes",
        sa.Column("playlist_id", sa.Integer(), sa.ForeignKey("playlists.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("playlist_likes")
