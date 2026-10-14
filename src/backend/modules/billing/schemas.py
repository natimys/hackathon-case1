from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def money_to_minor(value: Decimal | str | int) -> int:
    amount = Decimal(str(value))
    if not amount.is_finite() or amount <= 0 or amount.as_tuple().exponent < -2:
        raise ValueError("Amount must be positive with at most two decimal places")
    minor = amount * 100
    if minor != minor.to_integral_value() or minor > 100000000000:
        raise ValueError("Amount is outside supported range")
    return int(minor)


def minor_to_money(value: int) -> str:
    return f"{Decimal(value) / 100:.2f}"


class AccountCreate(BaseModel):
    apartment_id: int = Field(gt=0)
    account_number: str = Field(min_length=1, max_length=80)
    source_system: str = Field(default="internal", min_length=1, max_length=50)
    external_id: str | None = Field(default=None, max_length=120)


class AccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    apartment_id: int
    account_number: str
    source_system: str
    external_id: str | None
    is_active: bool
    created_at: datetime


class AccrualGenerate(BaseModel):
    building_id: int = Field(gt=0)
    billing_period: date
    service_code: str = Field(min_length=1, max_length=60)
    description: str = Field(min_length=1, max_length=250)
    unit_price: Decimal
    due_at: datetime

    @field_validator("unit_price")
    @classmethod
    def validate_price(cls, value):
        money_to_minor(value)
        return value


class AccrualResult(BaseModel):
    created_count: int
    skipped_count: int
    total_amount: str


class InvoiceItemRead(BaseModel):
    id: int
    service_code: str
    description: str
    quantity: int
    unit_price: str
    amount: str


class InvoiceRead(BaseModel):
    id: int
    personal_account_id: int
    account_number: str
    billing_period: date
    issued_at: datetime
    due_at: datetime
    total_amount: str
    paid_amount: str
    balance: str
    currency: str
    status: Literal["unpaid", "partially_paid", "paid", "overdue"]
    items: list[InvoiceItemRead]


class PaymentCreate(BaseModel):
    amount: Decimal | None = None
    idempotency_key: str = Field(min_length=8, max_length=120)


class PaymentRead(BaseModel):
    id: int
    invoice_id: int
    provider: str
    provider_reference: str | None
    amount: str
    currency: str
    status: str
    created_at: datetime
    confirmed_at: datetime | None
    confirmation_url: str | None = None

    @field_validator("amount", mode="before")
    @classmethod
    def format_minor_units(cls, value):
        if isinstance(value, int):
            return minor_to_money(value)
        return value


class PaymentImportReport(BaseModel):
    imported_count: int
    duplicate_count: int
    rejected_count: int
    rejected_rows: list[dict]
