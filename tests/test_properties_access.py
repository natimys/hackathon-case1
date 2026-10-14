from datetime import datetime
from pathlib import Path

import pytest
from sqlalchemy import create_engine, event, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.enums import UserRole
from database.base import Base
from database.bootstrap import bootstrap_models
from modules.access.models import CompanyMembership, ResidentBinding
from modules.access.policy import apartment_scope, building_scope, require_company_admin
from modules.access.schemas import MembershipCreate, ScopedRole
from modules.access.router import create_membership
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


def user(user_id: int, role: UserRole = UserRole.USER) -> User:
    return User(
        id=user_id,
        email=f"user{user_id}@example.com",
        name=f"User {user_id}",
        password="hashed",
        role=role,
        is_active=True,
        session_version=0,
        created_at=datetime.now(),
    )


@pytest.fixture
def properties(db):
    db.add_all([user(1), user(2), user(3), user(4, UserRole.ADMIN)])
    company_a = ManagementCompany(id=10, name="Company A")
    company_b = ManagementCompany(id=20, name="Company B")
    db.add_all([company_a, company_b])
    db.flush()
    building_a = Building(
        id=100,
        management_company_id=10,
        city="Yakutsk",
        street="Lenina",
        house_number="1",
    )
    building_b = Building(
        id=200,
        management_company_id=20,
        city="Yakutsk",
        street="Lenina",
        house_number="2",
    )
    db.add_all([building_a, building_b])
    db.flush()
    entrance_a = Entrance(id=1000, building_id=100, number="1")
    entrance_b = Entrance(id=2000, building_id=200, number="1")
    db.add_all([entrance_a, entrance_b])
    db.flush()
    apartment_a = Apartment(id=10000, building_id=100, entrance_id=1000, number="1")
    apartment_b = Apartment(id=20000, building_id=200, entrance_id=2000, number="1")
    db.add_all([apartment_a, apartment_b])
    db.flush()
    return building_a, building_b, apartment_a, apartment_b


def test_buildings_entrances_and_apartments_create(db, properties):
    building_a, _, apartment_a, _ = properties
    assert db.get(Building, building_a.id).management_company_id == 10
    assert db.get(Entrance, 1000).building_id == building_a.id
    assert db.get(Apartment, apartment_a.id).number == "1"


def test_apartment_number_is_unique_within_building(db, properties):
    with pytest.raises(IntegrityError):
        db.add(Apartment(id=10001, building_id=100, entrance_id=1000, number="1"))
        db.flush()


def test_apartment_cannot_reference_an_entrance_from_another_building(db, properties):
    with pytest.raises(IntegrityError):
        db.add(Apartment(id=10002, building_id=100, entrance_id=2000, number="2"))
        db.flush()


def test_confirmed_resident_can_access_bound_apartment_only(db, properties):
    _, _, apartment_a, _ = properties
    db.add(
        ResidentBinding(
            id=30000, user_id=1, apartment_id=apartment_a.id, status="confirmed"
        )
    )
    db.flush()
    assert [
        a.id for a in db.scalars(select(Apartment).where(apartment_scope(user(1))))
    ] == [10000]
    assert (
        db.scalars(
            select(Apartment).where(Apartment.id == 20000, apartment_scope(user(1)))
        ).first()
        is None
    )


def test_two_management_companies_are_isolated(db, properties):
    db.add(
        CompanyMembership(
            id=31000, user_id=1, company_id=10, scoped_role="technician", is_active=True
        )
    )
    db.flush()
    visible = list(db.scalars(select(Building).where(building_scope(user(1)))))
    assert [b.id for b in visible] == [100]


def test_company_admin_scope_is_company_specific(db, properties):
    db.add(
        CompanyMembership(
            id=32000,
            user_id=1,
            company_id=10,
            scoped_role="company_admin",
            is_active=True,
        )
    )
    db.flush()

    class Result:
        def __init__(self, statement):
            self.statement = statement

        def scalar_one_or_none(self):
            return db.scalar(self.statement)

    class AsyncSessionAdapter:
        async def execute(self, statement):
            return Result(statement)

    import asyncio

    asyncio.run(require_company_admin(AsyncSessionAdapter(), user(1), 10))
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as error:
        asyncio.run(require_company_admin(AsyncSessionAdapter(), user(1), 20))
    assert error.value.status_code == 403


def test_company_admin_cannot_assign_company_admin_role():
    with pytest.raises(Exception):
        MembershipCreate(user_id=1, company_id=10, scoped_role="platform_admin")
    assert MembershipCreate(user_id=1, company_id=10, scoped_role=ScopedRole.TECHNICIAN)


def test_company_admin_cannot_promote_self_through_membership_payload():
    import asyncio

    from fastapi import HTTPException

    with pytest.raises(HTTPException) as error:
        asyncio.run(
            create_membership(
                MembershipCreate(
                    user_id=1, company_id=10, scoped_role=ScopedRole.COMPANY_ADMIN
                ),
                user=user(1),
                db=object(),
                service=object(),
            )
        )
    assert error.value.status_code == 403


def test_inactive_membership_grants_no_object_access(db, properties):
    db.add(
        CompanyMembership(
            id=33000,
            user_id=1,
            company_id=10,
            scoped_role="technician",
            is_active=False,
        )
    )
    db.flush()
    assert list(db.scalars(select(Building).where(building_scope(user(1))))) == []


def test_platform_admin_has_explicit_global_object_access(db, properties):
    buildings = list(
        db.scalars(select(Building).where(building_scope(user(4, UserRole.ADMIN))))
    )
    apartments = list(
        db.scalars(select(Apartment).where(apartment_scope(user(4, UserRole.ADMIN))))
    )
    assert {b.id for b in buildings} == {100, 200}
    assert {a.id for a in apartments} == {10000, 20000}


def test_list_filters_are_database_predicates(db, properties):
    db.add(ResidentBinding(id=34000, user_id=2, apartment_id=10000, status="confirmed"))
    db.flush()
    statement = select(Apartment).where(apartment_scope(user(2)))
    assert [apartment.id for apartment in db.scalars(statement)] == [10000]


def test_model_registration_and_migration_revision():
    bootstrap_models()
    expected = {
        "management_companies",
        "buildings",
        "entrances",
        "apartments",
        "company_memberships",
        "resident_bindings",
        "users",
    }
    assert expected.issubset(Base.metadata.tables)
    migration = (
        Path(__file__).parents[1]
        / "src/backend/alembic/versions/c51e2a8a4d31_properties_and_access.py"
    )
    assert migration.exists()
    source = migration.read_text(encoding="utf-8")
    assert 'down_revision: Union[str, Sequence[str], None] = "a83f82c4e19a"' in source
    assert '"fk_apartment_entrance_building"' in source


def test_disabled_module_models_remain_in_alembic_metadata(monkeypatch):
    from core.modules import ModuleDefinition
    from modules.properties import module as properties_module

    properties_module.module = ModuleDefinition(
        active=False,
        name="properties",
        router_prefix="/properties",
        router_tags=["properties"],
    )
    try:
        bootstrap_models()
        assert "buildings" in Base.metadata.tables
    finally:
        properties_module.module = ModuleDefinition(
            active=True,
            name="properties",
            router_prefix="/properties",
            router_tags=["properties"],
        )
