"""
database.py — Veritabanı bağlantı yönetimi

Sorumlulukları:
  - SQLAlchemy async engine oluşturma
  - AsyncSession factory (AsyncSessionLocal)
  - FastAPI dependency: get_db()
  - Uygulama başlangıcında tablo/index oluşturma (init_db)
  - Kapatma (close_db)

Tablo tanımları için → schema.py
Yardımcı sorgular için → helpers.py
"""
from __future__ import annotations

import logging
from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.schema import INDEXES, TABLES

logger = logging.getLogger(__name__)

# ── Engine ───────────────────────────────────────────────────────────
# create_async_engine: asyncpg ile asenkron PostgreSQL bağlantısı
# pool_pre_ping: bağlantı sağlığını her kullanımdan önce kontrol eder
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_pre_ping=True,
    echo=settings.DB_ECHO,  # True ise tüm SQL loglanır
)

# ── Session factory ──────────────────────────────────────────────────
# expire_on_commit=False: commit sonrası nesnelere erişimi sürdürür
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ── FastAPI dependency ───────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI endpoint'lerinde Depends(get_db) ile kullanılır.
    Her istek için bir oturum açar; hata durumunda rollback yapar.
    SQLAlchemy autobegin ile ilk sorgu çalışınca transaction otomatik başlar.
    import endpoint'leri db.begin_nested() (SAVEPOINT) kullanarak bu transaction
    içinde güvenli şekilde çalışır.

    Kullanım:
        @router.get("/ornek")
        async def ornek(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


# ── Schema kurulumu ──────────────────────────────────────────────────
async def init_db() -> None:
    """
    Uygulama başlarken (lifespan) çağrılır.
    schema.py'daki TABLES ve INDEXES listelerini çalıştırır.
    IF NOT EXISTS kullandığı için var olan tabloları bozmaz.
    """
    async with engine.begin() as conn:
        for sql in TABLES:
            await conn.execute(text(sql))
        for sql in INDEXES:
            await conn.execute(text(sql))
    logger.info("✅  Veritabanı şeması hazır")


async def close_db() -> None:
    """Uygulama kapanırken (lifespan) engine'i dispose eder."""
    await engine.dispose()
    logger.info("Veritabanı bağlantıları kapatıldı")