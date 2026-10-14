from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    JSON,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base


class PersonalAccount(Base):
    __tablename__ = "personal_accounts"
    __table_args__ = (
        UniqueConstraint(
            "source_system", "external_id", name="uq_account_source_external"
        ),
        Index("ix_personal_accounts_apartment_active", "apartment_id", "is_active"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    apartment_id: Mapped[int] = mapped_column(
        ForeignKey("apartments.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    account_number: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    source_system: Mapped[str] = mapped_column(
        String(50), nullable=False, default="internal", server_default="internal"
    )
    external_id: Mapped[str | None] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Invoice(Base):
    __tablename__ = "billing_invoices"
    __table_args__ = (
        UniqueConstraint(
            "personal_account_id",
            "billing_period",
            "service_code",
            name="uq_invoice_account_period_service",
        ),
        UniqueConstraint(
            "source_system", "external_id", name="uq_invoice_source_external"
        ),
        CheckConstraint(
            "total_amount > 0 AND total_amount <= 100000000000",
            name="ck_invoice_amount_range",
        ),
        CheckConstraint("currency = 'RUB'", name="ck_invoice_currency_rub"),
        Index("ix_billing_invoices_period", "billing_period"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    personal_account_id: Mapped[int] = mapped_column(
        ForeignKey("personal_accounts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    billing_period: Mapped[date] = mapped_column(Date, nullable=False)
    service_code: Mapped[str] = mapped_column(String(60), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    total_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="RUB", server_default="RUB"
    )
    source_system: Mapped[str] = mapped_column(
        String(50), nullable=False, default="internal", server_default="internal"
    )
    external_id: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    items: Mapped[list["InvoiceItem"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan"
    )


class InvoiceItem(Base):
    __tablename__ = "billing_invoice_items"
    __table_args__ = (
        CheckConstraint(
            "quantity > 0 AND unit_price > 0 AND amount > 0 AND amount <= 100000000000",
            name="ck_invoice_item_amounts",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    invoice_id: Mapped[int] = mapped_column(
        ForeignKey("billing_invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    service_code: Mapped[str] = mapped_column(String(60), nullable=False)
    description: Mapped[str] = mapped_column(String(250), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    invoice: Mapped[Invoice] = relationship(back_populates="items")


class PaymentOperation(Base):
    __tablename__ = "billing_payment_operations"
    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_payment_idempotency_key"),
        UniqueConstraint("provider", "provider_reference", name="uq_payment_provider_reference"),
        CheckConstraint(
            "amount > 0 AND amount <= 100000000000", name="ck_payment_amount_range"
        ),
        CheckConstraint("(invoice_id IS NOT NULL) <> (subscription_id IS NOT NULL)", name="ck_payment_single_target"),
        CheckConstraint("currency = 'RUB'", name="ck_payment_currency_rub"),
        CheckConstraint(
            "status IN ('pending', 'succeeded', 'failed', 'cancelled')",
            name="ck_payment_status",
        ),
        Index("ix_payment_invoice_status", "invoice_id", "status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    invoice_id: Mapped[int | None] = mapped_column(
        ForeignKey("billing_invoices.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    subscription_id: Mapped[int | None] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    provider: Mapped[str] = mapped_column(String(40), nullable=False)
    provider_reference: Mapped[str | None] = mapped_column(String(120))
    idempotency_key: Mapped[str] = mapped_column(String(120), nullable=False)
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="RUB", server_default="RUB"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending", server_default="pending"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    confirmation_url: Mapped[str | None] = mapped_column(String(1000))


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    __table_args__ = (
        CheckConstraint("price > 0", name="ck_subscription_plan_price"),
        CheckConstraint("duration_days > 0", name="ck_subscription_plan_duration"),
    )
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    code: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False, server_default="")
    price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default="RUB")
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)
    features: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class Subscription(Base):
    __tablename__ = "subscriptions"
    __table_args__ = (CheckConstraint("status IN ('pending','active','expired','cancelled')", name="ck_subscription_status"),)
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("subscription_plans.id", ondelete="RESTRICT"), nullable=False)
    price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default="RUB")
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="pending")
    features: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    event_preferences: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class PaymentReconciliation(Base):
    __tablename__ = "billing_payment_reconciliations"
    __table_args__ = (
        UniqueConstraint("source", "external_payment_id", name="uq_reconciliation_source_external"),
        CheckConstraint("amount > 0 AND amount <= 100000000000", name="ck_reconciliation_amount"),
    )
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("billing_invoices.id", ondelete="RESTRICT"), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    external_payment_id: Mapped[str] = mapped_column(String(120), nullable=False)
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default="RUB")
    reported_status: Mapped[str] = mapped_column(String(20), nullable=False)
    reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class PaymentEvent(Base):
    __tablename__ = "billing_payment_events"
    __table_args__ = (
        UniqueConstraint(
            "source", "external_event_id", name="uq_payment_event_source_external"
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    operation_id: Mapped[int] = mapped_column(
        ForeignKey("billing_payment_operations.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    external_event_id: Mapped[str] = mapped_column(String(120), nullable=False)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
