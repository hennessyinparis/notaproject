"""privacy settings, donations, is_deleted

Revision ID: 20260604_0010
"""

from alembic import op
import sqlalchemy as sa

revision = "20260604_0010"
down_revision = "20260604_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False))
    op.add_column(
        "users",
        sa.Column("messages_privacy", sa.String(32), server_default="everyone", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("profile_visibility", sa.String(32), server_default="public", nullable=False),
    )
    op.create_table(
        "donations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("donor_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("artist_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount_rub", sa.Float(), nullable=False),
        sa.Column("message", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_donations_artist_id", "donations", ["artist_id"])


def downgrade() -> None:
    op.drop_index("ix_donations_artist_id", table_name="donations")
    op.drop_table("donations")
    op.drop_column("users", "profile_visibility")
    op.drop_column("users", "messages_privacy")
    op.drop_column("users", "is_deleted")
