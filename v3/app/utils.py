"""
Saf yardımcı fonksiyonlar — I/O bağımlılığı yok.
"""
from __future__ import annotations

import hashlib
import re
from typing import Optional

from fastapi import HTTPException, UploadFile

from app.config import settings


# ── Dosya / Güvenlik ─────────────────────────────────────────────────────────

def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def check_file(file: UploadFile, allowed: set[str]) -> None:
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in allowed:
        raise HTTPException(
            400,
            detail=f"Kabul edilen formatlar: {', '.join('.' + e for e in sorted(allowed))}",
        )


def check_size(data: bytes) -> None:
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(413, detail=f"Dosya çok büyük (maks {settings.MAX_UPLOAD_MB} MB)")


# ── Sayı / Metin ─────────────────────────────────────────────────────────────

def to_float(v: object) -> float:
    try:
        return round(float(v), 3)  # type: ignore[arg-type]
    except (ValueError, TypeError):
        return 0.0


def clean(v: object, maxlen: int = 200) -> str:
    if v is None:
        return ""
    return str(v).replace("\x00", "").strip()[:maxlen]


def norm_koy(s: str) -> str:
    """Köy adındaki 'KÖYÜ', 'MAHALLESİ' vb. son ekleri kaldırır."""
    return re.sub(
        r"\s+(KÖYÜ?|MAHALLESİ?|BELDESİ?|MH\.?|KÖY\.?)$",
        "", s.strip().upper(), flags=re.IGNORECASE,
    ).strip()


# ── Yıl tespiti ──────────────────────────────────────────────────────────────

def yil_from(yil_str: Optional[str], fname: str = "", default: int = 2025) -> int:
    if yil_str and yil_str.strip().isdigit():
        return int(yil_str)
    m = re.search(r"(20\d{2})", fname)
    return int(m.group(1)) if m else default
