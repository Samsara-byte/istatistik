#!/usr/bin/env python3
"""
Bitkisel Üretim Excel Toplu Yükleme (ETL)
==========================================
Klasördeki *CKS*.xlsx dosyalarını ya da tek bir dosyayı toplu olarak
PostgreSQL'e aktarır. API sunucusu çalışmadan bağımsız kullanılır.

Kurulum:
    pip install sqlalchemy[asyncio] asyncpg openpyxl

Kullanım:
    # Tüm dosyaları yükle
    python -m etl.bulk_import \\
        --db "postgresql+asyncpg://postgres:pass@localhost/burdurdb" \\
        --dir ./excel

    # Tek dosya
    python -m etl.bulk_import --db "..." --file AĞLASUN_2025.xlsx

    # Mevcut kayıtları silmeden ekle
    python -m etl.bulk_import --db "..." --dir ./excel --no-truncate
"""
from __future__ import annotations

import argparse
import asyncio
import glob
import os
import sys
import time
from pathlib import Path

# Proje kökünü path'e ekle (python -m etl.bulk_import ile çalışmazsa)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

try:
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy import text
except ImportError:
    sys.exit("❌  pip install 'sqlalchemy[asyncio]'")

try:
    import openpyxl  # noqa: F401 — parsers/uretim.py bağımlılığı
except ImportError:
    sys.exit("❌  pip install openpyxl")

from app.parsers.uretim import parse_uretim_xlsx


# ── Tek dosya import ────────────────────────────────────────────────────────

async def import_file(engine, path: str, truncate: bool = True) -> tuple[int, int]:
    """
    Bir Excel dosyasını okuyup DB'ye yazar.
    Döndürür: (eklenen_kayıt, silinen_kayıt)
    """
    content = Path(path).read_bytes()
    rows, ilce, skipped = parse_uretim_xlsx(content, yil=0)  # yıl dosyadan okunur

    if not rows:
        print(f"  ⚠️   Geçerli satır yok (atlanan: {skipped})\n")
        return 0, 0

    yil = rows[0]["uretim_yili"]
    print(f"  📂  {Path(path).name}")
    print(f"      ilçe={ilce} | yıl={yil} | {len(rows):,} satır | atlanan={skipped}")

    t0 = time.perf_counter()
    async with engine.begin() as conn:
        silinen = 0
        if truncate and ilce:
            r = await conn.execute(
                text("DELETE FROM uretim WHERE uretim_yili=:yil AND ilce=:ilce"),
                {"yil": yil, "ilce": ilce},
            )
            silinen = r.rowcount
            if silinen:
                print(f"      🗑️  {silinen:,} eski kayıt silindi")

        await conn.execute(
            text(
                "INSERT INTO uretim "
                "(uretim_yili, il, ilce, koy, urun, tarim_sekli, uretim_cesidi, ekili_alan) "
                "VALUES (:uretim_yili, :il, :ilce, :koy, :urun, :tarim_sekli, :uretim_cesidi, :ekili_alan)"
            ),
            rows,
        )

        sure = round(time.perf_counter() - t0, 2)
        await conn.execute(
            text(
                "INSERT INTO import_log "
                "(dosya_adi, tablo, ilce, yil, kayit_sayisi, silinen, sure_sn, durum) "
                "VALUES (:dosya_adi, 'uretim', :ilce, :yil, :kayit, :silinen, :sure, 'basarili')"
            ),
            {
                "dosya_adi": Path(path).name,
                "ilce":      ilce,
                "yil":       yil,
                "kayit":     len(rows),
                "silinen":   silinen,
                "sure":      sure,
            },
        )

    print(f"      ✅  {len(rows):,} kayıt eklendi — {sure}s\n")
    return len(rows), silinen


# ── Ana akış ────────────────────────────────────────────────────────────────

async def main() -> None:
    ap = argparse.ArgumentParser(
        description="Bitkisel üretim Excel toplu yükleme",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--db",  required=True,
                    help="postgresql+asyncpg://user:pass@host/dbname")
    ap.add_argument("--dir", default=None,
                    help="Excel klasörü — *CKS*.xlsx dosyaları taranır")
    ap.add_argument("--file", default=None,
                    help="Tek dosya yolu")
    ap.add_argument("--no-truncate", action="store_true",
                    help="Mevcut kayıtları silmeden üstüne ekle")
    args = ap.parse_args()

    if args.file:
        files = [args.file]
    elif args.dir:
        files = sorted(glob.glob(os.path.join(args.dir, "*CKS*.xlsx")))
    else:
        ap.error("--dir veya --file belirtilmeli")
        return

    if not files:
        sys.exit("❌  Hiç dosya bulunamadı")

    print(f"\n🚀  {len(files)} dosya aktarılacak")
    print("─" * 50)

    engine  = create_async_engine(args.db, pool_size=2, max_overflow=3)
    toplam  = 0
    hatalar = 0

    for idx, fpath in enumerate(files, 1):
        print(f"[{idx}/{len(files)}] {Path(fpath).name}")
        try:
            eklenen, _ = await import_file(engine, fpath, truncate=not args.no_truncate)
            toplam += eklenen
        except Exception as exc:
            print(f"      ❌  HATA: {exc}\n")
            hatalar += 1

    await engine.dispose()

    print("═" * 50)
    print(f"✅  Toplam: {toplam:,} kayıt yüklendi")
    if hatalar:
        print(f"⚠️   {hatalar} dosyada hata oluştu")
    print()


if __name__ == "__main__":
    asyncio.run(main())
