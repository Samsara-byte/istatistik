"""Süt destekleme (.xlsx) parser."""
from __future__ import annotations
import io
import openpyxl


def parse_sut_xlsx(content: bytes, donem: str, yil: int) -> list[dict]:
    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    rows = []
    for row in ws.iter_rows(min_row=11, values_only=True):
        if not row[1] or not isinstance(row[1], (int, float)):
            continue
        koy  = str(row[8]  or "").strip().upper()
        ilce = str(row[9]  or "").strip().upper()
        if not koy or not ilce:
            continue
        rows.append({"donem":donem,"yil":yil,"il":str(row[10] or "").strip().upper(),
                     "ilce":ilce,"koy":koy,
                     "temel_sut_lt":round(float(row[12] or 0),2),
                     "destek_tutari":round(float(row[25] or 0),2)})
    wb.close()
    return rows
