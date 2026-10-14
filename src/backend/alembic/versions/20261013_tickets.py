"""Create service ticket workflow tables."""

from alembic import op
import sqlalchemy as sa

revision = "20261013_tickets"
down_revision = "c51e2a8a4d31"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_apartment_id_building", "apartments", ["id", "building_id"]
    )
    op.create_table(
        "service_tickets",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("building_id", sa.BigInteger(), nullable=False),
        sa.Column("apartment_id", sa.BigInteger(), nullable=False),
        sa.Column("created_by_id", sa.BigInteger(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), server_default="new", nullable=False),
        sa.Column("priority", sa.String(20), server_default="normal", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "status IN ('new', 'assigned', 'in_progress', 'resolved', 'closed')",
            name="ck_ticket_status",
        ),
        sa.CheckConstraint(
            "priority IN ('low', 'normal', 'high', 'urgent')", name="ck_ticket_priority"
        ),
        sa.CheckConstraint(
            "rating IS NULL OR rating BETWEEN 1 AND 5", name="ck_ticket_rating"
        ),
        sa.ForeignKeyConstraint(
            ["apartment_id", "building_id"],
            ["apartments.id", "apartments.building_id"],
            name="fk_ticket_apartment_building",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(["building_id"], ["buildings.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_service_tickets_created_by_id", "service_tickets", ["created_by_id"]
    )
    op.create_index(
        "ix_service_tickets_building_created",
        "service_tickets",
        ["building_id", "created_at"],
    )
    op.create_index(
        "ix_service_tickets_status_created", "service_tickets", ["status", "created_at"]
    )
    op.create_table(
        "ticket_assignments",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("ticket_id", sa.BigInteger(), nullable=False),
        sa.Column("technician_id", sa.BigInteger(), nullable=False),
        sa.Column("assigned_by_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["ticket_id"], ["service_tickets.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["technician_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["assigned_by_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ticket_assignments_ticket_id", "ticket_assignments", ["ticket_id"]
    )
    op.create_index(
        "ix_ticket_assignments_technician_open",
        "ticket_assignments",
        ["technician_id", "ended_at"],
    )
    op.create_table(
        "ticket_status_history",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("ticket_id", sa.BigInteger(), nullable=False),
        sa.Column("previous_status", sa.String(20), nullable=True),
        sa.Column("new_status", sa.String(20), nullable=False),
        sa.Column("changed_by_id", sa.BigInteger(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["ticket_id"], ["service_tickets.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["changed_by_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ticket_history_ticket_created",
        "ticket_status_history",
        ["ticket_id", "created_at"],
    )
    op.create_table(
        "ticket_attachments",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("ticket_id", sa.BigInteger(), nullable=False),
        sa.Column("uploaded_by_id", sa.BigInteger(), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("storage_key", sa.String(80), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("size_bytes > 0", name="ck_attachment_size"),
        sa.ForeignKeyConstraint(
            ["ticket_id"], ["service_tickets.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_key"),
    )
    op.create_index(
        "ix_ticket_attachments_ticket_id", "ticket_attachments", ["ticket_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_ticket_attachments_ticket_id", table_name="ticket_attachments")
    op.drop_table("ticket_attachments")
    op.drop_index(
        "ix_ticket_history_ticket_created", table_name="ticket_status_history"
    )
    op.drop_table("ticket_status_history")
    op.drop_index(
        "ix_ticket_assignments_technician_open", table_name="ticket_assignments"
    )
    op.drop_index("ix_ticket_assignments_ticket_id", table_name="ticket_assignments")
    op.drop_table("ticket_assignments")
    op.drop_index("ix_service_tickets_status_created", table_name="service_tickets")
    op.drop_index("ix_service_tickets_building_created", table_name="service_tickets")
    op.drop_index("ix_service_tickets_created_by_id", table_name="service_tickets")
    op.drop_table("service_tickets")
    op.drop_constraint("uq_apartment_id_building", "apartments", type_="unique")
