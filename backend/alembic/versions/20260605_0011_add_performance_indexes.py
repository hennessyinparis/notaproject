"""add performance indexes for tracks, messages, notifications, track_plays

Revision ID: 20260605_0011
"""

from alembic import op
import sqlalchemy as sa

revision = "20260605_0011"
down_revision = "20260604_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Track indexes
    op.create_index("ix_tracks_created_at", "tracks", ["created_at"])
    op.create_index("ix_tracks_plays_count", "tracks", ["plays_count"])
    op.create_index("ix_tracks_genre", "tracks", ["genre"])
    op.create_index("ix_tracks_user_id_created_at", "tracks", ["user_id", "created_at"])
    op.create_index("ix_tracks_is_public_created_at", "tracks", ["is_public", "created_at"])
    op.create_index("ix_tracks_is_public_plays_count", "tracks", ["is_public", "plays_count"])

    # TrackPlay indexes
    op.create_index("ix_track_plays_created_at", "track_plays", ["created_at"])
    op.create_index("ix_track_plays_track_id_created_at", "track_plays", ["track_id", "created_at"])
    op.create_index("ix_track_plays_listener_id_track_id", "track_plays", ["listener_id", "track_id"])

    # Message indexes
    op.create_index("ix_messages_created_at", "messages", ["created_at"])
    op.create_index("ix_messages_sender_receiver", "messages", ["sender_id", "receiver_id"])

    # Notification indexes
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])
    op.create_index("ix_notifications_user_id_created_at", "notifications", ["user_id", "created_at"])
    op.create_index("ix_notifications_user_id_is_read", "notifications", ["user_id", "is_read"])

    # Comment user relationship for eager loading
    op.create_index("ix_comments_user_id_track_id", "comments", ["user_id", "track_id"])


def downgrade() -> None:
    # Track indexes
    op.drop_index("ix_tracks_created_at", table_name="tracks")
    op.drop_index("ix_tracks_plays_count", table_name="tracks")
    op.drop_index("ix_tracks_genre", table_name="tracks")
    op.drop_index("ix_tracks_user_id_created_at", table_name="tracks")
    op.drop_index("ix_tracks_is_public_created_at", table_name="tracks")
    op.drop_index("ix_tracks_is_public_plays_count", table_name="tracks")

    # TrackPlay indexes
    op.drop_index("ix_track_plays_created_at", table_name="track_plays")
    op.drop_index("ix_track_plays_track_id_created_at", table_name="track_plays")
    op.drop_index("ix_track_plays_listener_id_track_id", table_name="track_plays")

    # Message indexes
    op.drop_index("ix_messages_created_at", table_name="messages")
    op.drop_index("ix_messages_sender_receiver", table_name="messages")

    # Notification indexes
    op.drop_index("ix_notifications_created_at", table_name="notifications")
    op.drop_index("ix_notifications_user_id_created_at", table_name="notifications")
    op.drop_index("ix_notifications_user_id_is_read", table_name="notifications")

    # Comment index
    op.drop_index("ix_comments_user_id_track_id", table_name="comments")
