from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.common import paginate

router = APIRouter(prefix="/api/kooperatif", tags=["Kooperatif"])


@router.get("")
async def list_kooperatif(
    ilce:      Optional[str] = Query(None),
    koop_turu: Optional[str] = Query(None),
    ara:       Optional[str] = Query(None),
    page:      int           = Query(1, ge=1),
    limit:     int           = Query(200, ge=1, le=5_000),
    db:        AsyncSession  = Depends(get_db),
):
    clauses: list[str] = []
    params: dict = {}

    if ilce:
        clauses.append("UPPER(ilce) = UPPER(:ilce)")
        params["ilce"] = ilce
    if koop_turu:
        clauses.append("UPPER(koop_turu) LIKE UPPER(:kt)")
        params["kt"] = f"%{koop_turu}%"
    if ara:
        clauses.append("(UPPER(koy_belde) LIKE UPPER(:ara) OR UPPER(baskan) LIKE UPPER(:ara))")
        params["ara"] = f"%{ara}%"

    where  = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    offset = (page - 1) * limit

    rows  = (
        await db.execute(
            text(f"SELECT * FROM kooperatif {where} ORDER BY ilce, koop_turu, koy_belde LIMIT :limit OFFSET :offset"),
            {**params, "limit": limit, "offset": offset},
        )
    ).mappings().all()
    total = (
        await db.execute(text(f"SELECT COUNT(*) FROM kooperatif {where}"), params)
    ).scalar() or 0

    return {"data": [dict(r) for r in rows], **paginate(int(total), page, limit)}


@router.get("/ozet")
async def kooperatif_ozet(db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            text("""
                SELECT koop_turu,
                       COUNT(*)::int            AS sayi,
                       COUNT(DISTINCT ilce)::int AS ilce_sayisi
                FROM kooperatif
                GROUP BY koop_turu ORDER BY sayi DESC
            """)
        )
    ).mappings().all()
    total = (await db.execute(text("SELECT COUNT(*) FROM kooperatif"))).scalar() or 0
    return {"data": [dict(r) for r in rows], "toplam": int(total)}


@router.delete("/temizle")
async def kooperatif_temizle(db: AsyncSession = Depends(get_db)):
    async with db.begin():
        r = await db.execute(text("DELETE FROM kooperatif"))
    return {"silinen": r.rowcount}
