import hashlib
import json
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from integrations.billing_gateway import BillingGateway
from modules.access.policy import financial_apartment_scope
from modules.properties.models import Apartment, Building
from modules.users.models import User

from .models import (
    Invoice,
    InvoiceItem,
    PaymentEvent,
    PaymentOperation,
    PersonalAccount,
)
from .repository import BillingRepository
from .schemas import minor_to_money, money_to_minor

MAX_MINOR = 100000000000


class BillingService:
    def __init__(
        self,
        db: AsyncSession,
        *,
        demo_enabled: bool = False,
        environment: str = "development",
        gateway=None,
    ):
        self.db = db
        self.repository = BillingRepository(db)
        self.demo_enabled = demo_enabled and environment.lower() not in {
            "production",
            "prod",
        }
        self.gateway = gateway or BillingGateway()

    async def account_scope(self, user: User):
        return (
            select(PersonalAccount)
            .join(Apartment, Apartment.id == PersonalAccount.apartment_id)
            .where(financial_apartment_scope(user))
        )

    async def create_account(self, user: User, apartment_id: int, **values):
        apartment = (
            await self.db.execute(
                select(Apartment).where(
                    Apartment.id == apartment_id, financial_apartment_scope(user)
                )
            )
        ).scalar_one_or_none()
        if apartment is None:
            raise HTTPException(404, "Apartment not found")
        try:
            item = await self.repository.add_account(
                apartment_id=apartment.id, **values
            )
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise
        await self.db.refresh(item)
        return item

    async def account(self, user: User, account_id: int):
        statement = await self.account_scope(user)
        item = (
            await self.db.execute(statement.where(PersonalAccount.id == account_id))
        ).scalar_one_or_none()
        if item is None:
            raise HTTPException(404, "Personal account not found")
        return item

    async def invoice_access(self, user: User, invoice_id: int, *, lock=False):
        statement = (
            select(Invoice)
            .join(PersonalAccount)
            .join(Apartment, Apartment.id == PersonalAccount.apartment_id)
            .where(Invoice.id == invoice_id, financial_apartment_scope(user))
        )
        if lock:
            statement = statement.with_for_update(of=Invoice)
        invoice = (await self.db.execute(statement)).scalar_one_or_none()
        if invoice is None:
            raise HTTPException(404, "Invoice not found")
        return invoice

    async def invoice_read(self, user: User, invoice_id: int):
        invoice = await self.invoice_access(user, invoice_id)
        return await self._invoice_view(invoice)

    async def _invoice_view(self, invoice: Invoice):
        account = await self.db.get(PersonalAccount, invoice.personal_account_id)
        items = await self.repository.items(invoice.id)
        paid = await self.db.scalar(
            select(func.coalesce(func.sum(PaymentOperation.amount), 0)).where(
                PaymentOperation.invoice_id == invoice.id,
                PaymentOperation.status == "succeeded",
            )
        )
        paid = int(paid or 0)
        now = datetime.now(UTC)
        status = (
            "paid"
            if paid >= invoice.total_amount
            else "partially_paid"
            if paid
            else "overdue"
            if invoice.due_at < now
            else "unpaid"
        )
        return {
            "id": invoice.id,
            "personal_account_id": invoice.personal_account_id,
            "account_number": account.account_number,
            "billing_period": invoice.billing_period,
            "issued_at": invoice.issued_at,
            "due_at": invoice.due_at,
            "total_amount": minor_to_money(invoice.total_amount),
            "paid_amount": minor_to_money(paid),
            "balance": minor_to_money(invoice.total_amount - paid),
            "currency": invoice.currency,
            "status": status,
            "items": [
                {
                    "id": i.id,
                    "service_code": i.service_code,
                    "description": i.description,
                    "quantity": i.quantity,
                    "unit_price": minor_to_money(i.unit_price),
                    "amount": minor_to_money(i.amount),
                }
                for i in items
            ],
        }

    async def generate(
        self,
        user: User,
        *,
        building_id: int,
        billing_period,
        service_code: str,
        description: str,
        unit_price: Decimal,
        due_at,
    ):
        building = (
            await self.db.execute(select(Building).where(Building.id == building_id))
        ).scalar_one_or_none()
        if building is None:
            raise HTTPException(404, "Building not found")
        from modules.access.policy import require_company_admin

        await require_company_admin(self.db, user, building.management_company_id)
        if billing_period.day != 1 or due_at.tzinfo is None:
            raise HTTPException(
                422, "Period must be the first day of month and due_at timezone-aware"
            )
        price = money_to_minor(unit_price)
        accounts = list(
            (
                await self.db.scalars(
                    select(PersonalAccount)
                    .join(Apartment)
                    .where(
                        Apartment.building_id == building_id,
                        PersonalAccount.is_active.is_(True),
                    )
                    .order_by(PersonalAccount.id)
                )
            ).all()
        )
        if len({a.apartment_id for a in accounts}) != len(accounts):
            raise HTTPException(
                409, "More than one active personal account exists for an apartment"
            )
        count = skipped = total = 0
        try:
            for account in accounts:
                values = dict(
                    personal_account_id=account.id,
                    billing_period=billing_period,
                    service_code=service_code,
                    due_at=due_at,
                    total_amount=price,
                    source_system="internal",
                )
                statement = (
                    pg_insert(Invoice)
                    .values(**values)
                    .on_conflict_do_nothing(
                        constraint="uq_invoice_account_period_service"
                    )
                    .returning(Invoice.id)
                )
                invoice_id = (await self.db.execute(statement)).scalar_one_or_none()
                if invoice_id is None:
                    skipped += 1
                    continue
                self.db.add(
                    InvoiceItem(
                        invoice_id=invoice_id,
                        service_code=service_code,
                        description=description,
                        quantity=1,
                        unit_price=price,
                        amount=price,
                    )
                )
                count += 1
                total += price
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise
        return {
            "created_count": count,
            "skipped_count": skipped,
            "total_amount": minor_to_money(total),
        }

    async def list_invoices(
        self,
        user: User,
        *,
        building_id=None,
        period=None,
        state=None,
        limit=50,
        offset=0,
    ):
        paid_amount = (
            select(func.coalesce(func.sum(PaymentOperation.amount), 0))
            .where(
                PaymentOperation.invoice_id == Invoice.id,
                PaymentOperation.status == "succeeded",
            )
            .scalar_subquery()
        )
        statement = (
            select(Invoice)
            .join(PersonalAccount)
            .join(Apartment, Apartment.id == PersonalAccount.apartment_id)
            .where(financial_apartment_scope(user))
        )
        if building_id is not None:
            statement = statement.where(Apartment.building_id == building_id)
        if period is not None:
            statement = statement.where(Invoice.billing_period == period)
        now = datetime.now(UTC)
        if state == "paid":
            statement = statement.where(paid_amount >= Invoice.total_amount)
        elif state == "partially_paid":
            statement = statement.where(
                paid_amount > 0, paid_amount < Invoice.total_amount
            )
        elif state == "unpaid":
            statement = statement.where(paid_amount == 0, Invoice.due_at >= now)
        elif state == "overdue":
            statement = statement.where(paid_amount == 0, Invoice.due_at < now)
        invoices = list(
            (
                await self.db.scalars(
                    statement.order_by(Invoice.billing_period.desc(), Invoice.id.desc())
                    .offset(offset)
                    .limit(limit)
                )
            ).all()
        )
        rows = [await self._invoice_view(i) for i in invoices]
        return rows

    async def payments(self, user: User, invoice_id: int):
        await self.invoice_access(user, invoice_id)
        return await self.repository.payments(invoice_id)

    async def start_demo_payment(
        self,
        user: User,
        invoice_id: int,
        *,
        amount: Decimal | None,
        idempotency_key: str,
    ):
        if not self.demo_enabled:
            raise HTTPException(503, "Demo payments are disabled")
        invoice = await self.invoice_access(user, invoice_id, lock=True)
        key_query = select(PaymentOperation).where(
            PaymentOperation.idempotency_key == idempotency_key
        )
        existing = (await self.db.execute(key_query)).scalar_one_or_none()
        if existing:
            if existing.invoice_id != invoice_id:
                raise HTTPException(409, "Idempotency key already used")
            return existing
        paid = int(
            await self.db.scalar(
                select(func.coalesce(func.sum(PaymentOperation.amount), 0)).where(
                    PaymentOperation.invoice_id == invoice.id,
                    PaymentOperation.status.in_(("succeeded", "pending")),
                )
            )
            or 0
        )
        amount_minor = (
            invoice.total_amount - paid if amount is None else money_to_minor(amount)
        )
        if amount_minor <= 0 or amount_minor > invoice.total_amount - paid:
            raise HTTPException(409, "Payment exceeds outstanding balance")
        operation = PaymentOperation(
            invoice_id=invoice.id,
            provider="DEMO",
            idempotency_key=idempotency_key,
            amount=amount_minor,
            currency="RUB",
            status="pending",
        )
        self.db.add(operation)
        try:
            await self.db.flush()
            # Demo adapter confirms separately in this request path after creation is persisted.
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            existing = (
                await self.db.execute(
                    select(PaymentOperation).where(
                        PaymentOperation.idempotency_key == idempotency_key
                    )
                )
            ).scalar_one_or_none()
            if existing is None or existing.invoice_id != invoice_id:
                raise HTTPException(409, "Idempotency key already used")
            return existing
        return operation

    async def confirm_demo_payment(self, user: User, operation_id: int):
        if not self.demo_enabled:
            raise HTTPException(503, "Demo payments are disabled")
        operation = await self.db.get(PaymentOperation, operation_id)
        if operation is None:
            raise HTTPException(404, "Payment operation not found")
        await self.invoice_access(user, operation.invoice_id, lock=True)
        await self.db.refresh(operation)
        if operation.provider != "DEMO":
            raise HTTPException(409, "Only demo operations can be confirmed here")
        if operation.status == "succeeded":
            return operation
        if operation.status != "pending":
            raise HTTPException(409, "Only pending demo operations can be confirmed")
        paid = int(
            await self.db.scalar(
                select(func.coalesce(func.sum(PaymentOperation.amount), 0)).where(
                    PaymentOperation.invoice_id == operation.invoice_id,
                    PaymentOperation.status == "succeeded",
                )
            )
            or 0
        )
        if (
            paid + operation.amount
            > (await self.db.get(Invoice, operation.invoice_id)).total_amount
        ):
            raise HTTPException(409, "Payment exceeds outstanding balance")
        operation.status = "succeeded"
        operation.confirmed_at = datetime.now(UTC)
        self.db.add(
            PaymentEvent(
                operation_id=operation.id,
                source="DEMO",
                external_event_id=f"demo:{operation.id}",
                payload_hash=hashlib.sha256(str(operation.id).encode()).hexdigest(),
            )
        )
        await self.db.commit()
        await self.db.refresh(operation)
        return operation

    async def export_accruals(self, user: User, building_id: int, period):
        from modules.access.policy import require_company_admin

        building = (
            await self.db.execute(select(Building).where(Building.id == building_id))
        ).scalar_one_or_none()
        if building is None:
            raise HTTPException(404, "Building not found")
        await require_company_admin(self.db, user, building.management_company_id)
        query = (
            select(PersonalAccount, Invoice, InvoiceItem)
            .join(Invoice, Invoice.personal_account_id == PersonalAccount.id)
            .join(InvoiceItem, InvoiceItem.invoice_id == Invoice.id)
            .join(Apartment, Apartment.id == PersonalAccount.apartment_id)
            .where(
                Apartment.building_id == building_id,
                Invoice.billing_period == period,
                financial_apartment_scope(user),
            )
            .order_by(PersonalAccount.account_number, Invoice.id, InvoiceItem.id)
        )
        return self.gateway.export_accruals((await self.db.execute(query)).all())

    async def import_payment_registry(self, user: User, company_id: int, data: bytes):
        from modules.access.policy import require_company_admin

        await require_company_admin(self.db, user, company_id)
        try:
            rows = self.gateway.parse_payment_registry(data)
        except (ValueError, UnicodeDecodeError) as exc:
            raise HTTPException(422, str(exc))
        report = {
            "imported_count": 0,
            "duplicate_count": 0,
            "rejected_count": 0,
            "rejected_rows": [],
        }
        for line, row in enumerate(rows, start=2):
            savepoint = await self.db.begin_nested()
            try:
                invoice_id = int(row["invoice_id"])
                amount = money_to_minor(row["amount"])
                if row["status"].strip().lower() != "succeeded":
                    raise ValueError("only succeeded confirmations are accepted")
                confirmed_at = datetime.fromisoformat(
                    row["confirmed_at"].replace("Z", "+00:00")
                )
                if confirmed_at.tzinfo is None:
                    raise ValueError("confirmed_at must include timezone")
                invoice = (
                    await self.db.execute(
                        select(Invoice)
                        .join(PersonalAccount)
                        .join(Apartment, Apartment.id == PersonalAccount.apartment_id)
                        .join(Building, Building.id == Apartment.building_id)
                        .where(
                            Invoice.id == invoice_id,
                            Building.management_company_id == company_id,
                        )
                        .with_for_update(of=Invoice)
                    )
                ).scalar_one_or_none()
                if invoice is None:
                    raise ValueError("invoice not found in company")
                external = row["external_payment_id"].strip()
                if not external:
                    raise ValueError("external_payment_id is required")
                duplicate = await self.db.scalar(
                    select(PaymentEvent.id).where(
                        PaymentEvent.source == "DEMO_IMPORT",
                        PaymentEvent.external_event_id == external,
                    )
                )
                if duplicate:
                    await savepoint.commit()
                    report["duplicate_count"] += 1
                    continue
                paid = int(
                    await self.db.scalar(
                        select(
                            func.coalesce(func.sum(PaymentOperation.amount), 0)
                        ).where(
                            PaymentOperation.invoice_id == invoice_id,
                            PaymentOperation.status == "succeeded",
                        )
                    )
                    or 0
                )
                if amount > invoice.total_amount - paid:
                    raise ValueError("payment exceeds outstanding balance")
                op = PaymentOperation(
                    invoice_id=invoice_id,
                    provider="DEMO_IMPORT",
                    provider_reference=external,
                    idempotency_key=f"import:{hashlib.sha256(external.encode()).hexdigest()}",
                    amount=amount,
                    status="succeeded",
                    confirmed_at=confirmed_at,
                )
                self.db.add(op)
                await self.db.flush()
                digest = hashlib.sha256(
                    json.dumps(row, sort_keys=True).encode()
                ).hexdigest()
                self.db.add(
                    PaymentEvent(
                        operation_id=op.id,
                        source="DEMO_IMPORT",
                        external_event_id=external,
                        payload_hash=digest,
                    )
                )
                await self.db.flush()
                await savepoint.commit()
                report["imported_count"] += 1
            except Exception as exc:
                await savepoint.rollback()
                report["rejected_count"] += 1
                report["rejected_rows"].append({"row": line, "reason": str(exc)[:200]})
        await self.db.commit()
        return report
