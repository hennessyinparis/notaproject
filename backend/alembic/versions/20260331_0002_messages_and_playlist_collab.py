"""add message track and playlist collaborators

Revision ID: 20260331_0002
Revises: 20260331_0001
Create Date: 2026-03-31 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260331_0002'
down_revision: Union[str, None] = '20260331_0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('messages', sa.Column('track_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_messages_track_id'), 'messages', ['track_id'], unique=False)
    op.create_foreign_key(None, 'messages', 'tracks', ['track_id'], ['id'], ondelete='SET NULL')

    op.create_table(
        'playlist_collaborators',
        sa.Column('playlist_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['playlist_id'], ['playlists.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('playlist_id', 'user_id'),
    )


def downgrade() -> None:
    op.drop_table('playlist_collaborators')
    op.drop_index(op.f('ix_messages_track_id'), table_name='messages')
    op.drop_column('messages', 'track_id')
