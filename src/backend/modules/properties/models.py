from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base


class ManagementCompany(Base):
    __tablename__ = "management_companies"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Building(Base):
    __tablename__ = "buildings"
    __table_args__ = (
        UniqueConstraint(
            "city",
            "street",
            "house_number",
            "building_suffix",
            name="uq_building_address",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    management_company_id: Mapped[int] = mapped_column(
        ForeignKey("management_companies.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    city: Mapped[str] = mapped_column(String(120), nullable=False)
    street: Mapped[str] = mapped_column(String(200), nullable=False)
    house_number: Mapped[str] = mapped_column(String(30), nullable=False)
    building_suffix: Mapped[str] = mapped_column(
        String(30), nullable=False, default="", server_default=""
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Entrance(Base):
    __tablename__ = "entrances"
    __table_args__ = (
        UniqueConstraint("building_id", "number", name="uq_entrance_building_number"),
        UniqueConstraint("id", "building_id", name="uq_entrance_id_building"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    building_id: Mapped[int] = mapped_column(
        ForeignKey("buildings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    number: Mapped[str] = mapped_column(String(30), nullable=False)


class Apartment(Base):
    __tablename__ = "apartments"
    __table_args__ = (
        UniqueConstraint("building_id", "number", name="uq_apartment_building_number"),
        UniqueConstraint("id", "building_id", name="uq_apartment_id_building"),
        # Composite FK guarantees the entrance belongs to the same building.
        ForeignKeyConstraint(
            ["entrance_id", "building_id"],
            ["entrances.id", "entrances.building_id"],
            name="fk_apartment_entrance_building",
            ondelete="RESTRICT",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    building_id: Mapped[int] = mapped_column(
        ForeignKey("buildings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entrance_id: Mapped[int | None] = mapped_column(BigInteger)
    number: Mapped[str] = mapped_column(String(30), nullable=False)
