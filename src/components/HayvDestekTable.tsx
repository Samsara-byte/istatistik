

import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  TableHeader,
  ExcelBtn,
  SortableTh,
  fmt,
  useSortState,
  LoadingRow,
  EmptyRow,
} from "@/lib/ui";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

interface DesRow {
  destek_adi: string;
  yil: number;
  tutar_tl: number;
}
interface OzetRow {
  yil: number;
  toplam_tl: number;
  destek_sayisi: number;
}

// Renk paleti — destek türüne göre
const RENK: Record<string, string> = {
  Mazot: "#1a5276",
  "Kimyevi Gübre": "#1a6b3a",
  "Zirai Don": "#6b2020",
  DGD: "#6b4c1a",
  "Organik Tarım": "#3a6620",
  "İyi Tarım": "#2a3d8b",
  "Katı Organik": "#4a2070",
  "5 Dekar": "#7a5200",
  Fındık: "#8b3a10",
};
function rowColor(ad: string): string {
  const k = Object.keys(RENK).find((k) => ad.includes(k));
  return k ? RENK[k] : "#374151";
}

export default function HayvDestekTable() {
  const [data, setData] = useState<DesRow[]>([]);
  const [ozet, setOzet] = useState<OzetRow[]>([]);
  const [yilFil, setYilFil] = useState("");
  const [araFil, setAraFil] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { sort, onSort } = useSortState("tutar_tl", "desc");

  const fetchData = useCallback(
    async (sk = sort.key, sd = sort.dir) => {
      setLoading(true);
      try {
        // Her zaman TÜM yılları çek — yil filtresi sadece sütun gösterimi için
        const p = new URLSearchParams();
        if (araFil) p.set("destek", araFil);
        p.set("sort_by", sk || "tutar_tl");
        p.set("sort_dir", sd || "desc");
        p.set("limit", "9999");
        const [r1, r2] = await Promise.all([
          fetch(`${BASE}/api/hayvancilik-destek?${p}`).then((r) => r.json()),
          fetch(`${BASE}/api/hayvancilik-destek/ozet`).then((r) => r.json()),
        ]);
        setData(r1.data || []);
        setOzet(r2.data || []);
      } finally {
        setLoading(false);
      }
    },
    [araFil],
  );

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [araFil, yilFil]);

  const handleSort = (key: string) => {
    const nd = sort.key === key && sort.dir === "asc" ? "desc" : "asc";
    onSort(key);
    fetchData(key, nd);
  };

  // Yıllar listesi
  const yillar = [...new Set(ozet.map((o) => o.yil))].sort((a, b) => b - a);

  // Pivot: destek_adi × yil matris
  const destekler = [...new Set(data.map((d) => d.destek_adi))];
  const yillarAktif = yilFil
    ? [parseInt(yilFil)]
    : [...new Set(data.map((d) => d.yil))].sort((a, b) => a - b);

  const pivot = new Map<string, Map<number, number>>();
  data.forEach((r) => {
    if (!pivot.has(r.destek_adi)) pivot.set(r.destek_adi, new Map());
    pivot.get(r.destek_adi)!.set(r.yil, r.tutar_tl);
  });

  // Sütun toplamları
  const colTotals = yillarAktif.map((y) =>
    [...pivot.values()].reduce((s, m) => s + (m.get(y) || 0), 0),
  );

  const exportExcel = useCallback(async () => {
    setExporting(true);
    try {
      const headers = ["Destek Adı", ...yillarAktif.map((y) => String(y))];
      const dataRows = destekler.map((d) => [
        d,
        ...yillarAktif.map((y) => pivot.get(d)?.get(y) || ""),
      ]);
      const totRow = ["TOPLAM", ...colTotals];
      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows, [], totRow]);
      ws["!cols"] = [{ wch: 40 }, ...yillarAktif.map(() => ({ wch: 18 }))];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Hayvancılık Destekleri");
      XLSX.writeFile(
        wb,
        `hayvancilik_destek${yilFil ? "_" + yilFil : ""}.xlsx`,
      );
    } finally {
      setExporting(false);
    }
  }, [destekler, yillarAktif, pivot, colTotals, yilFil]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        marginTop: 16,
      }}
    >
      {/* Yıl özet kartları */}
      {ozet.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 8,
          }}
        >
          {ozet.map((o) => (
            <div
              key={o.yil}
              onClick={() =>
                setYilFil(yilFil === String(o.yil) ? "" : String(o.yil))
              }
              style={{
                padding: "10px 14px",
                borderRadius: 9,
                cursor: "pointer",
                background: yilFil === String(o.yil) ? "var(--gm)" : "#fff",
                border: `2px solid ${yilFil === String(o.yil) ? "var(--gm)" : "var(--br)"}`,
                boxShadow: "var(--sh)",
                transition: "all .15s",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: ".6px",
                  marginBottom: 3,
                  color:
                    yilFil === String(o.yil)
                      ? "rgba(255,255,255,.7)"
                      : "var(--mu)",
                }}
              >
                {o.yil} Yılı
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  lineHeight: 1,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: yilFil === String(o.yil) ? "#fff" : "var(--tx)",
                }}
              >
                {(o.toplam_tl / 1_000_000).toLocaleString("tr-TR", {
                  maximumFractionDigits: 1,
                })}
                M
              </div>
              <div
                style={{
                  fontSize: 9.5,
                  marginTop: 2,
                  color:
                    yilFil === String(o.yil)
                      ? "rgba(255,255,255,.65)"
                      : "var(--mu)",
                }}
              >
                {o.destek_sayisi} destek kalemi · TL
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="dc">
        <TableHeader>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 800,
                color: "var(--gd)",
              }}
            >
              Hayvancılık Destekleri
            </h2>
            {yilFil && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--gm)",
                  background: "var(--gp)",
                  padding: "3px 9px",
                  borderRadius: 20,
                  border: "1px solid var(--gp2)",
                  cursor: "pointer",
                }}
                onClick={() => setYilFil("")}
              >
                {yilFil} ✕
              </span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {/* Yıl filtre butonları */}
            <div
              style={{
                display: "flex",
                gap: 4,
                background: "var(--sf3)",
                border: "1px solid var(--br)",
                borderRadius: 8,
                padding: 2,
              }}
            >
              <button
                onClick={() => setYilFil("")}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 10.5,
                  fontWeight: 700,
                  background: !yilFil ? "var(--gm)" : "transparent",
                  color: !yilFil ? "#fff" : "var(--mu)",
                }}
              >
                Tümü
              </button>
              {yillar.map((y) => (
                <button
                  key={y}
                  onClick={() =>
                    setYilFil(yilFil === String(y) ? "" : String(y))
                  }
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 10.5,
                    fontWeight: 700,
                    background:
                      yilFil === String(y) ? "var(--gm)" : "transparent",
                    color: yilFil === String(y) ? "#fff" : "var(--mu)",
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
            {/* Arama */}
            <input
              type="text"
              value={araFil}
              onChange={(e) => setAraFil(e.target.value)}
              placeholder="Destek ara…"
              style={{
                padding: "5px 10px",
                border: "1.5px solid var(--br2)",
                borderRadius: 7,
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--tx2)",
                outline: "none",
                width: 150,
              }}
            />
            <ExcelBtn
              onClick={exportExcel}
              disabled={data.length === 0}
              loading={exporting}
            />
          </div>
        </TableHeader>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
          >
            <thead>
              <tr style={{ background: "var(--gd)" }}>
                <SortableTh
                  label="Destek Adı"
                  sortKey="destek_adi"
                  currentSort={sort}
                  onSort={handleSort}
                  align="left"
                />
                {yillarAktif.map((y) => (
                  <SortableTh
                    key={y}
                    label={String(y)}
                    sortKey="tutar_tl"
                    currentSort={sort}
                    onSort={handleSort}
                    align="right"
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow cols={1 + yillarAktif.length} />
              ) : destekler.length === 0 ? (
                <EmptyRow
                  cols={1 + yillarAktif.length}
                  text="Veri yok — İçeri Aktar ile hayvancılık destek verisi yükleyin"
                />
              ) : (
                <>
                  {destekler.map((ad, ri) => (
                    <tr
                      key={ad}
                      style={{
                        borderBottom: "1px solid var(--br)",
                        background: ri % 2 === 0 ? "#fff" : "var(--sf2)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "var(--gp)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background =
                          ri % 2 === 0 ? "#fff" : "var(--sf2)")
                      }
                    >
                      <td
                        style={{
                          padding: "6px 12px",
                          fontSize: 12,
                          fontWeight: 600,
                          color: rowColor(ad),
                        }}
                      >
                        {ad}
                      </td>
                      {yillarAktif.map((y) => {
                        const v = pivot.get(ad)?.get(y);
                        return (
                          <td
                            key={y}
                            style={{
                              padding: "6px 12px",
                              textAlign: "right",
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 11.5,
                              color:
                                v == null
                                  ? "var(--br2)"
                                  : v > 0
                                    ? "var(--gm)"
                                    : "var(--mu)",
                              fontWeight: v != null && v > 0 ? 600 : 400,
                            }}
                          >
                            {v == null ? "—" : fmt(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Toplam satırı */}
                  <tr
                    style={{
                      background: "var(--gd)",
                      borderTop: "2px solid var(--gm)",
                    }}
                  >
                    <td
                      style={{
                        padding: "7px 12px",
                        fontWeight: 800,
                        color: "#fff",
                        fontSize: 12,
                      }}
                    >
                      TOPLAM
                    </td>
                    {colTotals.map((t, i) => (
                      <td
                        key={i}
                        style={{
                          padding: "7px 12px",
                          textAlign: "right",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 12,
                          fontWeight: 800,
                          color: "var(--am)",
                        }}
                      >
                        {fmt(t)}
                      </td>
                    ))}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Alt export */}
        {destekler.length > 0 && (
          <div
            style={{
              padding: "10px 14px",
              borderTop: "1px solid var(--br)",
              background: "var(--sf2)",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <ExcelBtn
              onClick={exportExcel}
              disabled={data.length === 0}
              loading={exporting}
            />
          </div>
        )}
      </div>
    </div>
  );
}
