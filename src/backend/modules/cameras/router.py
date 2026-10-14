from uuid import UUID
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from loguru import logger
from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.background import BackgroundTask
from starlette.responses import StreamingResponse

from core.dependencies import get_current_user
from core.enums import UserRole
from core.settings import get_settings
from database.dependencies import get_db
from integrations.mediamtx import MediaProvider, get_media_provider
from modules.access.models import CompanyMembership, ResidentBinding
from modules.access.policy import _platform_admin
from modules.properties.models import Apartment, Building, Entrance
from modules.users.models import User

from .models import Camera
from .module import module
from .media_auth import issue_media_token, media_token_allows
from .schemas import (
    CameraCreate,
    CameraRead,
    CameraStatus,
    CameraUpdate,
    MediaAuthRequest,
    MediaSession,
)

router = APIRouter(prefix=module.router_prefix, tags=module.router_tags)


def _scope(user: User):
    company = exists(
        select(CompanyMembership.id).where(
            CompanyMembership.user_id == user.id,
            CompanyMembership.company_id == Building.management_company_id,
            CompanyMembership.is_active.is_(True),
        )
    )
    resident = exists(
        select(ResidentBinding.id)
        .join(Apartment, Apartment.id == ResidentBinding.apartment_id)
        .where(
            ResidentBinding.user_id == user.id,
            ResidentBinding.status == "confirmed",
            Apartment.building_id == Building.id,
            (
                Camera.entrance_id.is_(None)
                | (Apartment.entrance_id == Camera.entrance_id)
            ),
        )
    )
    return company | resident


def _may_manage(user: User) -> bool:
    return _platform_admin(user)


async def _get_camera(db: AsyncSession, user: User, camera_id: UUID, *, manage=False):
    stmt = (
        select(Camera)
        .join(Building, Building.id == Camera.building_id)
        .where(Camera.id == camera_id)
    )
    if not _platform_admin(user):
        stmt = stmt.where(_scope(user))
        if manage:
            stmt = stmt.where(
                exists(
                    select(CompanyMembership.id).where(
                        CompanyMembership.user_id == user.id,
                        CompanyMembership.company_id == Building.management_company_id,
                        CompanyMembership.scoped_role == "company_admin",
                        CompanyMembership.is_active.is_(True),
                    )
                )
            )
    camera = (await db.execute(stmt)).scalar_one_or_none()
    if camera is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    return camera


@router.get("", response_model=list[CameraRead])
async def list_cameras(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    stmt = select(Camera).join(Building, Building.id == Camera.building_id)
    if not _platform_admin(user):
        stmt = stmt.where(_scope(user))
        can_manage = await db.scalar(
            select(CompanyMembership.id)
            .where(
                CompanyMembership.user_id == user.id,
                CompanyMembership.scoped_role == "company_admin",
                CompanyMembership.is_active.is_(True),
            )
            .limit(1)
        )
        if can_manage is None:
            stmt = stmt.where(Camera.enabled.is_(True))
    rows = await db.scalars(stmt.order_by(Camera.name))
    return list(rows.all())


@router.get("/{camera_id}", response_model=CameraRead)
async def get_camera(
    camera_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_camera(db, user, camera_id)


@router.post("", response_model=CameraRead, status_code=201)
async def create_camera(
    data: CameraCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    building = await db.get(Building, data.building_id)
    if building is None:
        raise HTTPException(404, "Building not found")
    if not _platform_admin(user):
        if user.role == UserRole.USER:
            raise HTTPException(403, "Camera management permission required")
        access = await db.scalar(
            select(CompanyMembership.id).where(
                CompanyMembership.user_id == user.id,
                CompanyMembership.company_id == building.management_company_id,
                CompanyMembership.scoped_role == "company_admin",
                CompanyMembership.is_active.is_(True),
            )
        )
        if access is None:
            raise HTTPException(403, "Company administrator access required")
    if data.entrance_id is not None:
        entrance = await db.scalar(
            select(Entrance).where(
                Entrance.id == data.entrance_id, Entrance.building_id == building.id
            )
        )
        if entrance is None:
            raise HTTPException(422, "Entrance must belong to the selected building")
    camera = Camera(**data.model_dump())
    db.add(camera)
    await db.commit()
    await db.refresh(camera)
    return camera


@router.patch("/{camera_id}", response_model=CameraRead)
async def update_camera(
    camera_id: UUID,
    data: CameraUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    camera = await _get_camera(db, user, camera_id, manage=True)
    values = data.model_dump(exclude_unset=True)
    if values.get("entrance_id") is not None:
        entrance = await db.scalar(
            select(Entrance).where(
                Entrance.id == values["entrance_id"],
                Entrance.building_id == camera.building_id,
            )
        )
        if entrance is None:
            raise HTTPException(422, "Entrance must belong to the camera building")
    for key, value in values.items():
        setattr(camera, key, value)
    await db.commit()
    await db.refresh(camera)
    return camera


@router.get("/{camera_id}/status", response_model=CameraStatus)
async def camera_status(
    camera_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    media: MediaProvider = Depends(get_media_provider),
):
    camera = await _get_camera(db, user, camera_id)
    if not camera.enabled:
        return CameraStatus(status="offline")
    return CameraStatus(status=(await media.status(camera.stream_path)).status)


@router.post("/{camera_id}/stream-session", response_model=MediaSession)
async def create_stream_session(
    request: Request,
    camera_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    media: MediaProvider = Depends(get_media_provider),
):
    camera = await _get_camera(db, user, camera_id)
    if not camera.enabled:
        raise HTTPException(503, "Camera is disabled")
    media_status = await media.status(camera.stream_path)
    if media_status.status == "unknown":
        raise HTTPException(503, "Media service unavailable")
    if media_status.status != "online":
        raise HTTPException(503, "Camera stream is offline")
    settings = get_settings()
    if settings.MEDIA_JWT_SECRET is None:
        raise HTTPException(503, "Media authentication is not configured")
    if (
        settings.ENVIRONMENT == "production"
        and request.url.scheme != "https"
    ):
        raise HTTPException(503, "Production media session endpoint must use HTTPS")
    media_token = issue_media_token(
        secret=settings.MEDIA_JWT_SECRET.get_secret_value(),
        issuer=settings.MEDIA_JWT_ISSUER,
        audience=settings.MEDIA_JWT_AUDIENCE,
        user_id=user.id,
        path=camera.stream_path,
        ttl=settings.MEDIA_JWT_TTL_SECONDS,
    )
    hls_url = str(
        request.url_for(
            "proxy_camera_hls",
            camera_id=str(camera.id),
            media_path="index.m3u8",
        )
    )
    return MediaSession(
        camera_id=camera.id,
        transport="hls",
        url=hls_url,
        token=media_token,
        expires_in=settings.MEDIA_JWT_TTL_SECONDS,
    )


@router.get(
    "/{camera_id}/media/{media_path:path}",
    name="proxy_camera_hls",
    include_in_schema=False,
)
async def proxy_camera_hls(
    camera_id: UUID,
    media_path: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Validate each HLS request, including child playlists and media segments."""
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    settings = get_settings()
    camera = await db.scalar(
        select(Camera).where(Camera.id == camera_id, Camera.enabled.is_(True))
    )
    if (
        camera is None
        or scheme.lower() != "bearer"
        or not token
        or settings.MEDIA_JWT_SECRET is None
        or not media_token_allows(
            token=token,
            secret=settings.MEDIA_JWT_SECRET.get_secret_value(),
            issuer=settings.MEDIA_JWT_ISSUER,
            audience=settings.MEDIA_JWT_AUDIENCE,
            action="read",
            path=camera.stream_path,
        )
    ):
        raise HTTPException(401, "Unauthorized")
    if (
        not media_path
        or any(part in {".", ".."} for part in media_path.split("/"))
        or any(char not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._/-" for char in media_path)
    ):
        raise HTTPException(404, "Media resource not found")

    base_url = settings.MEDIAMTX_HLS_INTERNAL_URL or settings.MEDIAMTX_HLS_URL
    upstream_url = f"{base_url.rstrip('/')}/{camera.stream_path}/{media_path}"
    client = httpx.AsyncClient(timeout=None, follow_redirects=False)
    upstream_request = client.build_request(
        "GET",
        upstream_url,
        params=request.query_params,
        headers={
            key: value
            for key, value in request.headers.items()
            if key.lower()
            in {
                "accept",
                "accept-encoding",
                "authorization",
                "range",
                "if-none-match",
                "if-modified-since",
                "cookie",
            }
        },
    )
    try:
        upstream = await client.send(upstream_request, stream=True)
    except httpx.HTTPError as error:
        await client.aclose()
        logger.warning("HLS upstream unavailable for camera_id={}: {}", camera_id, error)
        raise HTTPException(503, "Media service unavailable") from error

    headers = {
        key: value
        for key, value in upstream.headers.items()
        if key.lower()
        in {
            "content-type",
            "content-length",
            "content-range",
            "accept-ranges",
            "cache-control",
            "etag",
            "last-modified",
            "set-cookie",
        }
    }
    if upstream.is_redirect and "location" in upstream.headers:
        location = urlparse(upstream.headers["location"])
        if location.path.startswith(f"/{camera.stream_path}/"):
            suffix = location.path[len(f"/{camera.stream_path}/") :]
            headers["location"] = str(
                request.url_for(
                    "proxy_camera_hls", camera_id=str(camera.id), media_path=suffix
                )
            ) + (f"?{location.query}" if location.query else "")
        else:
            await upstream.aclose()
            await client.aclose()
            raise HTTPException(502, "Unexpected media redirect")

    async def close_upstream():
        await upstream.aclose()
        await client.aclose()

    return StreamingResponse(
        upstream.aiter_raw(),
        status_code=upstream.status_code,
        headers=headers,
        background=BackgroundTask(close_upstream),
    )


@router.post("/internal/media-auth", include_in_schema=False)
async def mediamtx_http_auth(
    payload: MediaAuthRequest, db: AsyncSession = Depends(get_db)
):
    """MediaMTX HTTP auth adapter; deny by default and never log credentials/tokens."""
    logger.debug(
        "MediaMTX auth action={} path={} token_present={}",
        payload.action,
        payload.path,
        bool(payload.token),
    )
    settings = get_settings()
    if (
        payload.action != "read"
        or not payload.token
        or settings.MEDIA_JWT_SECRET is None
    ):
        raise HTTPException(401, "Unauthorized")
    if not media_token_allows(
        token=payload.token,
        secret=settings.MEDIA_JWT_SECRET.get_secret_value(),
        issuer=settings.MEDIA_JWT_ISSUER,
        audience=settings.MEDIA_JWT_AUDIENCE,
        action=payload.action,
        path=payload.path,
    ):
        raise HTTPException(403, "Forbidden")
    camera = await db.scalar(
        select(Camera).where(
            Camera.stream_path == payload.path, Camera.enabled.is_(True)
        )
    )
    if camera is None:
        raise HTTPException(403, "Forbidden")
    return {"ok": True}
