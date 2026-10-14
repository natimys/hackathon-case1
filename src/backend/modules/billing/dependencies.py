from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database.dependencies import get_db
from .service import BillingService


async def get_billing_service(db: AsyncSession = Depends(get_db)) -> BillingService:
    return BillingService(db)
