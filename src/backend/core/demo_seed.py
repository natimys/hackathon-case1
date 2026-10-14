"""Create an isolated, repeatable demo dataset in a development/test database.

Run from ``src/backend`` with ``ENVIRONMENT=development`` (or ``test``) and
``DEMO_SEED_PASSWORD`` set. The script is never called by application startup.
It only inserts missing records and intentionally does not update or delete data.
"""

import asyncio
import os
from datetime import date, datetime, timedelta, timezone
from getpass import getpass

from sqlalchemy import select

from core.enums import UserRole
from core.security import hash_password
from database.engine import create_engine_and_sessionmaker
from modules.access.models import CompanyMembership, ResidentBinding
from modules.billing.models import Invoice, InvoiceItem, PersonalAccount
from modules.properties.models import Apartment, Building, Entrance, ManagementCompany
from modules.cameras.models import Camera
from modules.tickets.models import (
    ServiceTicket,
    TicketAssignment,
    TicketStatusHistory,
)
from modules.users.models import User

DEMO_USERS = (
    ("demo.platform@example.com", "Демо администратор платформы", UserRole.ADMIN),
    ("demo.uk@example.com", "Демо администратор УК", UserRole.USER),
    ("demo.resident@example.com", "Демо житель", UserRole.USER),
    ("demo.technician@example.com", "Демо техник", UserRole.USER),
)


async def seed() -> None:
    environment = os.getenv("ENVIRONMENT", "").lower()
    if environment not in {"development", "test"}:
        raise SystemExit(
            "Demo seed is allowed only when ENVIRONMENT is development or test"
        )

    password = os.getenv("DEMO_SEED_PASSWORD") or getpass("Demo account password: ")
    if len(password) < 12:
        raise SystemExit("DEMO_SEED_PASSWORD must contain at least 12 characters")

    from core.settings import get_settings

    settings = get_settings()
    engine, session_factory = create_engine_and_sessionmaker(settings.DATABASE_URL)
    created: list[str] = []
    try:
        async with session_factory() as db, db.begin():
            company = await db.scalar(
                select(ManagementCompany).where(
                    ManagementCompany.name == "Demo Management Company"
                )
            )
            if company is None:
                company = ManagementCompany(name="Demo Management Company")
                db.add(company)
                await db.flush()
                created.append("management company")

            building = await db.scalar(
                select(Building).where(
                    Building.city == "Якутск",
                    Building.street == "Тестовая улица",
                    Building.house_number == "1",
                    Building.building_suffix == "",
                )
            )
            if building is None:
                building = Building(
                    management_company_id=company.id,
                    city="Якутск",
                    street="Тестовая улица",
                    house_number="1",
                    building_suffix="",
                )
                db.add(building)
                await db.flush()
                created.append("building")
            elif building.management_company_id != company.id:
                raise SystemExit(
                    "The demo building address already belongs to another company; no data was changed"
                )

            entrance = await db.scalar(
                select(Entrance).where(
                    Entrance.building_id == building.id, Entrance.number == "1"
                )
            )
            if entrance is None:
                entrance = Entrance(building_id=building.id, number="1")
                db.add(entrance)
                await db.flush()
                created.append("camera demo entrance")

            apartment = await db.scalar(
                select(Apartment).where(
                    Apartment.building_id == building.id, Apartment.number == "1"
                )
            )
            if apartment is None:
                apartment = Apartment(
                    building_id=building.id, entrance_id=entrance.id, number="1"
                )
                db.add(apartment)
                await db.flush()
                created.append("apartment")
            elif apartment.entrance_id is None:
                apartment.entrance_id = entrance.id

            for number in range(1, 5):
                stream_path = f"demo/camera-{number:03d}"
                camera = await db.scalar(
                    select(Camera).where(Camera.stream_path == stream_path)
                )
                if camera is None:
                    db.add(
                        Camera(
                            name=f"Демо камера {number}",
                            building_id=building.id,
                            entrance_id=entrance.id,
                            location_description=f"Подъезд 1, зона {number}",
                            stream_path=stream_path,
                            source_type="simulator",
                            enabled=True,
                        )
                    )
                    created.append(f"camera {stream_path}")
                elif (
                    camera.building_id != building.id
                    or camera.entrance_id != entrance.id
                ):
                    raise SystemExit(
                        f"Camera path {stream_path} already belongs to another object; no data was changed"
                    )

            users: dict[str, User] = {}
            for email, name, role in DEMO_USERS:
                user = await db.scalar(select(User).where(User.email == email))
                if user is None:
                    user = User(
                        email=email,
                        name=name,
                        role=role,
                        password=hash_password(password),
                        is_active=True,
                    )
                    db.add(user)
                    await db.flush()
                    created.append(f"user {email}")
                elif user.role != role or not user.is_active:
                    raise SystemExit(
                        f"Existing demo user {email} has a different role or is disabled; no data was changed"
                    )
                users[email] = user

            uk_admin = users["demo.uk@example.com"]
            technician = users["demo.technician@example.com"]
            resident = users["demo.resident@example.com"]

            for user, scoped_role in (
                (uk_admin, "company_admin"),
                (technician, "technician"),
            ):
                membership = await db.scalar(
                    select(CompanyMembership).where(
                        CompanyMembership.user_id == user.id,
                        CompanyMembership.company_id == company.id,
                    )
                )
                if membership is None:
                    db.add(
                        CompanyMembership(
                            user_id=user.id,
                            company_id=company.id,
                            scoped_role=scoped_role,
                            is_active=True,
                        )
                    )
                    created.append(f"{scoped_role} membership")
                elif membership.scoped_role != scoped_role or not membership.is_active:
                    raise SystemExit(
                        f"Existing membership for {user.email} differs or is inactive; no data was changed"
                    )

            binding = await db.scalar(
                select(ResidentBinding).where(
                    ResidentBinding.user_id == resident.id,
                    ResidentBinding.apartment_id == apartment.id,
                )
            )
            if binding is None:
                db.add(
                    ResidentBinding(
                        user_id=resident.id,
                        apartment_id=apartment.id,
                        status="confirmed",
                    )
                )
                created.append("confirmed resident binding")
            elif binding.status != "confirmed":
                raise SystemExit(
                    "Existing demo resident binding is not confirmed; no data was changed"
                )

            account = await db.scalar(
                select(PersonalAccount).where(
                    PersonalAccount.account_number == "DEMO-0001"
                )
            )
            if account is None:
                account = PersonalAccount(
                    apartment_id=apartment.id,
                    account_number="DEMO-0001",
                    source_system="internal",
                    external_id="demo-account-0001",
                    is_active=True,
                )
                db.add(account)
                await db.flush()
                created.append("personal account")
            elif account.apartment_id != apartment.id:
                raise SystemExit(
                    "Demo account number already belongs to another apartment; no data was changed"
                )

            period = date.today().replace(day=1)
            invoice = await db.scalar(
                select(Invoice).where(
                    Invoice.personal_account_id == account.id,
                    Invoice.billing_period == period,
                    Invoice.service_code == "demo-maintenance",
                )
            )
            if invoice is None:
                invoice = Invoice(
                    personal_account_id=account.id,
                    billing_period=period,
                    service_code="demo-maintenance",
                    due_at=datetime.now(timezone.utc) + timedelta(days=14),
                    total_amount=850000,
                    currency="RUB",
                    source_system="internal",
                    external_id=f"demo-maintenance-{period.isoformat()}",
                )
                db.add(invoice)
                await db.flush()
                db.add(
                    InvoiceItem(
                        invoice_id=invoice.id,
                        service_code="demo-maintenance",
                        description="Тестовое содержание общего имущества",
                        quantity=1,
                        unit_price=850000,
                        amount=850000,
                    )
                )
                created.append("unpaid demo invoice")

            title = "Демо-заявка: проверить освещение"
            ticket = await db.scalar(
                select(ServiceTicket).where(
                    ServiceTicket.created_by_id == resident.id,
                    ServiceTicket.apartment_id == apartment.id,
                    ServiceTicket.title == title,
                )
            )
            if ticket is None:
                ticket = ServiceTicket(
                    building_id=building.id,
                    apartment_id=apartment.id,
                    created_by_id=resident.id,
                    title=title,
                    description="Тестовая заявка для показа назначения техника и обновления статуса.",
                    status="assigned",
                    priority="normal",
                )
                db.add(ticket)
                await db.flush()
                db.add_all(
                    [
                        TicketStatusHistory(
                            ticket_id=ticket.id,
                            previous_status=None,
                            new_status="new",
                            changed_by_id=resident.id,
                            comment="Ticket created",
                        ),
                        TicketStatusHistory(
                            ticket_id=ticket.id,
                            previous_status="new",
                            new_status="assigned",
                            changed_by_id=uk_admin.id,
                            comment="Demo technician assigned",
                        ),
                        TicketAssignment(
                            ticket_id=ticket.id,
                            technician_id=technician.id,
                            assigned_by_id=uk_admin.id,
                        ),
                    ]
                )
                created.append("assigned demo ticket")

        print(
            "Demo dataset is ready. Inserted: "
            + (", ".join(created) or "nothing; already present")
        )
        print(
            "Demo logins: demo.platform@example.com, demo.uk@example.com, demo.resident@example.com, demo.technician@example.com"
        )
        print("Use the DEMO_SEED_PASSWORD value for newly created demo users.")
    finally:
        await engine.dispose()


def main() -> None:
    asyncio.run(seed())


if __name__ == "__main__":
    main()
