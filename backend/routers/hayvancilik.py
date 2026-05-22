from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.common import paginate
from app.utils.db_helpers import build_where

router = APIRouter(prefix="/api/hayvancilik", tags=["Hayvancılık"])


@router.get("")
async def list_hayvancilik(
    yil:   int           = Query(2025),
    ilce:  Optional[str] = Query(None),
    koy:   Optional[str] = Query(None),
    page:  int           = Query(1, ge=1),
    limit: int           = Query(100, ge=1, le=50_000),
    db:    AsyncSession  = Depends(get_db),
):
    clauses = ["uretim_yili = :yil"]
    params: dict = {"yil": yil}
    if ilce:
        clauses.append("UPPER(ilce) = UPPER(:ilce)")
        params["ilce"] = ilce
    if koy:
        clauses.append("UPPER(koy) LIKE UPPER(:koy)")
        params["koy"] = f"%{koy}%"

    where  = "WHERE " + " AND ".join(clauses)
    offset = (page - 1) * limit

    sql = f"""
        SELECT ilce, koy,
               SUM(sigir)::int          AS sigir,
               SUM(manda)::int          AS manda,
               SUM(koyun)::int          AS koyun,
               SUM(keci)::int           AS keci,
               SUM(sigir_isletme)::int  AS sigir_isletme,
               SUM(manda_isletme)::int  AS manda_isletme,
               SUM(koyun_isletme)::int  AS koyun_isletme,
               SUM(keci_isletme)::int   AS keci_isletme,
               SUM(toplam_isletme)::int AS toplam_isletme
        FROM hayvancilik {where}
        GROUP BY ilce, koy ORDER BY ilce, koy
        LIMIT :limit OFFSET :offset
    """
    cnt = f"SELECT COUNT(*) FROM (SELECT koy FROM hayvancilik {where} GROUP BY ilce,koy) s"

    rows  = (await db.execute(text(sql),  {**params, "limit": limit, "offset": offset})).mappings().all()
    total = (await db.execute(text(cnt),  params)).scalar() or 0

    return {"data": [dict(r) for r in rows], **paginate(int(total), page, limit)}


@router.get("/ozet")
async def hayvancilik_ozet(
    yil:  int           = Query(2025),
    ilce: Optional[str] = Query(None),
    db:   AsyncSession  = Depends(get_db),
):
    where, params = build_where(yil=yil, ilce=ilce)
    sql = f"""
        SELECT SUM(sigir)::int          AS sigir_toplam,
               SUM(manda)::int          AS manda_toplam,
               SUM(koyun)::int          AS koyun_toplam,
               SUM(keci)::int           AS keci_toplam,
               SUM(sigir_isletme)::int  AS sigir_isletme,
               SUM(manda_isletme)::int  AS manda_isletme,
               SUM(koyun_isletme)::int  AS koyun_isletme,
               SUM(keci_isletme)::int   AS keci_isletme,
               SUM(toplam_isletme)::int AS toplam_isletme,
               COUNT(DISTINCT koy)::int AS koy_sayisi
        FROM hayvancilik {where}
    """
    row = (await db.execute(text(sql), params)).mappings().fetchone()
    return dict(row) if row else {}


@router.delete("/temizle")
async def hayvancilik_temizle(
    yil:  Optional[int] = Query(None),
    ilce: Optional[str] = Query(None),
    db:   AsyncSession  = Depends(get_db),
):
    async with db.begin():
        if yil and ilce:
            r = await db.execute(
                text("DELETE FROM hayvancilik WHERE uretim_yili = :y AND UPPER(ilce) = UPPER(:i)"),
                {"y": yil, "i": ilce},
            )
        elif yil:
            r = await db.execute(text("DELETE FROM hayvancilik WHERE uretim_yili = :y"), {"y": yil})
        else:
            r = await db.execute(text("DELETE FROM hayvancilik"))
    return {"silinen": r.rowcount}
