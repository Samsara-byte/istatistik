

import { useState, useEffect, useCallback, useRef } from "react";
import { api, type UretimRow } from "@/lib/api";
import * as XLSX from "xlsx";
import URUN_DATA from "@/data/urun_gruplari.json";
import {
  ILCELER,
  getVillages,
  Sel,
  Inp,
  FilterBar,
  TableHeader,
  ResetBtn,
  ExcelBtn,
  SortableTh,
  Pagination,
  fmt,
  YEARS,
  useSortState,
  LoadingRow,
  EmptyRow,
} from "@/lib/ui";

// ── Grup yardımcıları ──
const URUN_TO_GRUP = (URUN_DATA as { urun_to_grup: Record<string, string> })
  .urun_to_grup;
function getGrup(urun: string): string {
  const u = (urun || "").trim().toLocaleUpperCase("tr-TR");
  if (URUN_TO_GRUP[u]) return URUN_TO_GRUP[u];
  const norm = u.replace(/\s*[(][^)]*[)]/g, "").trim();
  if (URUN_TO_GRUP[norm]) return URUN_TO_GRUP[norm];
  const key = Object.keys(URUN_TO_GRUP).find(
    (k) => k.replace(/\s*[(][^)]*[)]/g, "").trim() === norm,
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
  "endüstri bitkileri": { bg: "#fff0f6", text: "#8b1050", border: "#d04080aa" },
  "süs bitkileri": { bg: "#fff0f0", text: "#8b2020", border: "#c04040aa" },
  "yumru bitkiler": { bg: "#f8f4ec", text: "#6b4c1a", border: "#a07830aa" },
  "orman emvali ürün": { bg: "#f0f7ee", text: "#2a5020", border: "#508040aa" },
  "nadas-boş bırakılan arazi": {
    bg: "#f5f5f5",
    text: "#555",
    border: "#aaaaaa",
  },
  diğer: { bg: "#f5f5f5", text: "#555", border: "#aaaaaa" },
};

function GrupBadge({ grup }: { grup: string }) {
  const s = GRUP_COLORS[grup] || GRUP_COLORS["diğer"];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
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

type ViewMode = "detayli" | "basit" | "grup";
type GroupBy = "" | "koy" | "urun";

interface Filters {
  yil: string;
  ilce: string;
  koy: string;
  urun: string;
  tarim_sekli: string;
  uretim_cesidi: string;
  group_by: GroupBy;
}
const INIT: Filters = {
  yil: "2025",
  ilce: "",
  koy: "",
  urun: "",
  tarim_sekli: "",
  uretim_cesidi: "",
  group_by: "",
};

type Col = {
  key: string;
  label: string;
  align: "left" | "right" | "center";
  num?: boolean;
  hint?: boolean;
};

const COLS_HAM: Col[] = [
  { key: "il", label: "İl", align: "left" },
  { key: "ilce", label: "İlçe", align: "left" },
  { key: "koy", label: "Köy", align: "left" },
  { key: "urun", label: "Ürün", align: "left" },
  { key: "tarim_sekli", label: "Tarım Şekli", align: "center" },
  { key: "uretim_cesidi", label: "Çeşit", align: "center" },
  { key: "ekili_alan", label: "Alan (da)", align: "right", num: true },
  {
    key: "ciftci_sayisi",
    label: "ÇKS Çiftçi",
    align: "right",
    num: true,
    hint: true,
  },
];
const COLS_KOY: Col[] = [
  { key: "ilce", label: "İlçe", align: "left" },
  { key: "koy", label: "Köy", align: "left" },
  { key: "urun_cesidi", label: "Ürün Çeşidi", align: "right", num: true },
  { key: "toplam_alan", label: "Ekili Alan (da)", align: "right", num: true },
];
const COLS_URUN: Col[] = [
  { key: "urun", label: "Ürün", align: "left" },
  { key: "tarim_sekli", label: "Tarım Şekli", align: "center" },
  { key: "ilce_sayisi", label: "İlçe", align: "right", num: true },
  { key: "koy_sayisi", label: "Köy", align: "right", num: true },
  { key: "toplam_alan", label: "Alan (da)", align: "right", num: true },
];
const COLS_BASIT: Col[] = [
  { key: "ilce", label: "İlçe", align: "left" },
  { key: "koy", label: "Köy", align: "left" },
  { key: "urun", label: "Ürün", align: "left" },
  { key: "toplam_alan", label: "Ekili Alan (da)", align: "right", num: true },
  { key: "ciftci_sayisi", label: "ÇKS Çiftçi", align: "right", num: true },
];

function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  const tabs: { id: ViewMode; label: string }[] = [
    { id: "detayli", label: "📋 Detaylı" },
    { id: "basit", label: "📊 Basit" },
    { id: "grup", label: "🗂️ Gruplu" },
  ];
  return (
    <div
      style={{
        display: "flex",
        background: "var(--sf3)",
        borderRadius: 8,
        border: "1px solid var(--br)",
        padding: 2,
        gap: 2,
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: "5px 11px",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "inherit",
            transition: "all .15s",
            background: mode === t.id ? "var(--gm)" : "transparent",
            color: mode === t.id ? "#fff" : "var(--mu)",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function UretimTable({
  defaultIlce = "",
  defaultKoy = "",
}: {
  defaultIlce?: string;
  defaultKoy?: string;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("detayli");
  const [f, setF] = useState<Filters>({
    ...INIT,
    ilce: defaultIlce.toLocaleUpperCase("tr-TR"),
    koy: defaultKoy,
  });
  const [grupFilter, setGrupFilter] = useState("");
  const [data, setData] = useState<UretimRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toplamAlan, setToplamAlan] = useState(0);
  const [exporting, setExporting] = useState(false);
  const { sort, onSort, resetSort } = useSortState();
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setF((p) => ({
      ...p,
      ilce: defaultIlce.toLocaleUpperCase("tr-TR"),
      koy: defaultKoy,
    }));
  }, [defaultIlce, defaultKoy]);

  const prevIlce = useRef(f.ilce);
  useEffect(() => {
    if (prevIlce.current !== f.ilce && !defaultKoy)
      setF((p) => ({ ...p, koy: "" }));
    prevIlce.current = f.ilce;
  }, [f.ilce, defaultKoy]);

  const villages = getVillages(f.ilce);

  const COLS_GRUP: Col[] = [
    { key: "_grup", label: "Ürün Grubu", align: "left" },
    { key: "toplam_alan", label: "Ekili Alan (da)", align: "right", num: true },
  ];
  const cols: Col[] =
    viewMode === "basit"
      ? COLS_BASIT
      : viewMode === "grup"
        ? COLS_GRUP
        : f.group_by === "koy"
          ? COLS_KOY
          : f.group_by === "urun"
            ? COLS_URUN
            : COLS_HAM;

  const fetchData = useCallback(
    async (
      filters: Filters,
      pg: number,
      vm: ViewMode,
      sk?: string,
      sd?: "asc" | "desc",
    ) => {
      setLoading(true);
      setError("");
      try {
        const gb =
          vm === "basit" || vm === "grup"
            ? "urun_basit"
            : filters.group_by || undefined;
        const [res, oz] = await Promise.all([
          api.listUretim({
            yil: parseInt(filters.yil),
            ilce: filters.ilce || undefined,
            koy: filters.koy || undefined,
            urun: filters.urun || undefined,
            tarim_sekli:
              vm === "basit" || vm === "grup"
                ? undefined
                : filters.tarim_sekli || undefined,
            uretim_cesidi:
              vm === "basit" || vm === "grup"
                ? undefined
                : filters.uretim_cesidi || undefined,
            group_by: gb,
            sort_by: sk || undefined,
            sort_dir: sd || undefined,
            page: pg,
            limit: 200,
          }),
          api.ozet({
            yil: parseInt(filters.yil),
            ilce: filters.ilce || undefined,
            group_by: "ilce",
          }),
        ]);
        setData(res.data);
        setTotal(res.total);
        setPages(res.pages);
        setPage(res.page);
        setToplamAlan(oz.toplam_alan_da);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setPage(1);
      fetchData(f, 1, viewMode, sort.key || undefined, sort.dir || undefined);
    }, 350);
    return () => clearTimeout(debounce.current);
  }, [f, fetchData, viewMode, sort.key, sort.dir]);

  const upd = (k: keyof Filters) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));
  const handleReset = () => {
    setF({
      ...INIT,
      ilce: defaultIlce.toLocaleUpperCase("tr-TR"),
      koy: defaultKoy,
    });
    setGrupFilter("");
    resetSort();
  };
  const handleViewChange = (m: ViewMode) => {
    setViewMode(m);
    setGrupFilter("");
    resetSort();
  };

  // Grup modunda aggregate: ürün gruplarını topla
  const grupAggregate: { _grup: string; toplam_alan: number }[] = (() => {
    if (viewMode !== "grup") return [];
    const map: Record<string, number> = {};
    data.forEach((r) => {
      const g = getGrup(String((r as Record<string, unknown>).urun || ""));
      map[g] =
        (map[g] || 0) + Number((r as Record<string, unknown>).toplam_alan || 0);
    });
    return Object.entries(map)
      .map(([_grup, toplam_alan]) => ({ _grup, toplam_alan }))
      .sort((a, b) => b.toplam_alan - a.toplam_alan);
  })();

  const displayed =
    viewMode === "grup"
      ? grupFilter
        ? grupAggregate.filter((r) => r._grup === grupFilter)
        : grupAggregate
      : data;

  // Grup özeti kartlar için
  const grupOzet =
    viewMode === "grup"
      ? grupAggregate.reduce<Record<string, number>>((acc, r) => {
          acc[r._grup] = r.toplam_alan;
          return acc;
        }, {})
      : {};

  const exportExcel = useCallback(async () => {
    setExporting(true);
    try {
      const gb =
        viewMode === "basit" || viewMode === "grup"
          ? "urun_basit"
          : f.group_by || undefined;
      const res = await api.listUretim({
        yil: parseInt(f.yil),
        ilce: f.ilce || undefined,
        koy: f.koy || undefined,
        urun: f.urun || undefined,
        group_by: gb,
        page: 1,
        limit: 50000,
      });
      const isGrup = viewMode === "grup";
      const colDefs = viewMode === "basit" || isGrup ? COLS_BASIT : cols;
      const headers = isGrup
        ? ["Grup", ...colDefs.map((c) => c.label)]
        : colDefs.map((c) => c.label);

      // Satırlar
      let dataRows: unknown[][];
      if (isGrup) {
        // Grup modunda aggregate
        const grupMap: Record<string, number> = {};
        res.data.forEach((r: Record<string, unknown>) => {
          const g = getGrup(String(r.urun || ""));
          grupMap[g] = (grupMap[g] || 0) + Number(r.toplam_alan || 0);
        });
        dataRows = Object.entries(grupMap)
          .sort((a, b) => b[1] - a[1])
          .map(([g, alan]) => [g, alan]);
      } else {
        dataRows = res.data.map((r: Record<string, unknown>) =>
          colDefs.map((c) => r[c.key] ?? ""),
        );
      }

      // Toplam satırı — alan sütununun indexini bul
      const alanKey = isGrup
        ? "toplam_alan"
        : viewMode === "basit"
          ? "toplam_alan"
          : f.group_by
            ? "toplam_alan"
            : "ekili_alan";
      const alanColIdx = isGrup
        ? 1
        : colDefs.findIndex((c) => c.key === alanKey);
      const toplamAlanVal =
        alanColIdx >= 0
          ? dataRows.reduce(
              (s, row) => s + Number((row as unknown[])[alanColIdx] || 0),
              0,
            )
          : 0;
      const totRow = headers.map((_, i) =>
        i === 0 ? "TOPLAM" : i === alanColIdx ? toplamAlanVal : "",
      );

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows, [], totRow]);
      ws["!cols"] = headers.map(() => ({ wch: 18 }));
      // Toplam satırını bold yap
      const totRowIdx = dataRows.length + 2;
      headers.forEach((_, ci) => {
        const cellRef = XLSX.utils.encode_cell({ r: totRowIdx, c: ci });
        if (ws[cellRef]) ws[cellRef].s = { font: { bold: true } };
      });
      XLSX.utils.book_append_sheet(
        wb,
        ws,
        viewMode === "grup" ? "Gruplu" : "Üretim",
      );
      XLSX.writeFile(
        wb,
        ["cks", f.yil, f.ilce || "tum", viewMode].filter(Boolean).join("_") +
          ".xlsx",
      );
    } finally {
      setExporting(false);
    }
  }, [f, viewMode, cols]);

  return (
    <div className="dc" style={{ marginTop: 16 }}>
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
            ÇKS Üretim Verileri
          </h2>
          <ViewToggle mode={viewMode} onChange={handleViewChange} />
          {toplamAlan > 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--gm)",
                background: "var(--gp)",
                padding: "3px 9px",
                borderRadius: 20,
                border: "1px solid var(--gp2)",
              }}
            >
              {toplamAlan.toLocaleString("tr-TR")} da
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--mu)", fontWeight: 600 }}>
            {total.toLocaleString("tr-TR")} kayıt
          </span>
          <ExcelBtn
            onClick={exportExcel}
            disabled={total === 0}
            loading={exporting}
          />
        </div>
      </TableHeader>

      {/* Basit mod açıklaması */}
      {viewMode === "basit" && (
        <div
          style={{
            padding: "6px 14px",
            background: "#fffdf0",
            borderBottom: "1px solid #ece396",
            fontSize: 11,
            color: "#6b5800",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>📊</span> Aynı ürünün tüm varyantları (kuru/sulu,
          ekmeklik/yemlik vb.) birleştirilmiştir.
        </div>
      )}

      {/* Grup özeti — tıklanabilir kartlar */}
      {viewMode === "grup" && Object.keys(grupOzet).length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))",
            gap: 6,
            padding: "10px 14px",
            borderBottom: "1px solid var(--br)",
          }}
        >
          {Object.entries(grupOzet)
            .sort((a, b) => b[1] - a[1])
            .map(([g, alan]) => {
              const s = GRUP_COLORS[g] || GRUP_COLORS["diğer"];
              const active = grupFilter === g;
              return (
                <div
                  key={g}
                  onClick={() => setGrupFilter(active ? "" : g)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: active ? s.text : s.bg,
                    border: `2px solid ${active ? s.text : s.border}`,
                    transition: "all .15s",
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: ".5px",
                      color: active ? "rgba(255,255,255,.7)" : s.text,
                      marginBottom: 2,
                    }}
                  >
                    {g}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      fontFamily: "'JetBrains Mono',monospace",
                      color: active ? "#fff" : "var(--tx)",
                      lineHeight: 1,
                    }}
                  >
                    {fmt(alan)}{" "}
                    <span style={{ fontSize: 8, fontWeight: 600 }}>da</span>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      <FilterBar>
        <Sel label="Yıl" value={f.yil} onChange={upd("yil")}>
          {YEARS.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </Sel>
        <Sel label="İlçe" value={f.ilce} onChange={upd("ilce")}>
          <option value="">— Tümü —</option>
          {ILCELER.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </Sel>
        {f.ilce && villages.length > 0 ? (
          <Sel label="Köy" value={f.koy} onChange={upd("koy")}>
            <option value="">— Tümü —</option>
            {villages.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Sel>
        ) : (
          <Inp
            label="Köy"
            value={f.koy}
            onChange={upd("koy")}
            placeholder="Ara…"
          />
        )}
        <Inp
          label="Ürün"
          value={f.urun}
          onChange={upd("urun")}
          placeholder="Ara…"
        />
        {viewMode === "detayli" && (
          <>
            <Sel
              label="Tarım Şekli"
              value={f.tarim_sekli}
              onChange={upd("tarim_sekli")}
            >
              <option value="">— Tümü —</option>
              <option>Kuru</option>
              <option>Sulu</option>
            </Sel>
            <Sel
              label="Çeşit"
              value={f.uretim_cesidi}
              onChange={upd("uretim_cesidi")}
            >
              <option value="">— Tümü —</option>
              <option value="1.Üretim">1. Üretim</option>
              <option value="2.Üretim">2. Üretim</option>
            </Sel>
            <Sel
              label="Görünüm"
              value={f.group_by}
              onChange={(v) => upd("group_by")(v as GroupBy)}
            >
              <option value="">Ham</option>
              <option value="koy">Köy bazlı</option>
              <option value="urun">Ürün bazlı</option>
            </Sel>
          </>
        )}
        <ResetBtn onClick={handleReset} />
      </FilterBar>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            color: "var(--red)",
            fontWeight: 700,
            fontSize: 12,
            background: "#fdf0ef",
            borderBottom: "1px solid #f5b8b5",
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
                  width: 32,
                  textAlign: "center",
                }}
              >
                #
              </th>

              {cols.map((c) => (
                <SortableTh
                  key={c.key}
                  label={c.hint ? `ÇKS Çiftçi (${f.yil})` : c.label}
                  sortKey={c.key}
                  currentSort={sort}
                  onSort={(key) => {
                    const nd =
                      sort.key === key && sort.dir === "asc" ? "desc" : "asc";
                    onSort(key);
                    fetchData(f, 1, viewMode, key, nd as "asc" | "desc");
                  }}
                  align={c.align}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRow cols={cols.length + 1} />
            ) : displayed.length === 0 ? (
              <EmptyRow cols={cols.length + 1} />
            ) : (
              displayed.map((row, ri) => {
                const rec = row as Record<string, unknown>;
                return (
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

                    {cols.map((c) => {
                      const v = rec[c.key];
                      if (c.key === "_grup")
                        return (
                          <td key={c.key} style={{ padding: "5px 10px" }}>
                            <GrupBadge grup={String(v || "diğer")} />
                          </td>
                        );
                      return (
                        <td
                          key={c.key}
                          style={{
                            padding: "5px 10px",
                            textAlign: c.align,
                            fontFamily: c.num
                              ? "'JetBrains Mono',monospace"
                              : "inherit",
                            fontSize: c.num ? 11 : 12,
                            fontWeight:
                              c.key === "urun" || c.key === "koy" ? 600 : 400,
                            color:
                              c.key === "ciftci_sayisi"
                                ? "#1a5276"
                                : c.key === "toplam_alan" ||
                                    c.key === "ekili_alan"
                                  ? "var(--gm)"
                                  : "var(--tx)",
                          }}
                        >
                          {c.num ? fmt(v) : String(v ?? "—")}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pages={pages}
        total={total}
        onPage={(pg) =>
          fetchData(
            f,
            pg,
            viewMode,
            sort.key || undefined,
            sort.dir || undefined,
          )
        }
      />
      {/* Alt export butonu */}
      {total > 0 && (
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
            disabled={total === 0}
            loading={exporting}
          />
        </div>
      )}
    </div>
  );
}
