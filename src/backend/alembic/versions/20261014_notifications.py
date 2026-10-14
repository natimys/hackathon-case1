"""Push devices, user preferences and camera observed states."""
from alembic import op
import sqlalchemy as sa

revision = "20261014_notifications"
down_revision = "20261014_subscriptions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notification_push_devices",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(255), nullable=False, unique=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_notification_push_devices_user_id", "notification_push_devices", ["user_id"])
    op.create_table(
        "notification_preferences",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("timezone", sa.String(80), nullable=False, server_default="Asia/Yakutsk"),
        sa.Column("quiet_start", sa.Time()), sa.Column("quiet_end", sa.Time()),
        sa.Column("camera_offline_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("ticket_status_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "camera_observed_states",
        sa.Column("camera_id", sa.Uuid(), sa.ForeignKey("cameras.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="unknown"),
        sa.Column("offline_since", sa.DateTime(timezone=True)),
        sa.Column("notified_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("camera_observed_states")
    op.drop_table("notification_preferences")
    op.drop_index("ix_notification_push_devices_user_id", table_name="notification_push_devices")
    op.drop_table("notification_push_devices")
