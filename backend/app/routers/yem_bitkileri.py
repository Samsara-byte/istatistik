from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.helpers import paginate, safe_sort, sort_direction

router = APIRouter(prefix="/api/yem-bitkileri", tags=["Yem Bitkileri Desteği"])

_SORT_FIELDS = {
    "ilce", "koy", "urun", "isletme_sayisi",
    "destege_tabi_alan_da", "su_kisiti_da", "sut_havzasi_da", "destek_tutari_tl",
}


@router.get("")
async def list_yem_bitkileri(
    yil:      int           = Query(2025),
    ilce:     Optional[str] = Query(None),
    koy:      Optional[str] = Query(None),
    urun:     Optional[str] = Query(None),
    sort_by:  Optional[str] = Query("destege_tabi_alan_da"),
    sort_dir: Optional[str] = Query("desc"),
    page:     int           = Query(1, ge=1),
    limit:    int           = Query(100, ge=1, le=50_000),
    db:       AsyncSession  = Depends(get_db),
):
    clauses = ["yil = :yil"]
    params: dict = {"yil": yil}

    if ilce:
        clauses.append("UPPER(ilce) = UPPER(:ilce)")
        params["ilce"] = ilce
    if koy:
        clauses.append("UPPER(koy) LIKE UPPER(:koy)")
        params["koy"] = f"%{koy}%"
    if urun:
        clauses.append("UPPER(urun) LIKE UPPER(:urun)")
        params["urun"] = f"%{urun}%"

    where  = "WHERE " + " AND ".join(clauses)
    offset = (page - 1) * limit
    oc     = safe_sort(sort_by, _SORT_FIELDS, "destege_tabi_alan_da")
    od     = sort_direction(sort_dir)

    sql = f"""
        SELECT id, yil, il, ilce, koy, urun,
               isletme_sayisi, destege_tabi_alan_da,
               su_kisiti_da, sut_havzasi_da, destek_tutari_tl
        FROM yem_bitkileri_destek {where}
        ORDER BY {oc} {od}
        LIMIT :limit OFFSET :offset
    """
    cnt = f"SELECT COUNT(*) FROM yem_bitkileri_destek {where}"

    rows  = (await db.execute(text(sql), {**params, "limit": limit, "offset": offset})).mappings().all()
    total = (await db.execute(text(cnt), params)).scalar() or 0

    return {"data": [dict(r) for r in rows], **paginate(int(total), page, limit)}


@router.get("/ozet")
async def yem_bitkileri_ozet(
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
    grp   = group_by if group_by in {"ilce", "koy", "urun"} else "ilce"

    rows = (
        await db.execute(
            text(f"""
                SELECT {grp},
                       SUM(isletme_sayisi)::int                       AS isletme_toplam,
                       ROUND(SUM(destege_tabi_alan_da)::numeric, 3)   AS alan_toplam,
                       ROUND(SUM(su_kisiti_da)::numeric, 3)           AS su_kisiti_toplam,
                       ROUND(SUM(sut_havzasi_da)::numeric, 3)         AS sut_havzasi_toplam,
                       ROUND(SUM(destek_tutari_tl)::numeric, 2)       AS destek_toplam
                FROM yem_bitkileri_destek {where}
                GROUP BY {grp} ORDER BY destek_toplam DESC
            """),
            params,
        )
    ).mappings().all()
    return {"group_by": grp, "data": [dict(r) for r in rows]}


@router.get("/toplam")
async def yem_bitkileri_toplam(
    yil:  int           = Query(2025),
    ilce: Optional[str] = Query(None),
    db:   AsyncSession  = Depends(get_db),
):
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
                    SUM(isletme_sayisi)::int                      AS isletme_sayisi,
                    ROUND(SUM(destege_tabi_alan_da)::numeric, 3)  AS destege_tabi_alan_da,
                    ROUND(SUM(su_kisiti_da)::numeric, 3)          AS su_kisiti_da,
                    ROUND(SUM(sut_havzasi_da)::numeric, 3)        AS sut_havzasi_da,
                    ROUND(SUM(destek_tutari_tl)::numeric, 2)      AS destek_tutari_tl
                FROM yem_bitkileri_destek {where}
            """),
            params,
        )
    ).mappings().one_or_none()
    return dict(row) if row else {}


@router.get("/urunler")
async def yem_bitkileri_urunler(
    yil: int          = Query(2025),
    db:  AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            text("SELECT DISTINCT urun FROM yem_bitkileri_destek WHERE yil = :yil ORDER BY urun"),
            {"yil": yil},
        )
    ).fetchall()
    return {"data": [r[0] for r in rows]}


@router.delete("/temizle")
async def yem_bitkileri_temizle(
    yil:  Optional[int] = Query(None),
    ilce: Optional[str] = Query(None),
    db:   AsyncSession  = Depends(get_db),
):
    async with db.begin():
        if yil and ilce:
            r = await db.execute(
                text("DELETE FROM yem_bitkileri_destek WHERE yil = :y AND UPPER(ilce) = UPPER(:i)"),
                {"y": yil, "i": ilce},
            )
        elif yil:
            r = await db.execute(
                text("DELETE FROM yem_bitkileri_destek WHERE yil = :y"), {"y": yil}
            )
        else:
            r = await db.execute(text("DELETE FROM yem_bitkileri_destek"))
    return {"silinen": r.rowcount}
