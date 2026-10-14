from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database.dependencies import get_db
from .service import PropertiesService


async def get_properties_service(
    db: AsyncSession = Depends(get_db),
) -> PropertiesService:
    return PropertiesService(db)
