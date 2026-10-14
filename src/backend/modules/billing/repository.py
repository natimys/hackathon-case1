from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Invoice, InvoiceItem, PaymentOperation, PersonalAccount


class BillingRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def add_account(self, **values):
        account = PersonalAccount(**values)
        self.db.add(account)
        await self.db.flush()
        return account

    async def account(self, account_id: int):
        return await self.db.get(PersonalAccount, account_id)

    async def invoice(self, invoice_id: int, *, lock: bool = False):
        statement = select(Invoice).where(Invoice.id == invoice_id)
        if lock:
            statement = statement.with_for_update()
        return (await self.db.execute(statement)).scalar_one_or_none()

    async def payments(self, invoice_id: int):
        return list(
            (
                await self.db.scalars(
                    select(PaymentOperation)
                    .where(PaymentOperation.invoice_id == invoice_id)
                    .order_by(PaymentOperation.created_at, PaymentOperation.id)
                )
            ).all()
        )

    async def items(self, invoice_id: int):
        return list(
            (
                await self.db.scalars(
                    select(InvoiceItem)
                    .where(InvoiceItem.invoice_id == invoice_id)
                    .order_by(InvoiceItem.id)
                )
            ).all()
        )
