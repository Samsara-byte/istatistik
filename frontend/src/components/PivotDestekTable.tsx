/**
 * Genel Pivot Destek Tablosu
 * AlanBazlı · FarkPrim · HayvancılıkDestek · GenelDestek için ortak şablon
 */
import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  TableHeader, ExcelBtn, SortableTh, fmt,
  useSortState, LoadingRow, EmptyRow,
} from "@/lib/ui";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

interface OzetRow { yil: number; toplam_tl: number; [key: string]: number }

interface Props {
  endpoint: string;
  title: string;
  nameKey?: string;
  nameLabel?: string;
  excelSheet?: string;
  excelFile?: string;
  showSearch?: boolean;
}

export default function PivotDestekTable({
  endpoint,
  title,
  nameKey = "destek_adi",
  nameLabel = "Destek Adı",
  excelSheet = "Destekler",
  excelFile,
  showSearch = true,
}: Props) {
  const [data, setData]       = useState<Record<string, unknown>[]>([]);
  const [ozet, setOzet]       = useState<OzetRow[]>([]);
  const [yilFil, setYilFil]   = useState("");
  const [araFil, setAraFil]   = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { sort, onSort }      = useSortState(nameKey, "asc");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: "9999" });
      if (araFil) p.set("destek", araFil);
      const [r1, r2] = await Promise.all([
        fetch(`${BASE}/api/${endpoint}?${p}`).then(r => r.json()),
        fetch(`${BASE}/api/${endpoint}/ozet`).then(r => r.json()),
      ]);
      setData(r1.data ?? []);
      setOzet(r2.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [endpoint, araFil]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Pivot hesaplama ──────────────────────────────────────────
  const allYils = [...new Set(data.map(d => Number(d.yil)))].sort((a, b) => a - b);
  const yillarAktif = yilFil ? [parseInt(yilFil)] : allYils;

  const pivot = new Map<string, Map<number, number>>();
  data.forEach(r => {
    const name   = String(r[nameKey] ?? "");
    const yil    = Number(r.yil);
    const tutar  = Number(r.tutar_tl ?? 0);
    if (!pivot.has(name)) pivot.set(name, new Map());
    pivot.get(name)!.set(yil, tutar);
  });

  const rawItems = [...new Set(data.map(d => String(d[nameKey] ?? "")))];

  // Client-side sıralama (pivot tabloda veri az olduğundan uygundur)
  const sortedItems = [...rawItems].sort((a, b) => {
    if (!sort.dir) return 0;
    if (sort.key === nameKey) {
      const cmp = a.localeCompare(b, "tr");
      return sort.dir === "asc" ? cmp : -cmp;
    }
    const getVal = (k: string) =>
      yillarAktif.reduce((s, y) => s + (pivot.get(k)?.get(y) ?? 0), 0);
    return sort.dir === "asc" ? getVal(a) - getVal(b) : getVal(b) - getVal(a);
  });

  const colTotals = yillarAktif.map(y =>
    [...pivot.values()].reduce((s, m) => s + (m.get(y) ?? 0), 0)
  );

  const ozetYillar = [...new Set(ozet.map(o => o.yil))].sort((a, b) => b - a);
  const toggleYil = (y: string) => setYilFil(prev => prev === y ? "" : y);

  const exportExcel = useCallback(async () => {
    setExporting(true);
    try {
      const headers = [nameLabel, ...yillarAktif.map(String)];
      const rows    = sortedItems.map(d => [d, ...yillarAktif.map(y => pivot.get(d)?.get(y) ?? "")]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows, [], ["TOPLAM", ...colTotals]]);
      ws["!cols"] = [{ wch: 40 }, ...yillarAktif.map(() => ({ wch: 18 }))];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, excelSheet);
      XLSX.writeFile(wb, `${excelFile ?? endpoint}${yilFil ? "_" + yilFil : ""}.xlsx`);
    } finally { setExporting(false); }
  }, [sortedItems, yillarAktif, pivot, colTotals, yilFil, nameLabel, excelSheet, excelFile, endpoint]);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>

      {/* Yıl özet kartları */}
      {ozet.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 8 }}>
          {ozet.map(o => {
            const active = yilFil === String(o.yil);
            return (
              <div key={o.yil} onClick={() => toggleYil(String(o.yil))}
                style={{
                  padding: "10px 14px", borderRadius: 9, cursor: "pointer",
                  boxShadow: "var(--sh)", transition: "all .15s",
                  background: active ? "var(--gm)" : "#fff",
                  border: `2px solid ${active ? "var(--gm)" : "var(--br)"}`,
                }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 3, color: active ? "rgba(255,255,255,.7)" : "var(--mu)" }}>
                  {o.yil} Yılı
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1, fontFamily: "'JetBrains Mono',monospace", color: active ? "#fff" : "var(--tx)" }}>
                  {(o.toplam_tl / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}M
                </div>
                <div style={{ fontSize: 9.5, marginTop: 2, color: active ? "rgba(255,255,255,.65)" : "var(--mu)" }}>
                  {(o.destek_sayisi ?? o.kategori_sayisi ?? 0)} kalem · TL
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="dc">
        <TableHeader>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--gd)" }}>{title}</h2>
            {yilFil && (
              <span onClick={() => setYilFil("")}
                style={{ fontSize: 11, fontWeight: 700, color: "var(--gm)", background: "var(--gp)", padding: "3px 9px", borderRadius: 20, border: "1px solid var(--gp2)", cursor: "pointer" }}>
                {yilFil} ✕
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 4, background: "var(--sf3)", border: "1px solid var(--br)", borderRadius: 8, padding: 2 }}>
              <button onClick={() => setYilFil("")}
                style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 10.5, fontWeight: 700, background: !yilFil ? "var(--gm)" : "transparent", color: !yilFil ? "#fff" : "var(--mu)" }}>
                Tümü
              </button>
              {ozetYillar.map(y => (
                <button key={y} onClick={() => toggleYil(String(y))}
                  style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 10.5, fontWeight: 700, background: yilFil === String(y) ? "var(--gm)" : "transparent", color: yilFil === String(y) ? "#fff" : "var(--mu)" }}>
                  {y}
                </button>
              ))}
            </div>
            {showSearch && (
              <input
                type="text" value={araFil} onChange={e => setAraFil(e.target.value)}
                placeholder="Ara…"
                style={{ padding: "5px 10px", border: "1.5px solid var(--br2)", borderRadius: 7, fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: "var(--tx2)", outline: "none", width: 150 }}
              />
            )}
            <ExcelBtn onClick={exportExcel} disabled={rawItems.length === 0} loading={exporting} />
          </div>
        </TableHeader>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--gd)" }}>
                <SortableTh label={nameLabel} sortKey={nameKey} currentSort={sort} onSort={onSort} align="left" />
                {yillarAktif.map(y => (
                  <SortableTh key={y} label={String(y)} sortKey="tutar_tl" currentSort={sort} onSort={onSort} align="right" />
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? <LoadingRow cols={1 + yillarAktif.length} />
                : sortedItems.length === 0
                  ? <EmptyRow cols={1 + yillarAktif.length} text="Veri yok — İçeri Aktar ile veri yükleyin" />
                  : (
                    <>
                      {sortedItems.map((ad, ri) => (
                        <tr key={ad}
                          style={{ borderBottom: "1px solid var(--br)", background: ri % 2 === 0 ? "#fff" : "var(--sf2)" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--gp)")}
                          onMouseLeave={e => (e.currentTarget.style.background = ri % 2 === 0 ? "#fff" : "var(--sf2)")}>
                          <td style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "var(--tx)" }}>{ad}</td>
                          {yillarAktif.map(y => {
                            const v = pivot.get(ad)?.get(y);
                            return (
                              <td key={y} style={{ padding: "6px 12px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: v == null ? "var(--br2)" : v > 0 ? "var(--gm)" : "var(--mu)", fontWeight: v != null && v > 0 ? 600 : 400 }}>
                                {v == null ? "—" : fmt(v)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr style={{ background: "var(--gd)", borderTop: "2px solid var(--gm)" }}>
                        <td style={{ padding: "7px 12px", fontWeight: 800, color: "#fff", fontSize: 12 }}>TOPLAM</td>
                        {colTotals.map((t, i) => (
                          <td key={i} style={{ padding: "7px 12px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 800, color: "var(--am)" }}>
                            {fmt(t)}
                          </td>
                        ))}
                      </tr>
                    </>
                  )
              }
            </tbody>
          </table>
        </div>

        {sortedItems.length > 0 && (
          <div style={{ padding: "10px 14px", borderTop: "1px solid var(--br)", background: "var(--sf2)", display: "flex", justifyContent: "flex-end" }}>
            <ExcelBtn onClick={exportExcel} disabled={rawItems.length === 0} loading={exporting} />
          </div>
        )}
      </div>
    </div>
  );
}
