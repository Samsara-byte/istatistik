# Burdur Tarım API — Tam Dokümantasyon

> **Versiyon:** 2.0.0 | **Stack:** FastAPI + PostgreSQL + asyncpg

---

## İçindekiler

1. [Genel Bakış](#1-genel-bakış)
2. [Proje Yapısı](#2-proje-yapısı)
3. [Kurulum](#3-kurulum)
4. [Veritabanı Şeması](#4-veritabanı-şeması)
5. [API Endpoint Referansı](#5-api-endpoint-referansı)
6. [Mimari ve Kod Akışı](#6-mimari-ve-kod-akışı)
7. [Yeni Modül Ekleme Rehberi](#7-yeni-modül-ekleme-rehberi)
8. [Sık Sorulan Sorular](#8-sık-sorulan-sorular)

---

## 1. Genel Bakış

Burdur Tarım API, il tarım müdürlüğüne ait Excel/XLS verilerini PostgreSQL'e aktaran ve REST API üzerinden sunan bir backend servisidir.

**Temel özellikler:**
- Excel/XLS dosyalarını içe aktarma (import)
- Yıl, ilçe, köy bazında filtreleme ve sayfalama
- SHA-256 hash ile aynı dosyanın tekrar yüklenmesini engelleme
- Her import işlemi `import_log` tablosunda kayıt altına alınır
- Async SQLAlchemy + asyncpg ile yüksek performanslı sorgular

---

## 2. Proje Yapısı

```
burdur_tarim_api/
│
├── app/
│   ├── __init__.py
│   ├── main.py          ← FastAPI uygulaması, router kayıtları, lifespan
│   ├── config.py        ← Tüm ayarlar (.env'den okunur)
│   ├── database.py      ← Engine, session, init_db, close_db
│   ├── schema.py        ← Tüm CREATE TABLE + CREATE INDEX tanımları
│   ├── helpers.py       ← Ortak yardımcılar: paginate, build_where, sha256…
│   ├── excel.py         ← Excel/XLS ayrıştırıcılar (openpyxl + custom binary)
│   ├── exceptions.py    ← Özel HTTP hata sınıfları
│   │
│   └── routers/
│       ├── __init__.py
│       ├── uretim.py          ← /api/uretim
│       ├── hayvancilik.py     ← /api/hayvancilik
│       ├── kooperatif.py      ← /api/kooperatif
│       ├── sut.py             ← /api/sut
│       ├── bitkisel.py        ← /api/bitkisel-destek
│       ├── cks.py             ← /api/cks-sayisi
│       ├── destekler.py       ← /api/{alan-bazli, fark-prim, …}
│       └── imports.py         ← /api/import/*
│
├── requirements.txt
├── .env.example
├── .gitignore
└── DOKUMANTASYON.md
```

**Dosya sorumluluk özeti:**

| Dosya | Ne yapar? | Ne YAPMAZ? |
|---|---|---|
| `config.py` | Ayarları okur | DB sorgusu yapmaz |
| `database.py` | Bağlantı yönetir | SQL içermez (schema.py'a devreder) |
| `schema.py` | DDL tanımlar | Sorgu yazmaz |
| `helpers.py` | Ortak yardımcılar | Business logic içermez |
| `excel.py` | Dosya ayrıştırır | DB'ye yazmaz |
| `routers/*.py` | HTTP katmanı | Excel okumaz |
| `imports.py` | Import orchestration | Kendi başına ayrıştırmaz |

---

## 3. Kurulum

### Ön gereksinimler

- Python 3.11+
- PostgreSQL 14+

### Adımlar

```bash
# 1. Sanal ortam
python -m venv venv
source venv/bin/activate        # Linux/Mac
venv\Scripts\activate           # Windows

# 2. Bağımlılıklar
pip install -r requirements.txt

# 3. Ortam değişkenleri
cp .env.example .env
# .env'i düzenle: DATABASE_URL, DEBUG vb.

# 4. Veritabanını oluştur (PostgreSQL'de)
createdb burdurdb

# 5. Başlat (tablolar otomatik oluşur)
uvicorn app.main:app --reload --port 8000
```

### .env değişkenleri

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/burdurdb` | asyncpg sürücüsü şart |
| `DEBUG` | `false` | `true` yapınca tüm SQL loglanır |
| `DB_POOL_SIZE` | `5` | Eş zamanlı bağlantı sayısı |
| `DB_MAX_OVERFLOW` | `10` | Havuz dolunca ek bağlantı |
| `DB_POOL_TIMEOUT` | `30` | Bağlantı beklemek için max saniye |
| `DB_ECHO` | `false` | SQLAlchemy SQL çıktısı |

---

## 4. Veritabanı Şeması

### Tablolar ve İlişkiler

```
uretim ──────────────────────┐
  id, uretim_yili,           │
  il, ilce, koy, urun,       │ JOIN: ilce+koy+yil
  tarim_sekli, uretim_cesidi,│
  ekili_alan                 ├── cks_sayisi
                             │     id, yil, ilce, koy, sayi
hayvancilik                  │
  id, uretim_yili,           │
  il, ilce, koy,             │
  sigir, manda, koyun, keci, │
  *_isletme, toplam_isletme  │
                             │
sut_destekleme               │       import_log ←── tüm import işlemleri
  id, donem, yil,            │         id, dosya_adi, dosya_hash,
  il, ilce, koy,             │         ilce, uretim_yili,
  temel_sut_lt, destek_tutari│         kayit_sayisi, silinen,
                             │         sure_sn, durum
kooperatif                   │
  id, ilce, koy_belde,       │
  koop_turu, ortak_sayisi,   │
  baskan, telefon            │

bitkisel_destek              │   ← UNIQUE(yil, ilce, koy, urun)
  id, yil, il, ilce,         │
  koy, urun,                 │
  feromon_*, faydali_*,      │
  desteklenen_alan_da,       │
  destek_tutari_tl,          │
  net_odeme_tl               │

── Özet destek tabloları (aynı yapı) ──────────────────────────────────
alan_bazli_destek     → destek_adi, yil, tutar_tl
fark_prim_destek      → kategori,   yil, tutar_tl
hayvancilik_destek    → destek_adi, yil, tutar_tl
genel_destek          → destek_adi, yil, tutar_tl
```

### Tablo Detayları

#### `uretim`

| Sütun | Tip | Açıklama |
|---|---|---|
| `id` | SERIAL PK | Otomatik artan |
| `uretim_yili` | SMALLINT | 2020–2030 arası |
| `il` | VARCHAR(60) | Büyük harf ("BURDUR") |
| `ilce` | VARCHAR(60) | Büyük harf ("MERKEZ") |
| `koy` | VARCHAR(120) | Köy/mahalle adı |
| `urun` | VARCHAR(120) | "BUĞDAY (EKMEKLİK)" formatı |
| `tarim_sekli` | VARCHAR(20) | "Kuru" veya "Sulu" |
| `uretim_cesidi` | VARCHAR(20) | "1.Üretim" vb. |
| `ekili_alan` | NUMERIC(10,3) | Dekar cinsinden |
| `created_at` | TIMESTAMPTZ | Kayıt zamanı |

**İndeksler:** `uretim_yili`, `ilce`, `koy`, `urun`, `(ilce, koy)`

#### `hayvancilik`

| Sütun | Tip | Açıklama |
|---|---|---|
| `uretim_yili` | SMALLINT | — |
| `il, ilce, koy` | VARCHAR | — |
| `sigir, manda, koyun, keci` | INTEGER | Hayvan sayıları |
| `sigir_isletme` … `keci_isletme` | INTEGER | Her türde işletme adedi |
| `toplam_isletme` | INTEGER | Tüm türlerin toplamı |

#### `sut_destekleme`

| Sütun | Tip | Açıklama |
|---|---|---|
| `donem` | VARCHAR(50) | "2024/1.DÖNEM" |
| `yil` | SMALLINT | Dönemden çıkarılan yıl |
| `temel_sut_lt` | NUMERIC(14,2) | Litre |
| `destek_tutari` | NUMERIC(14,2) | TL |

#### `bitkisel_destek`

UNIQUE index: `(yil, ilce, koy, urun)` — aynı kayıt için `ON CONFLICT DO UPDATE` ile toplanır.

| Sütun | Açıklama |
|---|---|
| `feromon_adet` | Feromon kapsül adedi |
| `feromon_tuzak_adet` | Tuzak adedi |
| `faydali_bocek_adet` | Faydalı böcek adedi |
| `desteklened_alan_da` | Desteklenen alan (dekar) |
| `destek_tutari_tl` | Brüt destek tutarı |
| `net_odeme_tl` | Kesintiler sonrası net ödeme |

#### `import_log`

Her `POST /api/import/*` çağrısında bir satır eklenir.

| Sütun | Açıklama |
|---|---|
| `dosya_hash` | SHA-256 — tekrar yükleme engeli |
| `kayit_sayisi` | Eklenen satır adedi |
| `silinen` | Truncate ile silinen satır adedi |
| `sure_sn` | Import süresi (saniye) |
| `durum` | "basarili" veya "hata" |

---

## 5. API Endpoint Referansı

### Temel URL

```
http://localhost:8000
```

Swagger UI: `http://localhost:8000/docs`

---

### GET /api/uretim

Bitkisel üretim verilerini listeler. Opsiyonel gruplandırma destekler.

**Query parametreleri:**

| Parametre | Tip | Varsayılan | Açıklama |
|---|---|---|---|
| `yil` | int | 2025 | Üretim yılı |
| `ilce` | str | — | İlçe filtresi (büyük/küçük harf duyarsız) |
| `koy` | str | — | Köy filtresi (kısmi eşleşme) |
| `urun` | str | — | Ürün filtresi (kısmi eşleşme) |
| `tarim_sekli` | str | — | "Kuru" veya "Sulu" |
| `group_by` | str | — | `koy`, `urun`, `urun_basit` |
| `sort_by` | str | `ilce` | Sıralama sütunu |
| `sort_dir` | str | `asc` | `asc` veya `desc` |
| `page` | int | 1 | Sayfa numarası |
| `limit` | int | 100 | Sayfa başına kayıt (max 50000) |

**Örnek istek:**
```
GET /api/uretim?yil=2024&ilce=MERKEZ&group_by=urun&sort_dir=desc
```

**Örnek yanıt:**
```json
{
  "data": [
    {
      "urun": "BUĞDAY (EKMEKLİK)",
      "tarim_sekli": "Kuru",
      "ilce_sayisi": 3,
      "koy_sayisi": 45,
      "kayit_sayisi": 120,
      "toplam_alan": 15234.50
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 100,
  "pages": 1
}
```

---

### GET /api/uretim/ozet

İlçe, köy veya ürün bazında özet istatistikler.

**Query parametreleri:**

| Parametre | Değerler |
|---|---|
| `group_by` | `ilce` (varsayılan), `koy`, `urun`, `tarim_sekli`, `uretim_cesidi` |

---

### GET /api/uretim/urunler

Yıla göre tüm ürün listesi ve toplam alanları.

---

### GET /api/uretim/ilceler

İlçe listesi, köy sayısı ve toplam alan.

---

### GET /api/uretim/log

Son import işlemlerinin listesi.

---

### DELETE /api/uretim/temizle

| Parametre | Açıklama |
|---|---|
| `yil` | Sadece bu yılı sil |
| `ilce` | `yil` ile birlikte: sadece bu ilçeyi sil |
| (boş) | Tüm tabloyu temizle |

---

### GET /api/hayvancilik

| Parametre | Açıklama |
|---|---|
| `yil` | int, varsayılan 2025 |
| `ilce`, `koy` | filtreler |
| `page`, `limit` | sayfalama |

**Yanıt alanları:** `sigir`, `manda`, `koyun`, `keci`, `*_isletme`, `toplam_isletme`

---

### GET /api/hayvancilik/ozet

İlçe veya köy bazında toplam hayvan ve işletme sayıları.

---

### GET /api/sut

Süt destekleme ödemeleri.

| Parametre | Açıklama |
|---|---|
| `yil` | — |
| `donem` | "2024/1.DÖNEM" gibi tam eşleşme |
| `ilce`, `koy` | filtreler |
| `sort_by` | `destek_tutari` (varsayılan), `temel_sut_lt`, `ilce` vb. |

---

### GET /api/sut/donemler

Sistemdeki tüm dönem listesi.

---

### GET /api/kooperatif

| Parametre | Açıklama |
|---|---|
| `ilce` | İlçe filtresi |
| `koop_turu` | Kısmi eşleşme |
| `ara` | Köy adı veya başkan adında arama |

---

### GET /api/bitkisel-destek

| Parametre | Açıklama |
|---|---|
| `yil` | Zorunlu değil, varsayılan 2025 |
| `ilce`, `koy`, `urun` | filtreler |
| `sort_by` | `desteklenen_alan_da` (varsayılan) |

---

### GET /api/bitkisel-destek/ozet

`group_by`: `ilce`, `koy`, `urun`

---

### GET /api/cks-sayisi

ÇKS'ye kayıtlı çiftçi sayıları (ilçe/köy/yıl bazında).

---

### Özet Destek Tabloları

Her biri için üç endpoint:

| Endpoint | Tablo |
|---|---|
| `/api/alan-bazli` | `alan_bazli_destek` |
| `/api/fark-prim` | `fark_prim_destek` |
| `/api/hayvancilik-destek` | `hayvancilik_destek` |
| `/api/genel-destek` | `genel_destek` |

Her endpoint: `GET /api/{isim}`, `GET /api/{isim}/ozet`, `DELETE /api/{isim}/temizle`

---

### Import Endpoint'leri

Tüm import'lar `POST /api/import/*` altındadır.

#### POST /api/import/uretim

Excel'den bitkisel üretim verisi aktarır.

**Form alanları:**

| Alan | Tip | Açıklama |
|---|---|---|
| `file` | UploadFile | xlsx, xls, xlsm, ods |
| `yil` | str (opsiyonel) | Belirtilmezse dosya adından çıkarılır |
| `truncate` | str | `"true"` (varsayılan) = önce sil, `"false"` = ekle |

**Yanıt:**
```json
{
  "ok": true,
  "ilce": "MERKEZ",
  "yil": 2024,
  "eklenen": 1523,
  "silinen": 1480,
  "atlandi": 3,
  "sure_sn": 0.84
}
```

---

#### POST /api/import/hayvancilik

**Önemli:** Yalnızca `.xls` (legacy binary) formatı kabul eder.
Dosya adı `ILCEADI_2024.xls` formatında olmalıdır; ilçe adı dosya adından çıkarılır.

---

#### POST /api/import/kooperatif

Yıl bilgisi gerektirmez. `truncate=true` ile tüm tablo silinir.

---

#### POST /api/import/sut

| Alan | Açıklama |
|---|---|
| `donem` | "2024/1.DÖNEM" (opsiyonel, yıldan türetilir) |
| `yil` | 4 haneli yıl (zorunlu veya dönem içinde) |
| `truncate` | Varsayılan `"false"` (birden fazla dönem olabilir) |

---

#### POST /api/import/bitkisel-destek

Aynı `(yil, ilce, koy, urun)` kombinasyonu varsa değerler eklenir (`DO UPDATE SET alan = alan + EXCLUDED.alan`).

---

#### POST /api/import/cks-sayisi

| Alan | Açıklama |
|---|---|
| `yil` | Zorunlu form alanı |

---

#### POST /api/import/{alan-bazli | fark-prim | hayvancilik-destek | genel-destek}

Özet destek tabloları için. `truncate=false` varsayılan (yıllık veriler biriktirilir).

---

### GET /health

```json
{"status": "healthy", "app": "Burdur Tarım API", "version": "2.0.0"}
```

---

## 6. Mimari ve Kod Akışı

### Bir import isteğinin yolculuğu

```
İstemci
  │
  ▼  POST /api/import/uretim (multipart/form-data)
FastAPI (main.py)
  │  ↳ CORSMiddleware
  │  ↳ exception_handler
  ▼
imports.py → import_uretim()
  ├── check_extension()        helpers.py  → uzantı doğrulama
  ├── sha256(content)          helpers.py  → hash hesapla
  ├── find_duplicate()         helpers.py  → import_log sorgusu
  ├── parse_uretim_xlsx()      excel.py    → satırları ayrıştır
  └── db.begin()
        ├── DELETE FROM uretim ...          (truncate=true ise)
        ├── _batch_insert()                 500'lük gruplarda INSERT
        └── write_import_log()  helpers.py → log kaydı
  ▼
{"ok": true, "eklenen": 1523, ...}
```

### Bir GET isteğinin yolculuğu

```
İstemci
  │
  ▼  GET /api/uretim?yil=2024&ilce=MERKEZ&group_by=urun
FastAPI → uretim.py → list_uretim()
  ├── build_where(yil=2024, ilce="MERKEZ")   helpers.py
  │     → "WHERE u.uretim_yili = :yil AND UPPER(u.ilce) = UPPER(:ilce)"
  ├── safe_sort(sort_by, _SORT_FIELDS, "toplam_alan")
  ├── db.execute(SQL, params)
  ├── db.execute(COUNT SQL, params)
  └── paginate(total, page, limit)           helpers.py
  ▼
{"data": [...], "total": 45, "page": 1, "limit": 100, "pages": 1}
```

### Excel ayrıştırma mantığı

`excel.py` iki farklı yöntem kullanır:

- **XLSX (openpyxl):** `parse_uretim_xlsx`, `parse_sut_xlsx`, `parse_cks_xlsx`
  - openpyxl `read_only=True, data_only=True` ile açar
  - Başlık satırını dinamik bulur (`find_uretim_columns`)

- **XLS binary (custom parser):** `parse_hayvancilik_xls`, `parse_kooperatif_xls`, `parse_bitkisel_xls`, `parse_ozet_xls`
  - `_read_xls_cells()`: OLE/BIFF8 formatını sıfırdan ayrıştırır
  - Harici kütüphane bağımlılığı yoktur

---

## 7. Yeni Modül Ekleme Rehberi

Bu bölüm, sisteme yeni bir veri türü (örneğin `sulama` veya `aricilik`) eklemenin adım adım kılavuzudur.

> **Örnek senaryo:** `aricilik` adında yeni bir tablo ekleyeceğiz.
> Her satır: bir köydeki kovan sayısı ve bal üretimi.

---

### Adım 1 — `schema.py`'a tablo ve index ekle

```python
# schema.py → TABLES listesine ekle

"""CREATE TABLE IF NOT EXISTS aricilik (
    id          SERIAL       PRIMARY KEY,
    uretim_yili SMALLINT     NOT NULL,
    il          VARCHAR(60)  NOT NULL,
    ilce        VARCHAR(60)  NOT NULL,
    koy         VARCHAR(120) NOT NULL,
    kovan_sayisi INTEGER     NOT NULL DEFAULT 0,
    bal_kg       NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
)""",
```

```python
# INDEXES listesine ekle

"CREATE INDEX IF NOT EXISTS idx_ari_yil      ON aricilik(uretim_yili)",
"CREATE INDEX IF NOT EXISTS idx_ari_ilce     ON aricilik(ilce)",
"CREATE INDEX IF NOT EXISTS idx_ari_ilce_koy ON aricilik(ilce, koy)",
```

> Uygulama yeniden başlatıldığında `init_db()` tabloyu otomatik oluşturur.

---

### Adım 2 — `excel.py`'a ayrıştırıcı ekle

```python
# excel.py → dosyanın sonuna ekle

def parse_aricilik_xls(content: bytes, ilce_adi: str, yil: int) -> list[dict]:
    """
    Arıcılık XLS dosyasını ayrıştırır.
    Beklenen sütunlar: köy, kovan sayısı, bal üretimi (kg)
    """
    cells = _read_xls_cells(content)
    if not cells:
        return []

    max_row = max(r for r, _ in cells)
    # Başlık satırını bul
    header_row = col_koy = col_kovan = col_bal = None
    for r in range(min(20, max_row)):
        strs = {c: str(v) for c in range(20)
                if isinstance((v := cells.get((r, c), "")), str)}
        if any("Köy" in v for v in strs.values()):
            header_row = r
            for col, v in strs.items():
                if "Köy" in v:    col_koy   = col
                if "Kovan" in v:  col_kovan = col
                if "Bal" in v:    col_bal   = col
            break

    if header_row is None:
        return []

    rows = []
    for r in range(header_row + 1, max_row + 1):
        koy = cells.get((r, col_koy), "")
        if not isinstance(koy, str) or not koy.strip():
            continue
        rows.append({
            "uretim_yili": yil,
            "il":          "BURDUR",
            "ilce":        ilce_adi.upper(),
            "koy":         koy.strip().upper(),
            "kovan_sayisi": max(0, int(float(cells.get((r, col_kovan), 0) or 0))),
            "bal_kg":       round(float(cells.get((r, col_bal), 0) or 0), 2),
        })
    return rows
```

---

### Adım 3 — Router dosyası oluştur

`app/routers/aricilik.py` dosyası oluştur:

```python
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.helpers import build_where, paginate

router = APIRouter(prefix="/api/aricilik", tags=["Arıcılık"])


@router.get("")
async def list_aricilik(
    yil:   int           = Query(2025),
    ilce:  Optional[str] = Query(None),
    koy:   Optional[str] = Query(None),
    page:  int           = Query(1, ge=1),
    limit: int           = Query(100, ge=1, le=50_000),
    db:    AsyncSession  = Depends(get_db),
):
    clauses = ["uretim_yili = :yil"]
    params: dict = {"yil": yil}
    if ilce:
        clauses.append("UPPER(ilce) = UPPER(:ilce)"); params["ilce"] = ilce
    if koy:
        clauses.append("UPPER(koy) LIKE UPPER(:koy)"); params["koy"] = f"%{koy}%"

    where  = "WHERE " + " AND ".join(clauses)
    offset = (page - 1) * limit

    sql = f"""
        SELECT ilce, koy,
               SUM(kovan_sayisi)::int       AS kovan_sayisi,
               ROUND(SUM(bal_kg)::numeric,2) AS bal_kg
        FROM aricilik {where}
        GROUP BY ilce, koy ORDER BY ilce, koy
        LIMIT :limit OFFSET :offset
    """
    cnt = f"SELECT COUNT(*) FROM (SELECT koy FROM aricilik {where} GROUP BY ilce,koy) s"

    rows  = (await db.execute(text(sql), {**params, "limit": limit, "offset": offset})).mappings().all()
    total = (await db.execute(text(cnt), params)).scalar() or 0
    return {"data": [dict(r) for r in rows], **paginate(int(total), page, limit)}


@router.get("/ozet")
async def aricilik_ozet(
    yil:  int           = Query(2025),
    ilce: Optional[str] = Query(None),
    db:   AsyncSession  = Depends(get_db),
):
    where, params = build_where(yil=yil, ilce=ilce)
    row = (await db.execute(
        text(f"""
            SELECT SUM(kovan_sayisi)::int        AS toplam_kovan,
                   ROUND(SUM(bal_kg)::numeric,2) AS toplam_bal_kg,
                   COUNT(DISTINCT koy)::int       AS koy_sayisi
            FROM aricilik {where}
        """), params
    )).mappings().fetchone()
    return dict(row) if row else {}


@router.delete("/temizle")
async def aricilik_temizle(
    yil:  Optional[int] = Query(None),
    ilce: Optional[str] = Query(None),
    db:   AsyncSession  = Depends(get_db),
):
    async with db.begin():
        if yil and ilce:
            r = await db.execute(
                text("DELETE FROM aricilik WHERE uretim_yili = :y AND UPPER(ilce) = UPPER(:i)"),
                {"y": yil, "i": ilce},
            )
        elif yil:
            r = await db.execute(text("DELETE FROM aricilik WHERE uretim_yili = :y"), {"y": yil})
        else:
            r = await db.execute(text("DELETE FROM aricilik"))
    return {"silinen": r.rowcount}
```

---

### Adım 4 — Import endpoint'ini ekle

`app/routers/imports.py` dosyasına ekle:

```python
# Dosyanın üstüne: import'a parse_aricilik_xls ekle
from app.excel import (
    ...
    parse_aricilik_xls,   # ← ekle
)

# Dosyanın sonuna: yeni endpoint ekle
@router.post("/aricilik")
async def import_aricilik(
    file:     UploadFile    = File(...),
    yil:      Optional[str] = Form(None),
    truncate: Optional[str] = Form("true"),
    db:       AsyncSession  = Depends(get_db),
):
    check_extension(file.filename or "", {"xls"})
    fname     = file.filename or ""
    content   = await file.read()
    file_hash = sha256(content)
    await _guard_duplicate(db, file_hash, fname)

    ilce_adi  = fname.split(".")[0].split("_")[0].strip().upper()
    final_yil = yil_from(yil, fname)
    rows      = parse_aricilik_xls(content, ilce_adi, final_yil)
    if not rows:
        raise NoValidDataError()

    t0 = time.perf_counter()
    async with db.begin():
        silinen = 0
        if truncate != "false":
            r = await db.execute(
                text("DELETE FROM aricilik WHERE uretim_yili = :y AND ilce = :i"),
                {"y": final_yil, "i": ilce_adi},
            )
            silinen = r.rowcount

        await _batch_insert(db, """
            INSERT INTO aricilik
                (uretim_yili, il, ilce, koy, kovan_sayisi, bal_kg)
            VALUES
                (:uretim_yili, :il, :ilce, :koy, :kovan_sayisi, :bal_kg)
        """, rows)

        sure = round(time.perf_counter() - t0, 2)
        await write_import_log(db, dosya_adi=fname, dosya_hash=file_hash,
                               yil=final_yil, ilce=ilce_adi,
                               kayit_sayisi=len(rows), silinen=silinen, sure_sn=sure)

    return {"ok": True, "ilce": ilce_adi, "yil": final_yil,
            "eklenen": len(rows), "silinen": silinen, "sure_sn": sure}
```

---

### Adım 5 — `main.py`'a router'ı kaydet

```python
# main.py

from app.routers import (
    ...
    aricilik,   # ← ekle
)

for _router in (
    ...
    aricilik.router,   # ← ekle
):
    app.include_router(_router)
```

---

### Kontrol listesi (yeni modül için)

```
✅ schema.py      → TABLES ve INDEXES listelerine eklendi
✅ excel.py       → parse_aricilik_xls() yazıldı
✅ routers/       → aricilik.py oluşturuldu (list, ozet, temizle)
✅ imports.py     → POST /api/import/aricilik eklendi
✅ main.py        → router kayıt edildi
✅ Uygulama yeniden başlatıldı (tablo otomatik oluştu)
✅ /docs sayfasında yeni endpoint'ler görünüyor
```

---

### Özet destek tablosu için kısa yol

Eğer yeni modülün yapısı `(isim, yil, tutar_tl)` şeklindeyse (alan bazlı, fark prim gibi),
`schema.py`'a tablo ve index ekledikten sonra `destekler.py`'daki `_register()` çağrısını kullan:

```python
# destekler.py → dosyanın sonuna ekle
_register("yeni-destek", "yeni_destek_tablo", "destek_adi", "destek")
```

Bu tek satır: `GET /api/yeni-destek`, `GET /api/yeni-destek/ozet`, `DELETE /api/yeni-destek/temizle` endpoint'lerini otomatik oluşturur.

---

## 8. Sık Sorulan Sorular

**S: Aynı dosyayı tekrar yüklersem ne olur?**
C: `DuplicateFileError` (409) döner. SHA-256 hash ile kontrol edilir. Farklı yıl için aynı formatlı dosyayı yüklemek istiyorsan içeriği biraz değiştirmen veya `import_log`'dan ilgili hash'i silmen gerekir.

**S: `truncate=false` ne zaman kullanılır?**
C: Süt destekleme gibi birden fazla dönem olan verilerde. `truncate=true` ile aynı ilçe/yılın önceki verisi silinir.

**S: Excel'deki başlık satırı farklı konumdaysa ne olur?**
C: `parse_uretim_xlsx` ilk 10 satırı tarar, `find_uretim_columns()` ile başlığı dinamik bulur. XLS parser'lar da ilk 25 satırı kontrol eder.

**S: Yeni bir filtre (örn. `mahalle`) nasıl eklenir?**
C: `helpers.py → build_where()` fonksiyonuna yeni `if` bloğu ekle. Router'da da `Query(None)` parametresi olarak tanımla.

**S: Büyük dosyalar neden yavaş yüklenir?**
C: `_batch_insert()` 500'lük gruplarla insert eder. Çok büyük dosyalarda `_BATCH = 500` değerini `imports.py`'da artırabilirsin (örn. 2000).

**S: `build_where` alias ne için?**
C: `uretim` tablosu bazı sorgularda `cks_sayisi` ile JOIN yapılır. Bu sorgularda `u.ilce` gibi prefix gerekir; `alias="u"` bunu sağlar.
