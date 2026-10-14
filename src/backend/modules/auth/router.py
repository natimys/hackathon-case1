from fastapi import APIRouter, Depends, Response
from core.dependencies import get_current_user
from core.security import jwt_security
from modules.users.dependencies import get_user_service

from .dependencies import (
    get_auth_service,
    login_and_set_cookies,
    logout_session,
    rotate_refresh_session,
    refresh_session_and_set_cookies,
)
from .module import module
from .schemas import MobileTokenPair, UserLogin, UserPublic, UserRegister
from .service import AuthService

router = APIRouter(prefix=module.router_prefix, tags=module.router_tags)


@router.post("/register/", response_model=UserPublic)
async def register(
    data: UserRegister, auth_service: AuthService = Depends(get_auth_service)
):
    user = await auth_service.register(data)
    return user


@router.get("/me/", response_model=UserPublic)
async def me(
    user=Depends(get_current_user),
):
    return user


@router.post("/refresh/")
async def refresh(status: dict = Depends(refresh_session_and_set_cookies)):
    return status


@router.post("/login/")
async def login(result: dict = Depends(login_and_set_cookies)):
    return result


@router.post("/logout/")
async def logout(response: Response, _=Depends(logout_session)):
    jwt_security.unset_refresh_cookies(response)
    jwt_security.unset_access_cookies(response)
    return {"message": "logged out"}


@router.post("/mobile/login", response_model=MobileTokenPair)
async def mobile_login(
    data: UserLogin, auth_service: AuthService = Depends(get_auth_service)
):
    """Issue the same session JWTs for native clients using Authorization headers."""
    access_token, refresh_token = await auth_service.authenticate(data)
    return MobileTokenPair(access_token=access_token, refresh_token=refresh_token)


@router.post("/mobile/refresh", response_model=MobileTokenPair)
async def mobile_refresh(
    payload=Depends(jwt_security.refresh_token_required),
    auth_service: AuthService = Depends(get_auth_service),
    user_service=Depends(get_user_service),
):
    access_token, refresh_token = await rotate_refresh_session(
        payload, auth_service, user_service
    )
    return MobileTokenPair(access_token=access_token, refresh_token=refresh_token)


@router.post("/mobile/logout/")
async def mobile_logout(_=Depends(logout_session)):
    return {"message": "logged out"}
