"""
Veritabanı servis katmanı.
Router'ların doğrudan SQL çalıştırması yerine bu fonksiyonlar kullanılır.
"""
from __future__ import annotations

import time
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from app.schemas import ImportResult
from app.utils import sha256


async def check_duplicate(conn: AsyncConnection, file_hash: str) -> None:
    """Aynı hash daha önce yüklenmişse HTTP 409 fırlatır."""
    row = (
        await conn.execute(
            text("SELECT dosya_adi FROM import_log WHERE dosya_hash=:h LIMIT 1"),
            {"h": file_hash},
        )
    ).fetchone()
    if row:
        raise HTTPException(409, detail=f"Bu dosya daha önce yüklenmiş: {row[0]}")


async def log_import(
    conn:      AsyncConnection,
    *,
    dosya_adi: str | None,
    file_hash: str,
    tablo:     str,
    yil:       int | None    = None,
    ilce:      str | None    = None,
    kayit:     int,
    silinen:   int           = 0,
    sure:      float,
) -> None:
    await conn.execute(
        text(
            "INSERT INTO import_log "
            "(dosya_adi, dosya_hash, tablo, ilce, yil, kayit_sayisi, silinen, sure_sn, durum) "
            "VALUES (:dosya_adi, :h, :tablo, :ilce, :yil, :kayit, :silinen, :sure, 'basarili')"
        ),
        {
            "dosya_adi": dosya_adi or "bilinmiyor",
            "h":         file_hash,
            "tablo":     tablo,
            "ilce":      ilce,
            "yil":       yil,
            "kayit":     kayit,
            "silinen":   silinen,
            "sure":      sure,
        },
    )


async def bulk_insert(
    conn:      AsyncConnection,
    *,
    tablo:     str,
    cols:      list[str],
    rows:      list[dict],
) -> None:
    """SQLAlchemy list-of-dicts bulk insert."""
    col_list  = ", ".join(cols)
    val_list  = ", ".join(f":{c}" for c in cols)
    await conn.execute(
        text(f"INSERT INTO {tablo} ({col_list}) VALUES ({val_list})"),
        rows,
    )


async def simple_delete(
    conn:  AsyncConnection,
    *,
    tablo: str,
    yil:   Optional[int]  = None,
    ilce:  Optional[str]  = None,
    donem: Optional[str]  = None,
) -> int:
    """Yıl / ilçe / dönem kombinasyonuna göre tablo temizleme."""
    clauses, params = [], {}
    if yil:   clauses.append("yil=:yil");                params["yil"]   = yil
    if ilce:  clauses.append("UPPER(ilce)=UPPER(:ilce)"); params["ilce"]  = ilce
    if donem: clauses.append("donem=:donem");            params["donem"] = donem

    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    r     = await conn.execute(text(f"DELETE FROM {tablo} {where}"), params)
    return r.rowcount
