from decimal import Decimal

import httpx
from fastapi import HTTPException

from core.settings import Settings, get_settings
from .payment_provider import PaymentRequest, ProviderEvent, ProviderPayment


class YooKassaPaymentProvider:
    def __init__(self, settings: Settings | None = None, *, client=None):
        self.settings = settings or get_settings()
        self.client = client

    def _auth(self):
        if not self.settings.YOOKASSA_SHOP_ID or self.settings.YOOKASSA_SECRET_KEY is None:
            raise HTTPException(503, "YooKassa is not configured")
        return self.settings.YOOKASSA_SHOP_ID, self.settings.YOOKASSA_SECRET_KEY.get_secret_value()

    async def _request(self, method: str, path: str, *, headers=None, json=None):
        auth = self._auth()
        if self.client is not None:
            response = await self.client.request(method, f"{self.settings.YOOKASSA_API_BASE_URL.rstrip('/')}{path}", auth=auth, headers=headers, json=json, timeout=15)
        else:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.request(method, f"{self.settings.YOOKASSA_API_BASE_URL.rstrip('/')}{path}", auth=auth, headers=headers, json=json)
        if response.is_error:
            raise HTTPException(502, "Payment provider request failed")
        return response.json()

    @staticmethod
    def _normalize(data: dict) -> ProviderPayment:
        try:
            amount = data["amount"]
            minor = int(Decimal(amount["value"]) * 100)
            confirmation = data.get("confirmation") or {}
            return ProviderPayment(
                payment_id=str(data["id"]), status=str(data["status"]),
                amount_minor=minor, currency=str(amount["currency"]),
                confirmation_url=confirmation.get("confirmation_url"),
                metadata_operation_id=(data.get("metadata") or {}).get("operation_id"),
            )
        except (KeyError, ValueError, TypeError):
            raise HTTPException(502, "Invalid payment provider response")

    async def create_payment(self, request: PaymentRequest) -> ProviderPayment:
        data = {
            "amount": {"value": f"{request.amount_minor // 100}.{request.amount_minor % 100:02d}", "currency": request.currency},
            "capture": True,
            "confirmation": {"type": "redirect", "return_url": request.return_url},
            "description": request.description[:128],
            "metadata": {"operation_id": str(request.operation_id)},
        }
        vat_code = self.settings.YOOKASSA_RECEIPT_VAT_CODE
        if vat_code is not None:
            if not request.receipt_email:
                raise HTTPException(422, "An email is required to issue a receipt")
            data["receipt"] = {
                "customer": {"email": request.receipt_email},
                "items": [{
                    "description": request.description[:128], "quantity": "1.00",
                    "amount": data["amount"], "vat_code": vat_code,
                    "payment_mode": "full_prepayment", "payment_subject": "service",
                }],
            }
        return self._normalize(await self._request("POST", "/payments", headers={"Idempotence-Key": request.idempotency_key}, json=data))

    async def get_payment(self, payment_id: str) -> ProviderPayment:
        return self._normalize(await self._request("GET", f"/payments/{payment_id}"))

    async def process_webhook(self, payload: dict) -> ProviderEvent:
        try:
            event = str(payload["event"])
            payment_id = str(payload["object"]["id"])
        except (KeyError, TypeError):
            raise HTTPException(400, "Invalid payment webhook")
        if event not in {"payment.succeeded", "payment.canceled"}:
            raise HTTPException(400, "Unsupported payment event")
        return ProviderEvent(event=event, payment_id=payment_id)
