from pydantic import BaseModel, EmailStr, SecretStr


class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: SecretStr


class UserLogin(BaseModel):
    email: EmailStr
    password: SecretStr


class UserPublic(BaseModel):
    name: str
    email: EmailStr


class MobileTokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
