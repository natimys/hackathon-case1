from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user
from core.enums import UserRole
from database.dependencies import get_db
from modules.access.policy import (
    require_apartment_access,
    require_building_access,
    require_company_admin,
)
from modules.users.models import User

from .dependencies import get_properties_service
from .module import module
from .models import Building, ManagementCompany
from .schemas import (
    ApartmentCreate,
    ApartmentRead,
    BuildingCreate,
    BuildingRead,
    CompanyCreate,
    CompanyRead,
    EntranceCreate,
    EntranceRead,
)
from .service import PropertiesService

router = APIRouter(prefix=module.router_prefix, tags=module.router_tags)


async def _commit_error(operation):
    try:
        return await operation
    except IntegrityError:
        raise HTTPException(status_code=409, detail="Conflicting property data")


@router.get("/buildings", response_model=list[BuildingRead])
async def list_buildings(
    user: User = Depends(get_current_user),
    service: PropertiesService = Depends(get_properties_service),
):
    return await service.list_buildings(user)


@router.get("/apartments", response_model=list[ApartmentRead])
async def list_apartments(
    building_id: int | None = Query(default=None),
    user: User = Depends(get_current_user),
    service: PropertiesService = Depends(get_properties_service),
):
    return await service.list_apartments(user, building_id)


@router.get("/buildings/{building_id}", response_model=BuildingRead)
async def get_building(
    building_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await require_building_access(db, user, building_id)


@router.get("/apartments/{apartment_id}", response_model=ApartmentRead)
async def get_apartment(
    apartment_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await require_apartment_access(db, user, apartment_id)


@router.post("/companies", response_model=CompanyRead, status_code=201)
async def create_company(
    data: CompanyCreate,
    user: User = Depends(get_current_user),
    service: PropertiesService = Depends(get_properties_service),
):
    if user.role != UserRole.ADMIN and user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=403, detail="Platform administrator access required"
        )
    return await _commit_error(service.create_company(data.name))


@router.post("/buildings", response_model=BuildingRead, status_code=201)
async def create_building(
    data: BuildingCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    service: PropertiesService = Depends(get_properties_service),
):
    company = await db.get(ManagementCompany, data.management_company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Management company not found")
    await require_company_admin(db, user, company.id)
    return await _commit_error(service.create_building(**data.model_dump()))


@router.post("/entrances", response_model=EntranceRead, status_code=201)
async def create_entrance(
    data: EntranceCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    service: PropertiesService = Depends(get_properties_service),
):
    building = await db.get(Building, data.building_id)
    if building is None:
        raise HTTPException(status_code=404, detail="Building not found")
    await require_company_admin(db, user, building.management_company_id)
    return await _commit_error(service.create_entrance(**data.model_dump()))


@router.post("/apartments", response_model=ApartmentRead, status_code=201)
async def create_apartment(
    data: ApartmentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    service: PropertiesService = Depends(get_properties_service),
):
    building = await db.get(Building, data.building_id)
    if building is None:
        raise HTTPException(status_code=404, detail="Building not found")
    await require_company_admin(db, user, building.management_company_id)
    if (
        data.entrance_id is not None
        and await service.get_entrance_for_building(data.entrance_id, data.building_id)
        is None
    ):
        raise HTTPException(
            status_code=422, detail="Entrance is not part of this building"
        )
    return await _commit_error(service.create_apartment(**data.model_dump()))
