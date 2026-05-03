"""Hayvancılık (.xls) parser."""
from __future__ import annotations
from app.parsers.xls_reader import read_xls_cells


def parse_hayvancilik_xls(content: bytes, ilce_adi: str, yil: int) -> list[dict]:
    cells = read_xls_cells(content)
    if not cells:
        return []
    max_row = max(r for r, c in cells)

    header_row = col_koy = col_sigir = col_manda = col_koyun = col_keci = None
    for r in range(min(25, max_row)):
        strs = {c2: str(cells.get((r, c2), "")) for c2 in range(25) if isinstance(cells.get((r, c2)), str)}
        if any("Köy" in v and "Mahalle" in v for v in strs.values()) and \
           any(kw in v for v in strs.values() for kw in ("Sığır","Koyun","Manda","Keçi")):
            header_row = r
            for col, v in strs.items():
                if "Köy" in v and "Mahalle" in v: col_koy   = col
                if "Sığır" in v:                  col_sigir = col
                if "Manda" in v:                  col_manda = col
                if "Koyun" in v:                  col_koyun = col
                if "Keçi"  in v:                  col_keci  = col
            break

    if header_row is None or col_koy is None:
        return []

    def num(row: int, col: int | None) -> int:
        if col is None: return 0
        try: return max(0, int(float(cells.get((row, col), 0) or 0)))
        except: return 0

    koyler: dict[str, dict] = {}
    for r in range(header_row + 1, max_row + 1):
        koy = cells.get((r, col_koy), "")
        if not isinstance(koy, str) or not koy.strip():
            continue
        koy = koy.strip().upper()
        si, ma, ko, ke = num(r,col_sigir), num(r,col_manda), num(r,col_koyun), num(r,col_keci)
        if koy not in koyler:
            koyler[koy] = dict(sigir=0,manda=0,koyun=0,keci=0,
                               sigir_isletme=0,manda_isletme=0,koyun_isletme=0,keci_isletme=0,toplam_isletme=0)
        k = koyler[koy]
        k["sigir"]+=si; k["manda"]+=ma; k["koyun"]+=ko; k["keci"]+=ke
        if si>0: k["sigir_isletme"]+=1
        if ma>0: k["manda_isletme"]+=1
        if ko>0: k["koyun_isletme"]+=1
        if ke>0: k["keci_isletme"]+=1
        k["toplam_isletme"]+=1

    return [{"uretim_yili":yil,"il":"BURDUR","ilce":ilce_adi.upper(),"koy":koy,**v}
            for koy, v in koyler.items()]
