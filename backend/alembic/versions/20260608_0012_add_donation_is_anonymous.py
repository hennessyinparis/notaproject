"""add donation is_anonymous

Revision ID: 20260608_0012
Revises: 20260605_0011
Create Date: 2026-06-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260608_0012"
down_revision: Union[str, None] = "20260605_0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("donations", sa.Column("is_anonymous", sa.Boolean(), server_default="false", nullable=False))


def downgrade() -> None:
    op.drop_column("donations", "is_anonymous")
