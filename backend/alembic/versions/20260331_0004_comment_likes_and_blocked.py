"""comment likes and user blocked flag

Revision ID: 20260331_0004
Revises: 20260331_0003
Create Date: 2026-03-31 23:45:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260331_0004"
down_revision: Union[str, None] = "20260331_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_blocked", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.alter_column("users", "is_blocked", server_default=None)

    op.create_table(
        "comment_likes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("comment_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["comment_id"], ["comments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "comment_id", name="uq_comment_like"),
    )
    op.create_index(op.f("ix_comment_likes_user_id"), "comment_likes", ["user_id"], unique=False)
    op.create_index(op.f("ix_comment_likes_comment_id"), "comment_likes", ["comment_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_comment_likes_comment_id"), table_name="comment_likes")
    op.drop_index(op.f("ix_comment_likes_user_id"), table_name="comment_likes")
    op.drop_table("comment_likes")
    op.drop_column("users", "is_blocked")
