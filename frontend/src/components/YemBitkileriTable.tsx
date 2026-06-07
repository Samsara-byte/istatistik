import { useState, useEffect, useCallback, useRef } from "react";
import { api, type YemBitkileriRow } from "@/lib/api";
import * as XLSX from "xlsx";
import {
  ILCELER, getVillages, Sel, Inp, FilterBar, TableHeader,
  ResetBtn, ExcelBtn, SortableTh, Pagination, fmt, YEARS,
  useSortState, LoadingRow, EmptyRow,
} from "@/lib/ui";

type Col = { key: keyof YemBitkileriRow; label: string; isText?: boolean };

const COLS: Col[] = [
  { key: "ilce",                 label: "İlçe",                    isText: true },
  { key: "koy",                  label: "Köy / Mahalle",           isText: true },
  { key: "urun",                 label: "Ürün",                    isText: true },
  { key: "isletme_sayisi",       label: "İşletme Sayısı" },
  { key: "destege_tabi_alan_da", label: "Desteğe Tabi Alan (da)" },
  { key: "su_kisiti_da",         label: "Su Kısıtı (da)" },
  { key: "sut_havzasi_da",       label: "Süt Havzası (da)" },
  { key: "destek_tutari_tl",     label: "Destek Tutarı (₺)" },
];

const COL_COLORS: Record<string, string> = {
  isletme_sayisi:       "#1a5276",
  destege_tabi_alan_da: "#2a3d8b",
  su_kisiti_da:         "#1a6b3a",
  sut_havzasi_da:       "#6b2020",
  destek_tutari_tl:     "#4a2070",
};

export default function YemBitkileriTable({
  defaultIlce = "",
  defaultKoy  = "",
}: {
  defaultIlce?: string;
  defaultKoy?:  string;
}) {
  const [yil,      setYil]      = useState("2025");
  const [ilce,     setIlce]     = useState(defaultIlce.toLocaleUpperCase("tr-TR"));
  const [koy,      setKoy]      = useState(defaultKoy);
  const [urun,     setUrun]     = useState("");
  const [data,     setData]     = useState<YemBitkileriRow[]>([]);
  const [toplam,   setToplam]   = useState<Record<string, number>>({});
  const [ozet,     setOzet]     = useState<Record<string, number>>({});
  const [total,    setTotal]    = useState(0);
  const [pages,    setPages]    = useState(1);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [exporting, setExporting] = useState(false);
  const { sort, onSort, resetSort } = useSortState("destege_tabi_alan_da", "desc");
  const debounce = useRef<ReturnType<typeof setTimeout>>();
  const villages = getVillages(ilce);

  useEffect(() => { setIlce(defaultIlce.toLocaleUpperCase("tr-TR")); }, [defaultIlce]);
  useEffect(() => { setKoy(defaultKoy); }, [defaultKoy]);

  const fetchData = useCallback(
    async (pg: number, sk = sort.key, sd = sort.dir) => {
      setLoading(true);
      try {
        const [res, oz, top] = await Promise.all([
          api.listYemBitkileri({
            yil: parseInt(yil),
            ilce: ilce || undefined, koy: koy || undefined, urun: urun || undefined,
            sort_by: sk || undefined, sort_dir: sd || undefined, page: pg, limit: 100,
          }),
          api.yemBitkileriOzet({ yil: parseInt(yil), ilce: ilce || undefined, group_by: "ilce" }),
          api.yemBitkileriToplam({ yil: parseInt(yil), ilce: ilce || undefined }),
        ]);
        setData(res.data); setTotal(res.total); setPages(res.pages); setPage(res.page);
        setToplam(top);
        const totals: Record<string, number> = {};
        for (const row of oz.data) {
          const r = row as Record<string, unknown>;
          for (const k of ["isletme_toplam","alan_toplam","su_kisiti_toplam","sut_havzasi_toplam","destek_toplam"]) {
            totals[k] = (totals[k] || 0) + (Number(r[k]) || 0);
          }
        }
        setOzet(totals);
      } finally { setLoading(false); }
    },
    [yil, ilce, koy, urun, sort.key, sort.dir],
  );

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { setPage(1); fetchData(1); }, 350);
    return () => clearTimeout(debounce.current);
  }, [fetchData]);

  const handleSort = (key: string) => {
    const nd = sort.key === key && sort.dir === "asc" ? "desc" : "asc";
    onSort(key); fetchData(1, key, nd as "asc" | "desc");
  };

  const exportExcel = useCallback(async () => {
    setExporting(true);
    try {
      const res = await api.listYemBitkileri({
        yil: parseInt(yil), ilce: ilce || undefined,
        koy: koy || undefined, urun: urun || undefined, limit: 50000,
      });
      const headers = COLS.map((c) => c.label);
      const rows = res.data.map((r) => COLS.map((c) => r[c.key] ?? ""));
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws["!cols"] = COLS.map((c) => ({ wch: c.isText ? 22 : 14 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Yem Bitkileri");
      XLSX.writeFile(wb, `yem_bitkileri_${yil}${ilce ? "_" + ilce : ""}.xlsx`);
    } finally { setExporting(false); }
  }, [yil, ilce, koy, urun]);

  const ozetKartlar = [
    { label: "Destek Tutarı (₺)",     val: fmt(ozet.destek_toplam),       color: "#4a2070" },
    { label: "Desteğe Tabi Alan (da)", val: fmt(ozet.alan_toplam),         color: "#2a3d8b" },
    { label: "İşletme Sayısı",         val: fmt(ozet.isletme_toplam),      color: "#1a5276" },
    { label: "Su Kısıtı (da)",         val: fmt(ozet.su_kisiti_toplam),    color: "#1a6b3a" },
    { label: "Süt Havzası (da)",        val: fmt(ozet.sut_havzasi_toplam), color: "#6b2020" },
  ];

  return (
    <div className="dc" style={{ marginTop: 16 }}>
      {Object.keys(ozet).length > 0 && (
        <div style={{ display: "flex", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--br)", flexWrap: "wrap" }}>
          {ozetKartlar.map((k) => (
            <div key={k.label} style={{ flex: 1, minWidth: 110, padding: "9px 12px", borderRadius: 8, background: "#fafbfa", border: `1.5px solid ${k.color}22` }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: k.color, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 2 }}>{k.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--tx)", fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>{k.val}</div>
            </div>
          ))}
        </div>
      )}

      <TableHeader>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--gd)" }}>Yem Bitkileri Desteği</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--mu)", fontWeight: 600 }}>{total.toLocaleString("tr-TR")} kayıt</span>
          <ExcelBtn onClick={exportExcel} disabled={total === 0} loading={exporting} />
        </div>
      </TableHeader>

      <FilterBar>
        <Sel label="Yıl" value={yil} onChange={setYil}>
          {YEARS.slice(0, 6).map((y) => <option key={y}>{y}</option>)}
        </Sel>
        <Sel label="İlçe" value={ilce} onChange={(v) => { setIlce(v); setKoy(""); }}>
          <option value="">— Tümü —</option>
          {ILCELER.map((i) => <option key={i} value={i}>{i}</option>)}
        </Sel>
        {ilce && villages.length > 0 && (
          <Sel label="Köy" value={koy} onChange={setKoy}>
            <option value="">— Tümü —</option>
            {villages.map((v) => <option key={v} value={v}>{v}</option>)}
          </Sel>
        )}
        <Inp label="Ürün" value={urun} onChange={setUrun} placeholder="Ara…" />
        <ResetBtn onClick={() => { setIlce(defaultIlce.toLocaleUpperCase("tr-TR")); setKoy(""); setYil("2025"); setUrun(""); resetSort(); }} />
      </FilterBar>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--gd)" }}>
              <th style={{ padding: "7px 8px", color: "rgba(255,255,255,.35)", fontSize: 9, fontWeight: 700, width: 28, textAlign: "center" }}>#</th>
              {COLS.map((col) => (
                <SortableTh key={col.key} label={col.label} sortKey={col.key} currentSort={sort} onSort={handleSort} align={col.isText ? "left" : "right"} />
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRow cols={COLS.length + 1} />
            ) : data.length === 0 ? (
              <EmptyRow cols={COLS.length + 1} text="Veri yok — İçeri Aktar ile yem bitkileri verisi yükleyin" />
            ) : (
              <>
                {data.map((row, ri) => (
                  <tr key={row.id}
                    style={{ borderBottom: "1px solid var(--br)", background: ri % 2 === 0 ? "#fff" : "var(--sf2)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--gp)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = ri % 2 === 0 ? "#fff" : "var(--sf2)")}
                  >
                    <td style={{ padding: "5px 8px", textAlign: "center", color: "var(--mu)", fontSize: 10 }}>
                      {(page - 1) * 100 + ri + 1}
                    </td>
                    {COLS.map((col) => {
                      const v = row[col.key as keyof YemBitkileriRow];
                      const color = COL_COLORS[col.key as string];
                      if (col.isText)
                        return (
                          <td key={col.key} style={{ padding: "5px 10px", fontSize: 12, fontWeight: col.key === "koy" ? 600 : 400 }}>
                            {String(v ?? "—")}
                          </td>
                        );
                      const numV = Number(v) || 0;
                      return (
                        <td key={col.key} style={{ padding: "5px 10px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: numV > 0 ? color || "var(--gm)" : "var(--br2)", fontWeight: numV > 0 ? 600 : 400 }}>
                          {numV > 0 ? fmt(v) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {Object.keys(toplam).length > 0 && (
                  <tr style={{ background: "var(--gd)", borderTop: "2px solid var(--gm)" }}>
                    <td style={{ padding: "7px 8px", textAlign: "center", color: "rgba(255,255,255,.4)", fontSize: 10 }}>—</td>
                    {COLS.map((col) => {
                      if (col.isText) return (
                        <td key={col.key} style={{ padding: "7px 10px", fontWeight: 800, color: "#fff", fontSize: 12 }}>
                          {col.key === "ilce" ? "TOPLAM" : ""}
                        </td>
                      );
                      const v = toplam[col.key as string];
                      return (
                        <td key={col.key} style={{ padding: "7px 10px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 800, color: "var(--am)" }}>
                          {v != null && v > 0 ? fmt(v) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={pages} total={total} onPage={(pg) => fetchData(pg)} />
    </div>
  );
}
