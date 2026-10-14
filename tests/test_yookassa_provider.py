import asyncio
import base64
import json

import httpx
import pytest
from fastapi import HTTPException
from pydantic import SecretStr

from core.settings import Settings
from integrations.payment_provider import PaymentRequest
from integrations.payment_provider import ProviderEvent, ProviderPayment
from integrations.yookassa import YooKassaPaymentProvider
from modules.billing.service import BillingService
from types import SimpleNamespace


def _settings(**kwargs):
    return Settings.model_construct(
        YOOKASSA_SHOP_ID="shop-123",
        YOOKASSA_SECRET_KEY=SecretStr("test-secret"),
        YOOKASSA_API_BASE_URL="https://api.yookassa.ru/v3",
        YOOKASSA_RECEIPT_VAT_CODE=None,
        **kwargs,
    )


def test_create_payment_uses_basic_auth_idempotence_capture_and_internal_metadata():
    seen = {}

    def handler(request):
        seen["request"] = request
        return httpx.Response(200, json={
            "id": "provider-id", "status": "pending", "amount": {"value": "25.00", "currency": "RUB"},
            "confirmation": {"confirmation_url": "https://pay.example/redirect"},
            "metadata": {"operation_id": "42"},
        })

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            provider = YooKassaPaymentProvider(_settings(), client=client)
            return await provider.create_payment(PaymentRequest(
                operation_id=42, amount_minor=2500, currency="RUB", idempotency_key="key-12345678",
                description="Account", return_url="https://app.example/return",
            ))

    result = asyncio.run(run())
    request = seen["request"]
    assert request.method == "POST"
    assert request.headers["Idempotence-Key"] == "key-12345678"
    assert request.headers["Authorization"] == "Basic " + base64.b64encode(b"shop-123:test-secret").decode()
    body = json.loads(request.content)
    assert body["capture"] is True
    assert body["confirmation"] == {"type": "redirect", "return_url": "https://app.example/return"}
    assert body["metadata"]["operation_id"] == "42"
    assert result.confirmation_url == "https://pay.example/redirect"
    assert result.amount_minor == 2500
    assert result.metadata_operation_id == "42"


def test_webhook_normalizes_only_supported_events():
    async def run():
        provider = YooKassaPaymentProvider(_settings())
        return await provider.process_webhook({"event": "payment.succeeded", "object": {"id": "provider-id"}})

    event = asyncio.run(run())
    assert (event.event, event.payment_id) == ("payment.succeeded", "provider-id")


class MockProvider:
    def __init__(self, payment):
        self.payment = payment

    async def process_webhook(self, _payload):
        return ProviderEvent("payment.succeeded", "provider-id")

    async def get_payment(self, _payment_id):
        return self.payment


class MockDB:
    def __init__(self):
        self.operation = SimpleNamespace(id=42, invoice_id=7, subscription_id=None, provider="yookassa", provider_reference="provider-id", status="pending", amount=2500, currency="RUB", confirmed_at=None)
        self.invoice = SimpleNamespace(id=7, total_amount=5000)
        self.added = []
        self.commits = 0
        self.event_seen = False

    async def scalar(self, statement):
        query = str(statement)
        if "billing_payment_events" in query:
            return 1 if self.event_seen else None
        if "sum(billing_payment_operations.amount)" in query:
            return 0
        if "billing_payment_operations" in query:
            return self.operation
        if "billing_invoices" in query:
            return self.invoice
        return None

    def add(self, item):
        self.added.append(item)

    async def commit(self):
        self.commits += 1
        if self.added:
            self.event_seen = True

    async def rollback(self):
        pass

    async def refresh(self, _item):
        pass

    async def get(self, _model, _id):
        return None


def test_webhook_fetches_provider_state_and_applies_payment_once():
    db = MockDB()
    provider = MockProvider(ProviderPayment("provider-id", "succeeded", 2500, "RUB", metadata_operation_id="42"))
    service = BillingService(db, payment_provider=provider)
    payload = {"event": "payment.succeeded", "object": {"id": "provider-id"}}

    async def run():
        await service.process_yookassa_webhook(payload, provider)
        await service.process_yookassa_webhook(payload, provider)

    asyncio.run(run())
    assert db.operation.status == "succeeded"
    assert db.commits == 1
    assert len(db.added) == 1


def test_webhook_amount_mismatch_does_not_confirm_or_commit():
    db = MockDB()
    provider = MockProvider(ProviderPayment("provider-id", "succeeded", 2501, "RUB", metadata_operation_id="42"))
    service = BillingService(db, payment_provider=provider)

    with pytest.raises(HTTPException):
        asyncio.run(service.process_yookassa_webhook({"event": "payment.succeeded", "object": {"id": "provider-id"}}, provider))
    assert db.operation.status == "pending"
    assert db.commits == 0
