from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.properties.models import Apartment

from .models import CompanyMembership, ResidentBinding


class AccessRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_apartment(self, apartment_id: int):
        return await self.db.get(Apartment, apartment_id)

    async def create_membership(self, **values):
        item = CompanyMembership(**values)
        self.db.add(item)
        await self.db.flush()
        return item

    async def get_membership(self, membership_id: int):
        result = await self.db.execute(
            select(CompanyMembership).where(CompanyMembership.id == membership_id)
        )
        return result.scalar_one_or_none()

    async def create_binding(self, **values):
        item = ResidentBinding(**values)
        self.db.add(item)
        await self.db.flush()
        return item

    async def get_binding(self, binding_id: int):
        result = await self.db.execute(
            select(ResidentBinding).where(ResidentBinding.id == binding_id)
        )
        return result.scalar_one_or_none()
