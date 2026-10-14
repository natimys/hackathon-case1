from datetime import datetime, time
from uuid import UUID

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, Time, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base


class PushDevice(Base):
    __tablename__ = "notification_push_devices"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    timezone: Mapped[str] = mapped_column(String(80), nullable=False, server_default="Asia/Yakutsk")
    quiet_start: Mapped[time | None] = mapped_column(Time)
    quiet_end: Mapped[time | None] = mapped_column(Time)
    camera_offline_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    ticket_status_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")


class CameraObservedState(Base):
    __tablename__ = "camera_observed_states"
    camera_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("cameras.id", ondelete="CASCADE"), primary_key=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="unknown")
    offline_since: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
