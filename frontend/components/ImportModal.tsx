"use client";

import { useState, useRef, useCallback } from "react";
import { api, type ImportResponse } from "@/lib/api";

interface Props {
  onClose: () => void;
  onDone?: () => void;
}
const YEARS = Array.from({ length: 10 }, (_, i) => String(2026 - i));

type Category =
  | "uretim"
  | "hayvancilik"
  | "kooperatif"
  | "sut"
  | "alan-bazli"
  | "fark-prim"
  | "hayv-destek"
  | "cks-sayisi"
  | "genel-destek"
  | "bitkisel-destek";
interface FileResult {
  name: string;
  status: "bekliyor" | "yukleniyor" | "tamam" | "hata";
  result?: ImportResponse & { koy_sayisi?: number };
  error?: string;
}

const CATS: {
  id: Category;
  icon: string;
  label: string;
  desc: string;
  accept: string;
}[] = [
  {
    id: "uretim",
    icon: "🌾",
    label: "Bitkisel Üretim (ÇKS)",
    desc: "İlçe bazlı .xlsx dosyaları",
    accept: ".xlsx,.xls,.xlsm,.ods",
  },
  {
    id: "hayvancilik",
    icon: "🐄",
    label: "Hayvancılık",
    desc: "İlçe bazlı .xls dosyaları",
    accept: ".xls,.xlsx",
  },
  {
    id: "kooperatif",
    icon: "🤝",
    label: "Kooperatifler & Birlikler",
    desc: "Tek .xls dosyası (tüm ilçeler)",
    accept: ".xls,.xlsx",
  },
  {
    id: "sut",
    icon: "🥛",
    label: "Süt Destekleme İcmali",
    desc: "Dönemlik .xlsx icmal dosyası",
    accept: ".xlsx,.xls",
  },
  {
    id: "alan-bazli",
    icon: "🌾",
    label: "Alan Bazlı Destekler",
    desc: "Yıllık .xls özet dosyası",
    accept: ".xls,.xlsx",
  },
  {
    id: "fark-prim",
    icon: "💰",
    label: "Fark/Prim Ödemeleri",
    desc: "Yıllık .xls özet dosyası",
    accept: ".xls,.xlsx",
  },
  {
    id: "hayv-destek",
    icon: "🐄",
    label: "Hayvancılık Destekleri",
    desc: "Yıllık .xls özet dosyası",
    accept: ".xls,.xlsx",
  },
  {
    id: "cks-sayisi",
    icon: "👨‍🌾",
    label: "ÇKS Çiftçi Sayısı",
    desc: "Yıllık .xlsx köy bazlı sayım",
    accept: ".xlsx,.xls",
  },
  {
    id: "genel-destek",
    icon: "📊",
    label: "Genel Destekler Özeti",
    desc: "Yıllık .xls özet dosyası",
    accept: ".xls,.xlsx",
  },
  {
    id: "bitkisel-destek",
    icon: "🌿",
    label: "Bitkisel Destekler",
    desc: "Feromon/Biyolojik .xls icmal dosyaları",
    accept: ".xls,.xlsx,.xlsm",
  },
];

export default function ImportModal({ onClose, onDone }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [cat, setCat] = useState<Category>("uretim");
  const [year, setYear] = useState("2025");
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [results, setResults] = useState<FileResult[]>([]);
  const [running, setRunning] = useState(false);
  const [donem, setDonem] = useState("");
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const accept = CATS.find((c) => c.id === cat)!.accept.split(",");
    const valid = Array.from(incoming).filter((f) => {
      const ext = "." + f.name.split(".").pop()?.toLowerCase();
      return accept.includes(ext);
    });
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...valid.filter((f) => !names.has(f.name))];
    });
  };

  const removeFile = (i: number) =>
    setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const handleUpload = useCallback(async () => {
    if (!files.length) return;
    setRunning(true);
    setDone(false);
    setResults(files.map((f) => ({ name: f.name, status: "bekliyor" })));

    for (let i = 0; i < files.length; i++) {
      setResults((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "yukleniyor" } : r)),
      );
      try {
        let res;
        if (cat === "hayvancilik") {
          res = await api.importHayvancilik(files[i], year);
        } else if (cat === "kooperatif") {
          res = await api.importKooperatif(files[i]);
        } else if (cat === "sut") {
          res = await api.importSut(files[i], donem, year);
        } else if (cat === "alan-bazli") {
          res = await api.importAlanBazli(files[i]);
        } else if (cat === "fark-prim") {
          res = await api.importFarkPrim(files[i]);
        } else if (cat === "hayv-destek") {
          res = await api.importHayvDestek(files[i]);
        } else if (cat === "cks-sayisi") {
          res = await api.importCksSayisi(files[i], year);
        } else if (cat === "genel-destek") {
          res = await api.importGenelDestek(files[i]);
        } else if (cat === "bitkisel-destek") {
          res = await api.importBitkiselDestek(files[i], year);
        } else {
          res = await api.importExcel(files[i], year);
        }
        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: "tamam", result: res } : r,
          ),
        );
      } catch (e) {
        const msg = (e as Error).message;
        const isDup =
          msg.includes("daha önce yüklenmiş") || msg.includes("409");
        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  status: "hata",
                  error: isDup ? "⚠️ Aynı dosya daha önce yüklenmiş" : msg,
                }
              : r,
          ),
        );
      }
    }
    setRunning(false);
    setDone(true);
    onDone?.();
  }, [files, year, cat, onDone]);

  const totalKayit = results
    .filter((r) => r.status === "tamam")
    .reduce((s, r) => s + (r.result?.eklenen ?? r.result?.koy_sayisi ?? 0), 0);
  const hatalar = results.filter((r) => r.status === "hata").length;
  const statusIcon = (s: FileResult["status"]) =>
    ({ bekliyor: "⏸", yukleniyor: "⏳", tamam: "✅", hata: "❌" })[s];
  const statusColor = (s: FileResult["status"]) =>
    ({
      bekliyor: "var(--mu)",
      yukleniyor: "var(--am)",
      tamam: "var(--gm)",
      hata: "var(--red)",
    })[s];

  const selectedCat = CATS.find((c) => c.id === cat)!;

  return (
    <div
      className="im-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="im-box">
        {/* Başlık */}
        <div className="im-head">
          <div className="im-head-left">
            <div className="im-head-icon">📥</div>
            <div>
              <div className="im-head-title">Veri Aktarımı</div>
              <div className="im-head-sub">
                {step === 1
                  ? "Kategori seçin"
                  : step === 2
                    ? `${selectedCat.label} · ${year}`
                    : "Aktarım tamamlandı"}
              </div>
            </div>
          </div>
          <button className="im-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Adım göstergesi */}
        <div
          style={{
            display: "flex",
            gap: 0,
            borderBottom: "1px solid var(--br)",
          }}
        >
          {["Kategori", "Yıl & Dosya", "Sonuç"].map((lbl, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                padding: "7px 0",
                textAlign: "center",
                fontSize: 10.5,
                fontWeight: 700,
                color:
                  step === i + 1
                    ? "var(--gm)"
                    : step > i + 1
                      ? "var(--gd)"
                      : "var(--mu)",
                borderBottom:
                  step === i + 1
                    ? "2.5px solid var(--gm)"
                    : "2.5px solid transparent",
                background: step === i + 1 ? "var(--sf2)" : "#fff",
              }}
            >
              {step > i + 1 ? "✓ " : `${i + 1}. `}
              {lbl}
            </div>
          ))}
        </div>

        <div className="im-body">
          {/* ADIM 1: Kategori */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "var(--tx2)",
                  marginBottom: 2,
                }}
              >
                Hangi veri türünü aktarmak istiyorsunuz?
              </div>
              {CATS.map((ct) => (
                <div
                  key={ct.id}
                  onClick={() => setCat(ct.id)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 9,
                    cursor: "pointer",
                    border: `2px solid ${cat === ct.id ? "var(--gm)" : "var(--br2)"}`,
                    background: cat === ct.id ? "#edfaf3" : "#fff",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    transition: "all .15s",
                  }}
                >
                  <span style={{ fontSize: 24 }}>{ct.icon}</span>
                  <div>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 800,
                        color: "var(--tx)",
                      }}
                    >
                      {ct.label}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "var(--mu)", marginTop: 2 }}
                    >
                      {ct.desc}
                    </div>
                  </div>
                  {cat === ct.id && (
                    <span
                      style={{
                        marginLeft: "auto",
                        color: "var(--gm)",
                        fontSize: 18,
                      }}
                    >
                      ✓
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ADIM 2: Yıl + dosya */}
          {step === 2 && !done && (
            <>
              {cat !== "kooperatif" && (
                <div className="im-field" style={{ marginBottom: 10 }}>
                  <label className="im-label">📅 Üretim Yılı</label>
                  <select
                    className="im-select"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  >
                    {YEARS.map((y) => (
                      <option key={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}
              {cat === "sut" && (
                <div className="im-field" style={{ marginBottom: 10 }}>
                  <label className="im-label">📋 Dönem</label>
                  <input
                    className="im-select"
                    type="text"
                    placeholder="örn: Temmuz-Ağustos-Eylül 2025"
                    value={donem}
                    onChange={(e) => setDonem(e.target.value)}
                    style={{
                      padding: "9px 12px",
                      fontSize: 13,
                      fontWeight: 600,
                      border: "1.5px solid var(--br2)",
                      borderRadius: 8,
                      fontFamily: "inherit",
                      width: "100%",
                      outline: "none",
                    }}
                  />
                </div>
              )}

              <div
                className={`im-dropzone${drag ? " drag" : ""}${files.length ? " has-file" : ""}`}
                style={{ minHeight: 80 }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  addFiles(e.dataTransfer.files);
                }}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept={selectedCat.accept}
                  multiple
                  onChange={(e) => addFiles(e.target.files)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="im-dz-icon">📂</div>
                <div className="im-dz-text">
                  Dosyaları sürükleyin veya tıklayın
                </div>
                <div className="im-dz-hint">
                  {selectedCat.accept} · Birden fazla dosya seçebilirsiniz
                </div>
              </div>

              {files.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  {files.map((f, i) => {
                    const r = results[i];
                    return (
                      <div
                        key={f.name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "5px 10px",
                          borderRadius: 7,
                          border: "1px solid var(--br)",
                          background: r
                            ? r.status === "tamam"
                              ? "#edfaf3"
                              : r.status === "hata"
                                ? "#fdf0ef"
                                : "#f8f9fa"
                            : "#f8f9fa",
                        }}
                      >
                        <span style={{ fontSize: 13 }}>
                          {r ? statusIcon(r.status) : "📄"}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: "var(--tx)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {f.name}
                        </span>
                        {r?.status === "tamam" && (
                          <span
                            style={{
                              fontSize: 10.5,
                              color: "var(--gm)",
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {r.result?.eklenen
                              ? `+${r.result.eklenen.toLocaleString("tr-TR")} kayıt`
                              : `+${r.result?.koy_sayisi} köy`}
                          </span>
                        )}
                        {r?.status === "hata" && (
                          <span style={{ fontSize: 10, color: "var(--red)" }}>
                            {r.error?.slice(0, 40)}
                          </span>
                        )}
                        {r?.status === "yukleniyor" && (
                          <span
                            style={{
                              fontSize: 10.5,
                              color: "var(--am)",
                              fontWeight: 700,
                            }}
                          >
                            Yükleniyor…
                          </span>
                        )}
                        {!r && !running && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(i);
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: 12,
                              color: "var(--mu)",
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ADIM 3: Sonuç */}
          {done && (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>
                {hatalar === 0 ? "🎉" : "⚠️"}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "var(--gd)",
                  marginBottom: 12,
                }}
              >
                {hatalar === 0
                  ? "Tüm dosyalar yüklendi!"
                  : `${results.length - hatalar} başarılı, ${hatalar} hatalı`}
              </div>
              <div className="im-summary">
                <div className="im-summary-row">
                  <span className="im-summary-key">Dosya</span>
                  <span className="im-summary-val">{results.length}</span>
                </div>
                <div className="im-summary-row">
                  <span className="im-summary-key">
                    {cat === "hayvancilik" ? "Kaydedilen Köy" : "Eklenen Kayıt"}
                  </span>
                  <span
                    className="im-summary-val"
                    style={{ color: "var(--gm)", fontSize: 14 }}
                  >
                    {totalKayit.toLocaleString("tr-TR")}
                  </span>
                </div>
              </div>
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                {results.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "5px 10px",
                      borderRadius: 6,
                      background: "#f8f9fa",
                      border: "1px solid var(--br)",
                      textAlign: "left",
                    }}
                  >
                    <span>{statusIcon(r.status)}</span>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 11,
                        color: "var(--tx)",
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.name}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: statusColor(r.status),
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.status === "tamam"
                        ? r.result?.eklenen
                          ? `+${r.result.eklenen.toLocaleString("tr-TR")}`
                          : `${r.result?.koy_sayisi} köy`
                        : (r.error?.slice(0, 30) ?? "")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="im-footer">
          {done ? (
            <>
              <button
                className="im-btn im-btn-ghost"
                onClick={() => {
                  setStep(1);
                  setFiles([]);
                  setResults([]);
                  setDone(false);
                }}
              >
                Yeni Aktarım
              </button>
              <button className="im-btn im-btn-success" onClick={onClose}>
                ✓ Kapat
              </button>
            </>
          ) : step === 1 ? (
            <>
              <button className="im-btn im-btn-ghost" onClick={onClose}>
                İptal
              </button>
              <button
                className="im-btn im-btn-primary"
                onClick={() => setStep(2)}
              >
                Devam →
              </button>
            </>
          ) : (
            <>
              <button
                className="im-btn im-btn-ghost"
                onClick={() => {
                  setStep(1);
                  setFiles([]);
                  setResults([]);
                }}
              >
                ← Geri
              </button>
              <button
                className="im-btn im-btn-primary"
                disabled={
                  !files.length || running || (cat === "sut" && !donem.trim())
                }
                onClick={handleUpload}
              >
                {running
                  ? `⏳ ${results.filter((r) => r.status === "tamam" || r.status === "hata").length}/${files.length} yükleniyor…`
                  : `📥 ${files.length} Dosyayı Aktar`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
