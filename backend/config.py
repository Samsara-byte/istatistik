from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Database ─────────────────────────────────────────────────────
    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/burdurdb"
    )
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_ECHO: bool = False

    # ── Application ──────────────────────────────────────────────────
    APP_NAME: str = "Burdur Tarım API"
    APP_VERSION: str = "2.0.0"
    FRONTEND_URL: str = "http://localhost:3000"
    DEBUG: bool = False

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
