"""Bitkisel destek / biyolojik mücadele (.xls) parser."""
from __future__ import annotations
from app.parsers.xls_reader import read_xls_cells
from app.utils import clean, to_float


def parse_bitkisel_destek_xls(content: bytes, yil: int) -> list[dict]:
    cells = read_xls_cells(content)
    if not cells: return []
    max_row = max(r for r, c in cells)
    rows = []
    for r in range(4, max_row + 1):
        ilce = clean(cells.get((r, 3)),  60)
        koy  = clean(cells.get((r, 4)),  120)
        urun = clean(cells.get((r, 10)), 120)
        if not ilce or not koy or not urun: continue
        rows.append({"yil":yil,"il":"BURDUR","ilce":ilce.upper(),"koy":koy.upper(),"urun":urun.upper(),
                     "feromon_adet":       to_float(cells.get((r,11))),
                     "feromon_tuzak_adet": to_float(cells.get((r,12))),
                     "faydali_bocek_adet": to_float(cells.get((r,13))),
                     "desteklenen_alan_da":to_float(cells.get((r,14))),
                     "destek_tutari_tl":   to_float(cells.get((r,15))),
                     "net_odeme_tl":       to_float(cells.get((r,17)))})
    return rows
