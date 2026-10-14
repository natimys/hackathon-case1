from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user
from database.dependencies import get_db
from modules.properties.models import Apartment, Building, ManagementCompany
from modules.users.models import User

from .dependencies import get_access_service
from .models import CompanyMembership, ResidentBinding
from .module import module
from .policy import _platform_admin, require_building_access, require_company_admin
from .schemas import (
    MembershipCreate,
    MembershipRead,
    MembershipUpdate,
    AccessScopesRead,
    ResidentBindingCreate,
    ResidentBindingRead,
    ResidentBindingUpdate,
    TechnicianRead,
)
from .service import AccessService

router = APIRouter(prefix=module.router_prefix, tags=module.router_tags)


@router.get("/me/scopes", response_model=AccessScopesRead)
async def my_scopes(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    memberships = await db.scalars(
        select(CompanyMembership.scoped_role).where(
            CompanyMembership.user_id == user.id,
            CompanyMembership.is_active.is_(True),
        ).distinct()
    )
    resident = await db.scalar(
        select(ResidentBinding.id).where(
            ResidentBinding.user_id == user.id,
            ResidentBinding.status == "confirmed",
        ).limit(1)
    )
    return AccessScopesRead(
        user_id=user.id,
        is_platform_admin=_platform_admin(user),
        scoped_roles=list(memberships.all()),
        is_resident=resident is not None,
    )


@router.get("/buildings/{building_id}/technicians", response_model=list[TechnicianRead])
async def list_building_technicians(
    building_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    building = await require_building_access(db, user, building_id)
    if not _platform_admin(user):
        await require_company_admin(db, user, building.management_company_id)
    rows = await db.execute(
        select(User.id, User.name)
        .join(CompanyMembership, CompanyMembership.user_id == User.id)
        .where(
            CompanyMembership.company_id == building.management_company_id,
            CompanyMembership.scoped_role == "technician",
            CompanyMembership.is_active.is_(True),
            User.is_active.is_(True),
        )
        .order_by(User.name, User.id)
    )
    return [TechnicianRead(id=row.id, name=row.name) for row in rows]


@router.post("/memberships", response_model=MembershipRead, status_code=201)
async def create_membership(
    data: MembershipCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    service: AccessService = Depends(get_access_service),
):
    if not _platform_admin(user) and data.scoped_role.value != "technician":
        raise HTTPException(
            status_code=403,
            detail="Only platform administrators can assign company administrators",
        )
    if not _platform_admin(user):
        await require_company_admin(db, user, data.company_id)
    if await db.get(ManagementCompany, data.company_id) is None:
        raise HTTPException(status_code=404, detail="Management company not found")
    if await db.get(User, data.user_id) is None:
        raise HTTPException(status_code=404, detail="User not found")
    return await service.create_membership(
        user_id=data.user_id,
        company_id=data.company_id,
        scoped_role=data.scoped_role.value,
        is_active=True,
    )


@router.patch("/memberships/{membership_id}", response_model=MembershipRead)
async def update_membership(
    membership_id: int,
    data: MembershipUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    service: AccessService = Depends(get_access_service),
):
    membership = await db.get(CompanyMembership, membership_id)
    if membership is None:
        raise HTTPException(status_code=404, detail="Membership not found")
    await require_company_admin(db, user, membership.company_id)
    if not _platform_admin(user) and membership.scoped_role == "company_admin":
        raise HTTPException(
            status_code=403,
            detail="Only platform administrators can manage company administrators",
        )
    updated = await service.update_membership(membership_id, is_active=data.is_active)
    return updated


@router.post("/resident-bindings", response_model=ResidentBindingRead, status_code=201)
async def create_resident_binding(
    data: ResidentBindingCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    service: AccessService = Depends(get_access_service),
):
    apartment = await db.get(Apartment, data.apartment_id)
    if apartment is None:
        raise HTTPException(status_code=404, detail="Apartment not found")
    building = await db.get(Building, apartment.building_id)
    if building is None:
        raise HTTPException(status_code=404, detail="Building not found")
    await require_company_admin(db, user, building.management_company_id)
    if await db.get(User, data.user_id) is None:
        raise HTTPException(status_code=404, detail="User not found")
    return await service.create_binding(
        user_id=data.user_id,
        apartment_id=data.apartment_id,
        status=data.status.value,
    )


@router.patch("/resident-bindings/{binding_id}", response_model=ResidentBindingRead)
async def update_resident_binding(
    binding_id: int,
    data: ResidentBindingUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    service: AccessService = Depends(get_access_service),
):
    binding = await db.get(ResidentBinding, binding_id)
    if binding is None:
        raise HTTPException(status_code=404, detail="Resident binding not found")
    apartment = await db.get(Apartment, binding.apartment_id)
    if apartment is None:
        raise HTTPException(status_code=404, detail="Apartment not found")
    building = await db.get(Building, apartment.building_id)
    if building is None:
        raise HTTPException(status_code=404, detail="Building not found")
    await require_company_admin(db, user, building.management_company_id)
    updated = await service.update_binding(binding_id, status=data.status.value)
    return updated
