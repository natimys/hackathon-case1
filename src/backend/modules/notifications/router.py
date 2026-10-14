from datetime import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from core.dependencies import get_current_user
from core.settings import get_settings
from database.dependencies import get_db
from modules.users.models import User
from .models import NotificationPreference, PushDevice

router = APIRouter(prefix="/notifications", tags=["notifications"])


class DeviceInput(BaseModel):
    token: str = Field(min_length=20, max_length=255)


class PreferencesInput(BaseModel):
    timezone: str = Field(default="Asia/Yakutsk", min_length=1, max_length=80)
    quiet_start: time | None = None
    quiet_end: time | None = None
    camera_offline_enabled: bool = True
    ticket_status_enabled: bool = True


@router.post("/devices", status_code=204)
async def register_device(data: DeviceInput, user: User = Depends(get_current_user), db=Depends(get_db)):
    if not data.token.startswith("ExponentPushToken[") and not data.token.startswith("ExpoPushToken["):
        raise HTTPException(422, "Expected an Expo push token")
    item = await db.scalar(select(PushDevice).where(PushDevice.token == data.token))
    if item is None:
        db.add(PushDevice(user_id=user.id, token=data.token, is_active=True))
    else:
        item.user_id, item.is_active = user.id, True
    await db.commit()


@router.delete("/devices", status_code=204)
async def unregister_device(data: DeviceInput, user: User = Depends(get_current_user), db=Depends(get_db)):
    item = await db.scalar(select(PushDevice).where(PushDevice.user_id == user.id, PushDevice.token == data.token))
    if item:
        item.is_active = False
        await db.commit()


@router.get("/preferences")
async def get_preferences(user: User = Depends(get_current_user), db=Depends(get_db)):
    item = await db.scalar(select(NotificationPreference).where(NotificationPreference.user_id == user.id))
    if not item:
        return {"timezone": get_settings().NOTIFICATION_TIMEZONE_DEFAULT, "quiet_start": None, "quiet_end": None, "camera_offline_enabled": True, "ticket_status_enabled": True}
    return {"timezone": item.timezone, "quiet_start": item.quiet_start, "quiet_end": item.quiet_end, "camera_offline_enabled": item.camera_offline_enabled, "ticket_status_enabled": item.ticket_status_enabled}


@router.patch("/preferences")
async def put_preferences(data: PreferencesInput, user: User = Depends(get_current_user), db=Depends(get_db)):
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
    try:
        ZoneInfo(data.timezone)
    except ZoneInfoNotFoundError:
        raise HTTPException(422, "Unknown timezone")
    item = await db.scalar(select(NotificationPreference).where(NotificationPreference.user_id == user.id))
    if item is None:
        item = NotificationPreference(user_id=user.id, **data.model_dump())
        db.add(item)
    else:
        for key, value in data.model_dump().items():
            setattr(item, key, value)
    await db.commit()
    return await get_preferences(user, db)
