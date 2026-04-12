import asyncpg
from config import settings

_pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    global _pool

    # postgres sistem DB'sine bağlan, burdurdb yoksa oluştur
    sys_url = settings.DATABASE_URL.rsplit("/", 1)[0] + "/postgres"
    conn = await asyncpg.connect(sys_url)
    try:
        exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname='burdurdb'")
        if not exists:
            await conn.execute("CREATE DATABASE burdurdb")
            print("✅  burdurdb oluşturuldu")
    finally:
        await conn.close()

    # Asıl DB'ye bağlan
    _pool = await asyncpg.create_pool(dsn=settings.DATABASE_URL, min_size=2, max_size=10)

    # Tabloları oluştur
    async with _pool.acquire() as conn:
        await conn.execute("""
            ALTER TABLE IF EXISTS kooperatif
            ADD COLUMN IF NOT EXISTS ortak_sayisi INTEGER
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS uretim (
                id            SERIAL        PRIMARY KEY,
                uretim_yili   SMALLINT      NOT NULL,
                il            VARCHAR(60)   NOT NULL,
                ilce          VARCHAR(60)   NOT NULL,
                koy           VARCHAR(120)  NOT NULL,
                urun          VARCHAR(120)  NOT NULL,
                tarim_sekli   VARCHAR(20)   NOT NULL,
                uretim_cesidi VARCHAR(20)   NOT NULL,
                ekili_alan    NUMERIC(10,3) NOT NULL DEFAULT 0,
                created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS import_log (
                id           SERIAL      PRIMARY KEY,
                dosya_adi    TEXT        NOT NULL,
                ilce         VARCHAR(60),
                uretim_yili  SMALLINT,
                kayit_sayisi INTEGER,
                silinen      INTEGER     DEFAULT 0,
                sure_sn      NUMERIC(8,2),
                durum        VARCHAR(20) NOT NULL DEFAULT 'basarili',
                hata_mesaji  TEXT,
                yuklendi_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        for idx in [
            "CREATE INDEX IF NOT EXISTS idx_u_yil      ON uretim(uretim_yili)",
            "CREATE INDEX IF NOT EXISTS idx_u_ilce     ON uretim(ilce)",
            "CREATE INDEX IF NOT EXISTS idx_u_koy      ON uretim(koy)",
            "CREATE INDEX IF NOT EXISTS idx_u_urun     ON uretim(urun)",
            "CREATE INDEX IF NOT EXISTS idx_u_ilce_koy ON uretim(ilce, koy)",
        ]:
            await conn.execute(idx)
    print("✅  DB hazır")


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("DB pool başlatılmadı")
    return _pool
