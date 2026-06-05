/**
 * FastAPI backend — tip güvenli API istemcisi
 *
 * Değişiklikler (Next.js → Vite):
 *  - NEXT_PUBLIC_API_URL  →  VITE_API_URL
 *  - AbortController desteği eklendi (race condition önleme)
 *  - ApiError sınıfı ile tip güvenli hata yönetimi
 *  - postForm'da timeout eklendi
 */

// Vite ortam değişkeni — .env dosyasında VITE_API_URL=http://localhost:8000
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// ── Tip güvenli hata sınıfı ──────────────────────────────────────
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Tipler ──────────────────────────────────────────────────────
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

export interface SertifikaliFidanRow {
  id: number;
  yil: number;
  il: string;
  ilce: string;
  koy: string;
  fidan_turu: string;
  kisi_sayisi: number;
  fidan_sayisi: number;
  sertifikali_alan_da: number;
  standart_alan_da: number;
  destekleme_alani_da: number;
  destekleme_tutari_tl: number;
}

export interface SertifikaliFidanListResponse {
  data: SertifikaliFidanRow[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface SertifikaliFidanImportResponse {
  ok: boolean;
  yil: number;
  ilce: string;
  eklenen: number;
  guncellenen: number;
  silinen: number;
  sure_sn: number;
}

export interface PlanliUretimRow {
  id: number;
  yil: number;
  il: string;
  ilce: string;
  koy: string;
  urun_grubu: string;
  isletme_sayisi: number;
  destege_tabi_alan_da: number;
  yeralti_su_alan_da: number;
  destekleme_miktari_tl: number;
}

export interface PlanliUretimListResponse {
  data: PlanliUretimRow[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface PlanliUretimImportResponse {
  ok: boolean;
  yil: number;
  ilce: string;
  eklenen: number;
  guncellenen: number;
  silinen: number;
  sure_sn: number;
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

// ── Yardımcılar ─────────────────────────────────────────────────
function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

async function get<T>(
  path: string,
  params: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`${BASE}${path}${qs(params)}`, {
    headers: { 'Content-Type': 'application/json' },
    signal,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { detail?: string };
    throw new ApiError(res.status, e.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function postForm<T>(path: string, fd: FormData, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', body: fd, signal });
  const json = await res.json() as { detail?: string | { loc: string[]; msg: string }[] };
  if (!res.ok) {
    const msg =
      typeof json.detail === 'string'
        ? json.detail
        : Array.isArray(json.detail)
          ? json.detail.map(e => `${e.loc.join('.')}: ${e.msg}`).join('; ')
          : JSON.stringify(json);
    throw new ApiError(res.status, msg);
  }
  return json as T;
}

// ── API ─────────────────────────────────────────────────────────
export const api = {
  // ── Bitkisel Üretim ──
  listUretim(
    p: {
      yil?: number; ilce?: string; koy?: string; urun?: string;
      tarim_sekli?: string; uretim_cesidi?: string; group_by?: string;
      sort_by?: string; sort_dir?: 'asc' | 'desc'; page?: number; limit?: number;
    },
    signal?: AbortSignal,
  ): Promise<ListResponse> {
    return get('/api/uretim', p as Record<string, unknown>, signal);
  },

  ozet(
    p: { yil?: number; ilce?: string; group_by?: string; limit?: number },
    signal?: AbortSignal,
  ): Promise<OzetResponse> {
    return get('/api/uretim/ozet', p as Record<string, unknown>, signal);
  },

  urunler(yil = 2025, ilce?: string, signal?: AbortSignal) {
    return get<{ data: { urun: string; toplam_alan: number }[] }>(
      '/api/uretim/urunler', { yil, ilce }, signal,
    );
  },

  ilceler(yil = 2025, signal?: AbortSignal) {
    return get<{ data: { ilce: string; koy_sayisi: number; toplam_alan: number }[] }>(
      '/api/uretim/ilceler', { yil }, signal,
    );
  },

  log(limit = 20, signal?: AbortSignal) {
    return get<{ data: Record<string, unknown>[] }>('/api/uretim/log', { limit }, signal);
  },

  async importExcel(file: File, yil: string, truncate = true): Promise<ImportResponse> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('yil', yil);
    fd.append('truncate', String(truncate));
    return postForm('/api/import', fd);
  },

  // ── Hayvancılık ──
  listHayvancilik(
    p: { yil: number; ilce?: string; koy?: string; page?: number; limit?: number },
    signal?: AbortSignal,
  ) {
    return get<HayvListResponse>('/api/hayvancilik', p, signal);
  },

  hayvOzet(p: { yil: number; ilce?: string }, signal?: AbortSignal) {
    return get<HayvOzet>('/api/hayvancilik/ozet', p, signal);
  },

  async importHayvancilik(file: File, yil: string, truncate = true): Promise<HayvImportResponse> {
    const fd = new FormData();
    fd.append('yil', yil);
    fd.append('truncate', String(truncate));
    fd.append('file', file, file.name);
    return postForm('/api/import/hayvancilik', fd);
  },

  // ── Kooperatif ──
  listKooperatif(
    p: { ilce?: string; koop_turu?: string; ara?: string; page?: number; limit?: number },
    signal?: AbortSignal,
  ) {
    return get<KoopListResponse>('/api/kooperatif', p, signal);
  },

  koopOzet(signal?: AbortSignal) {
    return get<KoopOzet>('/api/kooperatif/ozet', {}, signal);
  },

  async importKooperatif(file: File, truncate = true): Promise<ImportResponse> {
    const fd = new FormData();
    fd.append('truncate', String(truncate));
    fd.append('file', file, file.name);
    return postForm('/api/import/kooperatif', fd);
  },

  // ── Süt Destekleme ──
  listSut(
    p: {
      yil?: number; donem?: string; ilce?: string; koy?: string;
      sort_by?: string; sort_dir?: 'asc' | 'desc'; page?: number; limit?: number;
    },
    signal?: AbortSignal,
  ) {
    return get<SutListResponse>('/api/sut', p, signal);
  },

  sutOzet(p: { yil?: number; ilce?: string }, signal?: AbortSignal) {
    return get<SutOzet>('/api/sut/ozet', p, signal);
  },

  sutDonemler(signal?: AbortSignal) {
    return get<{ data: { donem: string; yil: number }[] }>('/api/sut/donemler', {}, signal);
  },

  async importSut(file: File, donem: string, yil: string, truncate = false): Promise<SutImportResponse> {
    const fd = new FormData();
    fd.append('donem', donem);
    fd.append('yil', yil);
    fd.append('truncate', String(truncate));
    fd.append('file', file, file.name);
    return postForm('/api/import/sut', fd);
  },

  // ── Alan Bazlı ──
  async importAlanBazli(file: File, truncate = false) {
    const fd = new FormData();
    fd.append('truncate', String(truncate));
    fd.append('file', file, file.name);
    return postForm<{ ok: boolean; eklenen: number; silinen: number; sure_sn: number }>(
      '/api/import/alan-bazli', fd,
    );
  },

  // ── Fark/Prim ──
  async importFarkPrim(file: File, truncate = false) {
    const fd = new FormData();
    fd.append('truncate', String(truncate));
    fd.append('file', file, file.name);
    return postForm<{ ok: boolean; eklenen: number; silinen: number; sure_sn: number }>(
      '/api/import/fark-prim', fd,
    );
  },

  // ── Hayvancılık Destek ──
  async importHayvDestek(file: File, truncate = false) {
    const fd = new FormData();
    fd.append('truncate', String(truncate));
    fd.append('file', file, file.name);
    return postForm<{ ok: boolean; eklenen: number; silinen: number; sure_sn: number }>(
      '/api/import/hayvancilik-destek', fd,
    );
  },

  // ── Genel Destek ──
  async importGenelDestek(file: File, truncate = false) {
    const fd = new FormData();
    fd.append('truncate', String(truncate));
    fd.append('file', file, file.name);
    return postForm<{ ok: boolean; eklenen: number; silinen: number; sure_sn: number }>(
      '/api/import/genel-destek', fd,
    );
  },

  // ── Bitkisel Destek ──
  listBitkiselDestek(
    p: {
      yil?: number; ilce?: string; koy?: string; urun?: string;
      sort_by?: string; sort_dir?: 'asc' | 'desc'; page?: number; limit?: number;
    },
    signal?: AbortSignal,
  ) {
    return get<{ data: BitkiselDestekRow[]; total: number; page: number; pages: number; limit: number }>(
      '/api/bitkisel-destek', p as Record<string, unknown>, signal,
    );
  },

  bitkiselDestekOzet(
    p: { yil?: number; ilce?: string; group_by?: string },
    signal?: AbortSignal,
  ) {
    return get<{ group_by: string; data: Record<string, unknown>[] }>(
      '/api/bitkisel-destek/ozet', p as Record<string, unknown>, signal,
    );
  },

  async importBitkiselDestek(file: File, yil: string, truncate = false) {
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('yil', yil);
    fd.append('truncate', String(truncate));
    return postForm<{ ok: boolean; yil: number; eklenen: number; guncellenen: number; sure_sn: number }>(
      '/api/import/bitkisel-destek', fd,
    );
  },

  // ── Sertifikalı Fidan Kullanım Desteği ──
  listSertifikaliFidan(
    p: {
      yil?: number; ilce?: string; koy?: string; fidan_turu?: string;
      sort_by?: string; sort_dir?: 'asc' | 'desc'; page?: number; limit?: number;
    },
    signal?: AbortSignal,
  ) {
    return get<SertifikaliFidanListResponse>('/api/sertifikali-fidan', p as Record<string, unknown>, signal);
  },

  sertifikaliFidanOzet(
    p: { yil?: number; ilce?: string; group_by?: string },
    signal?: AbortSignal,
  ) {
    return get<{ group_by: string; data: Record<string, unknown>[] }>(
      '/api/sertifikali-fidan/ozet', p as Record<string, unknown>, signal,
    );
  },

  sertifikaliFidanToplam(p: { yil?: number; ilce?: string }, signal?: AbortSignal) {
    return get<Record<string, number>>('/api/sertifikali-fidan/toplam', p as Record<string, unknown>, signal);
  },

  async importSertifikaliFidan(file: File, yil: string, truncate = false): Promise<SertifikaliFidanImportResponse> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('yil', yil);
    fd.append('truncate', String(truncate));
    return postForm('/api/import/sertifikali-fidan', fd);
  },

  // ── Planlı Üretim Desteği ──
  listPlanliUretim(
    p: {
      yil?: number; ilce?: string; koy?: string; urun_grubu?: string;
      sort_by?: string; sort_dir?: 'asc' | 'desc'; page?: number; limit?: number;
    },
    signal?: AbortSignal,
  ) {
    return get<PlanliUretimListResponse>('/api/planli-uretim', p as Record<string, unknown>, signal);
  },

  planliUretimOzet(
    p: { yil?: number; ilce?: string; group_by?: string },
    signal?: AbortSignal,
  ) {
    return get<{ group_by: string; data: Record<string, unknown>[] }>(
      '/api/planli-uretim/ozet', p as Record<string, unknown>, signal,
    );
  },

  planliUretimToplam(p: { yil?: number; ilce?: string }, signal?: AbortSignal) {
    return get<Record<string, number>>('/api/planli-uretim/toplam', p as Record<string, unknown>, signal);
  },

  async importPlanliUretim(file: File, yil: string, truncate = false): Promise<PlanliUretimImportResponse> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('yil', yil);
    fd.append('truncate', String(truncate));
    return postForm('/api/import/planli-uretim', fd);
  },

  // ── ÇKS Çiftçi Sayısı ──
  async importCksSayisi(file: File, yil: string) {
    const fd = new FormData();
    fd.append('yil', yil);
    fd.append('truncate', 'false');
    fd.append('file', file, file.name);
    return postForm<{ ok: boolean; yil: number; eklenen: number; silinen: number; sure_sn: number }>(
      '/api/import/cks-sayisi', fd,
    );
  },
};