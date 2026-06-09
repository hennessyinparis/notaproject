"""add paid_plays_count, artist_balances, withdrawal_requests, platform_earnings

Revision ID: 20260609_0014
Revises: 20260609_0013
Create Date: 2026-06-09 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20260609_0014'
down_revision: Union[str, None] = '20260609_0013'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Добавляем paid_plays_count в tracks
    op.add_column('tracks', sa.Column('paid_plays_count', sa.Integer(), nullable=False, server_default='0'))
    op.create_index('ix_tracks_paid_plays_count', 'tracks', ['paid_plays_count'], unique=False)

    # 2. Таблица artist_balances
    op.create_table(
        'artist_balances',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('artist_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('available_balance', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0'),
        sa.Column('total_earned', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0'),
        sa.Column('total_withdrawn', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0'),
        sa.Column('total_donations_earned', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0'),
        sa.Column('total_royalties_earned', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_artist_balances_artist_id', 'artist_balances', ['artist_id'], unique=True)

    # 3. Таблица withdrawal_requests
    op.create_table(
        'withdrawal_requests',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('artist_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='pending'),
        sa.Column('bank_card_mask', sa.String(length=20), nullable=False),
        sa.Column('recipient_name', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=32), nullable=True),
        sa.Column('admin_note', sa.Text(), nullable=True),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('processed_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_withdrawal_requests_artist_id', 'withdrawal_requests', ['artist_id'], unique=False)
    op.create_index('ix_withdrawal_requests_status', 'withdrawal_requests', ['status'], unique=False)
    op.create_index('ix_withdrawal_requests_created_at', 'withdrawal_requests', ['created_at'], unique=False)

    # 4. Таблица platform_earnings (для аналитики дохода платформы)
    op.create_table(
        'platform_earnings',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('period_month', sa.String(length=7), nullable=False, unique=True),
        sa.Column('subscriptions_revenue', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0'),
        sa.Column('donations_commission', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0'),
        sa.Column('royalties_commission', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0'),
        sa.Column('ad_revenue', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0'),
        sa.Column('total_payouts', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0'),
        sa.Column('net_profit', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('platform_earnings')
    op.drop_index('ix_withdrawal_requests_created_at', table_name='withdrawal_requests')
    op.drop_index('ix_withdrawal_requests_status', table_name='withdrawal_requests')
    op.drop_index('ix_withdrawal_requests_artist_id', table_name='withdrawal_requests')
    op.drop_table('withdrawal_requests')
    op.drop_index('ix_artist_balances_artist_id', table_name='artist_balances')
    op.drop_table('artist_balances')
    op.drop_index('ix_tracks_paid_plays_count', table_name='tracks')
    op.drop_column('tracks', 'paid_plays_count')
