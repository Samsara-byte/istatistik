from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.helpers import paginate, safe_sort, sort_direction

router = APIRouter(prefix="/api/sertifikali-fidan", tags=["Sertifikalı Fidan Desteği"])

_SORT_FIELDS = {
    "ilce", "koy", "fidan_turu", "kisi_sayisi", "fidan_sayisi",
    "sertifikali_alan_da", "standart_alan_da",
    "destekleme_alani_da", "destekleme_tutari_tl",
}


@router.get("")
async def list_sertifikali_fidan(
    yil:       int           = Query(2025),
    ilce:      Optional[str] = Query(None),
    koy:       Optional[str] = Query(None),
    fidan_turu: Optional[str] = Query(None),
    sort_by:   Optional[str] = Query("destekleme_tutari_tl"),
    sort_dir:  Optional[str] = Query("desc"),
    page:      int           = Query(1, ge=1),
    limit:     int           = Query(100, ge=1, le=50_000),
    db:        AsyncSession  = Depends(get_db),
):
    clauses = ["yil = :yil"]
    params: dict = {"yil": yil}

    if ilce:
        clauses.append("UPPER(ilce) = UPPER(:ilce)")
        params["ilce"] = ilce
    if koy:
        clauses.append("UPPER(koy) LIKE UPPER(:koy)")
        params["koy"] = f"%{koy}%"
    if fidan_turu:
        clauses.append("UPPER(fidan_turu) LIKE UPPER(:fidan_turu)")
        params["fidan_turu"] = f"%{fidan_turu}%"

    where  = "WHERE " + " AND ".join(clauses)
    offset = (page - 1) * limit
    oc     = safe_sort(sort_by, _SORT_FIELDS, "destekleme_tutari_tl")
    od     = sort_direction(sort_dir)

    sql = f"""
        SELECT id, yil, il, ilce, koy, fidan_turu,
               kisi_sayisi, fidan_sayisi,
               sertifikali_alan_da, standart_alan_da,
               destekleme_alani_da, destekleme_tutari_tl
        FROM sertifikali_fidan_destek {where}
        ORDER BY {oc} {od}
        LIMIT :limit OFFSET :offset
    """
    cnt = f"SELECT COUNT(*) FROM sertifikali_fidan_destek {where}"

    rows  = (await db.execute(text(sql), {**params, "limit": limit, "offset": offset})).mappings().all()
    total = (await db.execute(text(cnt), params)).scalar() or 0

    return {"data": [dict(r) for r in rows], **paginate(int(total), page, limit)}


@router.get("/ozet")
async def sertifikali_fidan_ozet(
    yil:      int           = Query(2025),
    ilce:     Optional[str] = Query(None),
    group_by: str           = Query("ilce"),
    db:       AsyncSession  = Depends(get_db),
):
    clauses = ["yil = :yil"]
    params: dict = {"yil": yil}
    if ilce:
        clauses.append("UPPER(ilce) = UPPER(:ilce)")
        params["ilce"] = ilce

    where = "WHERE " + " AND ".join(clauses)
    grp   = group_by if group_by in {"ilce", "koy", "fidan_turu"} else "ilce"

    rows = (
        await db.execute(
            text(f"""
                SELECT {grp},
                       SUM(kisi_sayisi)::int                           AS kisi_toplam,
                       SUM(fidan_sayisi)::int                          AS fidan_toplam,
                       ROUND(SUM(sertifikali_alan_da)::numeric, 3)     AS sertifikali_alan_toplam,
                       ROUND(SUM(standart_alan_da)::numeric, 3)        AS standart_alan_toplam,
                       ROUND(SUM(destekleme_alani_da)::numeric, 3)     AS destekleme_alani_toplam,
                       ROUND(SUM(destekleme_tutari_tl)::numeric, 2)    AS destek_toplam
                FROM sertifikali_fidan_destek {where}
                GROUP BY {grp} ORDER BY destek_toplam DESC
            """),
            params,
        )
    ).mappings().all()
    return {"group_by": grp, "data": [dict(r) for r in rows]}


@router.get("/toplam")
async def sertifikali_fidan_toplam(
    yil:  int           = Query(2025),
    ilce: Optional[str] = Query(None),
    db:   AsyncSession  = Depends(get_db),
):
    """Filtreye göre genel toplam satırını döndürür (tablonun en altında göstermek için)."""
    clauses = ["yil = :yil"]
    params: dict = {"yil": yil}
    if ilce:
        clauses.append("UPPER(ilce) = UPPER(:ilce)")
        params["ilce"] = ilce
    where = "WHERE " + " AND ".join(clauses)
    row = (
        await db.execute(
            text(f"""
                SELECT
                    SUM(kisi_sayisi)::int                              AS kisi_sayisi,
                    SUM(fidan_sayisi)::int                             AS fidan_sayisi,
                    ROUND(SUM(sertifikali_alan_da)::numeric, 3)        AS sertifikali_alan_da,
                    ROUND(SUM(standart_alan_da)::numeric, 3)           AS standart_alan_da,
                    ROUND(SUM(destekleme_alani_da)::numeric, 3)        AS destekleme_alani_da,
                    ROUND(SUM(destekleme_tutari_tl)::numeric, 2)       AS destekleme_tutari_tl
                FROM sertifikali_fidan_destek {where}
            """),
            params,
        )
    ).mappings().one_or_none()
    return dict(row) if row else {}


@router.get("/fidan-turleri")
async def fidan_turleri(
    yil: int          = Query(2025),
    db:  AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            text("SELECT DISTINCT fidan_turu FROM sertifikali_fidan_destek WHERE yil = :yil ORDER BY fidan_turu"),
            {"yil": yil},
        )
    ).fetchall()
    return {"data": [r[0] for r in rows]}


@router.delete("/temizle")
async def sertifikali_fidan_temizle(
    yil:  Optional[int] = Query(None),
    ilce: Optional[str] = Query(None),
    db:   AsyncSession  = Depends(get_db),
):
    async with db.begin():
        if yil and ilce:
            r = await db.execute(
                text("DELETE FROM sertifikali_fidan_destek WHERE yil = :y AND UPPER(ilce) = UPPER(:i)"),
                {"y": yil, "i": ilce},
            )
        elif yil:
            r = await db.execute(
                text("DELETE FROM sertifikali_fidan_destek WHERE yil = :y"), {"y": yil}
            )
        else:
            r = await db.execute(text("DELETE FROM sertifikali_fidan_destek"))
    return {"silinen": r.rowcount}