from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.helpers import paginate, safe_sort, sort_direction

router = APIRouter(prefix="/api/sut", tags=["Süt Destekleme"])

_SORT_FIELDS = {"yil", "donem", "il", "ilce", "koy", "temel_sut_lt", "destek_tutari"}


@router.get("")
async def list_sut(
    yil:      Optional[int] = Query(None),
    donem:    Optional[str] = Query(None),
    ilce:     Optional[str] = Query(None),
    koy:      Optional[str] = Query(None),
    sort_by:  Optional[str] = Query("destek_tutari"),
    sort_dir: Optional[str] = Query("desc"),
    page:     int           = Query(1, ge=1),
    limit:    int           = Query(100, ge=1, le=50_000),
    db:       AsyncSession  = Depends(get_db),
):
    clauses: list[str] = []
    params: dict = {}

    if yil:
        clauses.append("yil = :yil");      params["yil"]  = yil
    if donem:
        clauses.append("donem = :donem");  params["donem"] = donem
    if ilce:
        clauses.append("UPPER(ilce) = UPPER(:ilce)"); params["ilce"] = ilce
    if koy:
        clauses.append("UPPER(koy) LIKE UPPER(:koy)"); params["koy"] = f"%{koy}%"

    where  = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    offset = (page - 1) * limit
    oc     = safe_sort(sort_by, _SORT_FIELDS, "destek_tutari")
    od     = sort_direction(sort_dir)

    sql = f"""
        SELECT il, ilce, koy,
               SUM(temel_sut_lt)::numeric    AS temel_sut_lt,
               SUM(destek_tutari)::numeric   AS destek_tutari,
               COUNT(*)::int                 AS uretici_sayisi
        FROM sut_destekleme {where}
        GROUP BY il, ilce, koy ORDER BY {oc} {od}
        LIMIT :limit OFFSET :offset
    """
    cnt = f"SELECT COUNT(*) FROM (SELECT koy FROM sut_destekleme {where} GROUP BY il,ilce,koy) s"

    rows  = (await db.execute(text(sql), {**params, "limit": limit, "offset": offset})).mappings().all()
    total = (await db.execute(text(cnt), params)).scalar() or 0

    return {"data": [dict(r) for r in rows], **paginate(int(total), page, limit)}


@router.get("/ozet")
async def sut_ozet(
    yil:  Optional[int] = Query(None),
    ilce: Optional[str] = Query(None),
    db:   AsyncSession  = Depends(get_db),
):
    clauses: list[str] = []
    params: dict = {}
    if yil:
        clauses.append("yil = :yil");     params["yil"]  = yil
    if ilce:
        clauses.append("UPPER(ilce) = UPPER(:ilce)"); params["ilce"] = ilce
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""

    row = (
        await db.execute(
            text(f"""
                SELECT SUM(temel_sut_lt)::numeric    AS toplam_sut_lt,
                       SUM(destek_tutari)::numeric   AS toplam_tutar,
                       COUNT(*)::int                 AS uretici_sayisi,
                       COUNT(DISTINCT koy)::int      AS koy_sayisi,
                       COUNT(DISTINCT ilce)::int     AS ilce_sayisi
                FROM sut_destekleme {where}
            """),
            params,
        )
    ).mappings().fetchone()
    return dict(row) if row else {}


@router.get("/donemler")
async def sut_donemler(db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            text("SELECT DISTINCT donem, yil FROM sut_destekleme ORDER BY yil DESC, donem DESC")
        )
    ).mappings().all()
    return {"data": [dict(r) for r in rows]}


@router.delete("/temizle")
async def sut_temizle(
    donem: Optional[str] = Query(None),
    yil:   Optional[int] = Query(None),
    db:    AsyncSession  = Depends(get_db),
):
    async with db.begin():
        if donem:
            r = await db.execute(text("DELETE FROM sut_destekleme WHERE donem = :d"), {"d": donem})
        elif yil:
            r = await db.execute(text("DELETE FROM sut_destekleme WHERE yil = :y"), {"y": yil})
        else:
            r = await db.execute(text("DELETE FROM sut_destekleme"))
    return {"silinen": r.rowcount}
