from sqlalchemy.ext.asyncio import AsyncSession

from modules.access.policy import apartment_scope, building_scope
from modules.users.models import User

from .models import Apartment, Building, Entrance, ManagementCompany
from .repository import PropertiesRepository


class PropertiesService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repository = PropertiesRepository(db)

    async def list_buildings(self, user: User):
        return await self.repository.list_buildings(building_scope(user))

    async def list_apartments(self, user: User, building_id: int | None = None):
        predicate = apartment_scope(user)
        if building_id is not None:
            predicate = predicate & (Apartment.building_id == building_id)
        return await self.repository.list_apartments(predicate)

    async def get_entrance_for_building(self, entrance_id: int, building_id: int):
        return await self.repository.get_entrance_for_building(entrance_id, building_id)

    async def create_company(self, name: str):
        async with self.db.begin_nested():
            company = await self.repository.create(ManagementCompany(name=name))
        await self.db.commit()
        await self.db.refresh(company)
        return company

    async def create_building(self, **values):
        values["building_suffix"] = values.get("building_suffix") or ""
        async with self.db.begin_nested():
            building = await self.repository.create(Building(**values))
        await self.db.commit()
        await self.db.refresh(building)
        return building

    async def create_entrance(self, **values):
        async with self.db.begin_nested():
            entrance = await self.repository.create(Entrance(**values))
        await self.db.commit()
        await self.db.refresh(entrance)
        return entrance

    async def create_apartment(self, **values):
        async with self.db.begin_nested():
            apartment = await self.repository.create(Apartment(**values))
        await self.db.commit()
        await self.db.refresh(apartment)
        return apartment
