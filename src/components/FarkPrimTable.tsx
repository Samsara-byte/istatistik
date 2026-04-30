

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

interface Row {
  kategori: string;
  yil: number;
  tutar_tl: number;
}
interface Ozet {
  yil: number;
  toplam_tl: number;
  kategori_sayisi: number;
}

export default function FarkPrimTable() {
  const [data, setData] = useState<Row[]>([]);
  const [ozet, setOzet] = useState<Ozet[]>([]);
  const [yilFil, setYilFil] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { sort, onSort } = useSortState("kategori", "asc");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${BASE}/api/fark-prim?limit=9999`).then((r) => r.json()),
        fetch(`${BASE}/api/fark-prim/ozet`).then((r) => r.json()),
      ]);
      setData(r1.data ?? []);
      setOzet(r2.data ?? []);
    } catch (e) {
      console.error("FarkPrim fetch error:", e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Pivot
  const yillar = [...new Set(data.map((d) => d.yil))].sort((a, b) => a - b);
  const kategoriler = [...new Set(data.map((d) => d.kategori))].sort();
  const yillarAktif = yilFil ? [parseInt(yilFil)] : yillar;

  const pivot = new Map<string, Map<number, number>>();
  data.forEach((r) => {
    if (!pivot.has(r.kategori)) pivot.set(r.kategori, new Map());
    pivot.get(r.kategori)!.set(r.yil, r.tutar_tl);
  });

  const colTotals = yillarAktif.map((y) =>
    [...pivot.values()].reduce((s, m) => s + (m.get(y) || 0), 0),
  );

  const handleSort = (key: string) => {
    const nd = sort.key === key && sort.dir === "asc" ? "desc" : "asc";
    onSort(key);
    // Sıralama client-side yeterli (az veri)
  };

  const sorted = [...kategoriler].sort((a, b) => {
    if (sort.key === "kategori") {
      return sort.dir === "asc"
        ? a.localeCompare(b, "tr")
        : b.localeCompare(a, "tr");
    }
    // Tutar sıralaması — seçili yıl yoksa toplam
    const getVal = (k: string) =>
      yillarAktif.reduce((s, y) => s + (pivot.get(k)?.get(y) || 0), 0);
    return sort.dir === "asc" ? getVal(a) - getVal(b) : getVal(b) - getVal(a);
  });

  const exportExcel = useCallback(async () => {
    setExporting(true);
    try {
      const headers = ["Kategori", ...yillarAktif.map(String)];
      const dataRows = sorted.map((k) => [
        k,
        ...yillarAktif.map((y) => pivot.get(k)?.get(y) ?? 0),
      ]);
      const totRow = ["TOPLAM", ...colTotals];
      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows, [], totRow]);
      ws["!cols"] = [{ wch: 40 }, ...yillarAktif.map(() => ({ wch: 18 }))];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Fark-Prim");
      XLSX.writeFile(wb, `fark_prim${yilFil ? "_" + yilFil : ""}.xlsx`);
    } finally {
      setExporting(false);
    }
  }, [sorted, yillarAktif, pivot, colTotals, yilFil]);

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
            gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))",
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
                boxShadow: "var(--sh)",
                background: yilFil === String(o.yil) ? "var(--gm)" : "#fff",
                border: `2px solid ${yilFil === String(o.yil) ? "var(--gm)" : "var(--br)"}`,
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
                  fontFamily: "'JetBrains Mono',monospace",
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
                {o.kategori_sayisi} kategori · TL
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
              Fark/Prim Ödemeleri
            </h2>
            {yilFil && (
              <span
                onClick={() => setYilFil("")}
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
                  label="Kategori"
                  sortKey="kategori"
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
              ) : sorted.length === 0 ? (
                <EmptyRow
                  cols={1 + yillarAktif.length}
                  text="Veri yok — İçeri Aktar ile Fark/Prim verisi yükleyin"
                />
              ) : (
                <>
                  {sorted.map((kat, ri) => (
                    <tr
                      key={kat}
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
                          padding: "7px 12px",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--tx)",
                        }}
                      >
                        {kat}
                      </td>
                      {yillarAktif.map((y) => {
                        const v = pivot.get(kat)?.get(y);
                        return (
                          <td
                            key={y}
                            style={{
                              padding: "7px 12px",
                              textAlign: "right",
                              fontFamily: "'JetBrains Mono',monospace",
                              fontSize: 11.5,
                              color:
                                v == null
                                  ? "var(--br2)"
                                  : v > 0
                                    ? "var(--gm)"
                                    : "var(--mu)",
                              fontWeight: v && v > 0 ? 600 : 400,
                            }}
                          >
                            {v == null ? "—" : fmt(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
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
                          fontFamily: "'JetBrains Mono',monospace",
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

        {sorted.length > 0 && (
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
