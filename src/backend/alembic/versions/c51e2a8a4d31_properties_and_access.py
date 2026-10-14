"""Add property model and object-scoped access."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c51e2a8a4d31"
down_revision: Union[str, Sequence[str], None] = "a83f82c4e19a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "management_companies",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "buildings",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("management_company_id", sa.BigInteger(), nullable=False),
        sa.Column("city", sa.String(length=120), nullable=False),
        sa.Column("street", sa.String(length=200), nullable=False),
        sa.Column("house_number", sa.String(length=30), nullable=False),
        sa.Column("building_suffix", sa.String(length=30), server_default="", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["management_company_id"], ["management_companies.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("city", "street", "house_number", "building_suffix", name="uq_building_address"),
    )
    op.create_index("ix_buildings_management_company_id", "buildings", ["management_company_id"])
    op.create_table(
        "entrances",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("building_id", sa.BigInteger(), nullable=False),
        sa.Column("number", sa.String(length=30), nullable=False),
        sa.ForeignKeyConstraint(["building_id"], ["buildings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("building_id", "number", name="uq_entrance_building_number"),
        sa.UniqueConstraint("id", "building_id", name="uq_entrance_id_building"),
    )
    op.create_index("ix_entrances_building_id", "entrances", ["building_id"])
    op.create_table(
        "apartments",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("building_id", sa.BigInteger(), nullable=False),
        sa.Column("entrance_id", sa.BigInteger(), nullable=True),
        sa.Column("number", sa.String(length=30), nullable=False),
        sa.ForeignKeyConstraint(["building_id"], ["buildings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["entrance_id", "building_id"], ["entrances.id", "entrances.building_id"], name="fk_apartment_entrance_building", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("building_id", "number", name="uq_apartment_building_number"),
    )
    op.create_index("ix_apartments_building_id", "apartments", ["building_id"])
    op.create_table(
        "company_memberships",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("company_id", sa.BigInteger(), nullable=False),
        sa.Column("scoped_role", sa.String(length=30), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("scoped_role IN ('company_admin', 'technician')", name="ck_membership_scoped_role"),
        sa.ForeignKeyConstraint(["company_id"], ["management_companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "company_id", name="uq_membership_user_company"),
    )
    op.create_index("ix_company_memberships_company_id", "company_memberships", ["company_id"])
    op.create_index("ix_company_memberships_user_id", "company_memberships", ["user_id"])
    op.create_table(
        "resident_bindings",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("apartment_id", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("status IN ('pending', 'confirmed', 'rejected')", name="ck_binding_status"),
        sa.ForeignKeyConstraint(["apartment_id"], ["apartments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "apartment_id", name="uq_binding_user_apartment"),
    )
    op.create_index("ix_resident_bindings_apartment_id", "resident_bindings", ["apartment_id"])
    op.create_index("ix_resident_bindings_user_id", "resident_bindings", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_resident_bindings_user_id", table_name="resident_bindings")
    op.drop_index("ix_resident_bindings_apartment_id", table_name="resident_bindings")
    op.drop_table("resident_bindings")
    op.drop_index("ix_company_memberships_user_id", table_name="company_memberships")
    op.drop_index("ix_company_memberships_company_id", table_name="company_memberships")
    op.drop_table("company_memberships")
    op.drop_index("ix_apartments_building_id", table_name="apartments")
    op.drop_table("apartments")
    op.drop_index("ix_entrances_building_id", table_name="entrances")
    op.drop_table("entrances")
    op.drop_index("ix_buildings_management_company_id", table_name="buildings")
    op.drop_table("buildings")
    op.drop_table("management_companies")
