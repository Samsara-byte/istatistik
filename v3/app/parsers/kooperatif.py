"""Kooperatif (.xls) parser."""
from __future__ import annotations
from app.parsers.xls_reader import read_xls_cells
from app.utils import clean


def parse_kooperatif_xls(content: bytes) -> list[dict]:
    cells = read_xls_cells(content)
    if not cells:
        return []
    max_row = max(r for r, c in cells)
    rows = []
    for r in range(2, max_row + 1):
        ilce   = cells.get((r, 1)); koy    = cells.get((r, 2))
        ktype  = cells.get((r, 3)); ortak  = cells.get((r, 4))
        baskan = cells.get((r, 5)); telefon= cells.get((r, 6))
        if not isinstance(ilce, str) or not clean(ilce): continue
        if not isinstance(koy,  str) or not clean(koy):  continue
        if not isinstance(ktype,str):                     continue
        tel = ""
        if telefon:
            try:    tel = str(int(float(telefon)))
            except: tel = clean(telefon, 30)
        ortak_sayisi = None
        if ortak is not None:
            try: ortak_sayisi = int(float(ortak))
            except: pass
        rows.append({"ilce":clean(ilce,60),"koy_belde":clean(koy,120),"koop_turu":clean(ktype,80),
                     "ortak_sayisi":ortak_sayisi,"baskan":clean(baskan,200),"telefon":tel})
    return rows
