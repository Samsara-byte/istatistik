from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter(prefix="/api/cks-sayisi", tags=["ÇKS Sayısı"])


@router.get("")
async def list_cks(
    yil: Optional[int] = Query(None),
    db:  AsyncSession  = Depends(get_db),
):
    clauses: list[str] = []
    params: dict = {}
    if yil:
        clauses.append("yil = :yil")
        params["yil"] = yil
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""

    rows = (
        await db.execute(
            text(f"SELECT yil, ilce, koy, sayi FROM cks_sayisi {where} ORDER BY ilce, koy, yil"),
            params,
        )
    ).mappings().all()
    return {"data": [dict(r) for r in rows], "total": len(rows)}


@router.get("/ozet")
async def cks_ozet(db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            text("""
                SELECT yil,
                       SUM(sayi)::int           AS toplam_ciftci,
                       COUNT(DISTINCT koy)::int  AS koy_sayisi
                FROM cks_sayisi
                GROUP BY yil ORDER BY yil DESC
            """)
        )
    ).mappings().all()
    return {"data": [dict(r) for r in rows]}


@router.delete("/temizle")
async def cks_temizle(
    yil: Optional[int] = Query(None),
    db:  AsyncSession  = Depends(get_db),
):
    async with db.begin():
        if yil:
            r = await db.execute(text("DELETE FROM cks_sayisi WHERE yil = :y"), {"y": yil})
        else:
            r = await db.execute(text("DELETE FROM cks_sayisi"))
    return {"silinen": r.rowcount}
