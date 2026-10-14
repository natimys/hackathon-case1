from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from core.demo_seed import DEMO_USERS
from core.enums import UserRole
from modules.auth.router import mobile_login, mobile_refresh
from modules.auth.schemas import MobileTokenPair, UserLogin


def test_demo_seed_emails_are_accepted_by_login_schema():
    for email, _, _ in DEMO_USERS:
        UserLogin(email=email, password="demo-password")


@pytest.mark.anyio
async def test_mobile_login_returns_existing_auth_service_tokens_without_cookies():
    auth_service = SimpleNamespace(authenticate=AsyncMock(return_value=("access", "refresh")))
    credentials = UserLogin(email="resident@example.com", password="secret")

    result = await mobile_login(credentials, auth_service)

    assert result == MobileTokenPair(access_token="access", refresh_token="refresh")
    auth_service.authenticate.assert_awaited_once_with(credentials)


@pytest.mark.anyio
async def test_mobile_refresh_rotates_session_and_returns_new_pair():
    user = SimpleNamespace(
        id=12, is_active=True, session_version=4, role=UserRole.USER
    )
    user_service = SimpleNamespace(
        get_user_by_id=AsyncMock(return_value=user),
        rotate_session_version=AsyncMock(return_value=5),
    )
    auth_service = SimpleNamespace(generate_tokens=Mock(return_value=("new-access", "new-refresh")))
    payload = SimpleNamespace(sub="12", session_version=4)

    result = await mobile_refresh(payload, auth_service, user_service)

    assert result == MobileTokenPair(
        access_token="new-access", refresh_token="new-refresh"
    )
    user_service.rotate_session_version.assert_awaited_once_with(12, 4)
    auth_service.generate_tokens.assert_called_once_with(12, 5, user_role=UserRole.USER)


@pytest.mark.anyio
async def test_mobile_refresh_rejects_reused_refresh_token():
    user = SimpleNamespace(id=12, is_active=True, session_version=4, role=UserRole.USER)
    user_service = SimpleNamespace(
        get_user_by_id=AsyncMock(return_value=user),
        rotate_session_version=AsyncMock(return_value=None),
    )
    auth_service = SimpleNamespace(generate_tokens=Mock())
    payload = SimpleNamespace(sub="12", session_version=4)

    from fastapi import HTTPException

    with pytest.raises(HTTPException) as error:
        await mobile_refresh(payload, auth_service, user_service)

    assert error.value.status_code == 401
    auth_service.generate_tokens.assert_not_called()
