"""Özet destek tabloları parser'ları."""
from __future__ import annotations
import re
from app.parsers.xls_reader import read_xls_cells


def _yil_cols(cells: dict, start: int = 1, end: int = 10) -> dict[int, int]:
    yil_cols = {}
    for col in range(start, end):
        v = cells.get((0, col))
        if v and str(v).strip().isdigit():
            yil_cols[col] = int(float(str(v).strip()))
    return yil_cols


def parse_ozet_xls(content: bytes, key_field: str, start_col: int = 1) -> list[dict]:
    cells = read_xls_cells(content)
    if not cells: return []
    max_row  = max(r for r, c in cells)
    yil_cols = _yil_cols(cells, start_col)
    if not yil_cols: return []
    rows = []
    for r in range(1, max_row + 1):
        ad = str(cells.get((r, 0), "") or "").strip()
        if not ad or "genel toplam" in ad.lower(): continue
        ad = re.sub(r"^[0-9]+-\s*", "", ad).strip()
        for col, yil in yil_cols.items():
            try:    tutar = round(float(cells.get((r, col))), 2)
            except: tutar = 0.0
            rows.append({key_field: ad, "yil": yil, "tutar_tl": tutar})
    return rows


def parse_fark_prim_xls(content: bytes) -> list[dict]:
    cells = read_xls_cells(content)
    if not cells: return []
    max_row  = max(r for r, c in cells)
    yil_cols = _yil_cols(cells, start=2, end=10)
    if not yil_cols: return []
    kat_rows: dict[str, int] = {}
    for r in range(1, max_row + 1):
        a = str(cells.get((r, 0), "") or "").strip()
        b = str(cells.get((r, 1), "") or "").strip()
        if not a or "genel toplam" in a.lower(): continue
        kat = re.sub(r"\s+Toplam.*$","",a.replace("\n"," "),flags=re.IGNORECASE).strip()
        if "toplam" in a.lower() or not b or b == a.split("\n")[0].strip():
            kat_rows[kat] = r
    rows = []
    for kat, r in kat_rows.items():
        for col, yil in yil_cols.items():
            try:    tutar = round(float(cells.get((r, col))), 2)
            except: tutar = 0.0
            rows.append({"kategori": kat, "yil": yil, "tutar_tl": tutar})
    return rows
