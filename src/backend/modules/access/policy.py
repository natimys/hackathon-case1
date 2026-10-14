from fastapi import HTTPException, status
from sqlalchemy import exists, select, true
from sqlalchemy.ext.asyncio import AsyncSession

from core.enums import UserRole
from modules.properties.models import Apartment, Building
from modules.users.models import User

from .models import CompanyMembership, ResidentBinding


def _platform_admin(user: User) -> bool:
    return user.role == UserRole.ADMIN or user.role == UserRole.ADMIN.value


def building_scope(user: User):
    """SQL predicate for buildings visible to the user; use in list queries."""
    if _platform_admin(user):
        return true()
    company_access = exists(
        select(CompanyMembership.id).where(
            CompanyMembership.user_id == user.id,
            CompanyMembership.company_id == Building.management_company_id,
            CompanyMembership.is_active.is_(True),
        )
    )
    resident_access = exists(
        select(ResidentBinding.id)
        .join(Apartment, Apartment.id == ResidentBinding.apartment_id)
        .where(
            ResidentBinding.user_id == user.id,
            ResidentBinding.status == "confirmed",
            Apartment.building_id == Building.id,
        )
    )
    return company_access | resident_access


def apartment_scope(user: User):
    """SQL predicate for apartments visible to the user; use in list queries."""
    if _platform_admin(user):
        return true()
    company_access = exists(
        select(CompanyMembership.id)
        .join(Building, Building.management_company_id == CompanyMembership.company_id)
        .where(
            CompanyMembership.user_id == user.id,
            CompanyMembership.is_active.is_(True),
            Building.id == Apartment.building_id,
        )
    )
    resident_access = exists(
        select(ResidentBinding.id).where(
            ResidentBinding.user_id == user.id,
            ResidentBinding.apartment_id == Apartment.id,
            ResidentBinding.status == "confirmed",
        )
    )
    return company_access | resident_access


def financial_apartment_scope(user: User):
    """SQL scope for finances: platform admins, company admins, and residents."""
    if _platform_admin(user):
        return true()
    company_admin_access = exists(
        select(CompanyMembership.id)
        .join(Building, Building.management_company_id == CompanyMembership.company_id)
        .where(
            CompanyMembership.user_id == user.id,
            CompanyMembership.scoped_role == "company_admin",
            CompanyMembership.is_active.is_(True),
            Building.id == Apartment.building_id,
        )
    )
    resident_access = exists(
        select(ResidentBinding.id).where(
            ResidentBinding.user_id == user.id,
            ResidentBinding.apartment_id == Apartment.id,
            ResidentBinding.status == "confirmed",
        )
    )
    return company_admin_access | resident_access


async def require_building_access(
    db: AsyncSession, user: User, building_id: int
) -> Building:
    result = await db.execute(
        select(Building).where(Building.id == building_id, building_scope(user))
    )
    building = result.scalar_one_or_none()
    if building is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Building not found"
        )
    return building


async def require_apartment_access(
    db: AsyncSession, user: User, apartment_id: int
) -> Apartment:
    result = await db.execute(
        select(Apartment).where(Apartment.id == apartment_id, apartment_scope(user))
    )
    apartment = result.scalar_one_or_none()
    if apartment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Apartment not found"
        )
    return apartment


async def require_company_admin(db: AsyncSession, user: User, company_id: int) -> None:
    if _platform_admin(user):
        return
    result = await db.execute(
        select(CompanyMembership.id).where(
            CompanyMembership.user_id == user.id,
            CompanyMembership.company_id == company_id,
            CompanyMembership.scoped_role == "company_admin",
            CompanyMembership.is_active.is_(True),
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company administrator access required",
        )


async def require_company_staff(db: AsyncSession, user: User, company_id: int) -> None:
    if _platform_admin(user):
        return
    result = await db.execute(
        select(CompanyMembership.id).where(
            CompanyMembership.user_id == user.id,
            CompanyMembership.company_id == company_id,
            CompanyMembership.is_active.is_(True),
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Company access required"
        )
