from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DB_HOST: str = "db"
    DB_PORT: int = 5432
    DB_USER: str
    DB_PASSWORD: SecretStr
    DB_NAME: str

    JWT_SECURITY_KEY: SecretStr

    CORS_ORIGINS: list[str]
    CORS_ALLOW_CREDENTIALS: bool
    CORS_ALLOW_METHODS: list[str]
    CORS_ALLOW_HEADERS: list[str]

    REFRESH_TOKEN_EXPIRES: int
    ACCESS_TOKEN_EXPIRES: int

    DEBUG: bool = False
    JWT_COOKIE_SECURE: bool = False
    JWT_COOKIE_SAMESITE: str = "lax"
    TICKET_ATTACHMENT_DIR: Path = BASE_DIR / "var" / "ticket-attachments"
    TICKET_ATTACHMENT_MAX_BYTES: int = 10 * 1024 * 1024
    BILLING_DEMO_PAYMENTS_ENABLED: bool = False
    MEDIAMTX_API_URL: str = "http://127.0.0.1:9997"
    MEDIAMTX_HLS_URL: str = "http://127.0.0.1:8888"
    MEDIAMTX_HLS_INTERNAL_URL: str | None = None
    MEDIA_JWT_SECRET: SecretStr | None = None
    MEDIA_JWT_ISSUER: str = "yakutsk-home"
    MEDIA_JWT_AUDIENCE: str = "mediamtx"
    MEDIA_JWT_TTL_SECONDS: int = 600

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @field_validator("JWT_SECURITY_KEY", mode="after")
    @classmethod
    def check_default_key(cls, value: SecretStr) -> SecretStr:
        raw = value.get_secret_value()
        if len(raw) < 32 or raw.lower().startswith(("change", "replace", "example")):
            raise ValueError("JWT_SECURITY_KEY must contain at least 32 characters")
        return value

    @field_validator("DB_PASSWORD")
    @classmethod
    def check_default_database_password(cls, value: SecretStr) -> SecretStr:
        raw = value.get_secret_value()
        if not raw or raw.lower().startswith(
            ("change", "replace", "example", "password")
        ):
            raise ValueError("DB_PASSWORD must be set to a unique value")
        return value

    @field_validator("JWT_COOKIE_SAMESITE")
    @classmethod
    def validate_samesite(cls, value: str) -> str:
        value = value.lower()
        if value not in {"lax", "strict", "none"}:
            raise ValueError("JWT_COOKIE_SAMESITE must be lax, strict, or none")
        return value

    @model_validator(mode="after")
    def validate_media_token_security(self):
        if self.ENVIRONMENT not in {"development", "test", "production"}:
            raise ValueError("ENVIRONMENT must be development, test, or production")
        if self.MEDIA_JWT_SECRET is not None:
            media_secret = self.MEDIA_JWT_SECRET.get_secret_value()
            if len(media_secret) < 32 or media_secret.lower().startswith(
                ("change", "replace", "example", "password")
            ):
                raise ValueError("MEDIA_JWT_SECRET must be unique and at least 32 characters")
            if media_secret == self.JWT_SECURITY_KEY.get_secret_value():
                raise ValueError("MEDIA_JWT_SECRET must differ from JWT_SECURITY_KEY")
        if not 30 <= self.MEDIA_JWT_TTL_SECONDS <= 3600:
            raise ValueError("MEDIA_JWT_TTL_SECONDS must be between 30 and 3600")
        return self

    @property
    def DATABASE_URL(self) -> str:
        from urllib.parse import quote_plus

        password = quote_plus(self.DB_PASSWORD.get_secret_value())
        return f"postgresql+asyncpg://{self.DB_USER}:{password}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def ALEMBIC_DATABASE_URL(self) -> str:
        from urllib.parse import quote_plus

        password = quote_plus(self.DB_PASSWORD.get_secret_value())
        return f"postgresql+psycopg://{self.DB_USER}:{password}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"


@lru_cache
def get_settings():
    return Settings()
