"""
helpers.py — Ortak yardımcı fonksiyonlar

Tüm modüllerin paylaştığı yardımcılar tek dosyada toplanmıştır:

  Bölüm 1 — Sayfalama    : paginate()
  Bölüm 2 — WHERE üretici: build_where()
  Bölüm 3 — Sıralama     : safe_sort(), sort_direction()
  Bölüm 4 — Dosya        : sha256(), check_extension(), yil_from()
  Bölüm 5 — Veritabanı   : find_duplicate(), write_import_log()
"""
from __future__ import annotations

import hashlib
import re
from typing import Any, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


# ═══════════════════════════════════════════════════════════
# BÖLÜM 1 — SAYFALAMA
# ═══════════════════════════════════════════════════════════

def paginate(total: int, page: int, limit: int) -> dict[str, int]:
    """
    Standart sayfalama metadata sözlüğü döner.
    Router'lar bunu **paginate(...) ile yanıt gövdesine ekler.

    Örnek çıktı: {"total": 500, "page": 2, "limit": 100, "pages": 5}
    """
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, -(-total // limit)),  # ceil(total / limit)
    }


# ═══════════════════════════════════════════════════════════
# BÖLÜM 2 — WHERE CÜMLECİĞİ
# ═══════════════════════════════════════════════════════════

def build_where(
    *,
    yil: Optional[int] = None,
    il: Optional[str] = None,
    ilce: Optional[str] = None,
    koy: Optional[str] = None,
    urun: Optional[str] = None,
    tarim_sekli: Optional[str] = None,
    uretim_cesidi: Optional[str] = None,
    alias: str = "",        # JOIN sorgularında tablo prefix'i: "u" → "u.ilce"
) -> tuple[str, dict[str, Any]]:
    """
    Verilen filtrelerden SQLAlchemy text() için parametreli WHERE cümlesi üretir.
    None geçilen parametreler WHERE'e dahil edilmez.

    alias="u" → JOIN olan sorgularda "u.uretim_yili = :yil" gibi prefix ekler.

    Dönüş:
        ("WHERE ilce = :ilce AND ...", {"ilce": "MERKEZ", ...})

    YENİ FİLTRE EKLEMEK: aşağıya yeni if bloğu ekle.
    """
    p = f"{alias}." if alias else ""
    clauses: list[str] = []
    params: dict[str, Any] = {}

    if yil is not None:
        clauses.append(f"{p}uretim_yili = :yil")
        params["yil"] = yil

    if il:
        # Büyük/küçük harf duyarsız eşitlik
        clauses.append(f"UPPER({p}il) = UPPER(:il)")
        params["il"] = il

    if ilce:
        clauses.append(f"UPPER({p}ilce) = UPPER(:ilce)")
        params["ilce"] = ilce

    if koy:
        # LIKE: kısmi eşleşme (% ile her iki uca wildcard eklenir)
        clauses.append(f"UPPER({p}koy) LIKE UPPER(:koy)")
        params["koy"] = f"%{koy}%"

    if urun:
        clauses.append(f"UPPER({p}urun) LIKE UPPER(:urun)")
        params["urun"] = f"%{urun}%"

    if tarim_sekli:
        # Tam eşleşme (Kuru/Sulu sabit değerler)
        clauses.append(f"{p}tarim_sekli = :tarim_sekli")
        params["tarim_sekli"] = tarim_sekli

    if uretim_cesidi:
        clauses.append(f"{p}uretim_cesidi = :uretim_cesidi")
        params["uretim_cesidi"] = uretim_cesidi

    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    return where, params


# ═══════════════════════════════════════════════════════════
# BÖLÜM 3 — SIRALAMA
# ═══════════════════════════════════════════════════════════

def safe_sort(sort_by: Optional[str], allowed: set[str], default: str) -> str:
    """
    SQL injection'a karşı sıralama sütununu whitelist ile doğrular.
    Geçersiz veya boş sort_by gelirse default sütun kullanılır.
    """
    return sort_by if (sort_by and sort_by in allowed) else default


def sort_direction(direction: Optional[str]) -> str:
    """'desc' → 'DESC', diğer her şey → 'ASC'"""
    return "DESC" if str(direction or "").lower() == "desc" else "ASC"


# ═══════════════════════════════════════════════════════════
# BÖLÜM 4 — DOSYA YARDIMCILARI
# ═══════════════════════════════════════════════════════════

def sha256(data: bytes) -> str:
    """Dosya içeriğinin SHA-256 hash'ini hex string olarak döner (duplikasyon tespiti için)."""
    return hashlib.sha256(data).hexdigest()


def check_extension(filename: str, accepted: set[str]) -> None:
    """
    Dosya uzantısını kabul listesiyle karşılaştırır.
    Geçersizse InvalidFileFormatError fırlatır.

    Örnek: check_extension("data.xlsx", {"xlsx", "xls"})
    """
    from app.exceptions import InvalidFileFormatError
    ext = (filename or "").rsplit(".", 1)[-1].lower()
    if ext not in accepted:
        raise InvalidFileFormatError(accepted)


def yil_from(yil_str: Optional[str], fname: str, default: int = 2025) -> int:
    """
    Yılı şu öncelik sırasıyla belirler:
      1. Form alanı (yil_str) rakam dizisiyse
      2. Dosya adındaki 4 haneli sayı (örn. "YESILOVA_2024.xlsx")
      3. Varsayılan değer (default=2025)
    """
    if yil_str and yil_str.isdigit():
        return int(yil_str)
    m = re.search(r"(\d{4})", fname or "")
    return int(m.group(1)) if m else default


# ═══════════════════════════════════════════════════════════
# BÖLÜM 5 — VERİTABANI YARDIMCILARI
# ═══════════════════════════════════════════════════════════

async def find_duplicate(db: AsyncSession, file_hash: str) -> dict | None:
    """
    Aynı SHA-256 hash'e sahip önceki import kaydını arar.
    Bulursa {"dosya_adi": ..., "yuklendi_at": ...} döner, bulamazsa None.
    """
    row = (
        await db.execute(
            text("SELECT dosya_adi, yuklendi_at FROM import_log WHERE dosya_hash = :h LIMIT 1"),
            {"h": file_hash},
        )
    ).mappings().fetchone()
    return dict(row) if row else None


async def write_import_log(
    db: AsyncSession,
    *,
    dosya_adi: str,
    dosya_hash: str,
    kayit_sayisi: int,
    silinen: int,
    sure_sn: float,
    yil: Optional[int] = None,    # kooperatif gibi yılsız importlarda None
    ilce: Optional[str] = None,   # il geneli importlarda None
) -> None:
    """
    Her başarılı import sonunda import_log tablosuna bir satır ekler.
    db.begin() bloğu içinde çağrılmalıdır (transaction garantisi).
    """
    await db.execute(
        text("""
            INSERT INTO import_log
                (dosya_adi, dosya_hash, ilce, uretim_yili,
                 kayit_sayisi, silinen, sure_sn, durum)
            VALUES
                (:dosya_adi, :dosya_hash, :ilce, :yil,
                 :kayit_sayisi, :silinen, :sure_sn, 'basarili')
        """),
        {
            "dosya_adi":    dosya_adi,
            "dosya_hash":   dosya_hash,
            "ilce":         ilce,
            "yil":          yil,
            "kayit_sayisi": kayit_sayisi,
            "silinen":      silinen,
            "sure_sn":      sure_sn,
        },
    )
