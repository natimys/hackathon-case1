from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base


class ServiceTicket(Base):
    __tablename__ = "service_tickets"
    __table_args__ = (
        ForeignKeyConstraint(
            ["apartment_id", "building_id"],
            ["apartments.id", "apartments.building_id"],
            name="fk_ticket_apartment_building",
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "status IN ('new', 'assigned', 'in_progress', 'resolved', 'closed')",
            name="ck_ticket_status",
        ),
        CheckConstraint(
            "priority IN ('low', 'normal', 'high', 'urgent')", name="ck_ticket_priority"
        ),
        CheckConstraint(
            "rating IS NULL OR rating BETWEEN 1 AND 5", name="ck_ticket_rating"
        ),
        Index("ix_service_tickets_building_created", "building_id", "created_at"),
        Index("ix_service_tickets_status_created", "status", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    building_id: Mapped[int] = mapped_column(
        ForeignKey("buildings.id", ondelete="RESTRICT"), nullable=False
    )
    apartment_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="new"
    )
    priority: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="normal"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rating: Mapped[int | None] = mapped_column(Integer)


class TicketAssignment(Base):
    __tablename__ = "ticket_assignments"
    __table_args__ = (
        Index("ix_ticket_assignments_technician_open", "technician_id", "ended_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    ticket_id: Mapped[int] = mapped_column(
        ForeignKey("service_tickets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    technician_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    assigned_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TicketStatusHistory(Base):
    __tablename__ = "ticket_status_history"
    __table_args__ = (
        Index("ix_ticket_history_ticket_created", "ticket_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    ticket_id: Mapped[int] = mapped_column(
        ForeignKey("service_tickets.id", ondelete="CASCADE"), nullable=False
    )
    previous_status: Mapped[str | None] = mapped_column(String(20))
    new_status: Mapped[str] = mapped_column(String(20), nullable=False)
    changed_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class TicketAttachment(Base):
    __tablename__ = "ticket_attachments"
    __table_args__ = (CheckConstraint("size_bytes > 0", name="ck_attachment_size"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    ticket_id: Mapped[int] = mapped_column(
        ForeignKey("service_tickets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    uploaded_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
