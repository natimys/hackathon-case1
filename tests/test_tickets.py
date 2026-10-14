from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

from core.enums import UserRole
from modules.access.policy import apartment_scope, building_scope
from modules.properties.models import Apartment
from modules.tickets.models import ServiceTicket, TicketStatusHistory
from modules.tickets.schemas import TicketCreate, TicketTransition
from modules.tickets.service import TicketsService
from modules.users.models import User


class NestedTransaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return False


@pytest.fixture
def anyio_backend():
    return "asyncio"


def fake_db():
    return SimpleNamespace(
        begin_nested=lambda: NestedTransaction(),
        flush=AsyncMock(),
        commit=AsyncMock(),
        rollback=AsyncMock(),
        refresh=AsyncMock(),
        add=Mock(),
    )


def make_user(user_id=7, role=UserRole.USER):
    return User(
        id=user_id, role=role, email=f"u{user_id}@example.com", name="U", password="x"
    )


def test_ticket_requires_apartment_and_building_pair():
    ddl = str(
        CreateTable(ServiceTicket.__table__).compile(dialect=postgresql.dialect())
    )
    assert "fk_ticket_apartment_building" in ddl
    assert "FOREIGN KEY(apartment_id, building_id)" in ddl


def test_apartment_pair_is_unique_for_ticket_foreign_key():
    assert any(
        constraint.name == "uq_apartment_id_building"
        for constraint in Apartment.__table__.constraints
    )


def test_create_payload_cannot_supply_creator_or_building():
    payload = TicketCreate(
        apartment_id=1, title="Broken light", description="Hall light is out"
    )
    assert "created_by_id" not in payload.model_dump()
    assert "building_id" not in payload.model_dump()
    with pytest.raises(ValueError):
        TicketCreate(
            apartment_id=1,
            building_id=2,
            title="Broken light",
            description="Hall light is out",
        )


def test_transition_payload_has_no_arbitrary_status():
    with pytest.raises(ValueError):
        TicketTransition(status="new")
    assert TicketTransition(status="resolved", comment="Fixed").status == "resolved"


def test_access_policy_is_sql_filter_not_python_filter():
    user = make_user()
    building_sql = str(building_scope(user).compile(dialect=postgresql.dialect()))
    apartment_sql = str(apartment_scope(user).compile(dialect=postgresql.dialect()))
    assert "resident_bindings" in building_sql and "company_memberships" in building_sql
    assert (
        "resident_bindings" in apartment_sql and "company_memberships" in apartment_sql
    )


def test_ticket_visibility_query_compiles_for_postgresql():
    query = select(ServiceTicket).where(TicketsService(None).visibility(make_user()))

    compiled = str(query.compile(dialect=postgresql.dialect()))

    assert "company_memberships" in compiled
    assert "resident_bindings" in compiled
    assert "ticket_assignments" in compiled


@pytest.mark.anyio
async def test_invalid_transition_rejected_and_does_not_change_ticket():
    db = fake_db()
    service = TicketsService(db)
    ticket = SimpleNamespace(id=1, status="new")

    async def get_ticket(*args, **kwargs):
        return ticket

    service.get_ticket = get_ticket
    with pytest.raises(HTTPException) as exc:
        await service.transition(make_user(), 1, "resolved", "done")
    assert exc.value.status_code == 409
    assert ticket.status == "new"


@pytest.mark.anyio
async def test_status_transition_writes_history_atomically():
    db = fake_db()
    service = TicketsService(db)
    ticket = SimpleNamespace(
        id=1,
        status="in_progress",
        updated_at=None,
        resolved_at=None,
        closed_at=None,
    )

    async def get_ticket(*args, **kwargs):
        return ticket

    async def require_technician(*args, **kwargs):
        return None

    service.get_ticket = get_ticket
    service._require_current_technician = require_technician
    result = await service.transition(make_user(), 1, "resolved", "Replaced bulb")
    history = next(
        call.args[0]
        for call in db.add.call_args_list
        if isinstance(call.args[0], TicketStatusHistory)
    )
    assert result.status == "resolved"
    assert history.previous_status == "in_progress"
    assert history.new_status == "resolved"
    assert history.comment == "Replaced bulb"
    db.commit.assert_awaited_once()


@pytest.mark.anyio
async def test_resolving_requires_comment():
    db = fake_db()
    service = TicketsService(db)
    ticket = SimpleNamespace(id=1, status="in_progress")

    async def get_ticket(*args, **kwargs):
        return ticket

    async def require_technician(*args, **kwargs):
        return None

    service.get_ticket = get_ticket
    service._require_current_technician = require_technician
    with pytest.raises(HTTPException) as exc:
        await service.transition(make_user(), 1, "resolved", " ")
    assert exc.value.status_code == 422
    assert ticket.status == "in_progress"


@pytest.mark.anyio
async def test_upload_rejects_extension_or_mime_spoof_before_storage(
    monkeypatch, tmp_path
):
    from modules.tickets import service as service_module

    monkeypatch.setattr(
        service_module,
        "get_settings",
        lambda: SimpleNamespace(
            TICKET_ATTACHMENT_MAX_BYTES=100, TICKET_ATTACHMENT_DIR=Path(tmp_path)
        ),
    )
    upload = UploadFile(
        filename="../payload.jpg",
        file=__import__("io").BytesIO(b"not an image"),
        headers={"content-type": "image/jpeg"},
    )

    with pytest.raises(HTTPException) as exc:
        await TicketsService(fake_db()).upload(make_user(), 1, upload)
    assert exc.value.status_code == 415
    assert list(tmp_path.iterdir()) == []


def test_role_predicates_use_global_admin_shortcut():
    admin = make_user(role=UserRole.ADMIN)
    assert building_scope(admin) is not None
    assert apartment_scope(admin) is not None
