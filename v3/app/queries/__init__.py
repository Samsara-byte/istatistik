"""
SQL sorgu yardımcıları.
Tüm WHERE/SELECT inşaası burada; router'lar saf iş mantığıyla kalır.
"""
from __future__ import annotations

from typing import Optional


# ── WHERE builder ────────────────────────────────────────────────────────────

def where(
    *,
    yil:           Optional[int] = None,
    ilce:          Optional[str] = None,
    koy:           Optional[str] = None,
    urun:          Optional[str] = None,
    tarim_sekli:   Optional[str] = None,
    uretim_cesidi: Optional[str] = None,
    donem:         Optional[str] = None,
    prefix:        str = "",          # "u" → "u.ilce", "" → "ilce"
) -> tuple[str, dict]:
    """
    Dinamik WHERE cümlesi + parametre dict'i üretir.
    prefix="u" → JOIN'li sorgularda tablo belirsizliğini önler.

    Döndürür: ("WHERE ilce=:ilce AND ...", {"ilce": "BURDUR", ...})
    """
    p   = f"{prefix}." if prefix else ""
    cls: list[str] = []
    params: dict   = {}

    if yil is not None:
        cls.append(f"{p}uretim_yili=:yil");           params["yil"]           = yil
    if ilce:
        cls.append(f"UPPER({p}ilce)=UPPER(:ilce)");   params["ilce"]          = ilce
    if koy:
        cls.append(f"{p}koy ILIKE :koy");             params["koy"]           = f"%{koy}%"
    if urun:
        cls.append(f"{p}urun ILIKE :urun");           params["urun"]          = f"%{urun}%"
    if tarim_sekli:
        cls.append(f"{p}tarim_sekli=:tarim_sekli");   params["tarim_sekli"]   = tarim_sekli
    if uretim_cesidi:
        cls.append(f"{p}uretim_cesidi=:uretim_cesidi"); params["uretim_cesidi"] = uretim_cesidi
    if donem:
        cls.append(f"{p}donem=:donem");               params["donem"]         = donem

    clause = ("WHERE " + " AND ".join(cls)) if cls else ""
    return clause, params


def order(sort_by: Optional[str], sort_dir: Optional[str], allowed: set[str], default: str) -> str:
    col = sort_by if sort_by in allowed else default
    dir_ = "DESC" if str(sort_dir or "").lower() == "desc" else "ASC"
    return f"ORDER BY {col} {dir_}"


def paginate(page: int, limit: int) -> tuple[int, dict]:
    offset = (page - 1) * limit
    return offset, {"limit": limit, "offset": offset}


# ── Sabit join ifadesi ───────────────────────────────────────────────────────

CKS_JOIN = (
    "LEFT JOIN cks_sayisi cs "
    "ON UPPER(cs.ilce)=UPPER(u.ilce) "
    "AND UPPER(cs.koy)=UPPER(u.koy) "
    "AND cs.yil=u.uretim_yili"
)
