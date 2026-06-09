"""add ads table

Revision ID: 20260331_0005
Revises: 20260331_0004
Create Date: 2026-03-31 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260331_0005'
down_revision: Union[str, None] = '20260331_0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ads',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('image_url', sa.String(), nullable=False),
        sa.Column('link', sa.String(), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_ads_id'), 'ads', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_ads_id'), table_name='ads')
    op.drop_table('ads')
