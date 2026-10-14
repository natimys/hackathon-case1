from sqlalchemy.ext.asyncio import AsyncSession

from .models import ResidentBinding
from .repository import AccessRepository


class AccessService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repository = AccessRepository(db)

    async def create_membership(self, **values):
        async with self.db.begin_nested():
            item = await self.repository.create_membership(**values)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def update_membership(self, membership_id: int, *, is_active: bool):
        async with self.db.begin_nested():
            item = await self.repository.get_membership(membership_id)
            if item is None:
                return None
            item.is_active = is_active
            await self.db.flush()
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def create_binding(self, **values):
        async with self.db.begin_nested():
            item = await self.repository.create_binding(**values)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def update_binding(self, binding_id: int, *, status: str):
        async with self.db.begin_nested():
            item = await self.db.get(ResidentBinding, binding_id)
            if item is None:
                return None
            item.status = status
            await self.db.flush()
        await self.db.commit()
        await self.db.refresh(item)
        return item
