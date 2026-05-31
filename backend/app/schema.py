"""
schema.py — Veritabanı şema tanımları (DDL)

Tüm CREATE TABLE ve CREATE INDEX ifadeleri burada tutulur.
database.py yalnızca engine/session yönetir; schema bilmez.

YENİ TABLO EKLEMEK İÇİN:
  1. TABLES listesine CREATE TABLE bloğunu ekle.
  2. INDEXES listesine gerekli indexleri ekle.
  3. helpers.py → build_where() fonksiyonuna yeni sütun filtreleri ekle (gerekirse).
  4. app/routers/ altına yeni router dosyasını oluştur.
  5. app/routers/imports.py içine yeni POST /api/import/{isim} endpoint'i ekle.
  6. main.py → for döngüsüne yeni router'ı ekle.
"""
from __future__ import annotations

# ─────────────────────────────────────────────────────────────────────
# TABLOLAR
# Sütun tipleri:
#   SERIAL        → otomatik artan birincil anahtar
#   SMALLINT      → -32768..32767 (yıl gibi küçük tam sayılar)
#   VARCHAR(n)    → maksimum n karakter metin
#   NUMERIC(p,s)  → p toplam basamak, s ondalık (para/alan için)
#   INTEGER       → standart tam sayı
#   TIMESTAMPTZ   → saat dilimi bilgisiyle timestamp
#   TEXT          → sınırsız metin
# ─────────────────────────────────────────────────────────────────────

TABLES: list[str] = [

    # ── Bitkisel üretim (ÇKS kayıtları) ─────────────────────────────
    # Her satır: bir ilçe-köy-ürün-yıl kombinasyonunun ekili alanı
    """CREATE TABLE IF NOT EXISTS uretim (
        id            SERIAL        PRIMARY KEY,
        uretim_yili   SMALLINT      NOT NULL,           -- 2020..2030
        il            VARCHAR(60)   NOT NULL,
        ilce          VARCHAR(60)   NOT NULL,
        koy           VARCHAR(120)  NOT NULL,
        urun          VARCHAR(120)  NOT NULL,           -- "BUĞDAY (EKMEKLIK)" vb.
        tarim_sekli   VARCHAR(20)   NOT NULL,           -- "Kuru" / "Sulu"
        uretim_cesidi VARCHAR(20)   NOT NULL,           -- "1.Üretim" vb.
        ekili_alan    NUMERIC(10,3) NOT NULL DEFAULT 0, -- dekar cinsinden
        created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )""",

    # ── Hayvancılık (tür bazında hayvan ve işletme sayıları) ─────────
    # Her satır: bir köydeki hayvan türü toplamları
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
        sigir_isletme  INTEGER      NOT NULL DEFAULT 0, -- sığır olan işletme adedi
        manda_isletme  INTEGER      NOT NULL DEFAULT 0,
        koyun_isletme  INTEGER      NOT NULL DEFAULT 0,
        keci_isletme   INTEGER      NOT NULL DEFAULT 0,
        toplam_isletme INTEGER      NOT NULL DEFAULT 0,
        created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )""",

    # ── Tarım kooperatifleri ──────────────────────────────────────────
    # Yıl bağımsız; yeni import önceki tüm veriyi siler (truncate=true varsayılan)
    """CREATE TABLE IF NOT EXISTS kooperatif (
        id           SERIAL       PRIMARY KEY,
        ilce         VARCHAR(60)  NOT NULL,
        koy_belde    VARCHAR(120) NOT NULL,
        koop_turu    VARCHAR(80)  NOT NULL,             -- "Tarımsal Kalkınma" vb.
        ortak_sayisi INTEGER,                           -- NULL olabilir
        baskan       VARCHAR(200),
        telefon      VARCHAR(30),
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )""",

    # ── Süt destekleme ödemeleri ──────────────────────────────────────
    # dönem: "2024/1.DÖNEM" gibi string; yıl da ayrıca saklanır
    """CREATE TABLE IF NOT EXISTS sut_destekleme (
        id            SERIAL        PRIMARY KEY,
        donem         VARCHAR(50)   NOT NULL,
        yil           SMALLINT      NOT NULL,
        il            VARCHAR(60)   NOT NULL,
        ilce          VARCHAR(60)   NOT NULL,
        koy           VARCHAR(120)  NOT NULL,
        temel_sut_lt  NUMERIC(14,2) NOT NULL DEFAULT 0, -- litre
        destek_tutari NUMERIC(14,2) NOT NULL DEFAULT 0, -- TL
        created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )""",

    # ── Özet destek tabloları (4 tablo aynı yapıda) ──────────────────
    # Her satır: bir destek kalemi için yıllık toplam tutar
    # alan_bazli_destek: tarla bitkileri, meyve vb. alan bazlı primler
    """CREATE TABLE IF NOT EXISTS alan_bazli_destek (
        id         SERIAL        PRIMARY KEY,
        destek_adi VARCHAR(200)  NOT NULL,
        yil        SMALLINT      NOT NULL,
        tutar_tl   NUMERIC(16,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )""",

    # fark_prim_destek: hububat, bakliyat vb. fark prim ödemeleri
    """CREATE TABLE IF NOT EXISTS fark_prim_destek (
        id         SERIAL        PRIMARY KEY,
        kategori   VARCHAR(200)  NOT NULL,              -- alan_bazli'dan farklı: "kategori"
        yil        SMALLINT      NOT NULL,
        tutar_tl   NUMERIC(16,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )""",

    # hayvancilik_destek: anaç, buzağı, koyun vb. hayvan destekleri
    """CREATE TABLE IF NOT EXISTS hayvancilik_destek (
        id         SERIAL        PRIMARY KEY,
        destek_adi VARCHAR(200)  NOT NULL,
        yil        SMALLINT      NOT NULL,
        tutar_tl   NUMERIC(16,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )""",

    # genel_destek: diğer destekler (sulama, çevre vb.)
    """CREATE TABLE IF NOT EXISTS genel_destek (
        id         SERIAL        PRIMARY KEY,
        destek_adi VARCHAR(200)  NOT NULL,
        yil        SMALLINT      NOT NULL,
        tutar_tl   NUMERIC(16,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )""",

    # ── Bitkisel (organik/entegre) destek ───────────────────────────
    # UNIQUE kısıtı: aynı yıl-ilçe-köy-ürün kombinasyonu tek satır
    # (ON CONFLICT ... DO UPDATE ile kümülatif toplama yapılır)
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
        desteklenen_alan_da NUMERIC(12,3) NOT NULL DEFAULT 0,  -- dekar
        destek_tutari_tl    NUMERIC(16,2) NOT NULL DEFAULT 0,
        net_odeme_tl        NUMERIC(16,2) NOT NULL DEFAULT 0,
        created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()  -- upsert güncellemesi
    )""",

    # ── Planlı Üretim Desteği (İCMAL-2, köy/mahalle detay) ──────────
    # Her satır: bir ilçe-köy-ürün kombinasyonunun destek özeti
    # UNIQUE: aynı yıl-ilçe-köy-ürün kombinasyonu tek satır (ON CONFLICT upsert)
    """CREATE TABLE IF NOT EXISTS planli_uretim_destek (
        id                      SERIAL        PRIMARY KEY,
        yil                     SMALLINT      NOT NULL,
        il                      VARCHAR(60)   NOT NULL DEFAULT 'BURDUR',
        ilce                    VARCHAR(60)   NOT NULL,
        koy                     VARCHAR(120)  NOT NULL,
        urun_grubu              VARCHAR(120)  NOT NULL,
        isletme_sayisi          INTEGER       NOT NULL DEFAULT 0,
        destege_tabi_alan_da    NUMERIC(14,3) NOT NULL DEFAULT 0,
        yeralti_su_alan_da      NUMERIC(14,3) NOT NULL DEFAULT 0,
        destekleme_miktari_tl   NUMERIC(16,2) NOT NULL DEFAULT 0,
        created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )""",

    # ── ÇKS çiftçi kayıt sayıları ────────────────────────────────────
    # uretim tablosuyla JOIN için: ciftci_sayisi = cks_sayisi.sayi
    """CREATE TABLE IF NOT EXISTS cks_sayisi (
        id   SERIAL       PRIMARY KEY,
        yil  SMALLINT     NOT NULL,
        ilce VARCHAR(60)  NOT NULL,
        koy  VARCHAR(120) NOT NULL,
        sayi INTEGER      NOT NULL DEFAULT 0
    )""",

    # ── Import geçmişi (audit log) ────────────────────────────────────
    # Her başarılı import sonrası bir satır eklenir.
    # dosya_hash ile aynı dosyanın tekrar yüklenmesi engellenir.
    """CREATE TABLE IF NOT EXISTS import_log (
        id           SERIAL      PRIMARY KEY,
        dosya_adi    TEXT        NOT NULL,
        dosya_hash   VARCHAR(64),              -- SHA-256 hex
        ilce         VARCHAR(60),              -- NULL olabilir (genel importlar için)
        uretim_yili  SMALLINT,
        kayit_sayisi INTEGER,
        silinen      INTEGER     DEFAULT 0,
        sure_sn      NUMERIC(8,2),             -- import süresi (saniye)
        durum        VARCHAR(20) NOT NULL DEFAULT 'basarili',
        hata_mesaji  TEXT,
        yuklendi_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )""",
]


# ─────────────────────────────────────────────────────────────────────
# INDEX'LER
# Kural: WHERE veya ORDER BY'da sık kullanılan her sütun için index.
# UNIQUE index → veri bütünlüğü garantisi (bitkisel_destek gibi).
# ─────────────────────────────────────────────────────────────────────

INDEXES: list[str] = [
    # uretim — yıl, ilçe, köy, ürün ve bileşik (ilçe+köy) aramaları
    "CREATE INDEX IF NOT EXISTS idx_u_yil      ON uretim(uretim_yili)",
    "CREATE INDEX IF NOT EXISTS idx_u_ilce     ON uretim(ilce)",
    "CREATE INDEX IF NOT EXISTS idx_u_koy      ON uretim(koy)",
    "CREATE INDEX IF NOT EXISTS idx_u_urun     ON uretim(urun)",
    "CREATE INDEX IF NOT EXISTS idx_u_ilce_koy ON uretim(ilce, koy)",

    # hayvancilik
    "CREATE INDEX IF NOT EXISTS idx_h_yil      ON hayvancilik(uretim_yili)",
    "CREATE INDEX IF NOT EXISTS idx_h_ilce     ON hayvancilik(ilce)",
    "CREATE INDEX IF NOT EXISTS idx_h_ilce_koy ON hayvancilik(ilce, koy)",

    # kooperatif
    "CREATE INDEX IF NOT EXISTS idx_k_ilce     ON kooperatif(ilce)",

    # sut_destekleme
    "CREATE INDEX IF NOT EXISTS idx_sd_yil     ON sut_destekleme(yil)",
    "CREATE INDEX IF NOT EXISTS idx_sd_ilce    ON sut_destekleme(ilce)",

    # özet destek tabloları (sadece yıl bazında sorgu yapılır)
    "CREATE INDEX IF NOT EXISTS idx_abd_yil    ON alan_bazli_destek(yil)",
    "CREATE INDEX IF NOT EXISTS idx_fpd_yil    ON fark_prim_destek(yil)",
    "CREATE INDEX IF NOT EXISTS idx_hd_yil     ON hayvancilik_destek(yil)",
    "CREATE INDEX IF NOT EXISTS idx_gd_yil     ON genel_destek(yil)",

    # bitkisel_destek — UNIQUE: ON CONFLICT için şart
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_bd_unique ON bitkisel_destek(yil, ilce, koy, urun)",
    "CREATE INDEX IF NOT EXISTS idx_bd_yil     ON bitkisel_destek(yil)",
    "CREATE INDEX IF NOT EXISTS idx_bd_ilce    ON bitkisel_destek(ilce)",

    # planli_uretim_destek
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_pud_unique ON planli_uretim_destek(yil, ilce, koy, urun_grubu)",
    "CREATE INDEX IF NOT EXISTS idx_pud_yil        ON planli_uretim_destek(yil)",
    "CREATE INDEX IF NOT EXISTS idx_pud_ilce       ON planli_uretim_destek(ilce)",
    "CREATE INDEX IF NOT EXISTS idx_pud_ilce_koy   ON planli_uretim_destek(ilce, koy)",

    # cks_sayisi — uretim JOIN'i için bileşik index
    "CREATE INDEX IF NOT EXISTS idx_cks_yil    ON cks_sayisi(yil)",
    "CREATE INDEX IF NOT EXISTS idx_cks_ik     ON cks_sayisi(ilce, koy)",

    # import_log — tekrar yükleme kontrolü için hash index
    "CREATE INDEX IF NOT EXISTS idx_il_hash    ON import_log(dosya_hash)",
]