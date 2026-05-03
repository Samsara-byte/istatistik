"""
Uygulama ayarları.
Tüm ortam değişkenleri .env dosyasından veya shell'den okunur.
"""
from __future__ import annotations

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Veritabanı — SQLAlchemy async (asyncpg driver)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:burdur15@localhost:5432/burdurdb"

    # CORS
    FRONTEND_URLS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # Uygulama
    APP_TITLE:   str  = "Burdur Tarım API"
    APP_VERSION: str  = "3.0.0"
    DEBUG:       bool = False

    # Limitler
    MAX_UPLOAD_MB: int = 60

    @field_validator("DATABASE_URL")
    @classmethod
    def check_async_driver(cls, v: str) -> str:
        if "+asyncpg" not in v:
            raise ValueError(
                "DATABASE_URL'de asyncpg driver belirtilmeli: "
                "postgresql+asyncpg://..."
            )
        return v

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024

    @property
    def sys_database_url(self) -> str:
        """DB oluşturma için postgres sistem DB URL'i."""
        base, _ = self.DATABASE_URL.rsplit("/", 1)
        return base + "/postgres"

    @property
    def db_name(self) -> str:
        return self.DATABASE_URL.rsplit("/", 1)[1]


settings = Settings()
