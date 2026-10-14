from datetime import UTC, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.settings import get_settings
from .models import NotificationPreference, PushDevice


def in_quiet_hours(now: datetime, preference: NotificationPreference | None) -> bool:
    if not preference or preference.quiet_start is None or preference.quiet_end is None:
        return False
    try:
        local = now.astimezone(ZoneInfo(preference.timezone))
    except ZoneInfoNotFoundError:
        local = now.astimezone(ZoneInfo(get_settings().NOTIFICATION_TIMEZONE_DEFAULT))
    current = local.timetz().replace(tzinfo=None)
    start, end = preference.quiet_start, preference.quiet_end
    if start == end:
        return False
    return start <= current < end if start < end else current >= start or current < end


async def send_push(db: AsyncSession, user_id: int, title: str, body: str, *, preference_key: str = "camera_offline_enabled"):
    settings = get_settings()
    preference = await db.scalar(select(NotificationPreference).where(NotificationPreference.user_id == user_id))
    if preference and (not getattr(preference, preference_key, True) or in_quiet_hours(datetime.now(UTC), preference)):
        return
    devices = list((await db.scalars(select(PushDevice).where(PushDevice.user_id == user_id, PushDevice.is_active.is_(True)))).all())
    if not devices:
        return
    headers = {"Content-Type": "application/json"}
    if settings.EXPO_ACCESS_TOKEN:
        headers["Authorization"] = f"Bearer {settings.EXPO_ACCESS_TOKEN.get_secret_value()}"
    messages = [{"to": device.token, "title": title, "body": body, "sound": "default"} for device in devices]
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post("https://exp.host/--/api/v2/push/send", json=messages, headers=headers)
        if response.is_error:
            return
        tickets = response.json().get("data", [])
        for device, ticket in zip(devices, tickets):
            if ticket.get("details", {}).get("error") == "DeviceNotRegistered":
                device.is_active = False
        await db.commit()
    except httpx.HTTPError:
        return
