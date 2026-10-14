import os
from datetime import UTC, date, datetime, time

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import case, select

from core.dependencies import get_current_user
from core.settings import get_settings
from modules.access.policy import require_company_admin
from modules.properties.models import Apartment, Building
from modules.users.models import User
from database.dependencies import get_db

from .dependencies import get_billing_service
from .models import PersonalAccount, SubscriptionPlan, Subscription
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
    minor_to_money,
    money_to_minor,
)
from modules.access.policy import financial_apartment_scope
from .service import BillingService

router = APIRouter(prefix=module.router_prefix, tags=module.router_tags)


class PlanInput(BaseModel):
    code: str = Field(min_length=1, max_length=60)
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    price: str
    duration_days: int = Field(gt=0, le=3660)
    features: dict = Field(default_factory=dict)
    is_active: bool = True


class SubscribeInput(BaseModel):
    idempotency_key: str = Field(min_length=8, max_length=120)


class SubscriptionPreferences(BaseModel):
    notifications_enabled: bool | None = None
    motion_start: time | None = None
    motion_end: time | None = None
    event_zones: list[str] | None = Field(default=None, max_length=20)


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


@router.post("/invoices/{invoice_id}/payments", response_model=PaymentRead, status_code=201)
async def create_payment(
    invoice_id: int,
    data: PaymentCreate,
    user: User = Depends(get_current_user),
    service: BillingService = Depends(get_billing_service),
):
    return await service.start_payment(user, invoice_id, idempotency_key=data.idempotency_key)


async def yookassa_webhook(request: Request, db=Depends(get_db)):
    import ipaddress
    import json
    from core.settings import get_settings
    from integrations.yookassa import YooKassaPaymentProvider

    settings = get_settings()
    host = request.client.host if request.client else ""
    if settings.YOOKASSA_TRUST_PROXY_HEADERS:
        try:
            proxy = ipaddress.ip_address(host)
            if not any(proxy in ipaddress.ip_network(network) for network in settings.YOOKASSA_TRUSTED_PROXY_IPS):
                raise HTTPException(403, "Untrusted reverse proxy")
        except ValueError:
            raise HTTPException(403, "Invalid reverse proxy")
        forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
        if forwarded:
            host = forwarded
    if settings.YOOKASSA_IP_FILTER_ENABLED:
        try:
            source = ipaddress.ip_address(host)
            if not any(source in ipaddress.ip_network(network) for network in settings.YOOKASSA_TRUSTED_IPS):
                raise HTTPException(403, "Untrusted webhook source")
        except ValueError:
            raise HTTPException(403, "Invalid webhook source")
    try:
        payload = json.loads(await request.body())
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(400, "Invalid webhook body")
    provider = YooKassaPaymentProvider(settings)
    service = BillingService(db, payment_provider=provider)
    await service.process_yookassa_webhook(payload, provider)
    return {"status": "ok"}


@router.get("/plans")
async def list_plans(user: User = Depends(get_current_user), service: BillingService = Depends(get_billing_service)):
    plans = await service.db.scalars(select(SubscriptionPlan).where(SubscriptionPlan.is_active.is_(True)).order_by(SubscriptionPlan.price))
    return [{"id": p.id, "code": p.code, "name": p.name, "description": p.description, "price": minor_to_money(p.price), "currency": p.currency, "duration_days": p.duration_days, "features": p.features} for p in plans]


@router.post("/plans", status_code=201)
async def create_plan(data: PlanInput, user: User = Depends(get_current_user), service: BillingService = Depends(get_billing_service)):
    if user.role != "admin":
        raise HTTPException(403, "Administrator access required")
    plan = SubscriptionPlan(**data.model_dump(exclude={"price"}), price=money_to_minor(data.price))
    service.db.add(plan)
    await service.db.commit()
    await service.db.refresh(plan)
    return {"id": plan.id, "code": plan.code, "name": plan.name}


@router.patch("/plans/{plan_id}")
async def update_plan(plan_id: int, data: PlanInput, user: User = Depends(get_current_user), service: BillingService = Depends(get_billing_service)):
    if user.role != "admin":
        raise HTTPException(403, "Administrator access required")
    plan = await service.db.get(SubscriptionPlan, plan_id)
    if plan is None:
        raise HTTPException(404, "Plan not found")
    for key, value in data.model_dump(exclude={"price"}).items():
        setattr(plan, key, value)
    plan.price = money_to_minor(data.price)
    await service.db.commit()
    return {"id": plan.id, "code": plan.code, "name": plan.name}


@router.get("/subscriptions/me")
async def my_subscription(user: User = Depends(get_current_user), service: BillingService = Depends(get_billing_service)):
    now = datetime.now(UTC)
    active_now = case(((Subscription.status == "active") & (Subscription.starts_at <= now) & (Subscription.ends_at > now), 0), else_=1)
    row = await service.db.execute(select(Subscription, SubscriptionPlan).join(SubscriptionPlan).where(Subscription.owner_id == user.id).order_by(active_now, Subscription.created_at.desc()).limit(1))
    pair = row.first()
    if not pair:
        return None
    sub, plan = pair
    status_value = sub.status
    now = datetime.now(UTC)
    if status_value == "active" and sub.ends_at is not None and sub.ends_at <= now:
        status_value = "expired"
    elif status_value == "active" and sub.starts_at is not None and sub.starts_at > now:
        status_value = "pending"
    return {"id": sub.id, "plan": plan.name, "status": status_value, "starts_at": sub.starts_at, "ends_at": sub.ends_at, "price": minor_to_money(sub.price), "features": sub.features, "notifications_enabled": sub.notifications_enabled, "event_preferences": sub.event_preferences}


@router.post("/plans/{plan_id}/subscribe", status_code=201)
async def subscribe(plan_id: int, data: SubscribeInput, user: User = Depends(get_current_user), service: BillingService = Depends(get_billing_service)):
    operation, subscription = await service.start_subscription(user, plan_id, idempotency_key=data.idempotency_key)
    return {"subscription_id": subscription.id, "payment_id": operation.id, "status": operation.status, "confirmation_url": operation.confirmation_url}


@router.patch("/subscriptions/me/preferences")
async def update_subscription_preferences(data: SubscriptionPreferences, user: User = Depends(get_current_user), service: BillingService = Depends(get_billing_service)):
    sub = await service.db.scalar(select(Subscription).where(Subscription.owner_id == user.id, Subscription.status == "active").order_by(Subscription.created_at.desc()).limit(1))
    if sub is None:
        raise HTTPException(404, "Active subscription not found")
    values = data.model_dump(exclude_unset=True)
    if values.get("notifications_enabled") is not None:
        sub.notifications_enabled = values["notifications_enabled"]
    if "event_zones" in values or "motion_start" in values or "motion_end" in values:
        if not sub.features.get("motion_notifications", False):
            raise HTTPException(403, "Motion notifications are not included in this subscription")
        preferences = dict(sub.event_preferences or {})
        if "event_zones" in values:
            preferences["event_zones"] = [zone.strip() for zone in (values["event_zones"] or []) if zone.strip()]
        if "motion_start" in values or "motion_end" in values:
            start, end = values.get("motion_start"), values.get("motion_end")
            if (start is None) != (end is None):
                raise HTTPException(422, "Both motion interval endpoints must be set")
            preferences["motion_interval"] = {"start": start.isoformat() if start else None, "end": end.isoformat() if end else None}
        sub.event_preferences = preferences
    await service.db.commit()
    return {"notifications_enabled": sub.notifications_enabled, "ends_at": sub.ends_at, "event_preferences": sub.event_preferences}


@router.post("/subscriptions/me/cancel")
async def cancel_subscription(user: User = Depends(get_current_user), service: BillingService = Depends(get_billing_service)):
    sub = await service.db.scalar(select(Subscription).where(Subscription.owner_id == user.id, Subscription.status == "active").order_by(Subscription.created_at.desc()).limit(1))
    if sub is None:
        raise HTTPException(404, "Active subscription not found")
    sub.status = "cancelled"
    sub.notifications_enabled = False
    await service.db.commit()
    return {"status": sub.status, "paid_until": sub.ends_at}
