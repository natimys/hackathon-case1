from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class PaymentRequest:
    operation_id: int
    amount_minor: int
    currency: str
    idempotency_key: str
    description: str
    return_url: str
    receipt_email: str | None = None


@dataclass(frozen=True, slots=True)
class ProviderPayment:
    payment_id: str
    status: str
    amount_minor: int
    currency: str
    confirmation_url: str | None = None
    metadata_operation_id: str | None = None


@dataclass(frozen=True, slots=True)
class ProviderEvent:
    event: str
    payment_id: str


class PaymentProvider(Protocol):
    async def create_payment(self, request: PaymentRequest) -> ProviderPayment: ...

    async def get_payment(self, payment_id: str) -> ProviderPayment: ...

    async def process_webhook(self, payload: dict) -> ProviderEvent: ...
