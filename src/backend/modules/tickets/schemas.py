from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class TicketCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    apartment_id: int
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=3, max_length=10000)
    priority: Literal["low", "normal", "high", "urgent"] = "normal"


class TicketRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    building_id: int
    apartment_id: int
    created_by_id: int
    title: str
    description: str
    status: str
    priority: str
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None
    closed_at: datetime | None
    rating: int | None


class TicketTransition(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["in_progress", "resolved", "closed"]
    comment: str | None = Field(default=None, max_length=2000)


class TicketAssignmentCreate(BaseModel):
    technician_id: int


class TicketHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    previous_status: str | None
    new_status: str
    changed_by_id: int
    comment: str | None
    created_at: datetime


class TicketAssignmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    technician_id: int
    assigned_by_id: int
    assigned_at: datetime
    ended_at: datetime | None


class TicketAttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    uploaded_by_id: int
    original_filename: str
    content_type: str
    size_bytes: int
    created_at: datetime


class TicketRating(BaseModel):
    rating: int = Field(ge=1, le=5)


class TicketPage(BaseModel):
    items: list[TicketRead]
    total: int
    limit: int
    offset: int
