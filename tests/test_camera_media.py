from datetime import datetime, timedelta, timezone
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import jwt
import httpx
import pytest
from fastapi import HTTPException
from starlette.requests import Request
from pydantic import ValidationError

from core.enums import UserRole
from integrations.mediamtx import MediaProvider
from modules.cameras import router as camera_router
from modules.cameras.models import Camera
from modules.cameras.media_auth import issue_media_token, media_token_allows
from modules.cameras.schemas import CameraCreate, MediaAuthRequest, MediaSession
from modules.users.models import User

SECRET = "unit-test-only-media-secret-with-32-chars"


def token(path="demo/camera-001", ttl=120):
    return issue_media_token(
        secret=SECRET,
        issuer="test-issuer",
        audience="test-media",
        user_id=42,
        path=path,
        ttl=ttl,
    )


def allows(encoded, *, action="read", path="demo/camera-001"):
    return media_token_allows(
        token=encoded,
        secret=SECRET,
        issuer="test-issuer",
        audience="test-media",
        action=action,
        path=path,
    )


def test_media_token_allows_exact_path_and_read_action_only():
    encoded = token()
    assert allows(encoded)
    assert not allows(encoded, path="demo/camera-002")
    assert not allows(encoded, action="publish")


def test_expired_media_session_is_rejected():
    expired = jwt.encode(
        {
            "iss": "test-issuer",
            "aud": "test-media",
            "sub": "42",
            "iat": datetime.now(timezone.utc) - timedelta(minutes=5),
            "exp": datetime.now(timezone.utc) - timedelta(minutes=4),
            "mediamtx_permissions": [{"action": "read", "path": "demo/camera-001"}],
        },
        SECRET,
        algorithm="HS256",
    )
    assert not allows(expired)


def test_media_session_is_short_lived_and_uses_a_separate_permission_claim():
    claims = jwt.decode(
        token(ttl=60),
        SECRET,
        algorithms=["HS256"],
        audience="test-media",
        issuer="test-issuer",
    )
    assert claims["mediamtx_permissions"] == [
        {"action": "read", "path": "demo/camera-001"}
    ]
    assert claims["exp"] - claims["iat"] == 60
    assert "access_token" not in claims


def test_media_session_and_camera_contracts_do_not_include_rtsp_credentials():
    session = MediaSession(
        camera_id="55a8ad55-1e88-4237-9b06-b5c94f5c84ba",
        transport="hls",
        url="http://media.example.test:8888/demo/camera-001/index.m3u8",
        token=token(),
        expires_in=60,
    )
    assert "rtsp" not in session.model_dump_json().lower()
    with pytest.raises(ValidationError):
        CameraCreate(
            name="Lobby",
            building_id=1,
            location_description="Lobby",
            stream_path="/demo//cam",
            password="should-not-be-accepted",
        )


def test_media_provider_constructs_only_internal_path_specific_hls_url():
    provider = MediaProvider("http://mediamtx:9997", "https://video.example.test")
    assert (
        provider.hls_url("demo/camera-001")
        == "https://video.example.test/demo/camera-001/index.m3u8"
    )


def test_media_auth_requires_a_token_for_the_exact_read_path(monkeypatch):
    settings = SimpleNamespace(
        MEDIA_JWT_SECRET=SimpleNamespace(get_secret_value=lambda: SECRET),
        MEDIA_JWT_ISSUER="test-issuer",
        MEDIA_JWT_AUDIENCE="test-media",
    )
    monkeypatch.setattr(camera_router, "get_settings", lambda: settings)
    db = SimpleNamespace(scalar=AsyncMock(return_value=SimpleNamespace(enabled=True)))
    request = MediaAuthRequest(action="read", path="demo/camera-002", token=token())
    with pytest.raises(HTTPException) as error:
        asyncio.run(camera_router.mediamtx_http_auth(request, db))
    assert error.value.status_code == 403
    missing = MediaAuthRequest(action="read", path="demo/camera-001")
    with pytest.raises(HTTPException) as error:
        asyncio.run(camera_router.mediamtx_http_auth(missing, db))
    assert error.value.status_code == 401


def test_media_auth_denies_disabled_or_removed_camera(monkeypatch):
    settings = SimpleNamespace(
        MEDIA_JWT_SECRET=SimpleNamespace(get_secret_value=lambda: SECRET),
        MEDIA_JWT_ISSUER="test-issuer",
        MEDIA_JWT_AUDIENCE="test-media",
    )
    monkeypatch.setattr(camera_router, "get_settings", lambda: settings)
    db = SimpleNamespace(scalar=AsyncMock(return_value=None))
    request = MediaAuthRequest(action="read", path="demo/camera-001", token=token())
    with pytest.raises(HTTPException) as error:
        asyncio.run(camera_router.mediamtx_http_auth(request, db))
    assert error.value.status_code == 403


def test_hls_proxy_validates_every_request_and_streams_media_bytes(monkeypatch):
    camera = SimpleNamespace(
        id=uuid4(), stream_path="demo/camera-001", enabled=True
    )
    settings = SimpleNamespace(
        MEDIA_JWT_SECRET=SimpleNamespace(get_secret_value=lambda: SECRET),
        MEDIA_JWT_ISSUER="test-issuer",
        MEDIA_JWT_AUDIENCE="test-media",
        MEDIAMTX_HLS_INTERNAL_URL="http://media.internal:8888",
        MEDIAMTX_HLS_URL="http://media:8888",
    )
    monkeypatch.setattr(camera_router, "get_settings", lambda: settings)
    db = SimpleNamespace(scalar=AsyncMock(return_value=camera))
    calls = []
    real_async_client = httpx.AsyncClient

    def upstream_handler(req):
        calls.append(req)
        return httpx.Response(
            200,
            headers={"content-type": "video/mp4"},
            stream=httpx.ByteStream(b"fMP4-segment"),
        )

    monkeypatch.setattr(
        camera_router.httpx,
        "AsyncClient",
        lambda **kwargs: real_async_client(
            transport=httpx.MockTransport(upstream_handler), **kwargs
        ),
    )

    async def run():
        request = Request(
            {
                "type": "http",
                "http_version": "1.1",
                "method": "GET",
                "scheme": "http",
                "path": f"/cameras/{camera.id}/media/segment.mp4",
                "raw_path": f"/cameras/{camera.id}/media/segment.mp4".encode(),
                "query_string": b"v=1",
                "headers": [(b"authorization", f"Bearer {token()}".encode())],
                "server": ("testserver", 80),
                "client": ("testclient", 50000),
            }
        )
        response = await camera_router.proxy_camera_hls(
            camera.id, "segment.mp4", request, db
        )
        body = b"".join([chunk async for chunk in response.body_iterator])
        await response.background()
        return response, body

    response, body = asyncio.run(run())
    assert response.status_code == 200
    assert response.headers["content-type"] == "video/mp4"
    assert body == b"fMP4-segment"
    assert str(calls[0].url) == (
        f"http://media.internal:8888/{camera.stream_path}/segment.mp4?v=1"
    )
    assert calls[0].headers["authorization"] == f"Bearer {token()}"


def test_hls_proxy_denies_missing_or_wrong_camera_token(monkeypatch):
    camera = SimpleNamespace(
        id=uuid4(), stream_path="demo/camera-001", enabled=True
    )
    settings = SimpleNamespace(
        MEDIA_JWT_SECRET=SimpleNamespace(get_secret_value=lambda: SECRET),
        MEDIA_JWT_ISSUER="test-issuer",
        MEDIA_JWT_AUDIENCE="test-media",
    )
    monkeypatch.setattr(camera_router, "get_settings", lambda: settings)
    db = SimpleNamespace(scalar=AsyncMock(return_value=camera))

    async def run(auth):
        request = Request(
            {
                "type": "http",
                "http_version": "1.1",
                "method": "GET",
                "scheme": "http",
                "path": f"/cameras/{camera.id}/media/segment.mp4",
                "raw_path": f"/cameras/{camera.id}/media/segment.mp4".encode(),
                "query_string": b"",
                "headers": auth,
                "server": ("testserver", 80),
                "client": ("testclient", 50000),
            }
        )
        await camera_router.proxy_camera_hls(camera.id, "segment.mp4", request, db)

    for headers in [[], [(b"authorization", f"Bearer {token('demo/camera-002')}".encode())]]:
        with pytest.raises(HTTPException) as error:
            asyncio.run(run(headers))
        assert error.value.status_code == 401


def test_stream_session_rejects_disabled_and_offline_camera(monkeypatch):
    user = User(
        id=7,
        email="admin@example.test",
        name="Admin",
        role=UserRole.ADMIN,
        password="unused",
    )
    camera = Camera(
        id=uuid4(),
        name="Lobby",
        building_id=1,
        entrance_id=None,
        location_description="Lobby",
        stream_path="demo/camera-001",
        source_type="simulator",
        enabled=False,
    )
    db = SimpleNamespace(
        execute=AsyncMock(
            return_value=SimpleNamespace(scalar_one_or_none=lambda: camera)
        )
    )
    media = SimpleNamespace(
        status=AsyncMock(return_value=SimpleNamespace(status="offline"))
    )
    request = SimpleNamespace()
    monkeypatch.setattr(camera_router, "get_settings", lambda: SimpleNamespace())
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            camera_router.create_stream_session(request, camera.id, user, db, media)
        )
    assert error.value.status_code == 503
    media.status.assert_not_awaited()
    camera.enabled = True
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            camera_router.create_stream_session(request, camera.id, user, db, media)
        )
    assert error.value.status_code == 503


def test_online_stream_session_returns_path_scoped_hls_session(monkeypatch):
    user = User(
        id=7,
        email="admin@example.test",
        name="Admin",
        role=UserRole.ADMIN,
        password="unused",
    )
    camera = Camera(
        id=uuid4(),
        name="Lobby",
        building_id=1,
        entrance_id=None,
        location_description="Lobby",
        stream_path="demo/camera-001",
        source_type="simulator",
        enabled=True,
    )
    db = SimpleNamespace(
        execute=AsyncMock(
            return_value=SimpleNamespace(scalar_one_or_none=lambda: camera)
        )
    )
    media = SimpleNamespace(
        status=AsyncMock(return_value=SimpleNamespace(status="online")),
        hls_url=lambda path: f"http://media:8888/{path}/index.m3u8",
    )
    settings = SimpleNamespace(
        ENVIRONMENT="development",
        MEDIA_JWT_SECRET=SimpleNamespace(get_secret_value=lambda: SECRET),
        MEDIA_JWT_ISSUER="test-issuer",
        MEDIA_JWT_AUDIENCE="test-media",
        MEDIA_JWT_TTL_SECONDS=60,
    )
    monkeypatch.setattr(camera_router, "get_settings", lambda: settings)
    request = SimpleNamespace(
        url=SimpleNamespace(scheme="http"),
        url_for=lambda name, **kwargs: (
            f"https://api.example/cameras/{camera.id}/media/index.m3u8"
        )
    )
    session = asyncio.run(
        camera_router.create_stream_session(request, camera.id, user, db, media)
    )
    assert session.transport == "hls"
    assert session.url == f"https://api.example/cameras/{camera.id}/media/index.m3u8"
    assert allows(session.token)
    assert not allows(session.token, path="demo/camera-002")
    settings.ENVIRONMENT = "production"
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            camera_router.create_stream_session(request, camera.id, user, db, media)
        )
    assert error.value.status_code == 503


def test_technician_membership_does_not_allow_camera_creation():
    user = User(
        id=7,
        email="tech@example.test",
        name="Tech",
        role=UserRole.USER,
        password="unused",
    )
    db = SimpleNamespace(
        get=AsyncMock(return_value=SimpleNamespace(management_company_id=3)),
        scalar=AsyncMock(return_value=None),
        commit=AsyncMock(),
    )
    request = CameraCreate(
        name="Lobby",
        building_id=1,
        location_description="Lobby",
        stream_path="demo/camera-001",
    )
    with pytest.raises(HTTPException) as error:
        asyncio.run(camera_router.create_camera(request, user, db))
    assert error.value.status_code == 403
    db.commit.assert_not_awaited()
