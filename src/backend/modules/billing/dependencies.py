from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database.dependencies import get_db
from core.settings import get_settings
from integrations.yookassa import YooKassaPaymentProvider
from .service import BillingService


async def get_billing_service(db: AsyncSession = Depends(get_db)) -> BillingService:
    settings = get_settings()
    provider = YooKassaPaymentProvider(settings) if settings.PAYMENTS_PROVIDER == "yookassa" and settings.YOOKASSA_SHOP_ID and settings.YOOKASSA_SECRET_KEY else None
    return BillingService(db, payment_provider=provider, return_url=settings.YOOKASSA_RETURN_URL)
