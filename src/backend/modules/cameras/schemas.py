from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CameraCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    building_id: int
    entrance_id: int | None = None
    location_description: str = Field(min_length=1, max_length=250)
    stream_path: str = Field(min_length=1, max_length=200, pattern=r"^[a-zA-Z0-9/_-]+$")
    source_type: Literal["rtsp", "simulator"] = "rtsp"
    enabled: bool = True

    @field_validator("stream_path")
    @classmethod
    def validate_stream_path(cls, value: str) -> str:
        if value.startswith("/") or value.endswith("/") or "//" in value:
            raise ValueError(
                "stream_path must be a relative path without empty segments"
            )
        return value


class CameraUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    entrance_id: int | None = None
    location_description: str | None = Field(default=None, min_length=1, max_length=250)
    enabled: bool | None = None


class CameraRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    building_id: int
    entrance_id: int | None
    location_description: str
    stream_path: str
    source_type: str
    enabled: bool
    created_at: datetime
    updated_at: datetime


class CameraStatus(BaseModel):
    status: Literal["online", "offline", "unknown"]


class MediaSession(BaseModel):
    camera_id: UUID
    transport: Literal["hls"]
    url: str
    token: str
    expires_in: int


class MediaAuthRequest(BaseModel):
    user: str = ""
    password: str = ""
    token: str = ""
    action: str
    path: str = ""
