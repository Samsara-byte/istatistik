"""
Tüm veri import endpoint'leri — POST /api/import/*
"""
from __future__ import annotations

import re
import time
import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.exceptions import DuplicateFileError, NoValidDataError
from app.utils.db_helpers import (
    check_extension,
    find_duplicate,
    sha256,
    write_import_log,
    yil_from,
)
from app.utils.excel import (
    parse_bitkisel_xls,
    parse_cks_xlsx,
    parse_fark_prim_xls,
    parse_hayvancilik_xls,
    parse_kooperatif_xls,
    parse_ozet_xls,
    parse_sut_xlsx,
    parse_uretim_xlsx,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/import", tags=["Import"])

_BATCH = 500  # rows per executemany batch


async def _guard_duplicate(db: AsyncSession, file_hash: str, filename: str) -> None:
    dup = await find_duplicate(db, file_hash)
    if dup:
        raise DuplicateFileError(dup["dosya_adi"])


async def _batch_insert(db: AsyncSession, sql: str, rows: list[dict]) -> None:
    """Insert rows in batches to avoid huge single statements."""
    for i in range(0, len(rows), _BATCH):
        await db.execute(text(sql), rows[i : i + _BATCH])


# ═══════════════════════════════════════════════════════════
# BİTKİSEL ÜRETİM (ÇKS)
# ═══════════════════════════════════════════════════════════

@router.post("")          # backwards-compatible: POST /api/import
@router.post("/uretim")   # explicit alias
async def import_uretim(
    file:     UploadFile    = File(...),
    yil:      Optional[str] = Form(None),
    truncate: Optional[str] = Form("true"),
    db:       AsyncSession  = Depends(get_db),
):
    check_extension(file.filename or "", {"xlsx", "xls", "xlsm", "ods"})
    content   = await file.read()
    file_hash = sha256(content)

    await _guard_duplicate(db, file_hash, file.filename or "")

    final_yil          = yil_from(yil, file.filename or "")
    rows, ilce, skipped = parse_uretim_xlsx(content, final_yil)

    if not rows:
        raise NoValidDataError(skipped)

    logger.info("Üretim import: %s → %d rows (ilçe=%s, yıl=%d)", file.filename, len(rows), ilce, final_yil)
    t0 = time.perf_counter()

    async with db.begin():
        silinen = 0
        if truncate != "false" and ilce:
            r = await db.execute(
                text("DELETE FROM uretim WHERE uretim_yili = :y AND ilce = :i"),
                {"y": final_yil, "i": ilce},
            )
            silinen = r.rowcount

        await _batch_insert(db, """
            INSERT INTO uretim
                (uretim_yili, il, ilce, koy, urun, tarim_sekli, uretim_cesidi, ekili_alan)
            VALUES
                (:uretim_yili, :il, :ilce, :koy, :urun, :tarim_sekli, :uretim_cesidi, :ekili_alan)
        """, rows)

        sure = round(time.perf_counter() - t0, 2)
        await write_import_log(
            db, dosya_adi=file.filename or "", dosya_hash=file_hash,
            yil=final_yil, ilce=ilce, kayit_sayisi=len(rows),
            silinen=silinen, sure_sn=sure,
        )

    return {"ok": True, "ilce": ilce, "yil": final_yil,
            "eklenen": len(rows), "silinen": silinen,
            "atlandi": skipped, "sure_sn": sure}


# ═══════════════════════════════════════════════════════════
# HAYVANCILIK
# ═══════════════════════════════════════════════════════════

@router.post("/hayvancilik")
async def import_hayvancilik(
    file:     UploadFile    = File(...),
    yil:      Optional[str] = Form(None),
    truncate: Optional[str] = Form("true"),
    db:       AsyncSession  = Depends(get_db),
):
    check_extension(file.filename or "", {"xls"})
    fname   = file.filename or ""
    content = await file.read()
    file_hash = sha256(content)

    await _guard_duplicate(db, file_hash, fname)

    ilce_adi  = fname.split(".")[0].split("_")[0].strip().upper()
    final_yil = yil_from(yil, fname)
    rows      = parse_hayvancilik_xls(content, ilce_adi, final_yil)

    if not rows:
        raise NoValidDataError()

    t0 = time.perf_counter()
    async with db.begin():
        silinen = 0
        if truncate != "false":
            r = await db.execute(
                text("DELETE FROM hayvancilik WHERE uretim_yili = :y AND ilce = :i"),
                {"y": final_yil, "i": ilce_adi},
            )
            silinen = r.rowcount

        await _batch_insert(db, """
            INSERT INTO hayvancilik
                (uretim_yili, il, ilce, koy,
                 sigir, manda, koyun, keci,
                 sigir_isletme, manda_isletme, koyun_isletme, keci_isletme,
                 toplam_isletme)
            VALUES
                (:uretim_yili, :il, :ilce, :koy,
                 :sigir, :manda, :koyun, :keci,
                 :sigir_isletme, :manda_isletme, :koyun_isletme, :keci_isletme,
                 :toplam_isletme)
        """, rows)

        sure = round(time.perf_counter() - t0, 2)
        await write_import_log(
            db, dosya_adi=fname, dosya_hash=file_hash,
            yil=final_yil, ilce=ilce_adi,
            kayit_sayisi=len(rows), silinen=silinen, sure_sn=sure,
        )

    return {"ok": True, "ilce": ilce_adi, "yil": final_yil,
            "koy_sayisi": len(rows), "silinen": silinen, "sure_sn": sure}


# ═══════════════════════════════════════════════════════════
# KOOPERATİF
# ═══════════════════════════════════════════════════════════

@router.post("/kooperatif")
async def import_kooperatif(
    file:     UploadFile    = File(...),
    truncate: Optional[str] = Form("true"),
    db:       AsyncSession  = Depends(get_db),
):
    check_extension(file.filename or "", {"xls", "xlsx"})
    content   = await file.read()
    file_hash = sha256(content)

    await _guard_duplicate(db, file_hash, file.filename or "")

    rows = parse_kooperatif_xls(content)
    if not rows:
        raise NoValidDataError()

    t0 = time.perf_counter()
    async with db.begin():
        silinen = 0
        if truncate != "false":
            r = await db.execute(text("DELETE FROM kooperatif"))
            silinen = r.rowcount

        await _batch_insert(db, """
            INSERT INTO kooperatif
                (ilce, koy_belde, koop_turu, ortak_sayisi, baskan, telefon)
            VALUES
                (:ilce, :koy_belde, :koop_turu, :ortak_sayisi, :baskan, :telefon)
        """, rows)

        sure = round(time.perf_counter() - t0, 2)
        await write_import_log(
            db, dosya_adi=file.filename or "", dosya_hash=file_hash,
            kayit_sayisi=len(rows), silinen=silinen, sure_sn=sure,
        )

    return {"ok": True, "eklenen": len(rows), "silinen": silinen, "sure_sn": sure}


# ═══════════════════════════════════════════════════════════
# SÜT DESTEKLEME
# ═══════════════════════════════════════════════════════════

@router.post("/sut")
async def import_sut(
    file:     UploadFile    = File(...),
    donem:    Optional[str] = Form(None),
    yil:      Optional[str] = Form(None),
    truncate: Optional[str] = Form("false"),
    db:       AsyncSession  = Depends(get_db),
):
    check_extension(file.filename or "", {"xlsx", "xls", "xlsm", "ods"})

    donem_val = (donem or "").strip()
    yil_val   = (yil or "").strip()

    if not yil_val or not yil_val.isdigit():
        m = re.search(r"20[0-9]{2}", donem_val)
        yil_val = m.group(0) if m else ""
    if not donem_val:
        donem_val = yil_val or "Bilinmiyor"
    if not yil_val:
        raise HTTPException(422, "Yıl tespit edilemedi. Dönem alanına yıl ekleyin.")

    content   = await file.read()
    file_hash = sha256(content)

    await _guard_duplicate(db, file_hash, file.filename or "")

    rows = parse_sut_xlsx(content, donem_val, int(yil_val))
    if not rows:
        raise NoValidDataError()

    t0 = time.perf_counter()
    async with db.begin():
        silinen = 0
        if truncate != "false":
            r = await db.execute(
                text("DELETE FROM sut_destekleme WHERE donem = :d"), {"d": donem_val}
            )
            silinen = r.rowcount

        await _batch_insert(db, """
            INSERT INTO sut_destekleme
                (donem, yil, il, ilce, koy, temel_sut_lt, destek_tutari)
            VALUES
                (:donem, :yil, :il, :ilce, :koy, :temel_sut_lt, :destek_tutari)
        """, rows)

        sure = round(time.perf_counter() - t0, 2)
        await write_import_log(
            db, dosya_adi=file.filename or "", dosya_hash=file_hash,
            yil=int(yil_val), kayit_sayisi=len(rows), silinen=silinen, sure_sn=sure,
        )

    return {"ok": True, "donem": donem_val, "yil": int(yil_val),
            "eklenen": len(rows), "silinen": silinen, "sure_sn": sure}


# ═══════════════════════════════════════════════════════════
# ÖZET DESTEK TABLOLARI — ortak yardımcı
# ═══════════════════════════════════════════════════════════

async def _import_ozet(
    db: AsyncSession,
    *,
    filename: str,
    content: bytes,
    table: str,
    key_field: str,
    rows: list[dict],
    truncate: str,
) -> dict:
    file_hash = sha256(content)
    await _guard_duplicate(db, file_hash, filename)

    if not rows:
        raise NoValidDataError()

    t0 = time.perf_counter()
    async with db.begin():
        silinen = 0
        if truncate != "false":
            r = await db.execute(text(f"DELETE FROM {table}"))
            silinen = r.rowcount

        await db.execute(
            text(f"INSERT INTO {table} ({key_field}, yil, tutar_tl) VALUES (:{key_field}, :yil, :tutar_tl)"),
            rows,
        )

        sure = round(time.perf_counter() - t0, 2)
        await write_import_log(
            db, dosya_adi=filename, dosya_hash=file_hash,
            kayit_sayisi=len(rows), silinen=silinen, sure_sn=sure,
        )

    return {"ok": True, "eklenen": len(rows), "silinen": silinen, "sure_sn": sure}


@router.post("/alan-bazli")
async def import_alan_bazli(
    file:     UploadFile    = File(...),
    truncate: Optional[str] = Form("false"),
    db:       AsyncSession  = Depends(get_db),
):
    check_extension(file.filename or "", {"xls", "xlsx", "xlsm"})
    content = await file.read()
    rows    = parse_ozet_xls(content, "destek_adi", 1)
    return await _import_ozet(
        db, filename=file.filename or "", content=content,
        table="alan_bazli_destek", key_field="destek_adi",
        rows=rows, truncate=truncate or "false",
    )


@router.post("/fark-prim")
async def import_fark_prim(
    file:     UploadFile    = File(...),
    truncate: Optional[str] = Form("false"),
    db:       AsyncSession  = Depends(get_db),
):
    check_extension(file.filename or "", {"xls", "xlsx", "xlsm"})
    content = await file.read()
    rows    = parse_fark_prim_xls(content)
    return await _import_ozet(
        db, filename=file.filename or "", content=content,
        table="fark_prim_destek", key_field="kategori",
        rows=rows, truncate=truncate or "false",
    )


@router.post("/hayvancilik-destek")
async def import_hayvancilik_destek(
    file:     UploadFile    = File(...),
    truncate: Optional[str] = Form("false"),
    db:       AsyncSession  = Depends(get_db),
):
    check_extension(file.filename or "", {"xls", "xlsx", "xlsm"})
    content = await file.read()
    rows    = parse_ozet_xls(content, "destek_adi", 1)
    return await _import_ozet(
        db, filename=file.filename or "", content=content,
        table="hayvancilik_destek", key_field="destek_adi",
        rows=rows, truncate=truncate or "false",
    )


@router.post("/genel-destek")
async def import_genel_destek(
    file:     UploadFile    = File(...),
    truncate: Optional[str] = Form("false"),
    db:       AsyncSession  = Depends(get_db),
):
    check_extension(file.filename or "", {"xls", "xlsx", "xlsm"})
    content = await file.read()
    rows    = parse_ozet_xls(content, "destek_adi", 1)
    return await _import_ozet(
        db, filename=file.filename or "", content=content,
        table="genel_destek", key_field="destek_adi",
        rows=rows, truncate=truncate or "false",
    )


# ═══════════════════════════════════════════════════════════
# ÇKS SAYISI
# ═══════════════════════════════════════════════════════════

@router.post("/cks-sayisi")
async def import_cks(
    file:     UploadFile    = File(...),
    yil:      str           = Form(...),
    truncate: Optional[str] = Form("false"),
    db:       AsyncSession  = Depends(get_db),
):
    if not yil.isdigit():
        raise HTTPException(422, "Geçersiz yıl")
    check_extension(file.filename or "", {"xlsx", "xls", "xlsm"})

    content   = await file.read()
    file_hash = sha256(content)
    await _guard_duplicate(db, file_hash, file.filename or "")

    rows = parse_cks_xlsx(content, int(yil))
    if not rows:
        raise NoValidDataError()

    t0 = time.perf_counter()
    async with db.begin():
        silinen = 0
        if truncate != "false":
            r = await db.execute(text("DELETE FROM cks_sayisi WHERE yil = :y"), {"y": int(yil)})
            silinen = r.rowcount

        await db.execute(
            text("INSERT INTO cks_sayisi (yil, ilce, koy, sayi) VALUES (:yil, :ilce, :koy, :sayi)"),
            rows,
        )

        sure = round(time.perf_counter() - t0, 2)
        await write_import_log(
            db, dosya_adi=file.filename or "", dosya_hash=file_hash,
            yil=int(yil), kayit_sayisi=len(rows), silinen=silinen, sure_sn=sure,
        )

    return {"ok": True, "yil": int(yil), "eklenen": len(rows),
            "silinen": silinen, "sure_sn": sure}


# ═══════════════════════════════════════════════════════════
# BİTKİSEL DESTEK
# ═══════════════════════════════════════════════════════════

@router.post("/bitkisel-destek")
async def import_bitkisel(
    file:     UploadFile    = File(...),
    yil:      Optional[str] = Form(None),
    truncate: Optional[str] = Form("false"),
    db:       AsyncSession  = Depends(get_db),
):
    check_extension(file.filename or "", {"xls", "xlsx", "xlsm"})

    content   = await file.read()
    file_hash = sha256(content)
    await _guard_duplicate(db, file_hash, file.filename or "")

    final_yil = yil_from(yil, file.filename or "")
    rows      = parse_bitkisel_xls(content, final_yil)
    if not rows:
        raise NoValidDataError()

    t0 = time.perf_counter()
    eklenen = guncellenen = 0

    async with db.begin():
        if truncate != "false":
            await db.execute(text("DELETE FROM bitkisel_destek WHERE yil = :y"), {"y": final_yil})

        for row in rows:
            result = await db.execute(
                text("""
                    INSERT INTO bitkisel_destek
                        (yil, il, ilce, koy, urun,
                         feromon_adet, feromon_tuzak_adet, faydali_bocek_adet,
                         desteklenen_alan_da, destek_tutari_tl, net_odeme_tl, updated_at)
                    VALUES
                        (:yil, :il, :ilce, :koy, :urun,
                         :feromon_adet, :feromon_tuzak_adet, :faydali_bocek_adet,
                         :desteklenen_alan_da, :destek_tutari_tl, :net_odeme_tl, NOW())
                    ON CONFLICT (yil, ilce, koy, urun) DO UPDATE SET
                        feromon_adet        = bitkisel_destek.feromon_adet        + EXCLUDED.feromon_adet,
                        feromon_tuzak_adet  = bitkisel_destek.feromon_tuzak_adet  + EXCLUDED.feromon_tuzak_adet,
                        faydali_bocek_adet  = bitkisel_destek.faydali_bocek_adet  + EXCLUDED.faydali_bocek_adet,
                        desteklenen_alan_da = bitkisel_destek.desteklenen_alan_da + EXCLUDED.desteklenen_alan_da,
                        destek_tutari_tl    = bitkisel_destek.destek_tutari_tl    + EXCLUDED.destek_tutari_tl,
                        net_odeme_tl        = bitkisel_destek.net_odeme_tl        + EXCLUDED.net_odeme_tl,
                        updated_at          = NOW()
                """),
                row,
            )
            if result.rowcount == 1:
                eklenen += 1
            else:
                guncellenen += 1

        sure = round(time.perf_counter() - t0, 2)
        await write_import_log(
            db, dosya_adi=file.filename or "", dosya_hash=file_hash,
            yil=final_yil, kayit_sayisi=len(rows), silinen=0, sure_sn=sure,
        )

    return {"ok": True, "yil": final_yil,
            "eklenen": eklenen, "guncellenen": guncellenen, "sure_sn": sure}
