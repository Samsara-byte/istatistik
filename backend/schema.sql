-- ════════════════════════════════════════════════
-- Burdur Tarım — PostgreSQL Schema
-- Çalıştır: psql -d burdurdb -f schema.sql
-- ════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS unaccent;

-- ── Ana tablo ──────────────────────────────────
CREATE TABLE IF NOT EXISTS uretim (
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
);

-- ── İndeksler ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_u_yil      ON uretim(uretim_yili);
CREATE INDEX IF NOT EXISTS idx_u_ilce     ON uretim(ilce);
CREATE INDEX IF NOT EXISTS idx_u_koy      ON uretim(koy);
CREATE INDEX IF NOT EXISTS idx_u_urun     ON uretim(urun);
CREATE INDEX IF NOT EXISTS idx_u_sekli    ON uretim(tarim_sekli);
CREATE INDEX IF NOT EXISTS idx_u_ilce_koy ON uretim(ilce, koy);

-- ── Import log ─────────────────────────────────
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
);
