from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.common import paginate
from app.utils.db_helpers import build_where, safe_sort, sort_direction

router = APIRouter(prefix="/api/uretim", tags=["Üretim"])

_SORT_FIELDS = {
    "uretim_yili", "il", "ilce", "koy", "urun", "tarim_sekli",
    "uretim_cesidi", "ekili_alan", "toplam_alan", "kayit_sayisi",
    "urun_cesidi", "koy_sayisi", "ilce_sayisi",
}


@router.get("")
async def list_uretim(
    yil:           Optional[int] = Query(2025),
    ilce:          Optional[str] = Query(None),
    koy:           Optional[str] = Query(None),
    urun:          Optional[str] = Query(None),
    tarim_sekli:   Optional[str] = Query(None),
    uretim_cesidi: Optional[str] = Query(None),
    group_by:      Optional[str] = Query(None),
    sort_by:       Optional[str] = Query(None),
    sort_dir:      Optional[str] = Query("asc"),
    page:          int           = Query(1, ge=1),
    limit:         int           = Query(100, ge=1, le=50_000),
    db:            AsyncSession  = Depends(get_db),
):
    offset = (page - 1) * limit
    where_u, params = build_where(
        yil=yil, ilce=ilce, koy=koy, urun=urun,
        tarim_sekli=tarim_sekli, uretim_cesidi=uretim_cesidi,
        alias="u",
    )
    where_p, params_p = build_where(
        yil=yil, ilce=ilce, koy=koy, urun=urun,
        tarim_sekli=tarim_sekli, uretim_cesidi=uretim_cesidi,
    )

    od = sort_direction(sort_dir)

    if group_by == "koy":
        oc  = safe_sort(sort_by, _SORT_FIELDS, "toplam_alan")
        sql = f"""
            SELECT ilce, koy,
                   COUNT(DISTINCT urun)::int         AS urun_cesidi,
                   COUNT(*)::int                     AS kayit_sayisi,
                   ROUND(SUM(ekili_alan)::numeric,2) AS toplam_alan
            FROM uretim {where_p}
            GROUP BY ilce, koy ORDER BY {oc} {od}
            LIMIT :limit OFFSET :offset
        """
        cnt = f"SELECT COUNT(*) FROM (SELECT koy FROM uretim {where_p} GROUP BY ilce,koy) s"
        p = params_p

    elif group_by == "urun":
        oc  = safe_sort(sort_by, _SORT_FIELDS, "toplam_alan")
        sql = f"""
            SELECT urun, tarim_sekli,
                   COUNT(DISTINCT ilce)::int          AS ilce_sayisi,
                   COUNT(DISTINCT koy)::int           AS koy_sayisi,
                   COUNT(*)::int                      AS kayit_sayisi,
                   ROUND(SUM(ekili_alan)::numeric,2)  AS toplam_alan
            FROM uretim {where_p}
            GROUP BY urun, tarim_sekli ORDER BY {oc} {od}
            LIMIT :limit OFFSET :offset
        """
        cnt = f"SELECT COUNT(*) FROM (SELECT urun FROM uretim {where_p} GROUP BY urun,tarim_sekli) s"
        p = params_p

    elif group_by == "urun_basit":
        oc  = safe_sort(sort_by, _SORT_FIELDS, "toplam_alan")
        sql = f"""
            SELECT u.ilce, u.koy,
                   REGEXP_REPLACE(u.urun,' *[(][^)]*[)]','','g') AS urun,
                   ROUND(SUM(u.ekili_alan)::numeric,2)           AS toplam_alan,
                   MAX(cs.sayi)                                   AS ciftci_sayisi
            FROM uretim u
            LEFT JOIN cks_sayisi cs
                   ON UPPER(cs.ilce) = UPPER(u.ilce)
                  AND UPPER(cs.koy)  = UPPER(u.koy)
                  AND cs.yil         = u.uretim_yili
            {where_u}
            GROUP BY u.ilce, u.koy, REGEXP_REPLACE(u.urun,' *[(][^)]*[)]','','g')
            ORDER BY {oc} {od}
            LIMIT :limit OFFSET :offset
        """
        cnt = f"""
            SELECT COUNT(*) FROM (
                SELECT 1 FROM uretim u
                LEFT JOIN cks_sayisi cs
                       ON UPPER(cs.ilce) = UPPER(u.ilce)
                      AND UPPER(cs.koy)  = UPPER(u.koy)
                      AND cs.yil         = u.uretim_yili
                {where_u}
                GROUP BY u.ilce, u.koy, REGEXP_REPLACE(u.urun,' *[(][^)]*[)]','','g')
            ) s
        """
        p = params

    else:
        oc  = safe_sort(sort_by, _SORT_FIELDS, "ilce")
        sql = f"""
            SELECT u.uretim_yili, u.il, u.ilce, u.koy, u.urun,
                   u.tarim_sekli, u.uretim_cesidi,
                   ROUND(SUM(u.ekili_alan)::numeric,3) AS ekili_alan,
                   MAX(cs.sayi)                        AS ciftci_sayisi
            FROM uretim u
            LEFT JOIN cks_sayisi cs
                   ON UPPER(cs.ilce) = UPPER(u.ilce)
                  AND UPPER(cs.koy)  = UPPER(u.koy)
                  AND cs.yil         = u.uretim_yili
            {where_u}
            GROUP BY u.uretim_yili, u.il, u.ilce, u.koy, u.urun,
                     u.tarim_sekli, u.uretim_cesidi
            ORDER BY {oc} {od}
            LIMIT :limit OFFSET :offset
        """
        cnt = f"""
            SELECT COUNT(*) FROM (
                SELECT 1 FROM uretim u
                LEFT JOIN cks_sayisi cs
                       ON UPPER(cs.ilce) = UPPER(u.ilce)
                      AND UPPER(cs.koy)  = UPPER(u.koy)
                      AND cs.yil         = u.uretim_yili
                {where_u}
                GROUP BY u.uretim_yili, u.il, u.ilce, u.koy, u.urun,
                         u.tarim_sekli, u.uretim_cesidi
            ) s
        """
        p = params

    rows  = (await db.execute(text(sql),  {**p, "limit": limit, "offset": offset})).mappings().all()
    total = (await db.execute(text(cnt),  p)).scalar() or 0

    return {"data": [dict(r) for r in rows], **paginate(int(total), page, limit)}


@router.get("/ozet")
async def ozet_uretim(
    yil:      int           = Query(2025),
    ilce:     Optional[str] = Query(None),
    group_by: str           = Query("ilce"),
    limit:    int           = Query(50, le=200),
    db:       AsyncSession  = Depends(get_db),
):
    where, params = build_where(yil=yil, ilce=ilce)
    grp = group_by if group_by in {"ilce", "koy", "urun", "tarim_sekli", "uretim_cesidi"} else "ilce"

    EXTRA_SEL = {
        "ilce":          "COUNT(DISTINCT koy)::int AS koy_sayisi, COUNT(DISTINCT urun)::int AS urun_cesidi,",
        "koy":           "ilce, COUNT(DISTINCT urun)::int AS urun_cesidi,",
        "urun":          "tarim_sekli, COUNT(DISTINCT ilce)::int AS ilce_sayisi, COUNT(DISTINCT koy)::int AS koy_sayisi,",
        "tarim_sekli":   "COUNT(DISTINCT urun)::int AS urun_cesidi,",
        "uretim_cesidi": "COUNT(DISTINCT urun)::int AS urun_cesidi,",
    }
    EXTRA_GRP = {"koy": ", ilce", "urun": ", tarim_sekli"}

    sql = f"""
        SELECT {grp}, {EXTRA_SEL.get(grp, "")}
               COUNT(*)::int                            AS kayit_sayisi,
               ROUND(SUM(ekili_alan)::numeric,2)        AS toplam_alan_da,
               ROUND((SUM(ekili_alan)/10.0)::numeric,3) AS toplam_alan_ha
        FROM uretim {where}
        GROUP BY {grp}{EXTRA_GRP.get(grp, "")}
        ORDER BY toplam_alan_da DESC LIMIT :limit
    """
    tot_sql = f"""
        SELECT ROUND(SUM(ekili_alan)::numeric,2) AS alan, COUNT(*)::int AS kayit
        FROM uretim {where}
    """
    rows = (await db.execute(text(sql),     {**params, "limit": limit})).mappings().all()
    tot  = (await db.execute(text(tot_sql), params)).mappings().fetchone()

    return {
        "group_by":       grp,
        "data":           [dict(r) for r in rows],
        "toplam_alan_da": float((tot or {}).get("alan") or 0),
        "toplam_kayit":   int((tot or {}).get("kayit") or 0),
    }


@router.get("/urunler")
async def list_urunler(
    yil:  int           = Query(2025),
    ilce: Optional[str] = Query(None),
    db:   AsyncSession  = Depends(get_db),
):
    where, params = build_where(yil=yil, ilce=ilce)
    sql = f"""
        SELECT urun, ROUND(SUM(ekili_alan)::numeric,2) AS toplam_alan
        FROM uretim {where}
        GROUP BY urun ORDER BY toplam_alan DESC
    """
    rows = (await db.execute(text(sql), params)).mappings().all()
    return {"data": [dict(r) for r in rows]}


@router.get("/ilceler")
async def list_ilceler(
    yil: int          = Query(2025),
    db:  AsyncSession = Depends(get_db),
):
    sql = """
        SELECT ilce,
               COUNT(DISTINCT koy)::int          AS koy_sayisi,
               ROUND(SUM(ekili_alan)::numeric,2) AS toplam_alan
        FROM uretim WHERE uretim_yili = :yil
        GROUP BY ilce ORDER BY ilce
    """
    rows = (await db.execute(text(sql), {"yil": yil})).mappings().all()
    return {"data": [dict(r) for r in rows]}


@router.get("/log")
async def import_log(
    limit: int          = Query(20, le=100),
    db:    AsyncSession = Depends(get_db),
):
    sql = """
        SELECT id, dosya_adi, ilce, uretim_yili, kayit_sayisi,
               silinen, sure_sn, durum, hata_mesaji, yuklendi_at
        FROM import_log ORDER BY yuklendi_at DESC LIMIT :limit
    """
    rows = (await db.execute(text(sql), {"limit": limit})).mappings().all()
    return {"data": [dict(r) for r in rows]}


@router.delete("/temizle")
async def uretim_temizle(
    yil:  Optional[int] = Query(None),
    ilce: Optional[str] = Query(None),
    db:   AsyncSession  = Depends(get_db),
):
    async with db.begin():
        if yil and ilce:
            r = await db.execute(
                text("DELETE FROM uretim WHERE uretim_yili = :y AND UPPER(ilce) = UPPER(:i)"),
                {"y": yil, "i": ilce},
            )
        elif yil:
            r = await db.execute(text("DELETE FROM uretim WHERE uretim_yili = :y"), {"y": yil})
        else:
            r = await db.execute(text("DELETE FROM uretim"))
    return {"silinen": r.rowcount}
