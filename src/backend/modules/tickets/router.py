from datetime import datetime

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import FileResponse

from core.dependencies import get_current_user
from modules.users.models import User

from .dependencies import get_tickets_service
from .module import module
from .schemas import (
    TicketAssignmentCreate,
    TicketAssignmentRead,
    TicketAttachmentRead,
    TicketCreate,
    TicketHistoryRead,
    TicketPage,
    TicketRating,
    TicketRead,
    TicketTransition,
)
from .service import TicketsService

router = APIRouter(prefix=module.router_prefix, tags=module.router_tags)


@router.post("", response_model=TicketRead, status_code=201)
async def create_ticket(
    data: TicketCreate,
    user: User = Depends(get_current_user),
    service: TicketsService = Depends(get_tickets_service),
):
    return await service.create(user, **data.model_dump())


@router.get("", response_model=TicketPage)
async def list_tickets(
    status_filter: str | None = Query(default=None, alias="status"),
    priority: str | None = None,
    building_id: int | None = None,
    apartment_id: int | None = None,
    assigned_to: int | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    service: TicketsService = Depends(get_tickets_service),
):
    items, total = await service.list_tickets(
        user,
        status_filter=status_filter,
        priority=priority,
        building_id=building_id,
        apartment_id=apartment_id,
        assigned_to=assigned_to,
        created_from=created_from,
        created_to=created_to,
        limit=limit,
        offset=offset,
    )
    return TicketPage(items=items, total=total, limit=limit, offset=offset)


@router.get("/{ticket_id}", response_model=TicketRead)
async def get_ticket(
    ticket_id: int,
    user: User = Depends(get_current_user),
    service: TicketsService = Depends(get_tickets_service),
):
    return await service.get_ticket(ticket_id, user)


@router.get("/{ticket_id}/history", response_model=list[TicketHistoryRead])
async def ticket_history(
    ticket_id: int,
    user: User = Depends(get_current_user),
    service: TicketsService = Depends(get_tickets_service),
):
    return await service.history(ticket_id, user)


@router.post(
    "/{ticket_id}/assignments", response_model=TicketAssignmentRead, status_code=201
)
async def assign_ticket(
    ticket_id: int,
    data: TicketAssignmentCreate,
    user: User = Depends(get_current_user),
    service: TicketsService = Depends(get_tickets_service),
):
    return await service.assign(user, ticket_id, data.technician_id)


@router.get("/{ticket_id}/assignments", response_model=list[TicketAssignmentRead])
async def assignment_history(
    ticket_id: int,
    user: User = Depends(get_current_user),
    service: TicketsService = Depends(get_tickets_service),
):
    return await service.assignment_history(user, ticket_id)


@router.post("/{ticket_id}/transitions", response_model=TicketRead)
async def transition_ticket(
    ticket_id: int,
    data: TicketTransition,
    user: User = Depends(get_current_user),
    service: TicketsService = Depends(get_tickets_service),
):
    return await service.transition(user, ticket_id, data.status, data.comment)


@router.post(
    "/{ticket_id}/attachments", response_model=TicketAttachmentRead, status_code=201
)
async def upload_attachment(
    ticket_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    service: TicketsService = Depends(get_tickets_service),
):
    attachment = await service.upload(user, ticket_id, file)
    return attachment


@router.get("/{ticket_id}/attachments", response_model=list[TicketAttachmentRead])
async def list_attachments(
    ticket_id: int,
    user: User = Depends(get_current_user),
    service: TicketsService = Depends(get_tickets_service),
):
    return await service.list_attachments(user, ticket_id)


@router.get("/{ticket_id}/attachments/{attachment_id}")
async def download_attachment(
    ticket_id: int,
    attachment_id: int,
    user: User = Depends(get_current_user),
    service: TicketsService = Depends(get_tickets_service),
):
    attachment, path = await service.attachment(user, ticket_id, attachment_id)
    return FileResponse(
        path,
        media_type=attachment.content_type,
        filename=attachment.original_filename,
        content_disposition_type="attachment",
        headers={"X-Content-Type-Options": "nosniff"},
    )


@router.post("/{ticket_id}/rating", response_model=TicketRead)
async def rate_ticket(
    ticket_id: int,
    data: TicketRating,
    user: User = Depends(get_current_user),
    service: TicketsService = Depends(get_tickets_service),
):
    return await service.rate(user, ticket_id, data.rating)
