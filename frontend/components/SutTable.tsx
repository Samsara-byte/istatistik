"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
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
  useSortState,
  LoadingRow,
  EmptyRow,
} from "@/lib/ui";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface SutRow {
  il: string;
  ilce: string;
  koy: string;
  temel_sut_lt: number;
  destek_tutari: number;
  uretici_sayisi: number;
}

const COLS = [
  { key: "ilce", label: "İlçe", align: "left" as const, num: false },
  { key: "koy", label: "Köy", align: "left" as const, num: false },
  {
    key: "temel_sut_lt",
    label: "Süt (lt)",
    align: "right" as const,
    num: true,
  },
  {
    key: "destek_tutari",
    label: "Destek Tutarı (₺)",
    align: "right" as const,
    num: true,
  },
];

export default function SutTable() {
  const [yil, setYil] = useState("2025");
  const [donem, setDonem] = useState("");
  const [ilce, setIlce] = useState("");
  const [koy, setKoy] = useState("");
  const [data, setData] = useState<SutRow[]>([]);
  const [ozet, setOzet] = useState<Record<string, number>>({});
  const [donemler, setDonemler] = useState<{ donem: string; yil: number }[]>(
    [],
  );
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const { sort, onSort, resetSort } = useSortState("destek_tutari", "desc");
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  const villages = getVillages(ilce);

  // Dönem listesi
  useEffect(() => {
    fetch(`${BASE}/api/sut/donemler`)
      .then((r) => r.json())
      .then((d) => setDonemler(d.data || []))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(
    async (pg: number, sortKey = sort.key, sortDir = sort.dir) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (yil) params.set("yil", yil);
        if (donem) params.set("donem", donem);
        if (ilce) params.set("ilce", ilce);
        if (koy) params.set("koy", koy);
        params.set("sort_by", sortKey || "destek_tutari");
        params.set("sort_dir", sortDir || "desc");
        params.set("page", String(pg));
        params.set("limit", "100");

        const [resData, resOzet] = await Promise.all([
          fetch(`${BASE}/api/sut?${params}`).then((r) => r.json()),
          fetch(
            `${BASE}/api/sut/ozet?${new URLSearchParams({
              ...(yil ? { yil } : {}),
              ...(ilce ? { ilce } : {}),
            })}`,
          ).then((r) => r.json()),
        ]);

        setData(resData.data || []);
        setTotal(resData.total || 0);
        setPages(resData.pages || 1);
        setPage(resData.page || 1);
        setOzet(resOzet || {});
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [yil, donem, ilce, koy, sort.key, sort.dir],
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
    const newDir = sort.key === key && sort.dir === "asc" ? "desc" : "asc";
    onSort(key);
    fetchData(1, key, newDir);
  };

  const handleReset = () => {
    setYil("2025");
    setDonem("");
    setIlce("");
    setKoy("");
    resetSort();
  };

  const exportExcel = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (yil) params.set("yil", yil);
      if (donem) params.set("donem", donem);
      if (ilce) params.set("ilce", ilce);
      if (koy) params.set("koy", koy);
      params.set("sort_by", sort.key || "destek_tutari");
      params.set("sort_dir", sort.dir || "desc");
      params.set("limit", "50000");
      const res = await fetch(`${BASE}/api/sut?${params}`).then((r) =>
        r.json(),
      );
      const ws = XLSX.utils.aoa_to_sheet([
        COLS.map((c) => c.label),
        ...res.data.map((r: SutRow) =>
          COLS.map((c) => r[c.key as keyof SutRow] ?? ""),
        ),
      ]);
      ws["!cols"] = [14, 22, 10, 14, 16].map((w) => ({ wch: w }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Süt Destekleme");
      XLSX.writeFile(wb, `sut_${yil || "tum"}${ilce ? "_" + ilce : ""}.xlsx`);
    } finally {
      setExporting(false);
    }
  }, [yil, donem, ilce, koy, sort]);

  return (
    <div className="dc" style={{ marginTop: 16 }}>
      {/* Özet */}
      {Object.keys(ozet).length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 14px",
            borderBottom: "1px solid var(--br)",
            flexWrap: "wrap",
          }}
        >
          {[
            {
              label: "Toplam Destek",
              val: `${Number(ozet.toplam_tutar || 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺`,
              color: "#1a5276",
            },
            {
              label: "Süt Miktarı",
              val: `${Number(ozet.toplam_sut_lt || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} lt`,
              color: "#2d6a4f",
            },
            {
              label: "Üretici",
              val: Number(ozet.uretici_sayisi || 0).toLocaleString("tr-TR"),
              color: "#6b4226",
            },
            {
              label: "Köy",
              val: Number(ozet.koy_sayisi || 0).toLocaleString("tr-TR"),
              color: "#7b6fa0",
            },
          ].map((a) => (
            <div
              key={a.label}
              style={{
                flex: 1,
                minWidth: 110,
                padding: "9px 12px",
                borderRadius: 8,
                background: "#fafbfa",
                border: `1.5px solid ${a.color}22`,
              }}
            >
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: a.color,
                  textTransform: "uppercase",
                  letterSpacing: ".5px",
                  marginBottom: 2,
                }}
              >
                {a.label}
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: "var(--tx)",
                  fontFamily: "'JetBrains Mono',monospace",
                  lineHeight: 1,
                }}
              >
                {a.val}
              </div>
            </div>
          ))}
        </div>
      )}

      <TableHeader>
        <h2
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 800,
            color: "var(--gd)",
          }}
        >
          Süt Destekleme İcmali
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--mu)", fontWeight: 600 }}>
            {total.toLocaleString("tr-TR")} köy
          </span>
          <ExcelBtn
            onClick={exportExcel}
            disabled={total === 0}
            loading={exporting}
          />
        </div>
      </TableHeader>

      <FilterBar>
        <Sel label="Yıl" value={yil} onChange={setYil}>
          <option value="">— Tümü —</option>
          {["2025", "2024", "2023"].map((y) => (
            <option key={y}>{y}</option>
          ))}
        </Sel>
        <Sel label="Dönem" value={donem} onChange={setDonem} minWidth={180}>
          <option value="">— Tüm Dönemler —</option>
          {donemler.map((d) => (
            <option key={d.donem} value={d.donem}>
              {d.donem} ({d.yil})
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
          <Inp label="Köy" value={koy} onChange={setKoy} placeholder="Ara…" />
        )}
        <ResetBtn onClick={handleReset} />
      </FilterBar>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            color: "var(--red)",
            fontSize: 12,
            fontWeight: 700,
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
              {COLS.map((col) => (
                <SortableTh
                  key={col.key}
                  label={col.label}
                  sortKey={col.key}
                  currentSort={sort}
                  onSort={handleSort}
                  align={col.align}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRow cols={COLS.length + 1} />
            ) : data.length === 0 ? (
              <EmptyRow
                cols={COLS.length + 1}
                text="Veri yok — İçeri Aktar ile süt destekleme yükleyin"
              />
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
                    {(page - 1) * 100 + ri + 1}
                  </td>
                  {COLS.map((col) => {
                    const v = row[col.key as keyof SutRow];
                    return (
                      <td
                        key={col.key}
                        style={{
                          padding: "5px 10px",
                          textAlign: col.align,
                          fontFamily: col.num
                            ? "'JetBrains Mono',monospace"
                            : "inherit",
                          fontSize: col.num ? 11 : 12,
                          fontWeight: col.key === "koy" ? 600 : 400,
                          color:
                            col.key === "destek_tutari"
                              ? "#1a5276"
                              : col.key === "temel_sut_lt"
                                ? "var(--gm)"
                                : "var(--tx)",
                        }}
                      >
                        {col.num ? fmt(v) : String(v ?? "—")}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pages={pages}
        total={total}
        onPage={(p) => fetchData(p)}
        unit="köy"
      />
    </div>
  );
}
