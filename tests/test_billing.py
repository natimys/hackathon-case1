from datetime import UTC, date, datetime
from decimal import Decimal
import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, event, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.enums import UserRole
from database.base import Base
from database.bootstrap import bootstrap_models
from integrations.billing_gateway import BillingGateway
from modules.access.models import CompanyMembership, ResidentBinding
from modules.access.policy import financial_apartment_scope
from modules.billing.models import (
    Invoice,
    InvoiceItem,
    PaymentEvent,
    PaymentOperation,
    PersonalAccount,
)
from modules.billing.schemas import PaymentRead, minor_to_money, money_to_minor
from modules.billing.service import BillingService
from modules.properties.models import Apartment, Building, Entrance, ManagementCompany
from modules.users.models import User


@pytest.fixture
def db():
    bootstrap_models()
    engine = create_engine("sqlite://")

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _record):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


@pytest.fixture
def setup(db):
    db.add_all(
        [
            User(
                id=i,
                email=f"{i}@example.com",
                name=f"User {i}",
                password="x",
                role=UserRole.USER,
                is_active=True,
                session_version=0,
            )
            for i in (1, 2, 3)
        ]
        + [
            User(
                id=4,
                email="4@example.com",
                name="Admin",
                password="x",
                role=UserRole.ADMIN,
                is_active=True,
                session_version=0,
            )
        ]
    )
    db.add_all([ManagementCompany(id=10, name="A"), ManagementCompany(id=20, name="B")])
    db.flush()
    db.add_all(
        [
            Building(
                id=100,
                management_company_id=10,
                city="Yakutsk",
                street="Lenina",
                house_number="1",
            ),
            Building(
                id=200,
                management_company_id=20,
                city="Yakutsk",
                street="Lenina",
                house_number="2",
            ),
        ]
    )
    db.flush()
    db.add_all(
        [
            Entrance(id=1000, building_id=100, number="1"),
            Entrance(id=2000, building_id=200, number="1"),
        ]
    )
    db.flush()
    db.add_all(
        [
            Apartment(id=10000, building_id=100, entrance_id=1000, number="1"),
            Apartment(id=20000, building_id=200, entrance_id=2000, number="1"),
        ]
    )
    db.flush()
    return db


def test_money_is_decimal_and_stored_as_kopecks():
    assert money_to_minor("300.00") == 30000
    assert money_to_minor(Decimal("0.01")) == 1
    assert minor_to_money(100001) == "1000.01"
    with pytest.raises(ValueError):
        money_to_minor("1.001")
    with pytest.raises(ValueError):
        money_to_minor("-1.00")


def test_payment_response_formats_minor_units_as_decimal_string():
    payment = PaymentRead(
        id=1,
        invoice_id=2,
        provider="DEMO",
        provider_reference=None,
        amount=4250,
        currency="RUB",
        status="pending",
        created_at=datetime(2026, 10, 13, tzinfo=UTC),
        confirmed_at=None,
    )

    assert payment.amount == "42.50"


def test_personal_account_and_source_identifier_constraints(setup):
    db = setup
    db.add(
        PersonalAccount(
            id=1,
            apartment_id=10000,
            account_number="00001",
            source_system="rbc",
            external_id="ext-1",
        )
    )
    db.flush()
    db.add(
        PersonalAccount(
            id=2,
            apartment_id=10000,
            account_number="00002",
            source_system="rbc",
            external_id="ext-1",
        )
    )
    with pytest.raises(IntegrityError):
        db.flush()


def test_duplicate_invoice_period_service_is_rejected(setup):
    db = setup
    db.add(PersonalAccount(id=1, apartment_id=10000, account_number="00001"))
    db.flush()
    due = datetime(2026, 11, 10, tzinfo=UTC)
    db.add_all(
        [
            Invoice(
                id=1,
                personal_account_id=1,
                billing_period=date(2026, 10, 1),
                service_code="CAM",
                due_at=due,
                total_amount=30000,
            ),
            Invoice(
                id=2,
                personal_account_id=1,
                billing_period=date(2026, 10, 1),
                service_code="CAM",
                due_at=due,
                total_amount=30000,
            ),
        ]
    )
    with pytest.raises(IntegrityError):
        db.flush()


def test_payment_statuses_and_partial_balance_use_only_successful(setup):
    db = setup
    db.add(PersonalAccount(id=1, apartment_id=10000, account_number="00001"))
    db.flush()
    due = datetime(2026, 11, 10, tzinfo=UTC)
    db.add(
        Invoice(
            id=1,
            personal_account_id=1,
            billing_period=date(2026, 10, 1),
            service_code="CAM",
            due_at=due,
            total_amount=30000,
        )
    )
    db.flush()
    db.add_all(
        [
            PaymentOperation(
                id=1,
                invoice_id=1,
                provider="DEMO",
                idempotency_key="pending-0001",
                amount=10000,
                status="pending",
            ),
            PaymentOperation(
                id=2,
                invoice_id=1,
                provider="DEMO",
                idempotency_key="success-001",
                amount=12000,
                status="succeeded",
            ),
            PaymentOperation(
                id=3,
                invoice_id=1,
                provider="DEMO",
                idempotency_key="failed-0001",
                amount=3000,
                status="failed",
            ),
        ]
    )
    db.flush()
    paid = db.scalar(
        select(PaymentOperation.amount).where(PaymentOperation.status == "succeeded")
    )
    balance = 30000 - paid
    assert balance == 18000


def test_invoice_items_additive_schema_and_financial_constraints():
    assert Invoice.__table__.c.total_amount.type.python_type is int
    assert InvoiceItem.__table__.c.amount.type.python_type is int
    assert any(
        c.name == "ck_invoice_item_amounts" for c in InvoiceItem.__table__.constraints
    )


def test_resident_and_company_admin_scopes_exclude_technician(setup):
    db = setup
    db.add_all(
        [
            ResidentBinding(id=1, user_id=1, apartment_id=10000, status="confirmed"),
            CompanyMembership(
                id=1, user_id=2, company_id=10, scoped_role="technician", is_active=True
            ),
            CompanyMembership(
                id=2,
                user_id=3,
                company_id=10,
                scoped_role="company_admin",
                is_active=True,
            ),
        ]
    )
    db.flush()

    def visible(user_id):
        user = db.get(User, user_id)
        return list(
            db.scalars(select(Apartment.id).where(financial_apartment_scope(user)))
        )

    assert visible(1) == [10000]
    assert visible(2) == []
    assert visible(3) == [10000]
    assert visible(4) == [10000, 20000]


def test_internal_demo_registry_csv_contract():
    gateway = BillingGateway()
    rows = gateway.parse_payment_registry(
        b"invoice_id;external_payment_id;amount;status;confirmed_at\n1;pay-1;300.00;succeeded;2026-10-01T12:00:00+09:00\n"
    )
    assert rows[0]["external_payment_id"] == "pay-1"
    with pytest.raises(ValueError, match="Expected internal demo CSV"):
        gateway.parse_payment_registry(b"invoice_id,amount\n1,1")


def test_export_csv_contract():
    gateway = BillingGateway()
    account = SimpleNamespace(account_number="00001")
    invoice = SimpleNamespace(id=1, billing_period=date(2026, 10, 1), currency="RUB")
    item = SimpleNamespace(service_code="CAM", amount=30000)
    content = gateway.export_accruals([(account, invoice, item)])
    assert content.startswith(b"\xef\xbb\xbf")
    text = content.decode("utf-8-sig")
    assert (
        "personal_account;invoice_id;billing_period;service_code;amount;currency"
        in text
    )
    assert "00001;1;2026-10-01;CAM;300.00;RUB" in text


def test_demo_mode_disabled_by_default_and_in_production():
    user = User(id=1, email="u@example.com", name="U", password="x", role=UserRole.USER)
    for service in (
        BillingService(None),
        BillingService(None, demo_enabled=True, environment="production"),
    ):
        with pytest.raises(HTTPException) as error:
            asyncio.run(
                service.start_demo_payment(
                    user, 1, amount=None, idempotency_key="demo-key-0001"
                )
            )
        assert error.value.status_code == 503


def test_external_payment_event_deduplicates_per_source():
    assert any(
        constraint.name == "uq_payment_event_source_external"
        and tuple(column.name for column in constraint.columns)
        == ("source", "external_event_id")
        for constraint in PaymentEvent.__table__.constraints
    )
