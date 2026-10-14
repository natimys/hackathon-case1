from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base


class Camera(Base):
    __tablename__ = "cameras"
    __table_args__ = (
        ForeignKeyConstraint(
            ["entrance_id", "building_id"],
            ["entrances.id", "entrances.building_id"],
            name="fk_camera_entrance_building",
            ondelete="RESTRICT",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    building_id: Mapped[int] = mapped_column(
        ForeignKey("buildings.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    entrance_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, index=True
    )
    location_description: Mapped[str] = mapped_column(String(250), nullable=False)
    stream_path: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    source_type: Mapped[str] = mapped_column(String(30), nullable=False, default="rtsp")
    enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
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
