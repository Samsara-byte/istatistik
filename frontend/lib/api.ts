/**
 * FastAPI backend — tip güvenli API istemcisi
 */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Tipler ─────────────────────────────────────────────────────────
export interface UretimRow {
  id?: number;
  uretim_yili?: number;
  il?: string;
  ilce?: string;
  koy?: string;
  urun?: string;
  tarim_sekli?: string;
  uretim_cesidi?: string;
  ekili_alan?: number;
  toplam_alan?: number;
  kayit_sayisi?: number;
  urun_cesidi?: number;
  koy_sayisi?: number;
  ilce_sayisi?: number;
  ciftci_sayisi?: number;
}
export interface ListResponse {
  data: UretimRow[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}
export interface OzetResponse {
  group_by: string;
  data: Record<string, unknown>[];
  toplam_alan_da: number;
  toplam_kayit: number;
}
export interface ImportResponse {
  ok: boolean;
  ilce: string;
  yil: number;
  eklenen: number;
  silinen: number;
  atlandi: number;
  sure_sn: number;
}

export interface SutRow {
  il: string;
  ilce: string;
  koy: string;
  temel_sut_lt: number;
  destek_tutari: number;
  uretici_sayisi: number;
}
export interface SutListResponse {
  data: SutRow[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}
export interface SutOzet {
  toplam_sut_lt: number;
  toplam_tutar: number;
  uretici_sayisi: number;
  koy_sayisi: number;
  ilce_sayisi: number;
}
export interface SutImportResponse {
  ok: boolean;
  donem: string;
  yil: number;
  eklenen: number;
  silinen: number;
  sure_sn: number;
}

export interface BitkiselDestekRow {
  id: number;
  yil: number;
  il: string;
  ilce: string;
  koy: string;
  urun: string;
  feromon_adet: number;
  feromon_tuzak_adet: number;
  faydali_bocek_adet: number;
  desteklenen_alan_da: number;
  destek_tutari_tl: number;
  net_odeme_tl: number;
}

export interface KoopRow {
  id: number;
  ilce: string;
  koy_belde: string;
  koop_turu: string;
  baskan: string;
  telefon: string;
  ortak_sayisi: number | null;
}
export interface KoopListResponse {
  data: KoopRow[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}
export interface KoopOzet {
  data: { koop_turu: string; sayi: number; ilce_sayisi: number }[];
  toplam: number;
}

export interface HayvRow {
  ilce: string;
  koy: string;
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
export interface HayvListResponse {
  data: HayvRow[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}
export interface HayvOzet {
  sigir_toplam: number;
  manda_toplam: number;
  koyun_toplam: number;
  keci_toplam: number;
  sigir_isletme: number;
  manda_isletme: number;
  koyun_isletme: number;
  keci_isletme: number;
  toplam_isletme: number;
  koy_sayisi: number;
}
export interface HayvImportResponse {
  ok: boolean;
  ilce: string;
  yil: number;
  koy_sayisi: number;
  silinen: number;
  sure_sn: number;
}

// ── Yardımcı ───────────────────────────────────────────────────────
function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function get<T>(
  path: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}${qs(params)}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

async function postForm<T>(path: string, fd: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "POST", body: fd });
  const json = await res.json();
  if (!res.ok)
    throw new Error(
      typeof json.detail === "string"
        ? json.detail
        : Array.isArray(json.detail)
          ? json.detail
              .map(
                (e: { loc: string[]; msg: string }) =>
                  `${e.loc.join(".")}: ${e.msg}`,
              )
              .join("; ")
          : JSON.stringify(json),
    );
  return json;
}

// ── API ────────────────────────────────────────────────────────────
export const api = {
  // Üretim
  listUretim(p: {
    yil?: number;
    ilce?: string;
    koy?: string;
    urun?: string;
    tarim_sekli?: string;
    uretim_cesidi?: string;
    group_by?: string;
    sort_by?: string;
    sort_dir?: "asc" | "desc";
    page?: number;
    limit?: number;
  }): Promise<ListResponse> {
    return get("/api/uretim", p as Record<string, unknown>);
  },
  ozet(p: {
    yil?: number;
    ilce?: string;
    group_by?: string;
    limit?: number;
  }): Promise<OzetResponse> {
    return get("/api/uretim/ozet", p as Record<string, unknown>);
  },
  urunler(yil = 2025, ilce?: string) {
    return get<{ data: { urun: string; toplam_alan: number }[] }>(
      "/api/uretim/urunler",
      { yil, ilce },
    );
  },
  ilceler(yil = 2025) {
    return get<{
      data: { ilce: string; koy_sayisi: number; toplam_alan: number }[];
    }>("/api/uretim/ilceler", { yil });
  },
  log(limit = 20) {
    return get<{ data: Record<string, unknown>[] }>("/api/uretim/log", {
      limit,
    });
  },

  async importExcel(
    file: File,
    yil: string,
    truncate = true,
  ): Promise<ImportResponse> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("yil", yil);
    fd.append("truncate", String(truncate));
    return postForm("/api/import", fd);
  },

  // Hayvancılık istatistik
  listHayvancilik(p: {
    yil: number;
    ilce?: string;
    koy?: string;
    page?: number;
    limit?: number;
  }) {
    return get<HayvListResponse>("/api/hayvancilik", p);
  },
  hayvOzet(p: { yil: number; ilce?: string }) {
    return get<HayvOzet>("/api/hayvancilik/ozet", p);
  },
  async importHayvancilik(
    file: File,
    yil: string,
    truncate = true,
  ): Promise<HayvImportResponse> {
    const fd = new FormData();
    fd.append("yil", yil);
    fd.append("truncate", String(truncate));
    fd.append("file", file, file.name);
    return postForm("/api/import/hayvancilik", fd);
  },

  // Kooperatif
  listKooperatif(p: {
    ilce?: string;
    koop_turu?: string;
    ara?: string;
    page?: number;
    limit?: number;
  }) {
    return get<KoopListResponse>("/api/kooperatif", p);
  },
  koopOzet() {
    return get<KoopOzet>("/api/kooperatif/ozet", {});
  },
  async importKooperatif(file: File, truncate = true): Promise<ImportResponse> {
    const fd = new FormData();
    fd.append("truncate", String(truncate));
    fd.append("file", file, file.name);
    return postForm("/api/import/kooperatif", fd);
  },

  // Süt destekleme
  listSut(p: {
    yil?: number;
    donem?: string;
    ilce?: string;
    koy?: string;
    sort_by?: string;
    sort_dir?: "asc" | "desc";
    page?: number;
    limit?: number;
  }) {
    return get<SutListResponse>("/api/sut", p);
  },
  sutOzet(p: { yil?: number; ilce?: string }) {
    return get<SutOzet>("/api/sut/ozet", p);
  },
  sutDonemler() {
    return get<{ data: { donem: string; yil: number }[] }>(
      "/api/sut/donemler",
      {},
    );
  },
  async importSut(
    file: File,
    donem: string,
    yil: string,
    truncate = false,
  ): Promise<SutImportResponse> {
    const fd = new FormData();
    fd.append("donem", donem);
    fd.append("yil", yil);
    fd.append("truncate", String(truncate));
    fd.append("file", file, file.name);
    return postForm("/api/import/sut", fd);
  },

  // Alan bazlı destekler
  async importAlanBazli(
    file: File,
    truncate = false,
  ): Promise<{
    ok: boolean;
    eklenen: number;
    silinen: number;
    sure_sn: number;
  }> {
    const fd = new FormData();
    fd.append("truncate", String(truncate));
    fd.append("file", file, file.name);
    return postForm("/api/import/alan-bazli", fd);
  },

  // Fark/Prim ödemeleri
  async importFarkPrim(
    file: File,
    truncate = false,
  ): Promise<{
    ok: boolean;
    eklenen: number;
    silinen: number;
    sure_sn: number;
  }> {
    const fd = new FormData();
    fd.append("truncate", String(truncate));
    fd.append("file", file, file.name);
    return postForm("/api/import/fark-prim", fd);
  },

  // Hayvancılık destekleri
  async importHayvDestek(
    file: File,
    truncate = false,
  ): Promise<{
    ok: boolean;
    eklenen: number;
    silinen: number;
    sure_sn: number;
  }> {
    const fd = new FormData();
    fd.append("truncate", String(truncate));
    fd.append("file", file, file.name);
    return postForm("/api/import/hayvancilik-destek", fd);
  },

  // Genel Destekler
  async importGenelDestek(
    file: File,
    truncate = false,
  ): Promise<{
    ok: boolean;
    eklenen: number;
    silinen: number;
    sure_sn: number;
  }> {
    const fd = new FormData();
    fd.append("truncate", String(truncate));
    fd.append("file", file, file.name);
    return postForm("/api/import/genel-destek", fd);
  },

  // Bitkisel destekler
  listBitkiselDestek(p: {
    yil?: number;
    ilce?: string;
    koy?: string;
    urun?: string;
    sort_by?: string;
    sort_dir?: "asc" | "desc";
    page?: number;
    limit?: number;
  }) {
    return get<{
      data: BitkiselDestekRow[];
      total: number;
      page: number;
      pages: number;
      limit: number;
    }>("/api/bitkisel-destek", p as Record<string, unknown>);
  },
  bitkiselDestekOzet(p: { yil?: number; ilce?: string; group_by?: string }) {
    return get<{ group_by: string; data: Record<string, unknown>[] }>(
      "/api/bitkisel-destek/ozet",
      p as Record<string, unknown>,
    );
  },
  async importBitkiselDestek(
    file: File,
    yil: string,
    truncate = false,
  ): Promise<{
    ok: boolean;
    yil: number;
    eklenen: number;
    guncellenen: number;
    sure_sn: number;
  }> {
    const fd = new FormData();
    fd.append("file", file, file.name);
    fd.append("yil", yil);
    fd.append("truncate", String(truncate));
    return postForm("/api/import/bitkisel-destek", fd);
  },

  // ÇKS Çiftçi Sayısı
  async importCksSayisi(
    file: File,
    yil: string,
  ): Promise<{
    ok: boolean;
    yil: number;
    eklenen: number;
    silinen: number;
    sure_sn: number;
  }> {
    const fd = new FormData();
    fd.append("yil", yil);
    fd.append("truncate", "false");
    fd.append("file", file, file.name);
    return postForm("/api/import/cks-sayisi", fd);
  },
};
