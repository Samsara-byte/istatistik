from __future__ import annotations

import hashlib
import re
from typing import Any, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


# ── Hashing ──────────────────────────────────────────────────────────
def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# ── Year extraction ──────────────────────────────────────────────────
def yil_from(yil_str: Optional[str], fname: str, default: int = 2025) -> int:
    """Extract year from form field or filename, fallback to default."""
    if yil_str and yil_str.isdigit():
        return int(yil_str)
    m = re.search(r"(\d{4})", fname or "")
    return int(m.group(1)) if m else default


# ── WHERE builder ────────────────────────────────────────────────────
def build_where(
    *,
    yil: Optional[int] = None,
    il: Optional[str] = None,
    ilce: Optional[str] = None,
    koy: Optional[str] = None,
    urun: Optional[str] = None,
    tarim_sekli: Optional[str] = None,
    uretim_cesidi: Optional[str] = None,
    alias: str = "",
) -> tuple[str, dict[str, Any]]:
    """Build a parameterised WHERE clause for SQLAlchemy text()."""
    p = f"{alias}." if alias else ""
    clauses: list[str] = []
    params: dict[str, Any] = {}

    if yil is not None:
        clauses.append(f"{p}uretim_yili = :yil")
        params["yil"] = yil
    if il:
        clauses.append(f"UPPER({p}il) = UPPER(:il)")
        params["il"] = il
    if ilce:
        clauses.append(f"UPPER({p}ilce) = UPPER(:ilce)")
        params["ilce"] = ilce
    if koy:
        clauses.append(f"UPPER({p}koy) LIKE UPPER(:koy)")
        params["koy"] = f"%{koy}%"
    if urun:
        clauses.append(f"UPPER({p}urun) LIKE UPPER(:urun)")
        params["urun"] = f"%{urun}%"
    if tarim_sekli:
        clauses.append(f"{p}tarim_sekli = :tarim_sekli")
        params["tarim_sekli"] = tarim_sekli
    if uretim_cesidi:
        clauses.append(f"{p}uretim_cesidi = :uretim_cesidi")
        params["uretim_cesidi"] = uretim_cesidi

    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    return where, params


# ── Sort helpers ─────────────────────────────────────────────────────
def safe_sort(sort_by: Optional[str], allowed: set[str], default: str) -> str:
    return sort_by if (sort_by and sort_by in allowed) else default


def sort_direction(direction: Optional[str]) -> str:
    return "DESC" if str(direction or "").lower() == "desc" else "ASC"


# ── File extension validation ─────────────────────────────────────────
def check_extension(filename: str, accepted: set[str]) -> None:
    from app.exceptions import InvalidFileFormatError
    ext = (filename or "").rsplit(".", 1)[-1].lower()
    if ext not in accepted:
        raise InvalidFileFormatError(accepted)


# ── Duplicate import detection ────────────────────────────────────────
async def find_duplicate(db: AsyncSession, file_hash: str) -> dict | None:
    row = (
        await db.execute(
            text(
                "SELECT dosya_adi, yuklendi_at FROM import_log "
                "WHERE dosya_hash = :h LIMIT 1"
            ),
            {"h": file_hash},
        )
    ).mappings().fetchone()
    return dict(row) if row else None


# ── Import log ────────────────────────────────────────────────────────
async def write_import_log(
    db: AsyncSession,
    *,
    dosya_adi: str,
    dosya_hash: str,
    kayit_sayisi: int,
    silinen: int,
    sure_sn: float,
    yil: Optional[int] = None,
    ilce: Optional[str] = None,
) -> None:
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
            "dosya_adi": dosya_adi,
            "dosya_hash": dosya_hash,
            "ilce": ilce,
            "yil": yil,
            "kayit_sayisi": kayit_sayisi,
            "silinen": silinen,
            "sure_sn": sure_sn,
        },
    )
