from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database.dependencies import get_db

from .service import TicketsService


async def get_tickets_service(db: AsyncSession = Depends(get_db)) -> TicketsService:
    return TicketsService(db)
