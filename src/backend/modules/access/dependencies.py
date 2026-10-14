from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database.dependencies import get_db
from .service import AccessService


async def get_access_service(db: AsyncSession = Depends(get_db)) -> AccessService:
    return AccessService(db)
