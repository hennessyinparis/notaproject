"""audit features: student verification, password reset, payment ref

Revision ID: 20260604_0009
"""

from alembic import op
import sqlalchemy as sa

revision = "20260604_0009"
down_revision = "20260604_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("student_verification_status", sa.String(32), server_default="none", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("student_verification_doc_url", sa.String(512), nullable=True),
    )
    op.add_column(
        "subscriptions",
        sa.Column("payment_transaction_id", sa.String(128), nullable=True),
    )
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_password_reset_tokens_token_hash", "password_reset_tokens", ["token_hash"], unique=True)
    op.create_index("ix_password_reset_tokens_user_id", "password_reset_tokens", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_password_reset_tokens_user_id", table_name="password_reset_tokens")
    op.drop_index("ix_password_reset_tokens_token_hash", table_name="password_reset_tokens")
    op.drop_table("password_reset_tokens")
    op.drop_column("subscriptions", "payment_transaction_id")
    op.drop_column("users", "student_verification_doc_url")
    op.drop_column("users", "student_verification_status")
