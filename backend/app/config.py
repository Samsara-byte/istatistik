"""
config.py — Uygulama ayarları

Tüm konfigürasyon değerleri buradan okunur.
Ortam değişkenleri .env dosyasından veya sistemden alınır.
Yeni bir ayar eklemek için: Settings sınıfına yeni alan ekle + .env.example güncelle.
"""
from __future__ import annotations

from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Veritabanı ────────────────────────────────────────────────────
    # asyncpg sürücüsü kullanıldığı için URL'de +asyncpg şart
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/burdurdb"
    DB_POOL_SIZE: int = 5        # eş zamanlı bağlantı havuzu
    DB_MAX_OVERFLOW: int = 10    # havuz dolunca ekstra açılabilecek bağlantı
    DB_POOL_TIMEOUT: int = 30    # bağlantı beklemek için max saniye
    DB_ECHO: bool = False        # True yapınca tüm SQL konsola yansır (debug)

    # ── Uygulama ──────────────────────────────────────────────────────
    APP_NAME: str = "Burdur Tarım API"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False          # True = DEBUG log seviyesi

    # pydantic-settings: .env dosyasından okur, bilinmeyen alanları yok sayar
    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache  # Settings bir kez oluşturulur, sonra önbellekten döner
def get_settings() -> Settings:
    return Settings()


# Tüm modüller bu nesneyi import eder: from app.config import settings
settings = get_settings()
