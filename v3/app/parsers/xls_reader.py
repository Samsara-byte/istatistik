"""
Saf Python OLE/BIFF8 XLS Okuyucu
----------------------------------
xlrd gerektirmeden eski .xls (BIFF8) dosyalarını okur.
Döndürür: {(satır, sütun): değer}
"""
from __future__ import annotations
import struct as _s


def _rk(rk: int) -> float:
    v = (rk >> 2) if (rk & 2) else _s.unpack("<d", _s.pack("<Q", (rk & 0xFFFFFFFC) << 32))[0]
    return v / 100.0 if (rk & 1) else v


def read_xls_cells(content: bytes) -> dict[tuple[int, int], str | float]:
    SEC = 512
    difat = [s for s in _s.unpack_from("<109I", content, 76) if s < 0xFFFFFFFA]
    fat: list[int] = []
    for s in difat:
        fat.extend(_s.unpack_from(f"<{SEC // 4}I", content, 512 + s * SEC))

    dir_off = 512 + _s.unpack_from("<I", content, 48)[0] * SEC
    wb_start = wb_size = 0
    for i in range(16):
        off  = dir_off + i * 128
        nlen = _s.unpack_from("<H", content, off + 64)[0]
        if nlen < 2:
            continue
        name = content[off : off + nlen - 2].decode("utf-16-le", errors="replace")
        if "Workbook" in name or "workbook" in name:
            wb_start = _s.unpack_from("<I", content, off + 116)[0]
            wb_size  = _s.unpack_from("<I", content, off + 120)[0]
            break
    if not wb_size:
        return {}

    wb = bytearray()
    sector, seen = wb_start, set()
    while sector < 0xFFFFFFFA and sector not in seen:
        seen.add(sector)
        wb.extend(content[512 + sector * SEC : 512 + sector * SEC + SEC])
        sector = fat[sector] if sector < len(fat) else 0xFFFFFFFF
    wb = bytes(wb[:wb_size])

    # SST
    sst: list[str] = []
    pos = 0
    while pos < len(wb) - 4:
        rt = _s.unpack_from("<H", wb, pos)[0]
        rl = _s.unpack_from("<H", wb, pos + 2)[0]
        if rl > 65535:
            pos += 2; continue
        body = wb[pos + 4 : pos + 4 + rl]
        if rt == 0x00FC:
            unique = _s.unpack_from("<I", body, 4)[0]
            sd = bytearray(body)
            np2 = pos + 4 + rl
            while np2 < len(wb) - 4:
                nrt = _s.unpack_from("<H", wb, np2)[0]
                nrl = _s.unpack_from("<H", wb, np2 + 2)[0]
                if nrt == 0x003C:
                    sd.extend(wb[np2 + 4 : np2 + 4 + nrl]); np2 += 4 + nrl
                else:
                    break
            p = 8
            for _ in range(unique):
                if p >= len(sd) - 2: break
                try:
                    n  = _s.unpack_from("<H", sd, p)[0]
                    fl = sd[p + 2]; p += 3
                    if fl & 0x08: p += _s.unpack_from("<H", sd, p)[0] * 0 + 2
                    if fl & 0x04: p += _s.unpack_from("<I", sd, p)[0] * 0 + 4
                    s2 = (sd[p : p + n * 2].decode("utf-16-le", "replace") if (fl & 1)
                          else sd[p : p + n].decode("cp1254", "replace"))
                    p += n * 2 if (fl & 1) else n
                    sst.append(s2.strip())
                except Exception:
                    p += 1
            break
        pos += 4 + rl

    # Hücreler
    cells: dict[tuple[int, int], str | float] = {}
    pos = 0
    while pos < len(wb) - 4:
        rt = _s.unpack_from("<H", wb, pos)[0]
        rl = _s.unpack_from("<H", wb, pos + 2)[0]
        if rl > 65535:
            pos += 2; continue
        body = wb[pos + 4 : pos + 4 + rl]
        try:
            if   rt == 0x00FD and rl >= 10:
                r, c = _s.unpack_from("<HH", body)
                idx  = _s.unpack_from("<I", body, 6)[0]
                if idx < len(sst): cells[(r, c)] = sst[idx]
            elif rt == 0x0204 and rl >= 9:
                r, c = _s.unpack_from("<HH", body)
                n    = _s.unpack_from("<H", body, 6)[0]; fl = body[8]
                cells[(r, c)] = (body[9 : 9+n*2].decode("utf-16-le","replace") if (fl & 1)
                                 else body[9 : 9+n].decode("cp1254","replace")).strip()
            elif rt == 0x0203 and rl >= 14:
                r, c = _s.unpack_from("<HH", body)
                cells[(r, c)] = _s.unpack_from("<d", body, 6)[0]
            elif rt == 0x00BD and rl >= 6:
                r, fc = _s.unpack_from("<HH", body)
                lc    = _s.unpack_from("<H", body, rl - 2)[0]
                for ii, col in enumerate(range(fc, lc + 1)):
                    cells[(r, col)] = _rk(_s.unpack_from("<I", body, 4 + ii * 6 + 2)[0])
            elif rt == 0x027e and rl >= 10:
                r, c = _s.unpack_from("<HH", body)
                cells[(r, c)] = _rk(_s.unpack_from("<I", body, 6)[0])
        except Exception:
            pass
        pos += 4 + rl
    return cells
