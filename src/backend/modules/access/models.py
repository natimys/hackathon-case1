from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base


class CompanyMembership(Base):
    __tablename__ = "company_memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "company_id", name="uq_membership_user_company"),
        CheckConstraint(
            "scoped_role IN ('company_admin', 'technician')",
            name="ck_membership_scoped_role",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[int] = mapped_column(
        ForeignKey("management_companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scoped_role: Mapped[str] = mapped_column(String(30), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ResidentBinding(Base):
    __tablename__ = "resident_bindings"
    __table_args__ = (
        UniqueConstraint("user_id", "apartment_id", name="uq_binding_user_apartment"),
        CheckConstraint(
            "status IN ('pending', 'confirmed', 'rejected')", name="ck_binding_status"
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    apartment_id: Mapped[int] = mapped_column(
        ForeignKey("apartments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="pending"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
