"""
Veritabanı yönetimi — SQLAlchemy async engine + tablo oluşturma.
"""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.config import settings

_engine: AsyncEngine | None = None

# ── DDL ──────────────────────────────────────────────────────────────────────
_DDL: list[str] = [
    "CREATE EXTENSION IF NOT EXISTS unaccent",

    # Bitkisel üretim
    """CREATE TABLE IF NOT EXISTS uretim (
        id             SERIAL        PRIMARY KEY,
        uretim_yili    SMALLINT      NOT NULL,
        il             VARCHAR(60)   NOT NULL,
        ilce           VARCHAR(60)   NOT NULL,
        koy            VARCHAR(120)  NOT NULL,
        urun           VARCHAR(120)  NOT NULL,
        tarim_sekli    VARCHAR(20)   NOT NULL,
        uretim_cesidi  VARCHAR(20)   NOT NULL,
        ekili_alan     NUMERIC(10,3) NOT NULL DEFAULT 0,
        created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS idx_u_yil      ON uretim(uretim_yili)",
    "CREATE INDEX IF NOT EXISTS idx_u_ilce     ON uretim(ilce)",
    "CREATE INDEX IF NOT EXISTS idx_u_koy      ON uretim(koy)",
    "CREATE INDEX IF NOT EXISTS idx_u_urun     ON uretim(urun)",
    "CREATE INDEX IF NOT EXISTS idx_u_ilce_koy ON uretim(ilce, koy)",

    # Hayvancılık
    """CREATE TABLE IF NOT EXISTS hayvancilik (
        id             SERIAL       PRIMARY KEY,
        uretim_yili    SMALLINT     NOT NULL,
        il             VARCHAR(60)  NOT NULL,
        ilce           VARCHAR(60)  NOT NULL,
        koy            VARCHAR(120) NOT NULL,
        sigir          INTEGER      NOT NULL DEFAULT 0,
        manda          INTEGER      NOT NULL DEFAULT 0,
        koyun          INTEGER      NOT NULL DEFAULT 0,
        keci           INTEGER      NOT NULL DEFAULT 0,
        sigir_isletme  INTEGER      NOT NULL DEFAULT 0,
        manda_isletme  INTEGER      NOT NULL DEFAULT 0,
        koyun_isletme  INTEGER      NOT NULL DEFAULT 0,
        keci_isletme   INTEGER      NOT NULL DEFAULT 0,
        toplam_isletme INTEGER      NOT NULL DEFAULT 0,
        created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS idx_h_yil      ON hayvancilik(uretim_yili)",
    "CREATE INDEX IF NOT EXISTS idx_h_ilce     ON hayvancilik(ilce)",
    "CREATE INDEX IF NOT EXISTS idx_h_ilce_koy ON hayvancilik(ilce, koy)",

    # Kooperatif
    """CREATE TABLE IF NOT EXISTS kooperatif (
        id           SERIAL       PRIMARY KEY,
        ilce         VARCHAR(60)  NOT NULL,
        koy_belde    VARCHAR(120) NOT NULL,
        koop_turu    VARCHAR(80)  NOT NULL,
        ortak_sayisi INTEGER,
        baskan       VARCHAR(200),
        telefon      VARCHAR(30),
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS idx_k_ilce ON kooperatif(ilce)",
    "CREATE INDEX IF NOT EXISTS idx_k_tur  ON kooperatif(koop_turu)",

    # Süt destekleme
    """CREATE TABLE IF NOT EXISTS sut_destekleme (
        id            SERIAL        PRIMARY KEY,
        donem         VARCHAR(50)   NOT NULL,
        yil           SMALLINT      NOT NULL,
        il            VARCHAR(60)   NOT NULL,
        ilce          VARCHAR(60)   NOT NULL,
        koy           VARCHAR(120)  NOT NULL,
        temel_sut_lt  NUMERIC(14,2) NOT NULL DEFAULT 0,
        destek_tutari NUMERIC(14,2) NOT NULL DEFAULT 0,
        created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS idx_sd_yil  ON sut_destekleme(yil)",
    "CREATE INDEX IF NOT EXISTS idx_sd_ilce ON sut_destekleme(ilce)",
    "CREATE INDEX IF NOT EXISTS idx_sd_ik   ON sut_destekleme(ilce, koy)",

    # Özet destek tabloları (alan bazlı, fark prim, hayvancılık, genel)
    """CREATE TABLE IF NOT EXISTS alan_bazli_destek (
        id SERIAL PRIMARY KEY, destek_adi VARCHAR(200) NOT NULL,
        yil SMALLINT NOT NULL, tutar_tl NUMERIC(16,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS idx_abd_yil ON alan_bazli_destek(yil)",

    """CREATE TABLE IF NOT EXISTS fark_prim_destek (
        id SERIAL PRIMARY KEY, kategori VARCHAR(200) NOT NULL,
        yil SMALLINT NOT NULL, tutar_tl NUMERIC(16,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS idx_fpd_yil ON fark_prim_destek(yil)",

    """CREATE TABLE IF NOT EXISTS hayvancilik_destek (
        id SERIAL PRIMARY KEY, destek_adi VARCHAR(200) NOT NULL,
        yil SMALLINT NOT NULL, tutar_tl NUMERIC(16,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS idx_hd_yil ON hayvancilik_destek(yil)",

    """CREATE TABLE IF NOT EXISTS genel_destek (
        id SERIAL PRIMARY KEY, destek_adi VARCHAR(200) NOT NULL,
        yil SMALLINT NOT NULL, tutar_tl NUMERIC(16,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS idx_gd_yil ON genel_destek(yil)",

    # Bitkisel destek (biyolojik mücadele)
    """CREATE TABLE IF NOT EXISTS bitkisel_destek (
        id                  SERIAL        PRIMARY KEY,
        yil                 SMALLINT      NOT NULL,
        il                  VARCHAR(60)   NOT NULL DEFAULT 'BURDUR',
        ilce                VARCHAR(60)   NOT NULL,
        koy                 VARCHAR(120)  NOT NULL,
        urun                VARCHAR(120)  NOT NULL,
        feromon_adet        NUMERIC(12,2) NOT NULL DEFAULT 0,
        feromon_tuzak_adet  NUMERIC(12,2) NOT NULL DEFAULT 0,
        faydali_bocek_adet  NUMERIC(12,2) NOT NULL DEFAULT 0,
        desteklenen_alan_da NUMERIC(12,3) NOT NULL DEFAULT 0,
        destek_tutari_tl    NUMERIC(16,2) NOT NULL DEFAULT 0,
        net_odeme_tl        NUMERIC(16,2) NOT NULL DEFAULT 0,
        created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_bd UNIQUE (yil, ilce, koy, urun)
    )""",
    "CREATE INDEX IF NOT EXISTS idx_bd_yil  ON bitkisel_destek(yil)",
    "CREATE INDEX IF NOT EXISTS idx_bd_ilce ON bitkisel_destek(ilce)",

    # ÇKS çiftçi kayıt sistemi
    """CREATE TABLE IF NOT EXISTS cks_sayisi (
        id SERIAL PRIMARY KEY, yil SMALLINT NOT NULL,
        ilce VARCHAR(60) NOT NULL, koy VARCHAR(120) NOT NULL,
        sayi INTEGER NOT NULL DEFAULT 0
    )""",
    "CREATE INDEX IF NOT EXISTS idx_cks_yil ON cks_sayisi(yil)",
    "CREATE INDEX IF NOT EXISTS idx_cks_ik  ON cks_sayisi(ilce, koy)",

    # Import log
    """CREATE TABLE IF NOT EXISTS import_log (
        id           SERIAL       PRIMARY KEY,
        dosya_adi    TEXT         NOT NULL,
        dosya_hash   VARCHAR(64),
        tablo        VARCHAR(40),
        ilce         VARCHAR(60),
        yil          SMALLINT,
        kayit_sayisi INTEGER,
        silinen      INTEGER      DEFAULT 0,
        sure_sn      NUMERIC(8,2),
        durum        VARCHAR(20)  NOT NULL DEFAULT 'basarili',
        hata_mesaji  TEXT,
        yuklendi_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS idx_il_hash ON import_log(dosya_hash)",
    "CREATE INDEX IF NOT EXISTS idx_il_yil  ON import_log(yil)",
    "CREATE INDEX IF NOT EXISTS idx_il_tbl  ON import_log(tablo)",
]


async def _ensure_db() -> None:
    sys_engine = create_async_engine(settings.sys_database_url, isolation_level="AUTOCOMMIT")
    try:
        async with sys_engine.connect() as conn:
            exists = (
                await conn.execute(
                    text("SELECT 1 FROM pg_database WHERE datname=:n"),
                    {"n": settings.db_name},
                )
            ).scalar()
            if not exists:
                await conn.execute(text(f'CREATE DATABASE "{settings.db_name}"'))
                print(f"✅  '{settings.db_name}' oluşturuldu.")
            else:
                print(f"✅  '{settings.db_name}' mevcut.")
    finally:
        await sys_engine.dispose()


async def init_engine() -> None:
    global _engine
    await _ensure_db()
    _engine = create_async_engine(
        settings.DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        echo=settings.DEBUG,
    )
    async with _engine.begin() as conn:
        for stmt in _DDL:
            await conn.execute(text(stmt))
    print("✅  DB hazır.")


async def close_engine() -> None:
    global _engine
    if _engine:
        await _engine.dispose()
        _engine = None
        print("✅  Engine kapatıldı.")


def get_engine() -> AsyncEngine:
    if _engine is None:
        raise RuntimeError("Engine başlatılmadı.")
    return _engine
