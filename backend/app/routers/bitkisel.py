from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.helpers import paginate, safe_sort, sort_direction

router = APIRouter(prefix="/api/bitkisel-destek", tags=["Bitkisel Destek"])

_SORT_FIELDS = {
    "ilce", "koy", "urun", "feromon_adet", "feromon_tuzak_adet",
    "faydali_bocek_adet", "desteklenen_alan_da", "destek_tutari_tl", "net_odeme_tl",
}


@router.get("")
async def list_bitkisel(
    yil:      int           = Query(2025),
    ilce:     Optional[str] = Query(None),
    koy:      Optional[str] = Query(None),
    urun:     Optional[str] = Query(None),
    sort_by:  Optional[str] = Query("desteklenen_alan_da"),
    sort_dir: Optional[str] = Query("desc"),
    page:     int           = Query(1, ge=1),
    limit:    int           = Query(100, ge=1, le=50_000),
    db:       AsyncSession  = Depends(get_db),
):
    clauses = ["yil = :yil"]
    params: dict = {"yil": yil}

    if ilce:
        clauses.append("UPPER(ilce) = UPPER(:ilce)"); params["ilce"] = ilce
    if koy:
        clauses.append("UPPER(koy) LIKE UPPER(:koy)"); params["koy"] = f"%{koy}%"
    if urun:
        clauses.append("UPPER(urun) LIKE UPPER(:urun)"); params["urun"] = f"%{urun}%"

    where  = "WHERE " + " AND ".join(clauses)
    offset = (page - 1) * limit
    oc     = safe_sort(sort_by, _SORT_FIELDS, "desteklenen_alan_da")
    od     = sort_direction(sort_dir)

    sql = f"""
        SELECT id, yil, il, ilce, koy, urun,
               feromon_adet, feromon_tuzak_adet, faydali_bocek_adet,
               desteklenen_alan_da, destek_tutari_tl, net_odeme_tl
        FROM bitkisel_destek {where}
        ORDER BY {oc} {od}
        LIMIT :limit OFFSET :offset
    """
    cnt = f"SELECT COUNT(*) FROM bitkisel_destek {where}"

    rows  = (await db.execute(text(sql), {**params, "limit": limit, "offset": offset})).mappings().all()
    total = (await db.execute(text(cnt), params)).scalar() or 0

    return {"data": [dict(r) for r in rows], **paginate(int(total), page, limit)}


@router.get("/ozet")
async def bitkisel_ozet(
    yil:      int           = Query(2025),
    ilce:     Optional[str] = Query(None),
    group_by: str           = Query("ilce"),
    db:       AsyncSession  = Depends(get_db),
):
    clauses = ["yil = :yil"]
    params: dict = {"yil": yil}
    if ilce:
        clauses.append("UPPER(ilce) = UPPER(:ilce)"); params["ilce"] = ilce

    where = "WHERE " + " AND ".join(clauses)
    grp   = group_by if group_by in {"ilce", "koy", "urun"} else "ilce"

    rows = (
        await db.execute(
            text(f"""
                SELECT {grp},
                       COUNT(*)::int                              AS kayit_sayisi,
                       ROUND(SUM(feromon_adet)::numeric,0)        AS feromon_toplam,
                       ROUND(SUM(feromon_tuzak_adet)::numeric,0)  AS feromon_tuzak_toplam,
                       ROUND(SUM(faydali_bocek_adet)::numeric,0)  AS faydali_bocek_toplam,
                       ROUND(SUM(desteklenen_alan_da)::numeric,2)  AS alan_toplam,
                       ROUND(SUM(destek_tutari_tl)::numeric,2)     AS destek_toplam,
                       ROUND(SUM(net_odeme_tl)::numeric,2)         AS net_toplam
                FROM bitkisel_destek {where}
                GROUP BY {grp} ORDER BY destek_toplam DESC
            """),
            params,
        )
    ).mappings().all()
    return {"group_by": grp, "data": [dict(r) for r in rows]}


@router.get("/urunler")
async def bitkisel_urunler(
    yil: int          = Query(2025),
    db:  AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            text("SELECT DISTINCT urun FROM bitkisel_destek WHERE yil = :yil ORDER BY urun"),
            {"yil": yil},
        )
    ).fetchall()
    return {"data": [r[0] for r in rows]}


@router.delete("/temizle")
async def bitkisel_temizle(
    yil: Optional[int] = Query(None),
    db:  AsyncSession  = Depends(get_db),
):
    async with db.begin():
        if yil:
            r = await db.execute(text("DELETE FROM bitkisel_destek WHERE yil = :y"), {"y": yil})
        else:
            r = await db.execute(text("DELETE FROM bitkisel_destek"))
    return {"silinen": r.rowcount}
