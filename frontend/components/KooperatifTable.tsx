"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, type KoopRow } from "@/lib/api";
import * as XLSX from "xlsx";
import {
  ILCELER,
  Sel,
  Inp,
  FilterBar,
  TableHeader,
  ResetBtn,
  ExcelBtn,
  SortableTh,
  Pagination,
  useSortState,
  applySortRows,
  LoadingRow,
  EmptyRow,
} from "@/lib/ui";

const KOOP_TURLERI = [
  "T.K.K.",
  "Sulama",
  "Su Ürünleri",
  "Yetiştirici Birliği",
  "Üretici birliği",
];
const KOOP_COLOR: Record<string, string> = {
  "T.K.K.": "#2d6a4f",
  Sulama: "#1a5276",
  "Su Ürünleri": "#1a6b5c",
  "Yetiştirici Birliği": "#7b6fa0",
  "Üretici birliği": "#b5722a",
};
type Col = { key: keyof KoopRow; label: string; num?: boolean };
const COLS: Col[] = [
  { key: "ilce", label: "İlçe" },
  { key: "koy_belde", label: "Köy / Belde" },
  { key: "koop_turu", label: "Tür" },
  { key: "ortak_sayisi", label: "Ortak Sayısı", num: true },
  { key: "baskan", label: "Başkan" },
  { key: "telefon", label: "Telefon" },
];

export default function KooperatifTable() {
  const [ilce, setIlce] = useState("");
  const [koopTuru, setKoopTuru] = useState("");
  const [ara, setAra] = useState("");
  const [data, setData] = useState<KoopRow[]>([]);
  const [ozet, setOzet] = useState<
    { koop_turu: string; sayi: number; ilce_sayisi: number }[]
  >([]);
  const [toplam, setToplam] = useState(0);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { sort, onSort, resetSort } = useSortState();
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  const fetchData = useCallback(
    async (pg: number) => {
      setLoading(true);
      try {
        const [res, oz] = await Promise.all([
          api.listKooperatif({
            ilce: ilce || undefined,
            koop_turu: koopTuru || undefined,
            ara: ara || undefined,
            page: pg,
            limit: 100,
          }),
          api.koopOzet(),
        ]);
        setData(res.data);
        setTotal(res.total);
        setPages(res.pages);
        setPage(res.page);
        setOzet(oz.data);
        setToplam(oz.toplam);
      } finally {
        setLoading(false);
      }
    },
    [ilce, koopTuru, ara],
  );

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setPage(1);
      fetchData(1);
    }, 350);
    return () => clearTimeout(debounce.current);
  }, [fetchData]);

  const sorted = applySortRows(
    data as Record<string, unknown>[],
    sort,
  ) as KoopRow[];

  const exportExcel = useCallback(async () => {
    setExporting(true);
    try {
      const res = await api.listKooperatif({
        ilce: ilce || undefined,
        koop_turu: koopTuru || undefined,
        ara: ara || undefined,
        page: 1,
        limit: 5000,
      });
      const ws = XLSX.utils.aoa_to_sheet([
        COLS.map((c) => c.label),
        ...res.data.map((r) => COLS.map((c) => r[c.key] ?? "")),
      ]);
      ws["!cols"] = [14, 20, 18, 14, 22, 13].map((w) => ({ wch: w }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Kooperatifler");
      XLSX.writeFile(wb, `kooperatifler${ilce ? "_" + ilce : ""}.xlsx`);
    } finally {
      setExporting(false);
    }
  }, [ilce, koopTuru, ara]);

  return (
    <div className="dc" style={{ marginTop: 16 }}>
      {/* Özet */}
      {ozet.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 14px",
            borderBottom: "1px solid var(--br)",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              flex: "0 0 auto",
              minWidth: 100,
              padding: "9px 12px",
              borderRadius: 8,
              background: "#f0f7ff",
              border: "1.5px solid #3b82f622",
            }}
          >
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: "#3b82f6",
                marginBottom: 2,
                textTransform: "uppercase",
                letterSpacing: ".5px",
              }}
            >
              Toplam
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: "var(--tx)",
                fontFamily: "'JetBrains Mono',monospace",
                lineHeight: 1,
              }}
            >
              {toplam.toLocaleString("tr-TR")}
            </div>
          </div>
          {ozet.map((o) => (
            <div
              key={o.koop_turu}
              style={{
                flex: 1,
                minWidth: 100,
                padding: "9px 12px",
                borderRadius: 8,
                background: "#fafbfa",
                border: `1.5px solid ${KOOP_COLOR[o.koop_turu] || "#888"}22`,
              }}
            >
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: KOOP_COLOR[o.koop_turu] || "#555",
                  marginBottom: 2,
                  textTransform: "uppercase",
                  letterSpacing: ".5px",
                }}
              >
                {o.koop_turu}
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: "var(--tx)",
                  fontFamily: "'JetBrains Mono',monospace",
                  lineHeight: 1,
                }}
              >
                {o.sayi}
              </div>
              <div style={{ fontSize: 9.5, color: "var(--mu)", marginTop: 2 }}>
                {o.ilce_sayisi} ilçe
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
          Kooperatifler & Birlikler
        </h2>
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

      <FilterBar>
        <Sel label="İlçe" value={ilce} onChange={setIlce}>
          <option value="">— Tümü —</option>
          {ILCELER.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </Sel>
        <Sel label="Tür" value={koopTuru} onChange={setKoopTuru} minWidth={150}>
          <option value="">— Tümü —</option>
          {KOOP_TURLERI.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </Sel>
        <Inp
          label="Köy / Başkan"
          value={ara}
          onChange={setAra}
          placeholder="Ara…"
          minWidth={150}
        />
        <ResetBtn
          onClick={() => {
            setIlce("");
            setKoopTuru("");
            setAra("");
            resetSort();
          }}
        />
      </FilterBar>

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
              {COLS.map((col) => (
                <SortableTh
                  key={col.key}
                  label={col.label}
                  sortKey={col.key}
                  currentSort={sort}
                  onSort={onSort}
                  align={col.num ? "right" : "left"}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRow cols={COLS.length + 1} />
            ) : sorted.length === 0 ? (
              <EmptyRow
                cols={COLS.length + 1}
                text="Veri bulunamadı — İçeri Aktar ile kooperatif verisi yükleyin"
              />
            ) : (
              sorted.map((row, ri) => (
                <tr
                  key={row.id}
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
                  <td style={{ padding: "5px 10px", fontSize: 12 }}>
                    {row.ilce}
                  </td>
                  <td
                    style={{
                      padding: "5px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {row.koy_belde}
                  </td>
                  <td style={{ padding: "5px 10px" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 20,
                        fontSize: 10.5,
                        fontWeight: 700,
                        background: `${KOOP_COLOR[row.koop_turu] || "#888"}15`,
                        color: KOOP_COLOR[row.koop_turu] || "#555",
                      }}
                    >
                      {row.koop_turu}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "5px 10px",
                      textAlign: "right",
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: 12,
                      fontWeight: row.ortak_sayisi ? 700 : 400,
                      color: row.ortak_sayisi ? "var(--gm)" : "var(--br2)",
                    }}
                  >
                    {row.ortak_sayisi != null && row.ortak_sayisi > 0
                      ? row.ortak_sayisi.toLocaleString("tr-TR")
                      : "—"}
                  </td>
                  <td style={{ padding: "5px 10px", fontSize: 12 }}>
                    {row.baskan || "—"}
                  </td>
                  <td
                    style={{
                      padding: "5px 10px",
                      fontSize: 11.5,
                      fontFamily: "'JetBrains Mono',monospace",
                      color: "var(--mu)",
                    }}
                  >
                    {row.telefon || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={pages} total={total} onPage={fetchData} />
    </div>
  );
}
