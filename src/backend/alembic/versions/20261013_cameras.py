"""Add cameras linked to existing buildings and entrances."""

from alembic import op
import sqlalchemy as sa

revision = "20261013_cameras"
down_revision = "20261013_billing"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cameras",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("building_id", sa.BigInteger(), nullable=False),
        sa.Column("entrance_id", sa.BigInteger(), nullable=True),
        sa.Column("location_description", sa.String(250), nullable=False),
        sa.Column("stream_path", sa.String(200), nullable=False),
        sa.Column("source_type", sa.String(30), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.true(), nullable=False),
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
        sa.ForeignKeyConstraint(["building_id"], ["buildings.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["entrance_id", "building_id"],
            ["entrances.id", "entrances.building_id"],
            name="fk_camera_entrance_building",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("stream_path", name="uq_cameras_stream_path"),
    )
    op.create_index("ix_cameras_building_id", "cameras", ["building_id"])
    op.create_index("ix_cameras_entrance_id", "cameras", ["entrance_id"])


def downgrade() -> None:
    op.drop_index("ix_cameras_entrance_id", table_name="cameras")
    op.drop_index("ix_cameras_building_id", table_name="cameras")
    op.drop_table("cameras")
