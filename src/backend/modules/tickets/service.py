from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.enums import UserRole
from core.settings import get_settings
from modules.access.models import CompanyMembership, ResidentBinding
from modules.access.policy import apartment_scope, building_scope
from modules.properties.models import Apartment, Building
from modules.users.models import User

from .models import (
    ServiceTicket,
    TicketAssignment,
    TicketAttachment,
    TicketStatusHistory,
)

ALLOWED_MIMES = {
    "image/jpeg": lambda b: b.startswith(b"\xff\xd8\xff"),
    "image/png": lambda b: b.startswith(b"\x89PNG\r\n\x1a\n"),
    "image/gif": lambda b: b.startswith((b"GIF87a", b"GIF89a")),
    "image/webp": lambda b: len(b) >= 12 and b[:4] == b"RIFF" and b[8:12] == b"WEBP",
    "video/mp4": lambda b: len(b) >= 12 and b[4:8] == b"ftyp",
    "video/webm": lambda b: b.startswith(b"\x1aE\xdf\xa3"),
}


def is_admin(user: User) -> bool:
    return user.role == UserRole.ADMIN or user.role == UserRole.ADMIN.value


class TicketsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def visibility(self, user: User):
        if is_admin(user):
            return True
        company_admin = exists(
            select(CompanyMembership.id)
            .join(
                Building, Building.management_company_id == CompanyMembership.company_id
            )
            .where(
                CompanyMembership.user_id == user.id,
                CompanyMembership.scoped_role == "company_admin",
                CompanyMembership.is_active.is_(True),
                Building.id == ServiceTicket.building_id,
            )
        )
        resident = exists(
            select(ResidentBinding.id).where(
                ResidentBinding.user_id == user.id,
                ResidentBinding.apartment_id == ServiceTicket.apartment_id,
                ResidentBinding.status == "confirmed",
            )
        )
        assigned_technician = exists(
            select(TicketAssignment.id)
            .join(Building, Building.id == ServiceTicket.building_id)
            .join(
                CompanyMembership,
                and_(
                    CompanyMembership.user_id == TicketAssignment.technician_id,
                    CompanyMembership.company_id == Building.management_company_id,
                ),
            )
            .where(
                TicketAssignment.ticket_id == ServiceTicket.id,
                TicketAssignment.technician_id == user.id,
                TicketAssignment.ended_at.is_(None),
                CompanyMembership.scoped_role == "technician",
                CompanyMembership.is_active.is_(True),
            )
        )
        return or_(
            and_(company_admin),
            and_(resident, ServiceTicket.created_by_id == user.id),
            and_(assigned_technician),
        )

    async def get_ticket(self, ticket_id: int, user: User, *, lock: bool = False):
        query = select(ServiceTicket).where(
            ServiceTicket.id == ticket_id, self.visibility(user)
        )
        if lock:
            query = query.with_for_update()
        result = await self.db.execute(query)
        ticket = result.scalar_one_or_none()
        if ticket is None:
            raise HTTPException(404, "Ticket not found")
        return ticket

    async def list_tickets(
        self,
        user: User,
        *,
        status_filter=None,
        priority=None,
        building_id=None,
        apartment_id=None,
        assigned_to=None,
        created_from=None,
        created_to=None,
        limit=50,
        offset=0,
    ):
        filters = [self.visibility(user)]
        for column, value in (
            (ServiceTicket.status, status_filter),
            (ServiceTicket.priority, priority),
            (ServiceTicket.building_id, building_id),
            (ServiceTicket.apartment_id, apartment_id),
        ):
            if value is not None:
                filters.append(column == value)
        if created_from is not None:
            filters.append(ServiceTicket.created_at >= created_from)
        if created_to is not None:
            filters.append(ServiceTicket.created_at <= created_to)
        if assigned_to is not None:
            filters.append(
                exists(
                    select(TicketAssignment.id).where(
                        TicketAssignment.ticket_id == ServiceTicket.id,
                        TicketAssignment.technician_id == assigned_to,
                        TicketAssignment.ended_at.is_(None),
                    )
                )
            )
        predicate = and_(*filters)
        total = await self.db.scalar(
            select(func.count()).select_from(ServiceTicket).where(predicate)
        )
        result = await self.db.execute(
            select(ServiceTicket)
            .where(predicate)
            .order_by(ServiceTicket.created_at.desc(), ServiceTicket.id.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all()), int(total or 0)

    async def create(
        self, user: User, apartment_id: int, title: str, description: str, priority: str
    ):
        apartment = await self.db.scalar(
            select(Apartment).where(Apartment.id == apartment_id, apartment_scope(user))
        )
        if apartment is None:
            raise HTTPException(404, "Apartment not found")
        binding = await self.db.scalar(
            select(ResidentBinding.id).where(
                ResidentBinding.user_id == user.id,
                ResidentBinding.apartment_id == apartment.id,
                ResidentBinding.status == "confirmed",
            )
        )
        if binding is None and not is_admin(user):
            raise HTTPException(404, "Apartment not found")
        try:
            async with self.db.begin_nested():
                ticket = ServiceTicket(
                    apartment_id=apartment.id,
                    building_id=apartment.building_id,
                    created_by_id=user.id,
                    title=title,
                    description=description,
                    priority=priority,
                    status="new",
                )
                self.db.add(ticket)
                await self.db.flush()
                self.db.add(
                    TicketStatusHistory(
                        ticket_id=ticket.id,
                        previous_status=None,
                        new_status="new",
                        changed_by_id=user.id,
                        comment="Ticket created",
                    )
                )
                await self.db.flush()
            await self.db.commit()
            await self.db.refresh(ticket)
            return ticket
        except Exception:
            await self.db.rollback()
            raise

    async def _require_company_admin(self, user: User, ticket: ServiceTicket):
        if is_admin(user):
            return
        company_id = await self.db.scalar(
            select(Building.management_company_id).where(
                Building.id == ticket.building_id
            )
        )
        membership = await self.db.scalar(
            select(CompanyMembership.id).where(
                CompanyMembership.user_id == user.id,
                CompanyMembership.company_id == company_id,
                CompanyMembership.scoped_role == "company_admin",
                CompanyMembership.is_active.is_(True),
            )
        )
        if membership is None:
            raise HTTPException(404, "Ticket not found")

    async def assign(self, user: User, ticket_id: int, technician_id: int):
        try:
            async with self.db.begin_nested():
                ticket = await self.get_ticket(ticket_id, user, lock=True)
                await self._require_company_admin(user, ticket)
                if ticket.status not in {"new", "assigned", "in_progress"}:
                    raise HTTPException(
                        409, "Closed or resolved tickets cannot be assigned"
                    )
                company_id = await self.db.scalar(
                    select(Building.management_company_id).where(
                        Building.id == ticket.building_id
                    )
                )
                valid_technician = await self.db.scalar(
                    select(CompanyMembership.id).where(
                        CompanyMembership.user_id == technician_id,
                        CompanyMembership.company_id == company_id,
                        CompanyMembership.scoped_role == "technician",
                        CompanyMembership.is_active.is_(True),
                    )
                )
                if valid_technician is None:
                    raise HTTPException(
                        422,
                        "Technician must have an active technician membership in this company",
                    )
                current = await self.db.scalar(
                    select(TicketAssignment)
                    .where(
                        TicketAssignment.ticket_id == ticket.id,
                        TicketAssignment.ended_at.is_(None),
                    )
                    .with_for_update()
                )
                if current and current.technician_id == technician_id:
                    return current
                now = datetime.now(timezone.utc)
                if current:
                    current.ended_at = now
                assignment = TicketAssignment(
                    ticket_id=ticket.id,
                    technician_id=technician_id,
                    assigned_by_id=user.id,
                    assigned_at=now,
                )
                self.db.add(assignment)
                if ticket.status == "new":
                    ticket.status = "assigned"
                    ticket.updated_at = now
                    self.db.add(
                        TicketStatusHistory(
                            ticket_id=ticket.id,
                            previous_status="new",
                            new_status="assigned",
                            changed_by_id=user.id,
                            comment="Technician assigned",
                        )
                    )
                await self.db.flush()
            await self.db.commit()
            await self.db.refresh(assignment)
            return assignment
        except Exception:
            await self.db.rollback()
            raise

    async def transition(
        self, user: User, ticket_id: int, new_status: str, comment: str | None
    ):
        try:
            async with self.db.begin_nested():
                ticket = await self.get_ticket(ticket_id, user, lock=True)
                old = ticket.status
                if old == "assigned" and new_status == "in_progress":
                    await self._require_current_technician(user, ticket)
                elif old == "in_progress" and new_status == "resolved":
                    await self._require_current_technician(user, ticket)
                    if not comment or not comment.strip():
                        raise HTTPException(
                            422, "A comment is required when resolving a ticket"
                        )
                elif old == "resolved" and new_status == "in_progress":
                    await self._require_current_technician(user, ticket)
                    if not comment or not comment.strip():
                        raise HTTPException(
                            422,
                            "A comment is required when returning a ticket for rework",
                        )
                elif old == "resolved" and new_status == "closed":
                    if ticket.created_by_id != user.id and not is_admin(user):
                        await self._require_company_admin(user, ticket)
                elif new_status == "closed" and is_admin(user):
                    if not comment or not comment.strip():
                        raise HTTPException(
                            422, "A comment is required for administrative closure"
                        )
                elif new_status == "closed":
                    await self._require_company_admin(user, ticket)
                    if not comment or not comment.strip():
                        raise HTTPException(
                            422, "A comment is required for administrative closure"
                        )
                else:
                    raise HTTPException(
                        409, f"Transition {old} -> {new_status} is not allowed"
                    )
                now = datetime.now(timezone.utc)
                ticket.status = new_status
                ticket.updated_at = now
                if new_status == "resolved":
                    ticket.resolved_at = now
                elif new_status == "closed":
                    ticket.closed_at = now
                self.db.add(
                    TicketStatusHistory(
                        ticket_id=ticket.id,
                        previous_status=old,
                        new_status=new_status,
                        changed_by_id=user.id,
                        comment=comment,
                    )
                )
                await self.db.flush()
            await self.db.commit()
            await self.db.refresh(ticket)
            return ticket
        except Exception:
            await self.db.rollback()
            raise

    async def _require_current_technician(self, user: User, ticket: ServiceTicket):
        if is_admin(user):
            return
        row = await self.db.scalar(
            select(TicketAssignment.id)
            .join(Building, Building.id == ticket.building_id)
            .join(
                CompanyMembership,
                and_(
                    CompanyMembership.user_id == user.id,
                    CompanyMembership.company_id == Building.management_company_id,
                ),
            )
            .where(
                TicketAssignment.ticket_id == ticket.id,
                TicketAssignment.technician_id == user.id,
                TicketAssignment.ended_at.is_(None),
                CompanyMembership.scoped_role == "technician",
                CompanyMembership.is_active.is_(True),
            )
        )
        if row is None:
            raise HTTPException(404, "Ticket not found")

    async def history(self, ticket_id: int, user: User):
        await self.get_ticket(ticket_id, user)
        rows = await self.db.scalars(
            select(TicketStatusHistory)
            .where(TicketStatusHistory.ticket_id == ticket_id)
            .order_by(TicketStatusHistory.created_at, TicketStatusHistory.id)
        )
        return list(rows.all())

    async def rate(self, user: User, ticket_id: int, rating: int):
        try:
            async with self.db.begin_nested():
                ticket = await self.get_ticket(ticket_id, user, lock=True)
                if ticket.created_by_id != user.id:
                    raise HTTPException(404, "Ticket not found")
                if ticket.status != "closed":
                    raise HTTPException(409, "Only closed tickets can be rated")
                ticket.rating = rating
                await self.db.flush()
            await self.db.commit()
            await self.db.refresh(ticket)
            return ticket
        except Exception:
            await self.db.rollback()
            raise

    async def upload(self, user: User, ticket_id: int, upload: UploadFile):
        settings = get_settings()
        data = await upload.read(settings.TICKET_ATTACHMENT_MAX_BYTES + 1)
        if not data or len(data) > settings.TICKET_ATTACHMENT_MAX_BYTES:
            raise HTTPException(413, "Attachment is empty or exceeds the size limit")
        detected = next(
            (mime for mime, check in ALLOWED_MIMES.items() if check(data)), None
        )
        if detected is None or upload.content_type != detected:
            raise HTTPException(415, "Unsupported or mismatched attachment type")
        original = Path((upload.filename or "attachment").replace("\\", "/")).name
        original = (
            "".join(ch for ch in original if ch.isprintable() and ch not in "\r\n")[
                :255
            ]
            or "attachment"
        )
        key = f"{uuid4().hex}.blob"
        root = settings.TICKET_ATTACHMENT_DIR.resolve()
        target = (root / key).resolve()
        if target.parent != root:
            raise HTTPException(400, "Invalid storage key")
        root.mkdir(parents=True, exist_ok=True)
        try:
            async with self.db.begin_nested():
                ticket = await self.get_ticket(ticket_id, user, lock=True)
                if ticket.status == "closed":
                    raise HTTPException(
                        409, "Closed tickets cannot receive attachments"
                    )
                if ticket.created_by_id != user.id:
                    await self._require_current_technician(user, ticket)
                target.write_bytes(data)
                attachment = TicketAttachment(
                    ticket_id=ticket.id,
                    uploaded_by_id=user.id,
                    original_filename=original,
                    storage_key=key,
                    content_type=detected,
                    size_bytes=len(data),
                )
                self.db.add(attachment)
                await self.db.flush()
            await self.db.commit()
            await self.db.refresh(attachment)
            return attachment
        except Exception:
            target.unlink(missing_ok=True)
            await self.db.rollback()
            raise

    async def attachment(self, user: User, ticket_id: int, attachment_id: int):
        await self.get_ticket(ticket_id, user)
        attachment = await self.db.scalar(
            select(TicketAttachment).where(
                TicketAttachment.id == attachment_id,
                TicketAttachment.ticket_id == ticket_id,
            )
        )
        if attachment is None:
            raise HTTPException(404, "Attachment not found")
        root = get_settings().TICKET_ATTACHMENT_DIR.resolve()
        path = (root / attachment.storage_key).resolve()
        if path.parent != root or not path.is_file():
            raise HTTPException(404, "Attachment not found")
        return attachment, path

    async def list_attachments(self, user: User, ticket_id: int):
        await self.get_ticket(ticket_id, user)
        rows = await self.db.scalars(
            select(TicketAttachment)
            .where(TicketAttachment.ticket_id == ticket_id)
            .order_by(TicketAttachment.created_at, TicketAttachment.id)
        )
        return list(rows.all())

    async def assignment_history(self, user: User, ticket_id: int):
        await self.get_ticket(ticket_id, user)
        rows = await self.db.scalars(
            select(TicketAssignment)
            .where(TicketAssignment.ticket_id == ticket_id)
            .order_by(TicketAssignment.assigned_at, TicketAssignment.id)
        )
        return list(rows.all())
