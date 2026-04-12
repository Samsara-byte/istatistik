"""
GET /api/uretim          — sayfalı & filtreli liste
GET /api/uretim/ozet     — aggregate özet (ilçe/köy/ürün bazlı)
GET /api/uretim/urunler  — ürün dropdown
GET /api/uretim/ilceler  — ilçe dropdown
GET /api/uretim/log      — import geçmişi
"""
import asyncio
from typing import Optional
from fastapi import APIRouter, Query
from database import get_pool

router = APIRouter(prefix="/api/uretim", tags=["uretim"])


# ── WHERE clause builder ─────────────────────────────────────
def _where(
    yil: Optional[int],
    ilce: Optional[str],
    koy: Optional[str],
    urun: Optional[str],
    tarim_sekli: Optional[str],
    uretim_cesidi: Optional[str],
    start: int = 1,
) -> tuple[str, list]:
    clauses, params, i = [], [], start
    if yil:           clauses.append(f"uretim_yili=${i}");   params.append(yil);               i += 1
    if ilce:          clauses.append(f"ilce=${i}");           params.append(ilce.upper());      i += 1
    if koy:           clauses.append(f"koy ILIKE ${i}");      params.append(f"%{koy}%");        i += 1
    if urun:          clauses.append(f"urun ILIKE ${i}");     params.append(f"%{urun}%");       i += 1
    if tarim_sekli:   clauses.append(f"tarim_sekli=${i}");    params.append(tarim_sekli);       i += 1
    if uretim_cesidi: clauses.append(f"uretim_cesidi=${i}");  params.append(uretim_cesidi);     i += 1
    return ("WHERE " + " AND ".join(clauses)) if clauses else "", params


# ── 1. Filtreli liste ────────────────────────────────────────
@router.get("")
async def list_uretim(
    yil:           Optional[int] = Query(2025),
    ilce:          Optional[str] = Query(None),
    koy:           Optional[str] = Query(None),
    urun:          Optional[str] = Query(None),
    tarim_sekli:   Optional[str] = Query(None),
    uretim_cesidi: Optional[str] = Query(None),
    group_by:      Optional[str] = Query(None, description="koy | urun"),
    page:          int           = Query(1, ge=1),
    limit:         int           = Query(100, ge=1, le=500),
):
    offset = (page - 1) * limit
    where, params = _where(yil, ilce, koy, urun, tarim_sekli, uretim_cesidi)
    pi = len(params) + 1  # next param index

    if group_by == "koy":
        sql = f"""
            SELECT ilce, koy,
                   COUNT(DISTINCT urun)::int          AS urun_cesidi,
                   COUNT(*)::int                       AS kayit_sayisi,
                   ROUND(SUM(ekili_alan)::numeric,2)  AS toplam_alan
            FROM uretim {where}
            GROUP BY ilce, koy ORDER BY toplam_alan DESC
            LIMIT ${pi} OFFSET ${pi+1}
        """
        cnt_sql = f"SELECT COUNT(*) FROM (SELECT koy FROM uretim {where} GROUP BY ilce,koy) s"
    elif group_by == "urun":
        sql = f"""
            SELECT urun, tarim_sekli,
                   COUNT(DISTINCT ilce)::int           AS ilce_sayisi,
                   COUNT(DISTINCT koy)::int            AS koy_sayisi,
                   COUNT(*)::int                       AS kayit_sayisi,
                   ROUND(SUM(ekili_alan)::numeric,2)   AS toplam_alan
            FROM uretim {where}
            GROUP BY urun, tarim_sekli ORDER BY toplam_alan DESC
            LIMIT ${pi} OFFSET ${pi+1}
        """
        cnt_sql = f"SELECT COUNT(*) FROM (SELECT urun FROM uretim {where} GROUP BY urun,tarim_sekli) s"
    else:
        sql = f"""
            SELECT id, uretim_yili, il, ilce, koy, urun, tarim_sekli, uretim_cesidi, ekili_alan
            FROM uretim {where}
            ORDER BY ilce, koy, urun
            LIMIT ${pi} OFFSET ${pi+1}
        """
        cnt_sql = f"SELECT COUNT(*) FROM uretim {where}"

    pool = get_pool()
    async with pool.acquire() as conn:
        rows, total = await asyncio.gather(
            conn.fetch(sql, *params, limit, offset),
            conn.fetchval(cnt_sql, *params),
        )

    total = int(total or 0)
    return {
        "data":  [dict(r) for r in rows],
        "total": total,
        "page":  page,
        "limit": limit,
        "pages": max(1, -(-total // limit)),
    }


# ── 2. Özet / aggregate ──────────────────────────────────────
@router.get("/ozet")
async def ozet_uretim(
    yil:      int           = Query(2025),
    ilce:     Optional[str] = Query(None),
    koy:      Optional[str] = Query(None),
    group_by: str           = Query("ilce"),
    limit:    int           = Query(50, ge=1, le=200),
):
    where, params = _where(yil, ilce, koy, None, None, None)
    pi = len(params) + 1

    VALID = {"ilce", "koy", "urun", "tarim_sekli", "uretim_cesidi"}
    grp = group_by if group_by in VALID else "ilce"

    EXTRA_SEL = {
        "ilce":          "COUNT(DISTINCT koy)::int AS koy_sayisi, COUNT(DISTINCT urun)::int AS urun_cesidi,",
        "koy":           "ilce, COUNT(DISTINCT urun)::int AS urun_cesidi,",
        "urun":          "tarim_sekli, COUNT(DISTINCT ilce)::int AS ilce_sayisi, COUNT(DISTINCT koy)::int AS koy_sayisi,",
        "tarim_sekli":   "COUNT(DISTINCT urun)::int AS urun_cesidi,",
        "uretim_cesidi": "COUNT(DISTINCT urun)::int AS urun_cesidi,",
    }
    EXTRA_GRP = {"koy": ", ilce", "urun": ", tarim_sekli"}

    sql = f"""
        SELECT {grp}, {EXTRA_SEL.get(grp,'')}
               COUNT(*)::int                           AS kayit_sayisi,
               ROUND(SUM(ekili_alan)::numeric,2)       AS toplam_alan_da,
               ROUND((SUM(ekili_alan)/10.0)::numeric,3) AS toplam_alan_ha
        FROM uretim {where}
        GROUP BY {grp}{EXTRA_GRP.get(grp,'')}
        ORDER BY toplam_alan_da DESC LIMIT ${pi}
    """
    tot_sql = f"""
        SELECT ROUND(SUM(ekili_alan)::numeric,2) AS alan, COUNT(*)::int AS kayit
        FROM uretim {where}
    """

    pool = get_pool()
    async with pool.acquire() as conn:
        rows, tot = await asyncio.gather(
            conn.fetch(sql, *params, limit),
            conn.fetchrow(tot_sql, *params),
        )

    return {
        "group_by":       grp,
        "data":           [dict(r) for r in rows],
        "toplam_alan_da": float(tot["alan"] or 0),
        "toplam_kayit":   int(tot["kayit"] or 0),
    }


# ── 3. Ürün dropdown ─────────────────────────────────────────
@router.get("/urunler")
async def list_urunler(
    yil:  int           = Query(2025),
    ilce: Optional[str] = Query(None),
):
    clauses, params = ["uretim_yili=$1"], [yil]
    if ilce:
        clauses.append("ilce=$2")
        params.append(ilce.upper())
    where = "WHERE " + " AND ".join(clauses)

    sql = f"""
        SELECT urun, ROUND(SUM(ekili_alan)::numeric,2) AS toplam_alan
        FROM uretim {where} GROUP BY urun ORDER BY toplam_alan DESC
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)
    return {"data": [dict(r) for r in rows]}


# ── 4. İlçe dropdown ─────────────────────────────────────────
@router.get("/ilceler")
async def list_ilceler(yil: int = Query(2025)):
    sql = """
        SELECT ilce,
               COUNT(DISTINCT koy)::int             AS koy_sayisi,
               ROUND(SUM(ekili_alan)::numeric,2)    AS toplam_alan
        FROM uretim WHERE uretim_yili=$1
        GROUP BY ilce ORDER BY ilce
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, yil)
    return {"data": [dict(r) for r in rows]}


# ── 5. Import geçmişi ─────────────────────────────────────────
@router.get("/log")
async def import_log(limit: int = Query(20, le=100)):
    sql = """
        SELECT id, dosya_adi, ilce, uretim_yili, kayit_sayisi,
               silinen, sure_sn, durum, hata_mesaji, yuklendi_at
        FROM import_log ORDER BY yuklendi_at DESC LIMIT $1
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, limit)
    return {"data": [dict(r) for r in rows]}
