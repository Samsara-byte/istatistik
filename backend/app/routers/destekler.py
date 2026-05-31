"""
Özet destek tablolarına ait GET / DELETE endpoint'leri.
Her destek tipi için aynı pattern:
  GET    /api/{route}
  GET    /api/{route}/ozet
  DELETE /api/{route}/temizle
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter(tags=["Destek Tabloları"])


def _register(route: str, table: str, key_field: str, key_label: str) -> None:
    """Bir destek tablosu için list / ozet / temizle endpoint'lerini kaydeder."""

    @router.get(f"/api/{route}", name=f"list_{route.replace('-', '_')}")
    async def _list(
        yil:   Optional[int] = Query(None),
        limit: int           = Query(9_999, le=99_999),
        db:    AsyncSession  = Depends(get_db),
    ):
        clauses: list[str] = []
        params: dict = {}
        if yil:
            clauses.append("yil = :yil"); params["yil"] = yil
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        rows = (
            await db.execute(
                text(f"""
                    SELECT {key_field}, yil, tutar_tl
                    FROM {table} {where}
                    ORDER BY {key_field} ASC, yil ASC
                    LIMIT :limit
                """),
                {**params, "limit": limit},
            )
        ).mappings().all()
        return {"data": [dict(r) for r in rows], "total": len(rows)}

    @router.get(f"/api/{route}/ozet", name=f"ozet_{route.replace('-', '_')}")
    async def _ozet(db: AsyncSession = Depends(get_db)):
        rows = (
            await db.execute(
                text(f"""
                    SELECT yil,
                           SUM(tutar_tl)::numeric          AS toplam_tl,
                           COUNT(DISTINCT {key_field})::int AS {key_label}_sayisi
                    FROM {table}
                    GROUP BY yil ORDER BY yil DESC
                """)
            )
        ).mappings().all()
        return {"data": [dict(r) for r in rows]}

    @router.delete(f"/api/{route}/temizle", name=f"temizle_{route.replace('-', '_')}")
    async def _temizle(
        yil: Optional[int] = Query(None),
        db:  AsyncSession  = Depends(get_db),
    ):
        async with db.begin():
            if yil:
                r = await db.execute(text(f"DELETE FROM {table} WHERE yil = :y"), {"y": yil})
            else:
                r = await db.execute(text(f"DELETE FROM {table}"))
        return {"silinen": r.rowcount}


# route                  tablo                  key_field    key_label
_register("alan-bazli",         "alan_bazli_destek",  "destek_adi", "destek")
_register("fark-prim",          "fark_prim_destek",   "kategori",   "kategori")
_register("hayvancilik-destek", "hayvancilik_destek", "destek_adi", "destek")
_register("genel-destek",       "genel_destek",       "destek_adi", "destek")
