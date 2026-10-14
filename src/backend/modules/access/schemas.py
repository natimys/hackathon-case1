from enum import Enum

from pydantic import BaseModel


class ScopedRole(str, Enum):
    COMPANY_ADMIN = "company_admin"
    TECHNICIAN = "technician"


class BindingStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class MembershipCreate(BaseModel):
    user_id: int
    company_id: int
    scoped_role: ScopedRole


class MembershipUpdate(BaseModel):
    is_active: bool


class MembershipRead(BaseModel):
    id: int
    user_id: int
    company_id: int
    scoped_role: ScopedRole
    is_active: bool

    model_config = {"from_attributes": True}


class TechnicianRead(BaseModel):
    id: int
    name: str


class AccessScopesRead(BaseModel):
    user_id: int
    is_platform_admin: bool
    scoped_roles: list[ScopedRole]
    is_resident: bool


class ResidentBindingCreate(BaseModel):
    user_id: int
    apartment_id: int
    status: BindingStatus = BindingStatus.CONFIRMED


class ResidentBindingRead(BaseModel):
    id: int
    user_id: int
    apartment_id: int
    status: BindingStatus

    model_config = {"from_attributes": True}


class ResidentBindingUpdate(BaseModel):
    status: BindingStatus
