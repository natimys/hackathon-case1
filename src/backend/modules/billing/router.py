import os
from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select

from core.dependencies import get_current_user
from core.settings import get_settings
from modules.access.policy import require_company_admin
from modules.properties.models import Apartment, Building
from modules.users.models import User

from .dependencies import get_billing_service
from .models import PersonalAccount
from .module import module
from .schemas import (
    AccountCreate,
    AccountRead,
    AccrualGenerate,
    AccrualResult,
    InvoiceRead,
    PaymentCreate,
    PaymentImportReport,
    PaymentRead,
)
from modules.access.policy import financial_apartment_scope
from .service import BillingService

router = APIRouter(prefix=module.router_prefix, tags=module.router_tags)


@router.get("/accounts", response_model=list[AccountRead])
async def list_accounts(
    user: User = Depends(get_current_user),
    service: BillingService = Depends(get_billing_service),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    statement = await service.account_scope(user)
    return list(
        (
            await service.db.scalars(
                statement.order_by(PersonalAccount.id).offset(offset).limit(limit)
            )
        ).all()
    )


@router.get("/accounts/{account_id}", response_model=AccountRead)
async def get_account(
    account_id: int,
    user: User = Depends(get_current_user),
    service: BillingService = Depends(get_billing_service),
):
    return await service.account(user, account_id)


@router.post(
    "/accounts", response_model=AccountRead, status_code=status.HTTP_201_CREATED
)
async def create_account(
    data: AccountCreate,
    user: User = Depends(get_current_user),
    service: BillingService = Depends(get_billing_service),
):
    apartment = (
        await service.db.execute(
            select(Apartment).where(
                Apartment.id == data.apartment_id, financial_apartment_scope(user)
            )
        )
    ).scalar_one_or_none()
    if apartment is None:
        raise HTTPException(404, "Apartment not found")
    building = await service.db.get(Building, apartment.building_id)
    await require_company_admin(service.db, user, building.management_company_id)
    try:
        return await service.create_account(user, **data.model_dump())
    except Exception as exc:
        if exc.__class__.__name__ == "IntegrityError":
            raise HTTPException(409, "Conflicting account data")
        raise


@router.get("/invoices", response_model=list[InvoiceRead])
async def list_invoices(
    building_id: int | None = None,
    period: date | None = None,
    state: str | None = Query(None, pattern="^(unpaid|partially_paid|paid|overdue)$"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    service: BillingService = Depends(get_billing_service),
):
    return await service.list_invoices(
        user,
        building_id=building_id,
        period=period,
        state=state,
        limit=limit,
        offset=offset,
    )


@router.get("/invoices/{invoice_id}", response_model=InvoiceRead)
async def get_invoice(
    invoice_id: int,
    user: User = Depends(get_current_user),
    service: BillingService = Depends(get_billing_service),
):
    return await service.invoice_read(user, invoice_id)


@router.get("/invoices/{invoice_id}/payments", response_model=list[PaymentRead])
async def invoice_payments(
    invoice_id: int,
    user: User = Depends(get_current_user),
    service: BillingService = Depends(get_billing_service),
):
    return await service.payments(user, invoice_id)


@router.post("/accruals/generate", response_model=AccrualResult)
async def generate_accruals(
    data: AccrualGenerate,
    user: User = Depends(get_current_user),
    service: BillingService = Depends(get_billing_service),
):
    return await service.generate(user, **data.model_dump())


@router.get("/exports/accruals")
async def export_accruals(
    building_id: int,
    period: date,
    user: User = Depends(get_current_user),
    service: BillingService = Depends(get_billing_service),
):
    content = await service.export_accruals(user, building_id, period)
    return Response(
        content,
        media_type="text/csv; charset=utf-8-sig",
        headers={
            "Content-Disposition": f'attachment; filename="billing-{building_id}-{period}.csv"',
            "X-Registry-Format": "internal-demo-csv-v1",
        },
    )


@router.post("/imports/payments", response_model=PaymentImportReport)
async def import_payments(
    company_id: int = Query(gt=0),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    service: BillingService = Depends(get_billing_service),
):
    settings = get_settings()
    if settings.BILLING_DEMO_PAYMENTS_ENABLED is not True:
        raise HTTPException(503, "Demo registry import is disabled")
    if os.getenv("ENVIRONMENT", "development").lower() in {"production", "prod"}:
        raise HTTPException(503, "Demo registry import is unavailable in production")
    content = await file.read(2 * 1024 * 1024 + 1)
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(413, "Registry file is too large")
    return await service.import_payment_registry(user, company_id, content)


@router.post(
    "/invoices/{invoice_id}/demo-payments", response_model=PaymentRead, status_code=201
)
async def create_demo_payment(
    invoice_id: int,
    data: PaymentCreate,
    user: User = Depends(get_current_user),
    service: BillingService = Depends(get_billing_service),
):
    settings = get_settings()
    service.demo_enabled = settings.BILLING_DEMO_PAYMENTS_ENABLED and os.getenv(
        "ENVIRONMENT", "development"
    ).lower() not in {"production", "prod"}
    return await service.start_demo_payment(
        user, invoice_id, amount=data.amount, idempotency_key=data.idempotency_key
    )


@router.post("/payments/{operation_id}/demo-confirm", response_model=PaymentRead)
async def confirm_demo_payment(
    operation_id: int,
    user: User = Depends(get_current_user),
    service: BillingService = Depends(get_billing_service),
):
    settings = get_settings()
    service.demo_enabled = settings.BILLING_DEMO_PAYMENTS_ENABLED and os.getenv(
        "ENVIRONMENT", "development"
    ).lower() not in {"production", "prod"}
    return await service.confirm_demo_payment(user, operation_id)
