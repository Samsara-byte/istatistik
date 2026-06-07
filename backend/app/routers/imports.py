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
from app.helpers import check_extension, find_duplicate, sha256, write_import_log, yil_from
from app.excel import (
    parse_bitkisel_xls,
    parse_cks_xlsx,
    parse_fark_prim_xls,
    parse_hayvancilik_xls,
    parse_kooperatif_xls,
    parse_ozet_xls,
    parse_planli_uretim_xls,
    parse_sertifikali_fidan_xls,
    parse_sertifikali_tohum_xls,
    parse_temel_destek_xls,
    parse_yem_bitkileri_xls,
    parse_zirai_don_xls,
    parse_sut_xlsx,
    parse_uretim_xlsx,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/import", tags=["Import"])

_BATCH = 500


# ── Ortak yardımcılar ────────────────────────────────────────────────

async def _guard_duplicate(db: AsyncSession, file_hash: str, filename: str) -> None:
    dup = await find_duplicate(db, file_hash)
    if dup:
        raise DuplicateFileError(dup["dosya_adi"])


async def _batch_insert(db: AsyncSession, sql: str, rows: list[dict]) -> None:
    for i in range(0, len(rows), _BATCH):
        await db.execute(text(sql), rows[i : i + _BATCH])


# ── Bitkisel Üretim (ÇKS) ───────────────────────────────────────────

@router.post("")
@router.post("/uretim")
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

    final_yil           = yil_from(yil, file.filename or "")
    rows, ilce, skipped = parse_uretim_xlsx(content, final_yil)
    if not rows:
        raise NoValidDataError(skipped)

    t0 = time.perf_counter()
    async with db.begin_nested():
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
        await write_import_log(db, dosya_adi=file.filename or "", dosya_hash=file_hash,
                               yil=final_yil, ilce=ilce, kayit_sayisi=len(rows),
                               silinen=silinen, sure_sn=sure)

    await db.commit()
    return {"ok": True, "ilce": ilce, "yil": final_yil,
            "eklenen": len(rows), "silinen": silinen, "atlandi": skipped, "sure_sn": sure}


# ── Hayvancılık ──────────────────────────────────────────────────────

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
    async with db.begin_nested():
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
                 sigir_isletme, manda_isletme, koyun_isletme, keci_isletme, toplam_isletme)
            VALUES
                (:uretim_yili, :il, :ilce, :koy,
                 :sigir, :manda, :koyun, :keci,
                 :sigir_isletme, :manda_isletme, :koyun_isletme, :keci_isletme, :toplam_isletme)
        """, rows)

        sure = round(time.perf_counter() - t0, 2)
        await write_import_log(db, dosya_adi=fname, dosya_hash=file_hash,
                               yil=final_yil, ilce=ilce_adi,
                               kayit_sayisi=len(rows), silinen=silinen, sure_sn=sure)

    await db.commit()
    return {"ok": True, "ilce": ilce_adi, "yil": final_yil,
            "koy_sayisi": len(rows), "silinen": silinen, "sure_sn": sure}


# ── Kooperatif ───────────────────────────────────────────────────────

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
    async with db.begin_nested():
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
        await write_import_log(db, dosya_adi=file.filename or "", dosya_hash=file_hash,
                               kayit_sayisi=len(rows), silinen=silinen, sure_sn=sure)

    await db.commit()
    return {"ok": True, "eklenen": len(rows), "silinen": silinen, "sure_sn": sure}


# ── Süt Destekleme ───────────────────────────────────────────────────

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
    async with db.begin_nested():
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
        await write_import_log(db, dosya_adi=file.filename or "", dosya_hash=file_hash,
                               yil=int(yil_val), kayit_sayisi=len(rows),
                               silinen=silinen, sure_sn=sure)

    await db.commit()
    return {"ok": True, "donem": donem_val, "yil": int(yil_val),
            "eklenen": len(rows), "silinen": silinen, "sure_sn": sure}


# ── Özet Destek Tabloları — ortak yardımcı ──────────────────────────

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
    async with db.begin_nested():
        silinen = 0
        if truncate != "false":
            r = await db.execute(text(f"DELETE FROM {table}"))
            silinen = r.rowcount

        await db.execute(
            text(f"INSERT INTO {table} ({key_field}, yil, tutar_tl) VALUES (:{key_field}, :yil, :tutar_tl)"),
            rows,
        )

        sure = round(time.perf_counter() - t0, 2)
        await write_import_log(db, dosya_adi=filename, dosya_hash=file_hash,
                               kayit_sayisi=len(rows), silinen=silinen, sure_sn=sure)

    await db.commit()
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
    return await _import_ozet(db, filename=file.filename or "", content=content,
                              table="alan_bazli_destek", key_field="destek_adi",
                              rows=rows, truncate=truncate or "false")


@router.post("/fark-prim")
async def import_fark_prim(
    file:     UploadFile    = File(...),
    truncate: Optional[str] = Form("false"),
    db:       AsyncSession  = Depends(get_db),
):
    check_extension(file.filename or "", {"xls", "xlsx", "xlsm"})
    content = await file.read()
    rows    = parse_fark_prim_xls(content)
    return await _import_ozet(db, filename=file.filename or "", content=content,
                              table="fark_prim_destek", key_field="kategori",
                              rows=rows, truncate=truncate or "false")


@router.post("/hayvancilik-destek")
async def import_hayvancilik_destek(
    file:     UploadFile    = File(...),
    truncate: Optional[str] = Form("false"),
    db:       AsyncSession  = Depends(get_db),
):
    check_extension(file.filename or "", {"xls", "xlsx", "xlsm"})
    content = await file.read()
    rows    = parse_ozet_xls(content, "destek_adi", 1)
    return await _import_ozet(db, filename=file.filename or "", content=content,
                              table="hayvancilik_destek", key_field="destek_adi",
                              rows=rows, truncate=truncate or "false")


@router.post("/genel-destek")
async def import_genel_destek(
    file:     UploadFile    = File(...),
    truncate: Optional[str] = Form("false"),
    db:       AsyncSession  = Depends(get_db),
):
    check_extension(file.filename or "", {"xls", "xlsx", "xlsm"})
    content = await file.read()
    rows    = parse_ozet_xls(content, "destek_adi", 1)
    return await _import_ozet(db, filename=file.filename or "", content=content,
                              table="genel_destek", key_field="destek_adi",
                              rows=rows, truncate=truncate or "false")


# ── ÇKS Sayısı ──────────────────────────────────────────────────────

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
    async with db.begin_nested():
        silinen = 0
        if truncate != "false":
            r = await db.execute(text("DELETE FROM cks_sayisi WHERE yil = :y"), {"y": int(yil)})
            silinen = r.rowcount

        await db.execute(
            text("INSERT INTO cks_sayisi (yil, ilce, koy, sayi) VALUES (:yil, :ilce, :koy, :sayi)"),
            rows,
        )

        sure = round(time.perf_counter() - t0, 2)
        await write_import_log(db, dosya_adi=file.filename or "", dosya_hash=file_hash,
                               yil=int(yil), kayit_sayisi=len(rows),
                               silinen=silinen, sure_sn=sure)

    await db.commit()
    return {"ok": True, "yil": int(yil), "eklenen": len(rows),
            "silinen": silinen, "sure_sn": sure}


# ── Bitkisel Destek ──────────────────────────────────────────────────

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

    async with db.begin_nested():
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
        await write_import_log(db, dosya_adi=file.filename or "", dosya_hash=file_hash,
                               yil=final_yil, kayit_sayisi=len(rows),
                               silinen=0, sure_sn=sure)

    await db.commit()
    return {"ok": True, "yil": final_yil,
            "eklenen": eklenen, "guncellenen": guncellenen, "sure_sn": sure}

# ── Planlı Üretim Desteği ─────────────────────────────────────────────

@router.post("/planli-uretim")
async def import_planli_uretim(
    file:     UploadFile    = File(...),
    yil:      Optional[str] = Form(None),
    truncate: Optional[str] = Form("false"),
    db:       AsyncSession  = Depends(get_db),
):
    """
    İCMAL-2 formatındaki Planlı Üretim Desteği XLS dosyasını yükler.

    - Dosya adından veya form'dan yıl alınır.
    - İlçe bilgisi dosya içindeki metadata'dan ('İlçe: BUCAK') otomatik okunur.
    - UNIQUE (yil, ilce, koy, urun_grubu) çakışmasında mevcut satır güncellenir (upsert).
    - truncate=true → aynı yıl+ilçe kombinasyonu silinip yeniden yazılır.
    """
    check_extension(file.filename or "", {"xls", "xlsx", "xlsm"})
    content   = await file.read()
    file_hash = sha256(content)
    await _guard_duplicate(db, file_hash, file.filename or "")

    final_yil          = yil_from(yil, file.filename or "")
    rows, il_adi, ilce_adi, _toplam = parse_planli_uretim_xls(content, final_yil)
    if not rows:
        raise NoValidDataError()

    t0 = time.perf_counter()
    eklenen = guncellenen = silinen = 0

    async with db.begin_nested():
        if truncate != "false" and ilce_adi:
            r = await db.execute(
                text("DELETE FROM planli_uretim_destek WHERE yil = :y AND ilce = :i"),
                {"y": final_yil, "i": ilce_adi},
            )
            silinen = r.rowcount
        elif truncate != "false":
            r = await db.execute(
                text("DELETE FROM planli_uretim_destek WHERE yil = :y"),
                {"y": final_yil},
            )
            silinen = r.rowcount

        for row in rows:
            result = await db.execute(
                text("""
                    INSERT INTO planli_uretim_destek
                        (yil, il, ilce, koy, urun_grubu,
                         isletme_sayisi, destege_tabi_alan_da,
                         yeralti_su_alan_da, destekleme_miktari_tl, updated_at)
                    VALUES
                        (:yil, :il, :ilce, :koy, :urun_grubu,
                         :isletme_sayisi, :destege_tabi_alan_da,
                         :yeralti_su_alan_da, :destekleme_miktari_tl, NOW())
                    ON CONFLICT (yil, ilce, koy, urun_grubu) DO UPDATE SET
                        isletme_sayisi        = EXCLUDED.isletme_sayisi,
                        destege_tabi_alan_da  = EXCLUDED.destege_tabi_alan_da,
                        yeralti_su_alan_da    = EXCLUDED.yeralti_su_alan_da,
                        destekleme_miktari_tl = EXCLUDED.destekleme_miktari_tl,
                        updated_at            = NOW()
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
            ilce=ilce_adi or None, yil=final_yil,
            kayit_sayisi=len(rows), silinen=silinen, sure_sn=sure,
        )

    await db.commit()
    return {
        "ok": True,
        "yil": final_yil,
        "ilce": ilce_adi,
        "eklenen": eklenen,
        "guncellenen": guncellenen,
        "silinen": silinen,
        "sure_sn": sure,
    }


# ── Sertifikalı Fidan Kullanım Desteği ───────────────────────────────

@router.post("/sertifikali-fidan")
async def import_sertifikali_fidan(
    file:     UploadFile    = File(...),
    yil:      Optional[str] = Form(None),
    truncate: Optional[str] = Form("false"),
    db:       AsyncSession  = Depends(get_db),
):
    """
    İCMAL-2 formatındaki Sertifikalı Fidan Kullanım Desteği XLS dosyasını yükler.
    UNIQUE (yil, ilce, koy, fidan_turu) çakışmasında upsert yapar.
    """
    check_extension(file.filename or "", {"xls", "xlsx", "xlsm"})
    content   = await file.read()
    file_hash = sha256(content)
    await _guard_duplicate(db, file_hash, file.filename or "")

    final_yil          = yil_from(yil, file.filename or "")
    rows, il_adi, ilce_adi, _toplam = parse_sertifikali_fidan_xls(content, final_yil)
    if not rows:
        raise NoValidDataError()

    t0 = time.perf_counter()
    eklenen = guncellenen = silinen = 0

    async with db.begin_nested():
        if truncate != "false" and ilce_adi:
            r = await db.execute(
                text("DELETE FROM sertifikali_fidan_destek WHERE yil = :y AND ilce = :i"),
                {"y": final_yil, "i": ilce_adi},
            )
            silinen = r.rowcount
        elif truncate != "false":
            r = await db.execute(
                text("DELETE FROM sertifikali_fidan_destek WHERE yil = :y"),
                {"y": final_yil},
            )
            silinen = r.rowcount

        for row in rows:
            result = await db.execute(
                text("""
                    INSERT INTO sertifikali_fidan_destek
                        (yil, il, ilce, koy, fidan_turu,
                         kisi_sayisi, fidan_sayisi,
                         sertifikali_alan_da, standart_alan_da,
                         destekleme_alani_da, destekleme_tutari_tl, updated_at)
                    VALUES
                        (:yil, :il, :ilce, :koy, :fidan_turu,
                         :kisi_sayisi, :fidan_sayisi,
                         :sertifikali_alan_da, :standart_alan_da,
                         :destekleme_alani_da, :destekleme_tutari_tl, NOW())
                    ON CONFLICT (yil, ilce, koy, fidan_turu) DO UPDATE SET
                        kisi_sayisi           = EXCLUDED.kisi_sayisi,
                        fidan_sayisi          = EXCLUDED.fidan_sayisi,
                        sertifikali_alan_da   = EXCLUDED.sertifikali_alan_da,
                        standart_alan_da      = EXCLUDED.standart_alan_da,
                        destekleme_alani_da   = EXCLUDED.destekleme_alani_da,
                        destekleme_tutari_tl  = EXCLUDED.destekleme_tutari_tl,
                        updated_at            = NOW()
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
            ilce=ilce_adi or None, yil=final_yil,
            kayit_sayisi=len(rows), silinen=silinen, sure_sn=sure,
        )

    await db.commit()
    return {
        "ok":          True,
        "yil":         final_yil,
        "ilce":        ilce_adi,
        "eklenen":     eklenen,
        "guncellenen": guncellenen,
        "silinen":     silinen,
        "sure_sn":     sure,
    }


# ── Sertifikalı Tohum Kullanım Desteği ───────────────────────────────

@router.post("/sertifikali-tohum")
async def import_sertifikali_tohum(
    file:     UploadFile    = File(...),
    yil:      Optional[str] = Form(None),
    truncate: Optional[str] = Form("false"),
    db:       AsyncSession  = Depends(get_db),
):
    """
    İCMAL-2 formatındaki Sertifikalı Tohum Kullanım Desteği XLS dosyasını yükler.
    UNIQUE (yil, ilce, koy, urun) çakışmasında upsert yapar.
    """
    check_extension(file.filename or "", {"xls", "xlsx", "xlsm"})
    content   = await file.read()
    file_hash = sha256(content)
    await _guard_duplicate(db, file_hash, file.filename or "")

    final_yil          = yil_from(yil, file.filename or "")
    rows, il_adi, ilce_adi, _toplam = parse_sertifikali_tohum_xls(content, final_yil)
    if not rows:
        raise NoValidDataError()

    t0 = time.perf_counter()
    eklenen = guncellenen = silinen = 0

    async with db.begin_nested():
        if truncate != "false" and ilce_adi:
            r = await db.execute(
                text("DELETE FROM sertifikali_tohum_destek WHERE yil = :y AND ilce = :i"),
                {"y": final_yil, "i": ilce_adi},
            )
            silinen = r.rowcount
        elif truncate != "false":
            r = await db.execute(
                text("DELETE FROM sertifikali_tohum_destek WHERE yil = :y"),
                {"y": final_yil},
            )
            silinen = r.rowcount

        for row in rows:
            result = await db.execute(
                text("""
                    INSERT INTO sertifikali_tohum_destek
                        (yil, il, ilce, koy, urun,
                         isletme_sayisi, destekleme_alani_da,
                         destekleme_miktari_tl, updated_at)
                    VALUES
                        (:yil, :il, :ilce, :koy, :urun,
                         :isletme_sayisi, :destekleme_alani_da,
                         :destekleme_miktari_tl, NOW())
                    ON CONFLICT (yil, ilce, koy, urun) DO UPDATE SET
                        isletme_sayisi        = EXCLUDED.isletme_sayisi,
                        destekleme_alani_da   = EXCLUDED.destekleme_alani_da,
                        destekleme_miktari_tl = EXCLUDED.destekleme_miktari_tl,
                        updated_at            = NOW()
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
            ilce=ilce_adi or None, yil=final_yil,
            kayit_sayisi=len(rows), silinen=silinen, sure_sn=sure,
        )

    await db.commit()
    return {
        "ok":          True,
        "yil":         final_yil,
        "ilce":        ilce_adi,
        "eklenen":     eklenen,
        "guncellenen": guncellenen,
        "silinen":     silinen,
        "sure_sn":     sure,
    }


# ── Temel Destek ─────────────────────────────────────────────────────

@router.post("/temel-destek")
async def import_temel_destek(
    file:     UploadFile    = File(...),
    yil:      Optional[str] = Form(None),
    truncate: Optional[str] = Form("false"),
    db:       AsyncSession  = Depends(get_db),
):
    """
    İCMAL-2 formatındaki Temel Destek XLS dosyasını yükler.
    UNIQUE (yil, ilce, koy, urun_grubu) çakışmasında upsert yapar.
    """
    check_extension(file.filename or "", {"xls", "xlsx", "xlsm"})
    content   = await file.read()
    file_hash = sha256(content)
    await _guard_duplicate(db, file_hash, file.filename or "")

    final_yil          = yil_from(yil, file.filename or "")
    rows, il_adi, ilce_adi, _toplam = parse_temel_destek_xls(content, final_yil)
    if not rows:
        raise NoValidDataError()

    t0 = time.perf_counter()
    eklenen = guncellenen = silinen = 0

    async with db.begin_nested():
        if truncate != "false" and ilce_adi:
            r = await db.execute(
                text("DELETE FROM temel_destek WHERE yil = :y AND ilce = :i"),
                {"y": final_yil, "i": ilce_adi},
            )
            silinen = r.rowcount
        elif truncate != "false":
            r = await db.execute(
                text("DELETE FROM temel_destek WHERE yil = :y"), {"y": final_yil}
            )
            silinen = r.rowcount

        for row in rows:
            result = await db.execute(
                text("""
                    INSERT INTO temel_destek
                        (yil, il, ilce, koy, urun_grubu,
                         isletme_sayisi, destege_tabi_alan_da,
                         destekleme_miktari_tl, updated_at)
                    VALUES
                        (:yil, :il, :ilce, :koy, :urun_grubu,
                         :isletme_sayisi, :destege_tabi_alan_da,
                         :destekleme_miktari_tl, NOW())
                    ON CONFLICT (yil, ilce, koy, urun_grubu) DO UPDATE SET
                        isletme_sayisi        = EXCLUDED.isletme_sayisi,
                        destege_tabi_alan_da  = EXCLUDED.destege_tabi_alan_da,
                        destekleme_miktari_tl = EXCLUDED.destekleme_miktari_tl,
                        updated_at            = NOW()
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
            ilce=ilce_adi or None, yil=final_yil,
            kayit_sayisi=len(rows), silinen=silinen, sure_sn=sure,
        )

    await db.commit()
    return {
        "ok":          True,
        "yil":         final_yil,
        "ilce":        ilce_adi,
        "eklenen":     eklenen,
        "guncellenen": guncellenen,
        "silinen":     silinen,
        "sure_sn":     sure,
    }


# ── Yem Bitkileri Desteği ────────────────────────────────────────────

@router.post("/yem-bitkileri")
async def import_yem_bitkileri(
    file:     UploadFile    = File(...),
    yil:      Optional[str] = Form(None),
    truncate: Optional[str] = Form("false"),
    db:       AsyncSession  = Depends(get_db),
):
    """İCMAL-2 formatındaki Yem Bitkileri Desteği XLS dosyasını yükler."""
    check_extension(file.filename or "", {"xls", "xlsx", "xlsm"})
    content   = await file.read()
    file_hash = sha256(content)
    await _guard_duplicate(db, file_hash, file.filename or "")

    final_yil          = yil_from(yil, file.filename or "")
    rows, il_adi, ilce_adi, _toplam = parse_yem_bitkileri_xls(content, final_yil)
    if not rows:
        raise NoValidDataError()

    t0 = time.perf_counter()
    eklenen = guncellenen = silinen = 0

    async with db.begin_nested():
        if truncate != "false" and ilce_adi:
            r = await db.execute(
                text("DELETE FROM yem_bitkileri_destek WHERE yil = :y AND ilce = :i"),
                {"y": final_yil, "i": ilce_adi},
            )
            silinen = r.rowcount
        elif truncate != "false":
            r = await db.execute(
                text("DELETE FROM yem_bitkileri_destek WHERE yil = :y"), {"y": final_yil}
            )
            silinen = r.rowcount

        for row in rows:
            result = await db.execute(
                text("""
                    INSERT INTO yem_bitkileri_destek
                        (yil, il, ilce, koy, urun, isletme_sayisi,
                         destege_tabi_alan_da, su_kisiti_da, sut_havzasi_da,
                         destek_tutari_tl, updated_at)
                    VALUES
                        (:yil, :il, :ilce, :koy, :urun, :isletme_sayisi,
                         :destege_tabi_alan_da, :su_kisiti_da, :sut_havzasi_da,
                         :destek_tutari_tl, NOW())
                    ON CONFLICT (yil, ilce, koy, urun) DO UPDATE SET
                        isletme_sayisi       = EXCLUDED.isletme_sayisi,
                        destege_tabi_alan_da = EXCLUDED.destege_tabi_alan_da,
                        su_kisiti_da         = EXCLUDED.su_kisiti_da,
                        sut_havzasi_da       = EXCLUDED.sut_havzasi_da,
                        destek_tutari_tl     = EXCLUDED.destek_tutari_tl,
                        updated_at           = NOW()
                """),
                row,
            )
            if result.rowcount == 1: eklenen += 1
            else: guncellenen += 1

        sure = round(time.perf_counter() - t0, 2)
        await write_import_log(db, dosya_adi=file.filename or "", dosya_hash=file_hash,
                               ilce=ilce_adi or None, yil=final_yil,
                               kayit_sayisi=len(rows), silinen=silinen, sure_sn=sure)

    await db.commit()
    return {"ok": True, "yil": final_yil, "ilce": ilce_adi,
            "eklenen": eklenen, "guncellenen": guncellenen,
            "silinen": silinen, "sure_sn": sure}


# ── Zirai Don Desteği ────────────────────────────────────────────────

@router.post("/zirai-don")
async def import_zirai_don(
    file:     UploadFile    = File(...),
    yil:      Optional[str] = Form(None),
    truncate: Optional[str] = Form("false"),
    db:       AsyncSession  = Depends(get_db),
):
    """İCMAL-2 formatındaki Zirai Don Desteği XLS dosyasını yükler."""
    check_extension(file.filename or "", {"xls", "xlsx", "xlsm"})
    content   = await file.read()
    file_hash = sha256(content)
    await _guard_duplicate(db, file_hash, file.filename or "")

    final_yil          = yil_from(yil, file.filename or "")
    rows, il_adi, ilce_adi, _toplam = parse_zirai_don_xls(content, final_yil)
    if not rows:
        raise NoValidDataError()

    t0 = time.perf_counter()
    eklenen = guncellenen = silinen = 0

    async with db.begin_nested():
        if truncate != "false" and ilce_adi:
            r = await db.execute(
                text("DELETE FROM zirai_don_destek WHERE yil = :y AND ilce = :i"),
                {"y": final_yil, "i": ilce_adi},
            )
            silinen = r.rowcount
        elif truncate != "false":
            r = await db.execute(
                text("DELETE FROM zirai_don_destek WHERE yil = :y"), {"y": final_yil}
            )
            silinen = r.rowcount

        for row in rows:
            result = await db.execute(
                text("""
                    INSERT INTO zirai_don_destek
                        (yil, il, ilce, koy, urun, isletme_sayisi,
                         hasar_orani_yuzde, birim_maliyet_tl,
                         etkilenen_alan_da, toplam_masraf_tl, updated_at)
                    VALUES
                        (:yil, :il, :ilce, :koy, :urun, :isletme_sayisi,
                         :hasar_orani_yuzde, :birim_maliyet_tl,
                         :etkilenen_alan_da, :toplam_masraf_tl, NOW())
                    ON CONFLICT (yil, ilce, koy, urun) DO UPDATE SET
                        isletme_sayisi    = EXCLUDED.isletme_sayisi,
                        hasar_orani_yuzde = EXCLUDED.hasar_orani_yuzde,
                        birim_maliyet_tl  = EXCLUDED.birim_maliyet_tl,
                        etkilenen_alan_da = EXCLUDED.etkilenen_alan_da,
                        toplam_masraf_tl  = EXCLUDED.toplam_masraf_tl,
                        updated_at        = NOW()
                """),
                row,
            )
            if result.rowcount == 1: eklenen += 1
            else: guncellenen += 1

        sure = round(time.perf_counter() - t0, 2)
        await write_import_log(db, dosya_adi=file.filename or "", dosya_hash=file_hash,
                               ilce=ilce_adi or None, yil=final_yil,
                               kayit_sayisi=len(rows), silinen=silinen, sure_sn=sure)

    await db.commit()
    return {"ok": True, "yil": final_yil, "ilce": ilce_adi,
            "eklenen": eklenen, "guncellenen": guncellenen,
            "silinen": silinen, "sure_sn": sure}