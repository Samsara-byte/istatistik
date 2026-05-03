import { useState, useRef, useCallback } from "react";
import { api } from "@/lib/api";

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

interface AnyResult {
  ok?: boolean;
  eklenen?: number;
  silinen?: number;
  atlandi?: number;
  sure_sn?: number;
  koy_sayisi?: number;
  yil?: number;
  guncellenen?: number;
  ilce?: string;
  donem?: string;
}

interface FileResult {
  name: string;
  status: "bekliyor" | "yukleniyor" | "tamam" | "hata";
  result?: AnyResult;
  error?: string;
}

interface CatDef {
  id: Category;
  icon: string;
  label: string;
  desc: string;
  accept: string;
  needsYear: boolean;
  multi?: boolean;
  hint?: string;
}

const CAT_GROUPS: { label: string; color: string; items: CatDef[] }[] = [
  {
    label: "Tarımsal Destekler",
    color: "#2d6a4f",
    items: [
      {
        id: "genel-destek",
        icon: "📊",
        label: "Genel Destekler",
        desc: "Yıllık özet dosyası",
        accept: ".xls,.xlsx",
        needsYear: false,
        hint: "Tüm genel destek kalemlerini içeren yıllık Excel dosyası",
      },
      {
        id: "alan-bazli",
        icon: "🌾",
        label: "Alan Bazlı Destekler",
        desc: "Yıllık özet dosyası",
        accept: ".xls,.xlsx",
        needsYear: false,
        hint: "Mazot, gübre vb. alan bazlı ödemelerin yıllık özeti",
      },
      {
        id: "fark-prim",
        icon: "💰",
        label: "Fark / Prim Ödemeleri",
        desc: "Yıllık özet dosyası",
        accept: ".xls,.xlsx",
        needsYear: false,
        hint: "Hububat, yağlı tohum vb. fark prim ödemeleri",
      },
      {
        id: "hayv-destek",
        icon: "🐄",
        label: "Hayvancılık Destekleri",
        desc: "Yıllık özet dosyası",
        accept: ".xls,.xlsx",
        needsYear: false,
        hint: "Ana sığır, aşılama vb. hayvancılık destek ödemeleri",
      },
      {
        id: "sut",
        icon: "🥛",
        label: "Süt Destekleme",
        desc: "Dönemlik icmal dosyası",
        accept: ".xlsx,.xls",
        needsYear: true,
        hint: "Süt destekleme dönemlik icmal — dönem adını giriniz",
      },
      {
        id: "bitkisel-destek",
        icon: "🌿",
        label: "Bitkisel Destekler",
        desc: "Feromon / Biyolojik mücadele",
        accept: ".xls,.xlsx,.xlsm",
        needsYear: true,
        hint: "Feromon tuzak ve faydalı böcek destek verileri",
      },
    ],
  },
  {
    label: "Tarımsal İstatistikler",
    color: "#1a5276",
    items: [
      {
        id: "uretim",
        icon: "🌱",
        label: "Bitkisel Üretim (ÇKS)",
        desc: "İlçe bazlı xlsx dosyaları",
        accept: ".xlsx,.xls,.xlsm,.ods",
        needsYear: true,
        multi: true,
        hint: "Her ilçe için ayrı ÇKS Excel dosyası — birden fazla seçebilirsiniz",
      },
      {
        id: "hayvancilik",
        icon: "🐂",
        label: "Hayvancılık İstatistikleri",
        desc: "İlçe bazlı xls dosyaları",
        accept: ".xls,.xlsx",
        needsYear: true,
        multi: true,
        hint: "Köy bazlı hayvan sayım verileri — birden fazla ilçe seçebilirsiniz",
      },
      {
        id: "cks-sayisi",
        icon: "👨‍🌾",
        label: "ÇKS Çiftçi Sayısı",
        desc: "Köy bazlı yıllık sayım",
        accept: ".xlsx,.xls",
        needsYear: true,
        hint: "Köy bazlı ÇKS'ye kayıtlı çiftçi sayım dosyası",
      },
    ],
  },
  {
    label: "Özel Bilgiler",
    color: "#6b4226",
    items: [
      {
        id: "kooperatif",
        icon: "🤝",
        label: "Kooperatifler & Birlikler",
        desc: "Tek xls dosyası (tüm ilçeler)",
        accept: ".xls,.xlsx",
        needsYear: false,
        hint: "Tüm ilçeleri kapsayan kooperatif ve birlik listesi",
      },
    ],
  },
];

const ALL_CATS: CatDef[] = CAT_GROUPS.flatMap((g) => g.items);

export default function ImportModal({ onClose, onDone }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [cat, setCat] = useState<Category>("genel-destek");
  const [year, setYear] = useState("2025");
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [results, setResults] = useState<FileResult[]>([]);
  const [running, setRunning] = useState(false);
  const [donem, setDonem] = useState("");
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedCat = ALL_CATS.find((c) => c.id === cat)!;

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const accept = selectedCat.accept.split(",");
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
        prev.map((r, idx) => (idx === i ? { ...r, status: "yukleniyor" } : r))
      );
      try {
        let res;
        if (cat === "hayvancilik") res = await api.importHayvancilik(files[i], year);
        else if (cat === "kooperatif") res = await api.importKooperatif(files[i]);
        else if (cat === "sut") res = await api.importSut(files[i], donem, year);
        else if (cat === "alan-bazli") res = await api.importAlanBazli(files[i]);
        else if (cat === "fark-prim") res = await api.importFarkPrim(files[i]);
        else if (cat === "hayv-destek") res = await api.importHayvDestek(files[i]);
        else if (cat === "cks-sayisi") res = await api.importCksSayisi(files[i], year);
        else if (cat === "genel-destek") res = await api.importGenelDestek(files[i]);
        else if (cat === "bitkisel-destek") res = await api.importBitkiselDestek(files[i], year);
        else res = await api.importExcel(files[i], year);

        setResults((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "tamam", result: res } : r))
        );
      } catch (e) {
        const msg = (e as Error).message;
        const isDup = msg.includes("daha önce yüklenmiş") || msg.includes("409");
        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? { ...r, status: "hata", error: isDup ? "Bu dosya daha önce yüklendi" : msg }
              : r
          )
        );
      }
    }
    setRunning(false);
    setDone(true);
    onDone?.();
  }, [files, year, cat, donem, onDone]);

  const totalKayit = results
    .filter((r) => r.status === "tamam")
    .reduce((s, r) => s + (r.result?.eklenen ?? r.result?.koy_sayisi ?? 0), 0);
  const hatalar = results.filter((r) => r.status === "hata").length;
  const basarili = results.filter((r) => r.status === "tamam").length;

  const canProceed =
    step === 1 ||
    (files.length > 0 && !(cat === "sut" && !donem.trim()));

  const resetAll = () => {
    setStep(1);
    setFiles([]);
    setResults([]);
    setDone(false);
    setDonem("");
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,.45)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#fff", borderRadius: 16, width: "100%", maxWidth: 600,
          maxHeight: "92vh", display: "flex", flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,.25)", overflow: "hidden",
        }}
      >
        {/* ── BAŞLIK ── */}
        <div
          style={{
            background: "var(--gd)", padding: "16px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: "rgba(255,255,255,.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18,
              }}
            >
              📥
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 15, lineHeight: 1.2 }}>
                Veri Aktarımı
              </div>
              <div style={{ color: "rgba(255,255,255,.65)", fontSize: 11.5, marginTop: 1 }}>
                {step === 1 ? "Aktarılacak veri türünü seçin" :
                 step === 2 ? `${selectedCat.label} · ${selectedCat.needsYear ? year + " yılı" : "tüm dönemler"}` :
                 "Aktarım tamamlandı"}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8,
              width: 30, height: 30, cursor: "pointer", color: "#fff", fontSize: 16,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* ── ADIM GÖSTERGESİ ── */}
        <div
          style={{
            display: "flex", alignItems: "center",
            padding: "10px 20px", background: "#f8f9fa",
            borderBottom: "1px solid var(--br)", gap: 0,
          }}
        >
          {[
            { n: 1, label: "Tür Seçimi" },
            { n: 2, label: "Dosya Yükleme" },
            { n: 3, label: "Sonuç" },
          ].map((s, i) => (
            <div key={s.n} style={{ display: "flex", alignItems: "center", flex: i < 2 ? "1 1 0" : "0 0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div
                  style={{
                    width: 26, height: 26, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800,
                    background:
                      (done && s.n === 3) || step > s.n ? "var(--gm)" :
                      step === s.n ? "var(--gd)" : "var(--br2)",
                    color: step >= s.n || (done && s.n === 3) ? "#fff" : "#aaa",
                    flexShrink: 0,
                    transition: "all .2s",
                  }}
                >
                  {(step > s.n || (done && s.n === 3)) ? "✓" : s.n}
                </div>
                <span
                  style={{
                    fontSize: 11, fontWeight: step === s.n ? 800 : 600,
                    color: step === s.n ? "var(--gd)" : step > s.n ? "var(--gm)" : "var(--mu)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.label}
                </span>
              </div>
              {i < 2 && (
                <div
                  style={{
                    flex: 1, height: 2, margin: "0 10px",
                    background: step > s.n ? "var(--gm)" : "var(--br)",
                    borderRadius: 1, transition: "background .2s",
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* ── GÖVDE ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>

          {/* ADIM 1: Kategori */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {CAT_GROUPS.map((group) => (
                <div key={group.label}>
                  <div
                    style={{
                      fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                      letterSpacing: ".8px", color: group.color,
                      marginBottom: 8, display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <div style={{ flex: 1, height: 1, background: `${group.color}30` }} />
                    {group.label}
                    <div style={{ flex: 1, height: 1, background: `${group.color}30` }} />
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                      gap: 8,
                    }}
                  >
                    {group.items.map((ct) => (
                      <div
                        key={ct.id}
                        onClick={() => setCat(ct.id)}
                        style={{
                          padding: "11px 14px", borderRadius: 10, cursor: "pointer",
                          border: `2px solid ${cat === ct.id ? group.color : "var(--br)"}`,
                          background: cat === ct.id ? `${group.color}0d` : "#fff",
                          display: "flex", alignItems: "flex-start", gap: 10,
                          transition: "all .12s",
                        }}
                        onMouseEnter={(e) => {
                          if (cat !== ct.id)
                            (e.currentTarget as HTMLDivElement).style.borderColor = `${group.color}66`;
                        }}
                        onMouseLeave={(e) => {
                          if (cat !== ct.id)
                            (e.currentTarget as HTMLDivElement).style.borderColor = "var(--br)";
                        }}
                      >
                        <span style={{ fontSize: 22, lineHeight: 1, marginTop: 1 }}>{ct.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 12.5, fontWeight: 800,
                              color: cat === ct.id ? group.color : "var(--tx)",
                              lineHeight: 1.2,
                            }}
                          >
                            {ct.label}
                          </div>
                          <div style={{ fontSize: 10.5, color: "var(--mu)", marginTop: 2 }}>
                            {ct.desc}
                          </div>
                        </div>
                        {cat === ct.id && (
                          <div
                            style={{
                              width: 18, height: 18, borderRadius: "50%",
                              background: group.color,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              color: "#fff", fontSize: 10, fontWeight: 800, flexShrink: 0,
                            }}
                          >
                            ✓
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ADIM 2: Yıl + dosya */}
          {step === 2 && !done && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Seçilen kategori bilgi kartı */}
              <div
                style={{
                  padding: "11px 14px", borderRadius: 10,
                  background: "#f0f7ff", border: "1.5px solid #3b82f622",
                  display: "flex", alignItems: "flex-start", gap: 10,
                }}
              >
                <span style={{ fontSize: 22 }}>{selectedCat.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--tx)" }}>
                    {selectedCat.label}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--mu)", marginTop: 2 }}>
                    {selectedCat.hint || selectedCat.desc}
                  </div>
                  <div
                    style={{
                      fontSize: 10.5, color: "#3b82f6", fontWeight: 700,
                      marginTop: 4, display: "flex", gap: 8,
                    }}
                  >
                    <span>📎 Kabul edilen: {selectedCat.accept}</span>
                    {selectedCat.multi && <span>· Çoklu dosya desteklenir</span>}
                  </div>
                </div>
              </div>

              {/* Yıl seçimi */}
              {selectedCat.needsYear && cat !== "kooperatif" && (
                <div>
                  <label
                    style={{
                      display: "block", fontSize: 10.5, fontWeight: 800,
                      textTransform: "uppercase", letterSpacing: ".6px",
                      color: "var(--mu)", marginBottom: 5,
                    }}
                  >
                    📅 Yıl
                  </label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {YEARS.slice(0, 6).map((y) => (
                      <button
                        key={y}
                        onClick={() => setYear(y)}
                        style={{
                          padding: "7px 16px", borderRadius: 8, border: "2px solid",
                          borderColor: year === y ? "var(--gm)" : "var(--br2)",
                          background: year === y ? "var(--gm)" : "#fff",
                          color: year === y ? "#fff" : "var(--tx2)",
                          fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                          cursor: "pointer", transition: "all .12s",
                        }}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Süt dönemi */}
              {cat === "sut" && (
                <div>
                  <label
                    style={{
                      display: "block", fontSize: 10.5, fontWeight: 800,
                      textTransform: "uppercase", letterSpacing: ".6px",
                      color: "var(--mu)", marginBottom: 5,
                    }}
                  >
                    📋 Dönem Adı <span style={{ color: "var(--red)", fontWeight: 900 }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="örn: Temmuz-Ağustos-Eylül 2025"
                    value={donem}
                    onChange={(e) => setDonem(e.target.value)}
                    style={{
                      width: "100%", padding: "9px 12px",
                      border: `1.5px solid ${donem.trim() ? "var(--gm)" : "var(--br2)"}`,
                      borderRadius: 8, fontFamily: "inherit", fontSize: 13,
                      fontWeight: 600, outline: "none", boxSizing: "border-box",
                      color: "var(--tx)",
                    }}
                  />
                  {!donem.trim() && (
                    <div style={{ fontSize: 10.5, color: "var(--red)", marginTop: 4, fontWeight: 600 }}>
                      ⚠️ Dönem adı zorunludur
                    </div>
                  )}
                </div>
              )}

              {/* Dropzone */}
              <div>
                <label
                  style={{
                    display: "block", fontSize: 10.5, fontWeight: 800,
                    textTransform: "uppercase", letterSpacing: ".6px",
                    color: "var(--mu)", marginBottom: 5,
                  }}
                >
                  📁 Dosyalar
                </label>
                <div
                  style={{
                    border: `2px dashed ${drag ? "var(--gm)" : files.length ? "var(--gm)" : "var(--br2)"}`,
                    borderRadius: 12,
                    background: drag ? "var(--gp)" : files.length ? "#f0fdf4" : "#fafafa",
                    padding: "24px 20px",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all .15s",
                  }}
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
                  onClick={() => fileRef.current?.click()}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept={selectedCat.accept}
                    multiple
                    style={{ display: "none" }}
                    onChange={(e) => addFiles(e.target.files)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div style={{ fontSize: 30, marginBottom: 6 }}>
                    {drag ? "📂" : files.length ? "✅" : "📂"}
                  </div>
                  {files.length === 0 ? (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tx2)", marginBottom: 3 }}>
                        Dosyaları buraya sürükleyin
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--mu)" }}>
                        veya seçmek için tıklayın
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--gm)" }}>
                      {files.length} dosya seçildi — eklemek için tekrar tıklayın
                    </div>
                  )}
                </div>

                {/* Dosya listesi */}
                {files.length > 0 && (
                  <div
                    style={{
                      marginTop: 8, display: "flex", flexDirection: "column", gap: 4,
                      maxHeight: 180, overflowY: "auto",
                    }}
                  >
                    {files.map((f, i) => {
                      const r = results[i];
                      const isLoading = r?.status === "yukleniyor";
                      const isTamam = r?.status === "tamam";
                      const isHata = r?.status === "hata";
                      return (
                        <div
                          key={f.name}
                          style={{
                            display: "flex", alignItems: "center", gap: 9,
                            padding: "7px 10px", borderRadius: 8,
                            border: "1.5px solid",
                            borderColor: isTamam ? "#86efac" : isHata ? "#fca5a5" : isLoading ? "#fcd34d" : "var(--br)",
                            background: isTamam ? "#f0fdf4" : isHata ? "#fff5f5" : isLoading ? "#fffbeb" : "#fff",
                          }}
                        >
                          <span style={{ fontSize: 14, flexShrink: 0 }}>
                            {isLoading ? "⏳" : isTamam ? "✅" : isHata ? "❌" : "📄"}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12, fontWeight: 600, color: "var(--tx)",
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                              }}
                            >
                              {f.name}
                            </div>
                            <div style={{ fontSize: 10, color: "var(--mu)", marginTop: 1 }}>
                              {formatBytes(f.size)}
                              {isTamam && r?.result?.eklenen
                                ? ` · +${r.result.eklenen.toLocaleString("tr-TR")} kayıt eklendi`
                                : isTamam && r?.result?.koy_sayisi
                                  ? ` · ${r.result.koy_sayisi} köy kaydedildi`
                                  : isHata
                                    ? ` · Hata: ${r.error}`
                                    : isLoading ? " · Yükleniyor…" : ""}
                            </div>
                          </div>
                          {!running && !r && (
                            <button
                              onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                              style={{
                                background: "none", border: "none", cursor: "pointer",
                                color: "var(--mu)", fontSize: 14, flexShrink: 0,
                                borderRadius: 4, padding: "2px 4px",
                              }}
                              title="Dosyayı kaldır"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Yükleme ilerlemesi */}
              {running && (
                <div>
                  <div
                    style={{
                      display: "flex", justifyContent: "space-between",
                      fontSize: 11, fontWeight: 700, color: "var(--mu)", marginBottom: 5,
                    }}
                  >
                    <span>Yükleniyor…</span>
                    <span>
                      {results.filter((r) => r.status === "tamam" || r.status === "hata").length}
                      /{files.length} dosya
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6, background: "var(--br)", borderRadius: 3, overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%", background: "var(--gm)", borderRadius: 3,
                        width: `${(results.filter((r) => r.status === "tamam" || r.status === "hata").length / files.length) * 100}%`,
                        transition: "width .3s ease",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ADIM 3: Sonuç */}
          {done && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Özet banner */}
              <div
                style={{
                  padding: "16px 20px", borderRadius: 12, textAlign: "center",
                  background: hatalar === 0 ? "#f0fdf4" : "#fff5f5",
                  border: `2px solid ${hatalar === 0 ? "#86efac" : "#fca5a5"}`,
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 6 }}>
                  {hatalar === 0 ? "🎉" : "⚠️"}
                </div>
                <div
                  style={{
                    fontSize: 15, fontWeight: 800,
                    color: hatalar === 0 ? "#166534" : "#991b1b",
                    marginBottom: 4,
                  }}
                >
                  {hatalar === 0 ? "Tüm dosyalar başarıyla yüklendi!" :
                   basarili > 0 ? `${basarili} başarılı, ${hatalar} hatalı` : "Yükleme başarısız"}
                </div>
                {totalKayit > 0 && (
                  <div style={{ fontSize: 12, color: "#166534", fontWeight: 700 }}>
                    {totalKayit.toLocaleString("tr-TR")}{" "}
                    {cat === "hayvancilik" ? "köy kaydedildi" : "kayıt eklendi"}
                  </div>
                )}
              </div>

              {/* Özet istatistik */}
              <div
                style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                {[
                  { label: "Toplam Dosya", val: String(results.length), color: "#374151" },
                  { label: "Başarılı", val: String(basarili), color: "#166534" },
                  { label: "Hatalı", val: String(hatalar), color: hatalar > 0 ? "#991b1b" : "#aaa" },
                  {
                    label: cat === "hayvancilik" ? "Kaydedilen Köy" : "Eklenen Kayıt",
                    val: totalKayit.toLocaleString("tr-TR"),
                    color: "#1a5276",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      padding: "10px 14px", borderRadius: 9,
                      background: "#f8f9fa", border: "1px solid var(--br)",
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--mu)", marginBottom: 3 }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: "'JetBrains Mono',monospace" }}>
                      {s.val}
                    </div>
                  </div>
                ))}
              </div>

              {/* Dosya detay listesi */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--mu)", marginBottom: 2 }}>
                  Dosya Detayları
                </div>
                {results.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", alignItems: "center", gap: 9,
                      padding: "7px 10px", borderRadius: 8,
                      border: "1px solid",
                      borderColor: r.status === "tamam" ? "#86efac" : r.status === "hata" ? "#fca5a5" : "var(--br)",
                      background: r.status === "tamam" ? "#f0fdf4" : r.status === "hata" ? "#fff5f5" : "#fff",
                    }}
                  >
                    <span style={{ fontSize: 14, flexShrink: 0 }}>
                      {r.status === "tamam" ? "✅" : r.status === "hata" ? "❌" : "⏸"}
                    </span>
                    <span
                      style={{
                        flex: 1, fontSize: 11.5, fontWeight: 600,
                        color: "var(--tx)", overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}
                    >
                      {r.name}
                    </span>
                    <span
                      style={{
                        fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                        color: r.status === "tamam" ? "#166534" : r.status === "hata" ? "#991b1b" : "var(--mu)",
                      }}
                    >
                      {r.status === "tamam"
                        ? r.result?.eklenen
                          ? `+${r.result.eklenen.toLocaleString("tr-TR")} kayıt`
                          : `${r.result?.koy_sayisi} köy`
                        : r.status === "hata"
                          ? r.error?.slice(0, 35)
                          : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div
          style={{
            padding: "12px 20px", borderTop: "1px solid var(--br)",
            background: "#f8f9fa", display: "flex",
            justifyContent: "space-between", alignItems: "center", gap: 10,
          }}
        >
          {done ? (
            <>
              <button
                onClick={resetAll}
                style={{
                  padding: "9px 18px", borderRadius: 8,
                  border: "1.5px solid var(--br2)", background: "#fff",
                  cursor: "pointer", fontFamily: "inherit", fontSize: 12.5,
                  fontWeight: 700, color: "var(--tx2)",
                }}
              >
                ↩ Yeni Aktarım
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: "9px 22px", borderRadius: 8,
                  border: "none", background: "var(--gm)",
                  cursor: "pointer", fontFamily: "inherit", fontSize: 12.5,
                  fontWeight: 800, color: "#fff",
                }}
              >
                ✓ Kapat
              </button>
            </>
          ) : step === 1 ? (
            <>
              <button
                onClick={onClose}
                style={{
                  padding: "9px 18px", borderRadius: 8,
                  border: "1.5px solid var(--br2)", background: "#fff",
                  cursor: "pointer", fontFamily: "inherit", fontSize: 12.5,
                  fontWeight: 700, color: "var(--tx2)",
                }}
              >
                İptal
              </button>
              <button
                onClick={() => setStep(2)}
                style={{
                  padding: "9px 22px", borderRadius: 8,
                  border: "none", background: "var(--gd)",
                  cursor: "pointer", fontFamily: "inherit", fontSize: 12.5,
                  fontWeight: 800, color: "#fff", display: "flex",
                  alignItems: "center", gap: 6,
                }}
              >
                Devam <span style={{ fontSize: 14 }}>→</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setStep(1); setFiles([]); setResults([]); }}
                style={{
                  padding: "9px 18px", borderRadius: 8,
                  border: "1.5px solid var(--br2)", background: "#fff",
                  cursor: "pointer", fontFamily: "inherit", fontSize: 12.5,
                  fontWeight: 700, color: "var(--tx2)", display: "flex",
                  alignItems: "center", gap: 5,
                }}
              >
                <span style={{ fontSize: 14 }}>←</span> Geri
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {files.length > 0 && !running && (
                  <span style={{ fontSize: 11, color: "var(--mu)", fontWeight: 600 }}>
                    {files.length} dosya hazır
                  </span>
                )}
                <button
                  disabled={!files.length || running || (cat === "sut" && !donem.trim())}
                  onClick={handleUpload}
                  style={{
                    padding: "9px 22px", borderRadius: 8, border: "none",
                    background:
                      !files.length || (cat === "sut" && !donem.trim())
                        ? "var(--br2)"
                        : running
                          ? "var(--am)"
                          : "var(--gm)",
                    cursor: !files.length || running || (cat === "sut" && !donem.trim()) ? "default" : "pointer",
                    fontFamily: "inherit", fontSize: 12.5, fontWeight: 800,
                    color: "#fff", display: "flex", alignItems: "center", gap: 6,
                    transition: "background .15s",
                  }}
                >
                  {running ? (
                    <>
                      <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>
                      {results.filter((r) => r.status === "tamam" || r.status === "hata").length}/{files.length} yükleniyor
                    </>
                  ) : (
                    <>
                      📥 {files.length > 0 ? `${files.length} Dosyayı Aktar` : "Dosya Seçin"}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}