"""Add internal billing tables."""

from alembic import op
import sqlalchemy as sa

revision = "20261013_billing"
down_revision = "20261013_tickets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "personal_accounts",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "apartment_id",
            sa.BigInteger(),
            sa.ForeignKey("apartments.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("account_number", sa.String(80), nullable=False, unique=True),
        sa.Column(
            "source_system", sa.String(50), server_default="internal", nullable=False
        ),
        sa.Column("external_id", sa.String(120)),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "source_system", "external_id", name="uq_account_source_external"
        ),
    )
    op.create_index(
        "ix_personal_accounts_apartment_id", "personal_accounts", ["apartment_id"]
    )
    op.create_index(
        "ix_personal_accounts_apartment_active",
        "personal_accounts",
        ["apartment_id", "is_active"],
    )
    op.create_table(
        "billing_invoices",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "personal_account_id",
            sa.BigInteger(),
            sa.ForeignKey("personal_accounts.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("billing_period", sa.Date(), nullable=False),
        sa.Column("service_code", sa.String(60), nullable=False),
        sa.Column(
            "issued_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("total_amount", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(3), server_default="RUB", nullable=False),
        sa.Column(
            "source_system", sa.String(50), server_default="internal", nullable=False
        ),
        sa.Column("external_id", sa.String(120)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "total_amount > 0 AND total_amount <= 100000000000",
            name="ck_invoice_amount_range",
        ),
        sa.CheckConstraint("currency = 'RUB'", name="ck_invoice_currency_rub"),
        sa.UniqueConstraint(
            "personal_account_id",
            "billing_period",
            "service_code",
            name="uq_invoice_account_period_service",
        ),
        sa.UniqueConstraint(
            "source_system", "external_id", name="uq_invoice_source_external"
        ),
    )
    op.create_index(
        "ix_billing_invoices_personal_account_id",
        "billing_invoices",
        ["personal_account_id"],
    )
    op.create_index(
        "ix_billing_invoices_period", "billing_invoices", ["billing_period"]
    )
    op.create_table(
        "billing_invoice_items",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "invoice_id",
            sa.BigInteger(),
            sa.ForeignKey("billing_invoices.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("service_code", sa.String(60), nullable=False),
        sa.Column("description", sa.String(250), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.BigInteger(), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.CheckConstraint(
            "quantity > 0 AND unit_price > 0 AND amount > 0 AND amount <= 100000000000",
            name="ck_invoice_item_amounts",
        ),
    )
    op.create_index(
        "ix_billing_invoice_items_invoice_id", "billing_invoice_items", ["invoice_id"]
    )
    op.create_table(
        "billing_payment_operations",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "invoice_id",
            sa.BigInteger(),
            sa.ForeignKey("billing_invoices.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(40), nullable=False),
        sa.Column("provider_reference", sa.String(120)),
        sa.Column("idempotency_key", sa.String(120), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(3), server_default="RUB", nullable=False),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("confirmed_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "amount > 0 AND amount <= 100000000000", name="ck_payment_amount_range"
        ),
        sa.CheckConstraint("currency = 'RUB'", name="ck_payment_currency_rub"),
        sa.CheckConstraint(
            "status IN ('pending', 'succeeded', 'failed', 'cancelled')",
            name="ck_payment_status",
        ),
        sa.UniqueConstraint("idempotency_key", name="uq_payment_idempotency_key"),
    )
    op.create_index(
        "ix_billing_payment_operations_invoice_id",
        "billing_payment_operations",
        ["invoice_id"],
    )
    op.create_index(
        "ix_payment_invoice_status",
        "billing_payment_operations",
        ["invoice_id", "status"],
    )
    op.create_table(
        "billing_payment_events",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "operation_id",
            sa.BigInteger(),
            sa.ForeignKey("billing_payment_operations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("external_event_id", sa.String(120), nullable=False),
        sa.Column("payload_hash", sa.String(64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "source", "external_event_id", name="uq_payment_event_source_external"
        ),
    )
    op.create_index(
        "ix_billing_payment_events_operation_id",
        "billing_payment_events",
        ["operation_id"],
    )


def downgrade() -> None:
    op.drop_table("billing_payment_events")
    op.drop_table("billing_payment_operations")
    op.drop_table("billing_invoice_items")
    op.drop_table("billing_invoices")
    op.drop_table("personal_accounts")
