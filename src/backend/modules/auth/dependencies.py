from core.security import jwt_security
from fastapi import Depends, HTTPException, Response, status

from modules.auth.schemas import UserLogin
from modules.auth.service import AuthService
from modules.users.dependencies import get_user_service
from modules.users.service import UserService


def get_auth_service(
    user_service: UserService = Depends(get_user_service),
) -> AuthService:
    return AuthService(user_service)


async def login_and_set_cookies(
    response: Response,
    data: UserLogin,
    auth_service: AuthService = Depends(get_auth_service),
) -> dict:
    access_token, refresh_token = await auth_service.authenticate(data)
    jwt_security.set_access_cookies(access_token, response)
    jwt_security.set_refresh_cookies(refresh_token, response)
    return {"message": "successfully logged in"}


async def refresh_session_and_set_cookies(
    response: Response,
    payload=Depends(jwt_security.refresh_token_required),
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    access_token, refresh_token = await rotate_refresh_session(
        payload, auth_service, user_service
    )

    jwt_security.set_access_cookies(access_token, response)
    jwt_security.set_refresh_cookies(refresh_token, response)

    return {"message": "token refreshed"}


async def rotate_refresh_session(payload, auth_service, user_service):
    user = await user_service.get_user_by_id(int(payload.sub))
    if (
        user is None
        or not user.is_active
        or getattr(payload, "session_version", None) != user.session_version
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session is no longer valid",
        )
    next_version = await user_service.rotate_session_version(
        user.id, user.session_version
    )
    if next_version is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token already used",
        )
    access_token, refresh_token = auth_service.generate_tokens(
        user.id, next_version, user_role=user.role
    )
    return access_token, refresh_token


async def logout_session(
    payload=Depends(jwt_security.refresh_token_required),
    user_service: UserService = Depends(get_user_service),
) -> None:
    user = await user_service.get_user_by_id(int(payload.sub))
    if (
        user is not None
        and user.is_active
        and getattr(payload, "session_version", None) == user.session_version
    ):
        await user_service.rotate_session_version(user.id, user.session_version)
