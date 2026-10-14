from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Apartment, Building, Entrance, ManagementCompany


class PropertiesRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, entity):
        self.db.add(entity)
        await self.db.flush()
        return entity

    async def get_company(self, company_id: int):
        return await self.db.get(ManagementCompany, company_id)

    async def get_building(self, building_id: int):
        return await self.db.get(Building, building_id)

    async def get_entrance_for_building(self, entrance_id: int, building_id: int):
        result = await self.db.execute(
            select(Entrance).where(
                Entrance.id == entrance_id, Entrance.building_id == building_id
            )
        )
        return result.scalar_one_or_none()

    async def list_buildings(self, predicate):
        result = await self.db.execute(
            select(Building).where(predicate).order_by(Building.id)
        )
        return list(result.scalars().all())

    async def list_apartments(self, predicate):
        result = await self.db.execute(
            select(Apartment).where(predicate).order_by(Apartment.id)
        )
        return list(result.scalars().all())
