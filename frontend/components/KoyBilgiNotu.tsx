"use client";

import { useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { ILCELER, getVillages, fmt } from "@/lib/ui";
import urunGruplari from "@/data/urun_gruplari.json";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─────────────────────────────────────────────────────────────
// TİPLER
// ─────────────────────────────────────────────────────────────
interface UretimRow {
  urun: string;
  ekili_alan: number;
  tarim_sekli: string;
  uretim_cesidi: string;
}
interface HayvRow {
  sigir: number;
  manda: number;
  koyun: number;
  keci: number;
  sigir_isletme: number;
  manda_isletme: number;
  koyun_isletme: number;
  keci_isletme: number;
  toplam_isletme: number;
}
interface KoopRow {
  koop_turu: string;
  baskan: string;
  ortak_sayisi: number | null;
  telefon: string;
  koy_belde: string;
}
interface SutOzet {
  toplam_sut_lt: number;
  toplam_tutar: number;
  uretici_sayisi: number;
}
interface BitkDRow {
  urun: string;
  feromon_adet: number;
  feromon_tuzak_adet: number;
  faydali_bocek_adet: number;
  desteklenen_alan_da: number;
  destek_tutari_tl: number;
  net_odeme_tl: number;
}
interface AlanBRow {
  destek_adi: string;
  yil: number;
  tutar_tl: number;
}
interface FarkRow {
  kategori: string;
  yil: number;
  tutar_tl: number;
}
interface HayvDRow {
  destek_adi: string;
  yil: number;
  tutar_tl: number;
}
interface GenelDRow {
  destek_adi: string;
  yil: number;
  tutar_tl: number;
}

// ─────────────────────────────────────────────────────────────
// ÜRÜN GRUPLARI
// ─────────────────────────────────────────────────────────────
const GRUP_LABEL: Record<string, string> = {
  tahıllar: "Tahıllar",
  baklagil: "Baklagil",
  "endüstri bitkileri": "Endüstri Bitkileri",
  meyve: "Meyve",
  sebze: "Sebze",
  "yem bitkileri": "Yem Bitkileri",
  "tıbbi aromatik": "Tıbbi Aromatik",
  "süs bitkileri": "Süs Bitkileri",
  "yumru bitkiler": "Yumru Bitkiler",
  "orman emvali ürün": "Orman Emvali",
  "nadas-boş bırakılan arazi": "Nadas / Boş Arazi",
};
const GRUP_COLOR: Record<string, string> = {
  tahıllar: "#e67e22",
  baklagil: "#27ae60",
  "endüstri bitkileri": "#8e44ad",
  meyve: "#e74c3c",
  sebze: "#2ecc71",
  "yem bitkileri": "#f39c12",
  "tıbbi aromatik": "#1abc9c",
  "süs bitkileri": "#e91e63",
  "yumru bitkiler": "#795548",
  "orman emvali ürün": "#4caf50",
  "nadas-boş bırakılan arazi": "#9e9e9e",
};
const urun_to_grup = urunGruplari.urun_to_grup as Record<string, string>;
const getGrup = (u: string) => urun_to_grup[u] ?? "diğer";

// ─────────────────────────────────────────────────────────────
// SVG PASTA GRAFİK
// ─────────────────────────────────────────────────────────────
function PieChart({
  slices,
}: {
  slices: { label: string; value: number; color: string }[];
}) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (!total) return null;
  const cx = 80;
  const cy = 80;
  const r = 62;
  let cum = -90;
  const paths = slices
    .filter((d) => d.value > 0)
    .map((d) => {
      const pct = d.value / total;
      const angle = pct * 360;
      const s1 = cum;
      cum += angle;
      const toXY = (deg: number) => {
        const rad = (deg * Math.PI) / 180;
        return {
          x: +(cx + r * Math.cos(rad)).toFixed(2),
          y: +(cy + r * Math.sin(rad)).toFixed(2),
        };
      };
      const start = toXY(s1);
      const end = toXY(cum);
      return {
        ...d,
        pct,
        path: `M${cx},${cy} L${start.x},${start.y} A${r},${r} 0 ${angle > 180 ? 1 : 0},1 ${end.x},${end.y} Z`,
      };
    });
  return (
    <svg
      viewBox="0 0 160 160"
      style={{ width: 140, height: 140, flexShrink: 0 }}
    >
      {paths.map((p, i) => (
        <path key={i} d={p.path} fill={p.color} stroke="#fff" strokeWidth={1.5}>
          <title>
            {p.label}:{" "}
            {Number(p.value).toLocaleString("tr-TR", {
              maximumFractionDigits: 1,
            })}{" "}
            da (%{(p.pct * 100).toFixed(1)})
          </title>
        </path>
      ))}
      <circle cx={cx} cy={cy} r={22} fill="white" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// UI YARDIMCILARI
// ─────────────────────────────────────────────────────────────
const C = {
  green: "#17472f",
  greenMid: "#2d6a4f",
  greenLight: "#4aaa72",
  greenBg: "#f0f7f3",
  greenBorder: "#2d6a4f33",
  gold: "#b7860b",
  goldBg: "#fffbf0",
  red: "#c0392b",
  blue: "#1a5276",
};

function SectionHeader({
  title,
  icon,
  color = "green",
}: {
  title: string;
  icon: string;
  color?: "green" | "gold" | "blue";
}) {
  const bg =
    color === "gold"
      ? "linear-gradient(90deg,#7d5a0a,#b7860b)"
      : color === "blue"
        ? "linear-gradient(90deg,#1a3a5c,#2471a3)"
        : "linear-gradient(90deg,#0e2d1e,#2d6a4f)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 14px",
        background: bg,
        borderRadius: "10px 10px 0 0",
      }}
    >
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: "#fff",
          letterSpacing: ".6px",
          textTransform: "uppercase",
        }}
      >
        {title}
      </span>
    </div>
  );
}

function Card({
  title,
  icon,
  children,
  color = "green",
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  color?: "green" | "gold" | "blue";
}) {
  return (
    <div
      style={{
        marginBottom: 14,
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: "0 1px 6px #0001",
        border: `1.5px solid ${color === "gold" ? C.goldBg : C.greenBorder}`,
      }}
    >
      <SectionHeader title={title} icon={icon} color={color} />
      <div style={{ background: "#fff" }}>{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        borderBottom: "1px solid #f2f2f2",
        background: accent ? "#f0f7f3" : "#fff",
      }}
    >
      <div
        style={{
          padding: "5px 12px",
          fontSize: 11.5,
          color: "#666",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          padding: "5px 12px",
          fontSize: 12,
          fontWeight: 700,
          color: accent ? C.green : "#222",
          fontFamily: mono ? "'JetBrains Mono',monospace" : "inherit",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TableHead({ cols }: { cols: { label: string; align?: string }[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols.length},1fr)`,
        padding: "4px 12px",
        background: "#17472f18",
        borderBottom: "1px solid #e0e0e0",
      }}
    >
      {cols.map((c, i) => (
        <span
          key={i}
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: "#555",
            textTransform: "uppercase",
            textAlign: (c.align as "right" | "left" | undefined) || "left",
          }}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}

function EmptyState({ text = "Veri yüklenmemiş" }: { text?: string }) {
  return (
    <div
      style={{
        padding: "16px 12px",
        textAlign: "center",
        color: "#ccc",
        fontSize: 12,
        fontStyle: "italic",
      }}
    >
      {text}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: 10.5,
        fontWeight: 700,
        background: color + "20",
        color,
      }}
    >
      {label}
    </span>
  );
}

// Para formatı
function tl(v: number | null | undefined): string {
  if (v == null || isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + " ₺";
}
function num(v: number | null | undefined, unit = ""): string {
  if (v == null || isNaN(Number(v)) || Number(v) === 0) return "—";
  return (
    Number(v).toLocaleString("tr-TR", { maximumFractionDigits: 2 }) +
    (unit ? " " + unit : "")
  );
}

// ─────────────────────────────────────────────────────────────
// ANA BİLEŞEN
// ─────────────────────────────────────────────────────────────
export default function KoyBilgiNotu() {
  const [ilce, setIlce] = useState("");
  const [koy, setKoy] = useState("");
  const [yil, setYil] = useState("2025");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  // ─── Veri state'leri ────────────────────────────────────
  const [uretim, setUretim] = useState<UretimRow[]>([]);
  const [hayv, setHayv] = useState<HayvRow | null>(null);
  const [koop, setKoop] = useState<KoopRow[]>([]);
  const [sut, setSut] = useState<SutOzet | null>(null);
  const [bitkDest, setBitkDest] = useState<BitkDRow[]>([]);
  const [alanB, setAlanB] = useState<AlanBRow[]>([]);
  const [fark, setFark] = useState<FarkRow[]>([]);
  const [hayvD, setHayvD] = useState<HayvDRow[]>([]);
  const [genelD, setGenelD] = useState<GenelDRow[]>([]);
  const [cks, setCks] = useState<number | null>(null);

  const villages = getVillages(ilce);
  const printRef = useRef<HTMLDivElement>(null);
  const hasData = uretim.length > 0 || hayv !== null || koop.length > 0;

  // ─── Tüm verileri çek ───────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!ilce || !koy) return;
    setLoading(true);
    setError("");
    const y = yil;
    const iEnc = encodeURIComponent(ilce);
    const kEnc = encodeURIComponent(koy);

    const safe = async (url: string) => {
      try {
        const r = await fetch(url);
        return await r.json();
      } catch {
        return null;
      }
    };

    const [uRes, hRes, kRes, sRes, bdRes, abRes, fpRes, hdRes, gdRes, cksRes] =
      await Promise.all([
        safe(`${BASE}/api/uretim?yil=${y}&ilce=${iEnc}&koy=${kEnc}&limit=500`),
        safe(
          `${BASE}/api/hayvancilik?yil=${y}&ilce=${iEnc}&koy=${kEnc}&limit=1`,
        ),
        safe(`${BASE}/api/kooperatif?ilce=${iEnc}&ara=${kEnc}&limit=20`),
        safe(`${BASE}/api/sut/ozet?yil=${y}&ilce=${iEnc}`),
        safe(
          `${BASE}/api/bitkisel-destek?yil=${y}&ilce=${iEnc}&koy=${kEnc}&limit=50`,
        ),
        safe(`${BASE}/api/alan-bazli?yil=${y}&limit=999`),
        safe(`${BASE}/api/fark-prim?yil=${y}&limit=999`),
        safe(`${BASE}/api/hayvancilik-destek?yil=${y}&limit=999`),
        safe(`${BASE}/api/genel-destek?yil=${y}&limit=999`),
        safe(`${BASE}/api/cks-sayisi?yil=${y}`),
      ]);

    setUretim(uRes?.data ?? []);
    setHayv((hRes?.data ?? [])[0] ?? null);
    setKoop(kRes?.data ?? []);
    setSut(sRes?.toplam_tutar ? sRes : null);
    setBitkDest(bdRes?.data ?? []);
    setAlanB(abRes?.data ?? []);
    setFark(fpRes?.data ?? []);
    setHayvD(hdRes?.data ?? []);
    setGenelD(gdRes?.data ?? []);

    // ÇKS — ilçe+köy eşleştir
    const cksRows: { yil: number; ilce: string; koy: string; sayi: number }[] =
      cksRes?.data ?? [];
    const match = cksRows.find(
      (r) =>
        r.ilce.toUpperCase() === ilce.toUpperCase() &&
        r.koy.toUpperCase() === koy.toUpperCase(),
    );
    setCks(match?.sayi ?? null);

    setLoading(false);
  }, [ilce, koy, yil]);

  // ─── Hesaplamalar ────────────────────────────────────────
  const grupToplam = useCallback((): Record<string, number> => {
    const res: Record<string, number> = {};
    for (const r of uretim) {
      const g = getGrup(r.urun);
      res[g] = (res[g] ?? 0) + Number(r.ekili_alan ?? 0);
    }
    return res;
  }, [uretim]);

  const gt = grupToplam();
  const toplamAlan = uretim.reduce((s, r) => s + Number(r.ekili_alan ?? 0), 0);
  const top10 = [...uretim]
    .sort((a, b) => Number(b.ekili_alan) - Number(a.ekili_alan))
    .slice(0, 10);
  const pieData = Object.entries(gt)
    .filter(([, v]) => v > 0)
    .map(([g, v]) => ({
      label: GRUP_LABEL[g] ?? g,
      value: v,
      color: GRUP_COLOR[g] ?? "#aaa",
    }));

  // Destek toplamları (il bazlı — köy bazlı değil)
  const alanBToplam = alanB.reduce((s, r) => s + Number(r.tutar_tl ?? 0), 0);
  const farkToplam = fark.reduce((s, r) => s + Number(r.tutar_tl ?? 0), 0);
  const hayvDToplam = hayvD.reduce((s, r) => s + Number(r.tutar_tl ?? 0), 0);
  const genelDToplam = genelD.reduce((s, r) => s + Number(r.tutar_tl ?? 0), 0);
  const bitkDestToplam = bitkDest.reduce(
    (s, r) => s + Number(r.destek_tutari_tl ?? 0),
    0,
  );
  const sutToplam = sut?.toplam_tutar ?? 0;
  const genelToplam =
    alanBToplam +
    farkToplam +
    hayvDToplam +
    genelDToplam +
    bitkDestToplam +
    sutToplam;

  const bugun = new Date().toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // ─── Excel export ────────────────────────────────────────
  const exportExcel = useCallback(async () => {
    if (!koy) return;
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // Sayfa 1: Özet
      const ws1 = XLSX.utils.aoa_to_sheet([
        [`${ilce} İLÇESİ — ${koy.toUpperCase()} KÖYÜ BİLGİ NOTU — ${yil}`],
        [`Tarih: ${bugun}`],
        [],
        ["BİTKİSEL ÜRETİM"],
        ["Grup", "Alan (da)"],
        ...Object.entries(gt)
          .filter(([, v]) => v > 0)
          .map(([g, v]) => [GRUP_LABEL[g] ?? g, v]),
        ["Toplam", toplamAlan],
        [],
        ["HAYVANSAL ÜRETİM"],
        ["Sığır", hayv?.sigir ?? 0],
        ["Manda", hayv?.manda ?? 0],
        ["Koyun", hayv?.koyun ?? 0],
        ["Keçi", hayv?.keci ?? 0],
        ["Toplam İşletme", hayv?.toplam_isletme ?? 0],
        [],
        ["DESTEKLER (İL GENELİ)"],
        ["Süt Destekleme", sutToplam],
        ["Bitkisel Destek", bitkDestToplam],
        ["Alan Bazlı", alanBToplam],
        ["Fark/Prim", farkToplam],
        ["Hayvancılık Desteği", hayvDToplam],
        ["Genel Destek", genelDToplam],
        ["TOPLAM", genelToplam],
        [],
        ["ÇKS Kayıtlı İşletme", cks ?? 0],
      ]);
      ws1["!cols"] = [{ wch: 35 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws1, "Özet");

      // Sayfa 2: Ürün Detay
      if (uretim.length > 0) {
        const ws2 = XLSX.utils.aoa_to_sheet([
          ["Ürün", "Grup", "Tarım Şekli", "Alan (da)"],
          ...uretim.map((r) => [
            r.urun,
            GRUP_LABEL[getGrup(r.urun)] ?? getGrup(r.urun),
            r.tarim_sekli,
            r.ekili_alan,
          ]),
        ]);
        ws2["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 15 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws2, "Ürün Detay");
      }

      // Sayfa 3: Bitkisel Destek
      if (bitkDest.length > 0) {
        const ws3 = XLSX.utils.aoa_to_sheet([
          [
            "Ürün",
            "Feromon",
            "Feromon+Tuzak",
            "Faydalı Böcek",
            "Alan (da)",
            "Destek (TL)",
            "Net Ödeme (TL)",
          ],
          ...bitkDest.map((r) => [
            r.urun,
            r.feromon_adet,
            r.feromon_tuzak_adet,
            r.faydali_bocek_adet,
            r.desteklenen_alan_da,
            r.destek_tutari_tl,
            r.net_odeme_tl,
          ]),
        ]);
        XLSX.utils.book_append_sheet(wb, ws3, "Bitkisel Destek");
      }

      XLSX.writeFile(wb, `${ilce}_${koy}_bilgi_notu_${yil}.xlsx`);
    } finally {
      setExporting(false);
    }
  }, [
    ilce,
    koy,
    yil,
    gt,
    toplamAlan,
    hayv,
    sut,
    bitkDest,
    uretim,
    alanBToplam,
    farkToplam,
    hayvDToplam,
    genelDToplam,
    bitkDestToplam,
    sutToplam,
    genelToplam,
    cks,
    bugun,
  ]);

  const handlePrint = () => window.print();

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <div
      style={{ background: "#f4f6f4", minHeight: "100vh", padding: "0 0 40px" }}
    >
      {/* ── Filtre / Başlık Bandı ─────────────────────── */}
      <div
        style={{
          background:
            "linear-gradient(135deg,#0e2d1e 0%,#17472f 60%,#1a6b3a 100%)",
          padding: "0",
          marginBottom: 0,
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "0 2px 12px #0003",
        }}
      >
        {/* Kurumsal başlık */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "10px 24px",
            borderBottom: "1px solid rgba(255,255,255,.12)",
          }}
        >
          <img
            src="/bakanlik_logo.jpg"
            alt="Bakanlık"
            style={{
              height: 44,
              borderRadius: 4,
              background: "#fff",
              padding: 2,
            }}
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,.55)",
                fontWeight: 600,
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              T.C. Tarım ve Orman Bakanlığı
            </div>
            <div
              style={{
                fontSize: 14,
                color: "#fff",
                fontWeight: 900,
                letterSpacing: 0.3,
              }}
            >
              Burdur İl Tarım ve Orman Müdürlüğü
            </div>
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,.6)",
                fontWeight: 500,
              }}
            >
              Köy Bilgi Notu Sistemi
            </div>
          </div>
          <img
            src="/burdur_val_logo.jpg"
            alt="Burdur Valiliği"
            style={{
              height: 44,
              borderRadius: 4,
              background: "#fff",
              padding: 2,
            }}
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        </div>

        {/* Seçici satırı */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 10,
            padding: "10px 24px 12px",
            flexWrap: "wrap",
          }}
        >
          {/* Yıl */}
          <div>
            <div
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,.5)",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 3,
              }}
            >
              Yıl
            </div>
            <select
              value={yil}
              onChange={(e) => setYil(e.target.value)}
              style={{
                padding: "7px 12px",
                borderRadius: 7,
                border: "1.5px solid rgba(255,255,255,.25)",
                background: "rgba(255,255,255,.12)",
                color: "#fff",
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                width: 90,
              }}
            >
              {["2026", "2025", "2024", "2023"].map((y) => (
                <option key={y} value={y} style={{ color: "#000" }}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* İlçe */}
          <div>
            <div
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,.5)",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 3,
              }}
            >
              İlçe
            </div>
            <select
              value={ilce}
              onChange={(e) => {
                setIlce(e.target.value);
                setKoy("");
              }}
              style={{
                padding: "7px 12px",
                borderRadius: 7,
                border: "1.5px solid rgba(255,255,255,.25)",
                background: "rgba(255,255,255,.12)",
                color: ilce ? "#fff" : "rgba(255,255,255,.5)",
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                minWidth: 140,
              }}
            >
              <option value="" style={{ color: "#000" }}>
                — İlçe Seçin —
              </option>
              {ILCELER.map((i) => (
                <option key={i} value={i} style={{ color: "#000" }}>
                  {i}
                </option>
              ))}
            </select>
          </div>

          {/* Köy */}
          <div>
            <div
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,.5)",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 3,
              }}
            >
              Köy / Belde
            </div>
            <select
              value={koy}
              onChange={(e) => setKoy(e.target.value)}
              disabled={!ilce}
              style={{
                padding: "7px 12px",
                borderRadius: 7,
                border: "1.5px solid rgba(255,255,255,.25)",
                background: "rgba(255,255,255,.12)",
                color: koy ? "#fff" : "rgba(255,255,255,.5)",
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 700,
                cursor: ilce ? "pointer" : "default",
                minWidth: 180,
                opacity: ilce ? 1 : 0.6,
              }}
            >
              <option value="" style={{ color: "#000" }}>
                {ilce ? "— Köy Seçin —" : "— Önce İlçe —"}
              </option>
              {villages.map((v) => (
                <option key={v} value={v} style={{ color: "#000" }}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* Getir butonu */}
          <button
            onClick={fetchAll}
            disabled={!ilce || !koy || loading}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "none",
              cursor: ilce && koy ? "pointer" : "default",
              background: loading
                ? "rgba(255,255,255,.2)"
                : ilce && koy
                  ? "#4aaa72"
                  : "rgba(255,255,255,.15)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 7,
              transition: "background .15s",
              boxShadow: ilce && koy ? "0 2px 8px #0003" : "none",
            }}
          >
            {loading ? <>⏳ Yükleniyor…</> : <>🔍 Bilgi Notunu Getir</>}
          </button>

          {/* Aksiyon butonları */}
          {hasData && (
            <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
              <button
                onClick={handlePrint}
                style={{
                  padding: "8px 14px",
                  borderRadius: 7,
                  border: "1.5px solid rgba(255,255,255,.3)",
                  background: "rgba(255,255,255,.1)",
                  color: "#fff",
                  fontSize: 11.5,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                🖨️ Yazdır / PDF
              </button>
              <button
                onClick={exportExcel}
                disabled={exporting}
                style={{
                  padding: "8px 14px",
                  borderRadius: 7,
                  border: "1.5px solid rgba(255,255,255,.3)",
                  background: "rgba(255,255,255,.1)",
                  color: "#fff",
                  fontSize: 11.5,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                {exporting ? "⏳" : "⬇️"} Excel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hata */}
      {error && (
        <div
          style={{
            margin: "12px 24px",
            padding: 12,
            background: "#fdf0ef",
            border: "1px solid #f5b8b5",
            borderRadius: 8,
            color: C.red,
            fontSize: 12,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Boş durum */}
      {!hasData && !loading && (
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>📋</div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "#444",
              marginBottom: 8,
            }}
          >
            Köy Bilgi Notu
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#888",
              maxWidth: 400,
              margin: "0 auto",
            }}
          >
            Üst bardan ilçe ve köy seçerek tüm tarımsal verilerini içeren bilgi
            notunu görüntüleyin.
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          BİLGİ NOTU İÇERİĞİ
         ══════════════════════════════════════════════════ */}
      {hasData && (
        <div
          ref={printRef}
          id="bilgi-notu-print"
          style={{ maxWidth: 1200, margin: "20px auto", padding: "0 16px" }}
        >
          {/* ── Köy Başlık Kartı ─────────────────────────── */}
          <div
            style={{
              background: "linear-gradient(135deg,#f8fffe,#e8f5f0)",
              border: `2px solid ${C.greenBorder}`,
              borderRadius: 14,
              padding: "18px 24px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 16,
              boxShadow: "0 2px 10px #0001",
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 10,
                  color: "#888",
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                Burdur İl Tarım ve Orman Müdürlüğü — Köy Bilgi Notu
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: C.green,
                  letterSpacing: 0.3,
                }}
              >
                {ilce} İlçesi —{" "}
                <span style={{ color: C.greenLight }}>{koy}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 6,
                  flexWrap: "wrap",
                }}
              >
                <Badge label={`${yil} Yılı`} color={C.green} />
                {cks !== null && (
                  <Badge label={`${cks} ÇKS İşletme`} color={C.blue} />
                )}
                {toplamAlan > 0 && (
                  <Badge
                    label={`${Number(toplamAlan).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} da Ekili Alan`}
                    color={C.gold}
                  />
                )}
              </div>
            </div>
            <div style={{ textAlign: "right", color: "#aaa", fontSize: 11 }}>
              <div style={{ fontWeight: 700, color: "#666" }}>H.T.</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#444" }}>
                {bugun}
              </div>
            </div>
          </div>

          {/* ── 3 KOLON GRID ─────────────────────────────── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 14,
            }}
          >
            {/* ═══ SOL KOLON ═══ */}
            <div>
              {/* BİTKİSEL ÜRETİM */}
              <Card title="Bitkisel Üretim" icon="🌾">
                <InfoRow
                  label="Toplam Ekili Alan"
                  value={`${Number(toplamAlan).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} da`}
                  accent
                  mono
                />
                <InfoRow
                  label="ÇKS Kayıtlı İşletme"
                  value={cks !== null ? `${cks} Kişi` : "—"}
                  accent
                />
                <div style={{ height: 1, background: "#eee" }} />
                {/* Grup tablosu */}
                <TableHead
                  cols={[
                    { label: "Grup" },
                    { label: "Alan (da)", align: "right" },
                  ]}
                />
                {Object.entries(GRUP_LABEL).map(([g, label]) => {
                  const v = gt[g];
                  if (!v) return null;
                  return (
                    <div
                      key={g}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        borderBottom: "1px solid #f5f5f5",
                        padding: "4px 12px",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          fontSize: 11.5,
                        }}
                      >
                        <span
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: "50%",
                            background: GRUP_COLOR[g] ?? "#aaa",
                            flexShrink: 0,
                          }}
                        />
                        {label}
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#222",
                          fontFamily: "'JetBrains Mono',monospace",
                        }}
                      >
                        {Number(v).toLocaleString("tr-TR", {
                          maximumFractionDigits: 1,
                        })}
                      </span>
                    </div>
                  );
                })}
                {/* Pasta */}
                {pieData.length > 0 && (
                  <div
                    style={{
                      padding: "12px",
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      borderTop: "1px solid #f0f0f0",
                    }}
                  >
                    <PieChart slices={pieData} />
                    <div style={{ flex: 1, minWidth: 80 }}>
                      {pieData.slice(0, 7).map((d, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 2,
                              background: d.color,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{ fontSize: 10, color: "#555", flex: 1 }}
                          >
                            {d.label}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#222",
                            }}
                          >
                            %{((d.value / toplamAlan) * 100).toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              {/* İLK 10 ÜRÜN */}
              {top10.length > 0 && (
                <Card title="İlk 10 Ürün" icon="📊">
                  <TableHead
                    cols={[
                      { label: "#" },
                      { label: "Ürün" },
                      { label: "Alan (da)", align: "right" },
                    ]}
                  />
                  {top10.map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "20px 1fr auto",
                        borderBottom: "1px solid #f5f5f5",
                        padding: "4px 12px",
                        background: i % 2 === 0 ? "#fff" : "#fafafa",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: 10, color: "#bbb" }}>
                        {i + 1}
                      </span>
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 600 }}>
                          {r.urun}
                        </div>
                        <div style={{ fontSize: 9.5, color: "#aaa" }}>
                          {r.tarim_sekli}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          fontFamily: "'JetBrains Mono',monospace",
                          color: C.green,
                        }}
                      >
                        {Number(r.ekili_alan).toLocaleString("tr-TR", {
                          maximumFractionDigits: 1,
                        })}
                      </span>
                    </div>
                  ))}
                </Card>
              )}
            </div>

            {/* ═══ ORTA KOLON ═══ */}
            <div>
              {/* HAYVANSAL ÜRETİM */}
              <Card title="Hayvansal Üretim" icon="🐄">
                {hayv ? (
                  <>
                    <InfoRow
                      label="Sığır Sayısı"
                      value={num(hayv.sigir, "Baş")}
                      accent
                    />
                    <InfoRow
                      label="Sığır İşletme"
                      value={num(hayv.sigir_isletme, "Adet")}
                      mono
                    />
                    <InfoRow
                      label="Manda Sayısı"
                      value={num(hayv.manda, "Baş")}
                      accent
                    />
                    <InfoRow
                      label="Koyun Sayısı"
                      value={num(hayv.koyun, "Baş")}
                      accent
                    />
                    <InfoRow
                      label="Koyun İşletme"
                      value={num(hayv.koyun_isletme, "Adet")}
                      mono
                    />
                    <InfoRow
                      label="Keçi Sayısı"
                      value={num(hayv.keci, "Baş")}
                      accent
                    />
                    <InfoRow
                      label="Keçi İşletme"
                      value={num(hayv.keci_isletme, "Adet")}
                      mono
                    />
                    <InfoRow
                      label="Toplam İşletme"
                      value={
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 900,
                            color: C.green,
                          }}
                        >
                          {num(hayv.toplam_isletme, "Adet")}
                        </span>
                      }
                      accent
                    />
                  </>
                ) : (
                  <EmptyState text="Hayvancılık verisi yüklenmemiş" />
                )}
              </Card>

              {/* KOOPERATİF */}
              <Card title="Örgütlenme / Kooperatif" icon="🤝">
                {koop.length > 0 ? (
                  koop.map((k, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #f0f0f0",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 4,
                        }}
                      >
                        <Badge label={k.koop_turu} color={C.green} />
                        {k.ortak_sayisi && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#555",
                            }}
                          >
                            {k.ortak_sayisi} Ortak
                          </span>
                        )}
                      </div>
                      <div
                        style={{ fontSize: 11, color: "#777", marginBottom: 2 }}
                      >
                        📍 {k.koy_belde}
                      </div>
                      {k.baskan && (
                        <div style={{ fontSize: 12, color: "#333" }}>
                          <span style={{ color: "#aaa" }}>Başkan: </span>
                          {k.baskan}
                        </div>
                      )}
                      {k.telefon && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "#888",
                            fontFamily: "'JetBrains Mono',monospace",
                            marginTop: 2,
                          }}
                        >
                          📞 {k.telefon}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <EmptyState text="Kooperatif verisi yüklenmemiş" />
                )}
              </Card>

              {/* SÜT DESTEKLEME */}
              <Card title="Süt Destekleme" icon="🥛" color="gold">
                {sut ? (
                  <>
                    <InfoRow
                      label="Süt Miktarı"
                      value={num(sut.toplam_sut_lt, "lt")}
                      accent
                      mono
                    />
                    <InfoRow
                      label="Destek Tutarı"
                      value={tl(sut.toplam_tutar)}
                      accent
                    />
                    <InfoRow
                      label="Üretici Sayısı"
                      value={num(sut.uretici_sayisi, "Üretici")}
                      mono
                    />
                  </>
                ) : (
                  <EmptyState text="Süt destekleme verisi yüklenmemiş" />
                )}
              </Card>

              {/* BİTKİSEL DESTEK */}
              <Card title="Bitkisel Destekler" icon="🌿" color="gold">
                {bitkDest.length > 0 ? (
                  <>
                    <TableHead
                      cols={[
                        { label: "Ürün" },
                        { label: "Alan (da)", align: "right" },
                        { label: "Destek (₺)", align: "right" },
                      ]}
                    />
                    {bitkDest.slice(0, 8).map((r, i) => (
                      <div
                        key={i}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto auto",
                          borderBottom: "1px solid #f5f5f5",
                          padding: "4px 12px",
                          background: i % 2 === 0 ? "#fff" : "#fffbf0",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 11.5, fontWeight: 600 }}>
                            {r.urun}
                          </div>
                          <div style={{ fontSize: 9.5, color: "#aaa" }}>
                            {r.feromon_adet > 0 &&
                              `F:${Number(r.feromon_adet).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} `}
                            {r.feromon_tuzak_adet > 0 &&
                              `FT:${Number(r.feromon_tuzak_adet).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} `}
                            {r.faydali_bocek_adet > 0 &&
                              `FB:${Number(r.faydali_bocek_adet).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`}
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: "'JetBrains Mono',monospace",
                            color: "#555",
                          }}
                        >
                          {Number(r.desteklenen_alan_da).toLocaleString(
                            "tr-TR",
                            { maximumFractionDigits: 1 },
                          )}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: "'JetBrains Mono',monospace",
                            color: C.gold,
                            fontWeight: 700,
                          }}
                        >
                          {Number(r.destek_tutari_tl).toLocaleString("tr-TR", {
                            maximumFractionDigits: 0,
                          })}
                        </span>
                      </div>
                    ))}
                    <div
                      style={{
                        padding: "6px 12px",
                        background: "#fffbf0",
                        display: "flex",
                        justifyContent: "space-between",
                        borderTop: "2px solid " + C.gold + "44",
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700 }}>
                        TOPLAM
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          color: C.gold,
                          fontFamily: "'JetBrains Mono',monospace",
                        }}
                      >
                        {tl(bitkDestToplam)}
                      </span>
                    </div>
                  </>
                ) : (
                  <EmptyState text="Bitkisel destek verisi yüklenmemiş" />
                )}
              </Card>
            </div>

            {/* ═══ SAĞ KOLON ═══ */}
            <div>
              {/* DESTEKLER ÖZET KARTI */}
              <Card title="Destekler Özeti (İl Geneli)" icon="💰" color="gold">
                <InfoRow
                  label="Süt Destekleme"
                  value={tl(sutToplam)}
                  accent
                  mono
                />
                <InfoRow
                  label="Bitkisel Üretim Desteği"
                  value={tl(bitkDestToplam)}
                  accent
                  mono
                />
                <InfoRow
                  label="Alan Bazlı Destekler"
                  value={tl(alanBToplam)}
                  mono
                />
                <InfoRow
                  label="Fark/Prim Ödemeleri"
                  value={tl(farkToplam)}
                  mono
                />
                <InfoRow
                  label="Hayvancılık Destekleri"
                  value={tl(hayvDToplam)}
                  mono
                />
                <InfoRow
                  label="Genel Destekler"
                  value={tl(genelDToplam)}
                  mono
                />
                <div
                  style={{
                    padding: "8px 12px",
                    background: "linear-gradient(90deg,#fffbf0,#fff8e6)",
                    borderTop: "2px solid " + C.gold + "55",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{ fontSize: 12, fontWeight: 800, color: C.gold }}
                  >
                    GENEL TOPLAM
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 900,
                      color: C.gold,
                      fontFamily: "'JetBrains Mono',monospace",
                    }}
                  >
                    {tl(genelToplam)}
                  </span>
                </div>
              </Card>

              {/* ALAN BAZLI DESTEK DETAY */}
              {alanB.length > 0 && (
                <Card title="Alan Bazlı Destekler" icon="🌾" color="blue">
                  <TableHead
                    cols={[
                      { label: "Destek Adı" },
                      { label: "TL", align: "right" },
                    ]}
                  />
                  {alanB.slice(0, 8).map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        borderBottom: "1px solid #f5f5f5",
                        padding: "4px 12px",
                        background: i % 2 === 0 ? "#fff" : "#f8fbff",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: 11, color: "#444" }}>
                        {r.destek_adi}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: "'JetBrains Mono',monospace",
                          color: C.blue,
                          fontWeight: 700,
                        }}
                      >
                        {Number(r.tutar_tl).toLocaleString("tr-TR", {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    </div>
                  ))}
                </Card>
              )}

              {/* FARK/PRİM */}
              {fark.length > 0 && (
                <Card title="Fark/Prim Ödemeleri" icon="💵" color="blue">
                  <TableHead
                    cols={[
                      { label: "Kategori" },
                      { label: "TL", align: "right" },
                    ]}
                  />
                  {fark.slice(0, 6).map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        borderBottom: "1px solid #f5f5f5",
                        padding: "4px 12px",
                        background: i % 2 === 0 ? "#fff" : "#f8fbff",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: 11, color: "#444" }}>
                        {r.kategori}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: "'JetBrains Mono',monospace",
                          color: C.blue,
                          fontWeight: 700,
                        }}
                      >
                        {Number(r.tutar_tl).toLocaleString("tr-TR", {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    </div>
                  ))}
                </Card>
              )}

              {/* HAYVANCILıK DESTEK */}
              {hayvD.length > 0 && (
                <Card title="Hayvancılık Destekleri" icon="🐄" color="blue">
                  <TableHead
                    cols={[
                      { label: "Destek" },
                      { label: "TL", align: "right" },
                    ]}
                  />
                  {hayvD.slice(0, 6).map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        borderBottom: "1px solid #f5f5f5",
                        padding: "4px 12px",
                        background: i % 2 === 0 ? "#fff" : "#f8fbff",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: 11, color: "#444" }}>
                        {r.destek_adi}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: "'JetBrains Mono',monospace",
                          color: C.blue,
                          fontWeight: 700,
                        }}
                      >
                        {Number(r.tutar_tl).toLocaleString("tr-TR", {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    </div>
                  ))}
                </Card>
              )}

              {/* BOŞ TABLOLAR */}
              <Card title="Su Ürünleri" icon="🐟">
                <TableHead
                  cols={[{ label: "Tür" }, { label: "Adet", align: "right" }]}
                />
                {["Avcılık (Tekne)", "Yetiştiricilik (Ton)"].map((row) => (
                  <div
                    key={row}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      borderBottom: "1px solid #f5f5f5",
                      padding: "5px 12px",
                    }}
                  >
                    <span style={{ fontSize: 11.5, color: "#555" }}>{row}</span>
                    <span style={{ fontSize: 12, color: "#ddd" }}>—</span>
                  </div>
                ))}
              </Card>

              <Card title="Gıda & Yem İşletmeleri" icon="🏭">
                {[
                  "Satış-Toplu Tüketim",
                  "Üretim İşletmeleri",
                  "Onaylı Üretim",
                  "Yem İşletmeleri",
                ].map((row) => (
                  <div
                    key={row}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      borderBottom: "1px solid #f5f5f5",
                      padding: "5px 12px",
                    }}
                  >
                    <span style={{ fontSize: 11.5, color: "#555" }}>{row}</span>
                    <span style={{ fontSize: 12, color: "#ddd" }}>—</span>
                  </div>
                ))}
              </Card>
            </div>
          </div>

          {/* Alt bilgi */}
          <div
            style={{
              textAlign: "center",
              padding: "12px 0 0",
              fontSize: 10,
              color: "#bbb",
              borderTop: "1px solid #e0e0e0",
              marginTop: 8,
            }}
          >
            T.C. Burdur İl Tarım ve Orman Müdürlüğü · Köy Bilgi Notu Sistemi ·{" "}
            {bugun}
          </div>
        </div>
      )}

      {/* ── Print CSS ─────────────────────────────── */}
      <style>{`
        @media print {
          header, nav.topnav, aside, footer, .im-overlay { display: none !important; }
          nav[class*="topnav"] { display: none !important; }
          body { background: white !important; }
          #bilgi-notu-print { position: static !important; }
          .page { padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
