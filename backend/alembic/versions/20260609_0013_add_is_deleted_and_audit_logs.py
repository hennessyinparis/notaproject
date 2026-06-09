"""add is_deleted to tracks and audit_logs table

Revision ID: 20260609_0013
Revises: 20260608_0012
Create Date: 2026-06-09 20:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20260609_0013'
down_revision: Union[str, None] = '20260608_0012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Добавляем колонки soft-delete в tracks
    op.add_column('tracks', sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('tracks', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('tracks', sa.Column('deleted_by', sa.Integer(), nullable=True))
    op.create_index('ix_tracks_is_deleted', 'tracks', ['is_deleted'], unique=False)

    # Создаем таблицу audit_logs
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('username', sa.String(length=120), nullable=True),
        sa.Column('action_type', sa.String(length=64), nullable=False),
        sa.Column('entity_type', sa.String(length=64), nullable=True),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('ip_address', sa.String(length=64), nullable=True),
        sa.Column('user_agent', sa.String(length=512), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'], unique=False)
    op.create_index('ix_audit_logs_action_type', 'audit_logs', ['action_type'], unique=False)
    op.create_index('ix_audit_logs_entity_type', 'audit_logs', ['entity_type'], unique=False)
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_audit_logs_created_at', table_name='audit_logs')
    op.drop_index('ix_audit_logs_entity_type', table_name='audit_logs')
    op.drop_index('ix_audit_logs_action_type', table_name='audit_logs')
    op.drop_index('ix_audit_logs_user_id', table_name='audit_logs')
    op.drop_table('audit_logs')

    op.drop_index('ix_tracks_is_deleted', table_name='tracks')
    op.drop_column('tracks', 'deleted_by')
    op.drop_column('tracks', 'deleted_at')
    op.drop_column('tracks', 'is_deleted')
