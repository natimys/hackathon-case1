"""Subscriptions and provider-backed payment operations."""
from alembic import op
import sqlalchemy as sa

revision = "20261014_subscriptions"
down_revision = "20261013_cameras"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "subscription_plans",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("code", sa.String(60), nullable=False, unique=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.String(500), nullable=False, server_default=""),
        sa.Column("price", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="RUB"),
        sa.Column("duration_days", sa.Integer(), nullable=False),
        sa.Column("features", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("price > 0", name="ck_subscription_plan_price"),
        sa.CheckConstraint("duration_days > 0", name="ck_subscription_plan_duration"),
    )
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("owner_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("plan_id", sa.BigInteger(), sa.ForeignKey("subscription_plans.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("price", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="RUB"),
        sa.Column("starts_at", sa.DateTime(timezone=True)),
        sa.Column("ends_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("features", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("event_preferences", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("notifications_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('pending','active','expired','cancelled')", name="ck_subscription_status"),
        sa.CheckConstraint("price > 0", name="ck_subscription_price"),
    )
    op.create_index("ix_subscriptions_owner_id", "subscriptions", ["owner_id"])
    op.add_column("billing_payment_operations", sa.Column("subscription_id", sa.BigInteger(), nullable=True))
    op.add_column("billing_payment_operations", sa.Column("confirmation_url", sa.String(1000), nullable=True))
    op.alter_column("billing_payment_operations", "invoice_id", existing_type=sa.BigInteger(), nullable=True)
    op.create_foreign_key("fk_payment_subscription", "billing_payment_operations", "subscriptions", ["subscription_id"], ["id"], ondelete="RESTRICT")
    op.create_index("ix_billing_payment_operations_subscription_id", "billing_payment_operations", ["subscription_id"])
    op.create_unique_constraint("uq_payment_provider_reference", "billing_payment_operations", ["provider", "provider_reference"])
    op.create_check_constraint("ck_payment_single_target", "billing_payment_operations", "(invoice_id IS NOT NULL) <> (subscription_id IS NOT NULL)")
    op.create_table(
        "billing_payment_reconciliations",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("invoice_id", sa.BigInteger(), sa.ForeignKey("billing_invoices.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("external_payment_id", sa.String(120), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="RUB"),
        sa.Column("reported_status", sa.String(20), nullable=False),
        sa.Column("reported_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("source", "external_payment_id", name="uq_reconciliation_source_external"),
        sa.CheckConstraint("amount > 0 AND amount <= 100000000000", name="ck_reconciliation_amount"),
    )
    op.create_index("ix_billing_payment_reconciliations_invoice_id", "billing_payment_reconciliations", ["invoice_id"])


def downgrade() -> None:
    op.drop_index("ix_billing_payment_reconciliations_invoice_id", table_name="billing_payment_reconciliations")
    op.drop_table("billing_payment_reconciliations")
    op.drop_constraint("ck_payment_single_target", "billing_payment_operations", type_="check")
    op.drop_constraint("uq_payment_provider_reference", "billing_payment_operations", type_="unique")
    op.drop_index("ix_billing_payment_operations_subscription_id", table_name="billing_payment_operations")
    op.drop_constraint("fk_payment_subscription", "billing_payment_operations", type_="foreignkey")
    op.alter_column("billing_payment_operations", "invoice_id", existing_type=sa.BigInteger(), nullable=False)
    op.drop_column("billing_payment_operations", "confirmation_url")
    op.drop_column("billing_payment_operations", "subscription_id")
    op.drop_index("ix_subscriptions_owner_id", table_name="subscriptions")
    op.drop_table("subscriptions")
    op.drop_table("subscription_plans")
