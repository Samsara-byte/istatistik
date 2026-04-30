

import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import URUN_DATA from "@/data/urun_gruplari.json";
import {
  ILCELER,
  getVillages,
  Sel,
  Inp,
  FilterBar,
  TableHeader,
  ExcelBtn,
  SortableTh,
  Pagination,
  fmt,
  useSortState,
  LoadingRow,
  EmptyRow,
} from "@/lib/ui";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// Ürün adından grubu bul
const URUN_TO_GRUP = (URUN_DATA as { urun_to_grup: Record<string, string> })
  .urun_to_grup;
const GRUPLAR = Object.keys(
  (URUN_DATA as { gruplar: Record<string, string[]> }).gruplar,
).sort();

// Ürün adını normalize et (parantez içini sil, büyük harf)
function normUrun(u: string): string {
  return u
    .replace(/\s*\(.*?\)/g, "")
    .trim()
    .toLocaleUpperCase("tr-TR");
}

function getGrup(urun: string): string {
  // Önce tam eşleşme
  const upper = (urun || "").trim().toLocaleUpperCase("tr-TR");
  if (URUN_TO_GRUP[upper]) return URUN_TO_GRUP[upper];
  // Normalize edilmiş eşleşme
  const norm = normUrun(upper);
  if (URUN_TO_GRUP[norm]) return URUN_TO_GRUP[norm];
  // Kısmi eşleşme
  const key = Object.keys(URUN_TO_GRUP).find(
    (k) =>
      normUrun(k) === norm ||
      k.startsWith(norm) ||
      norm.startsWith(normUrun(k)),
  );
  return key ? URUN_TO_GRUP[key] : "diğer";
}

const GRUP_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  tahıllar: { bg: "#fff8e7", text: "#7a5200", border: "#f0b42944" },
  sebze: { bg: "#edfaf1", text: "#1a6b3a", border: "#2d6a4f44" },
  meyve: { bg: "#fef3ec", text: "#8b3a10", border: "#e8721044" },
  baklagil: { bg: "#f0f4ff", text: "#2a3d8b", border: "#4a5cc844" },
  "yem bitkileri": { bg: "#f5faf0", text: "#3a6620", border: "#6aaa3044" },
  "tıbbi aromatik": { bg: "#fdf4ff", text: "#6a2085", border: "#a050c044" },
  "endüstri bitkileri": { bg: "#fff0f6", text: "#8b1050", border: "#d04080" },
  "süs bitkileri": { bg: "#fff0f0", text: "#8b2020", border: "#c04040" },
  "yumru bitkiler": { bg: "#f8f4ec", text: "#6b4c1a", border: "#a07830" },
  "orman emvali ürün": { bg: "#f0f7ee", text: "#2a5020", border: "#508040" },
  "nadas-boş bırakılan arazi": { bg: "#f5f5f5", text: "#555", border: "#aaa" },
  diğer: { bg: "#f5f5f5", text: "#555", border: "#aaa" },
};

function GrupBadge({ grup }: { grup: string }) {
  const s = GRUP_COLORS[grup] || GRUP_COLORS["diğer"];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 9px",
        borderRadius: 20,
        fontSize: 10.5,
        fontWeight: 700,
        background: s.bg,
        color: s.text,
        border: `1.5px solid ${s.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {grup}
    </span>
  );
}

interface Row {
  urun: string;
  grup: string;
  ilce: string;
  koy: string;
  toplam_alan: number;
}

export default function GrupAnaliziTable() {
  const [yil, setYil] = useState("2025");
  const [grup, setGrup] = useState("");
  const [ilce, setIlce] = useState("");
  const [koy, setKoy] = useState("");
  const [urun, setUrun] = useState("");
  const [data, setData] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const { sort, onSort, resetSort } = useSortState("toplam_alan", "desc");
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  const villages = getVillages(ilce);

  const fetchData = useCallback(
    async (pg: number, sk = sort.key, sd = sort.dir) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        params.set("yil", yil);
        params.set("group_by", "urun_basit");
        params.set("sort_by", sk || "toplam_alan");
        params.set("sort_dir", sd || "desc");
        params.set("page", String(pg));
        params.set("limit", "200");
        if (ilce) params.set("ilce", ilce);
        if (koy) params.set("koy", koy);
        if (urun) params.set("urun", urun);

        const res = await fetch(`${BASE}/api/uretim?${params}`).then((r) =>
          r.json(),
        );

        // Her satıra grup ata + filtrele
        let rows: Row[] = (res.data || []).map(
          (r: Record<string, unknown>) => ({
            urun: String(r.urun || ""),
            grup: getGrup(String(r.urun || "")),
            ilce: String(r.ilce || ""),
            koy: String(r.koy || ""),
            toplam_alan: Number(r.toplam_alan || 0),
          }),
        );

        if (grup) rows = rows.filter((r) => r.grup === grup);

        setData(rows);
        setTotal(grup ? rows.length : res.total || 0);
        setPages(
          grup ? Math.max(1, Math.ceil(rows.length / 200)) : res.pages || 1,
        );
        setPage(res.page || 1);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [yil, grup, ilce, koy, urun, sort.key, sort.dir],
  );

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setPage(1);
      fetchData(1);
    }, 350);
    return () => clearTimeout(debounce.current);
  }, [fetchData]);

  const handleSort = (key: string) => {
    const nd = sort.key === key && sort.dir === "asc" ? "desc" : "asc";
    onSort(key);
    fetchData(1, key, nd);
  };

  // Grup özeti
  const grupOzet = data.reduce<Record<string, { alan: number; urun: number }>>(
    (acc, r) => {
      if (!acc[r.grup]) acc[r.grup] = { alan: 0, urun: 0 };
      acc[r.grup].alan += r.toplam_alan;
      acc[r.grup].urun += 1;
      return acc;
    },
    {},
  );

  const exportExcel = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("yil", "2025");
      params.set("group_by", "urun_basit");
      params.set("limit", "50000");
      if (ilce) params.set("ilce", ilce);
      const res = await fetch(`${BASE}/api/uretim?${params}`).then((r) =>
        r.json(),
      );
      const rows = (res.data || []).map((r: Record<string, unknown>) => ({
        ...r,
        grup: getGrup(String(r.urun || "")),
      }));
      const ws = XLSX.utils.aoa_to_sheet([
        ["Grup", "Ürün", "İlçe", "Köy", "Ekili Alan (da)"],
        ...rows.map((r: Record<string, unknown>) => [
          r.grup,
          r.urun,
          r.ilce,
          r.koy,
          r.toplam_alan,
        ]),
      ]);
      ws["!cols"] = [18, 30, 14, 20, 14].map((w) => ({ wch: w }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Grup Analizi");
      XLSX.writeFile(wb, `grup_analizi_${yil}.xlsx`);
    } finally {
      setExporting(false);
    }
  }, [yil, ilce]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        marginTop: 16,
      }}
    >
      {/* Grup kartları */}
      {Object.keys(grupOzet).length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))",
            gap: 8,
          }}
        >
          {Object.entries(grupOzet)
            .sort((a, b) => b[1].alan - a[1].alan)
            .map(([g, v]) => {
              const s = GRUP_COLORS[g] || GRUP_COLORS["diğer"];
              const isActive = grup === g;
              return (
                <div
                  key={g}
                  onClick={() => setGrup(isActive ? "" : g)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 9,
                    cursor: "pointer",
                    background: isActive ? s.text : s.bg,
                    border: `2px solid ${isActive ? s.text : s.border}`,
                    transition: "all .15s",
                  }}
                >
                  <div
                    style={{
                      fontSize: 9.5,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: ".5px",
                      marginBottom: 3,
                      color: isActive ? "rgba(255,255,255,.8)" : s.text,
                    }}
                  >
                    {g}
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      lineHeight: 1,
                      fontFamily: "'JetBrains Mono',monospace",
                      color: isActive ? "#fff" : "var(--tx)",
                    }}
                  >
                    {fmt(v.alan)}{" "}
                    <span style={{ fontSize: 9, fontWeight: 600 }}>da</span>
                  </div>
                  <div
                    style={{
                      fontSize: 9.5,
                      marginTop: 2,
                      color: isActive ? "rgba(255,255,255,.65)" : "var(--mu)",
                    }}
                  >
                    {v.urun} ürün
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Tablo */}
      <div className="dc">
        <TableHeader>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 800,
                color: "var(--gd)",
              }}
            >
              Ürün Grup Analizi
            </h2>
            {grup && <GrupBadge grup={grup} />}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--mu)", fontWeight: 600 }}>
              {data.length} ürün
            </span>
            <ExcelBtn
              onClick={exportExcel}
              disabled={data.length === 0}
              loading={exporting}
            />
          </div>
        </TableHeader>

        <FilterBar>
          <Sel label="Yıl" value={yil} onChange={setYil}>
            {["2026", "2025", "2024", "2023"].map((y) => (
              <option key={y}>{y}</option>
            ))}
          </Sel>
          <Sel label="Grup" value={grup} onChange={setGrup} minWidth={160}>
            <option value="">— Tüm Gruplar —</option>
            {GRUPLAR.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Sel>
          <Sel
            label="İlçe"
            value={ilce}
            onChange={(v) => {
              setIlce(v);
              setKoy("");
            }}
          >
            <option value="">— Tümü —</option>
            {ILCELER.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </Sel>
          {ilce && villages.length > 0 ? (
            <Sel label="Köy" value={koy} onChange={setKoy}>
              <option value="">— Tümü —</option>
              {villages.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Sel>
          ) : (
            <Inp
              label="Ürün Ara"
              value={urun}
              onChange={setUrun}
              placeholder="Ara…"
            />
          )}
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              onClick={() => {
                setGrup("");
                setIlce("");
                setKoy("");
                setUrun("");
                setYil("2025");
                resetSort();
              }}
              style={{
                padding: "7px 12px",
                border: "1.5px solid var(--br2)",
                borderRadius: 7,
                background: "#fff",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--mu)",
                fontFamily: "inherit",
              }}
            >
              ↺ Sıfırla
            </button>
          </div>
        </FilterBar>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              color: "var(--red)",
              fontSize: 12,
              fontWeight: 700,
              background: "#fdf0ef",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
          >
            <thead>
              <tr style={{ background: "var(--gd)" }}>
                <th
                  style={{
                    padding: "7px 8px",
                    color: "rgba(255,255,255,.35)",
                    fontSize: 9,
                    fontWeight: 700,
                    width: 28,
                    textAlign: "center",
                  }}
                >
                  #
                </th>
                <SortableTh
                  label="Grup"
                  sortKey="grup"
                  currentSort={sort}
                  onSort={handleSort}
                  align="left"
                />
                <SortableTh
                  label="Ürün"
                  sortKey="urun"
                  currentSort={sort}
                  onSort={handleSort}
                  align="left"
                />
                <SortableTh
                  label="İlçe"
                  sortKey="ilce"
                  currentSort={sort}
                  onSort={handleSort}
                  align="left"
                />
                <SortableTh
                  label="Köy"
                  sortKey="koy"
                  currentSort={sort}
                  onSort={handleSort}
                  align="left"
                />
                <SortableTh
                  label="Ekili Alan (da)"
                  sortKey="toplam_alan"
                  currentSort={sort}
                  onSort={handleSort}
                  align="right"
                />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow cols={6} />
              ) : data.length === 0 ? (
                <EmptyRow cols={6} />
              ) : (
                data.map((row, ri) => (
                  <tr
                    key={ri}
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
                        padding: "5px 8px",
                        textAlign: "center",
                        color: "var(--mu)",
                        fontSize: 10,
                      }}
                    >
                      {(page - 1) * 200 + ri + 1}
                    </td>
                    <td style={{ padding: "5px 10px" }}>
                      <GrupBadge grup={row.grup} />
                    </td>
                    <td
                      style={{
                        padding: "5px 10px",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {row.urun}
                    </td>
                    <td style={{ padding: "5px 10px", fontSize: 12 }}>
                      {row.ilce}
                    </td>
                    <td style={{ padding: "5px 10px", fontSize: 12 }}>
                      {row.koy}
                    </td>
                    <td
                      style={{
                        padding: "5px 10px",
                        textAlign: "right",
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--gm)",
                      }}
                    >
                      {fmt(row.toplam_alan)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pages={pages}
          total={data.length}
          onPage={(p) => fetchData(p)}
          unit="ürün"
        />
      </div>
    </div>
  );
}
