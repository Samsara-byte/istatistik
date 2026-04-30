// NEXT.JS → VİTE: process.env.NEXT_PUBLIC_API_URL → import.meta.env.VITE_API_URL
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export interface UretimRow { id?: number; uretim_yili?: number; il?: string; ilce?: string; koy?: string; urun?: string; tarim_sekli?: string; uretim_cesidi?: string; ekili_alan?: number; toplam_alan?: number; kayit_sayisi?: number; urun_cesidi?: number; koy_sayisi?: number; ilce_sayisi?: number; ciftci_sayisi?: number }
export interface ListResponse { data: UretimRow[]; total: number; page: number; pages: number; limit: number }
export interface OzetResponse { group_by: string; data: Record<string, unknown>[]; toplam_alan_da: number; toplam_kayit: number }
export interface ImportResponse { ok: boolean; ilce: string; yil: number; eklenen: number; silinen: number; atlandi: number; sure_sn: number }
export interface SutRow { il: string; ilce: string; koy: string; temel_sut_lt: number; destek_tutari: number; uretici_sayisi: number }
export interface SutListResponse { data: SutRow[]; total: number; page: number; pages: number; limit: number }
export interface SutOzet { toplam_sut_lt: number; toplam_tutar: number; uretici_sayisi: number; koy_sayisi: number; ilce_sayisi: number }
export interface SutImportResponse { ok: boolean; donem: string; yil: number; eklenen: number; silinen: number; sure_sn: number }
export interface BitkiselDestekRow { id: number; yil: number; il: string; ilce: string; koy: string; urun: string; feromon_adet: number; feromon_tuzak_adet: number; faydali_bocek_adet: number; desteklenen_alan_da: number; destek_tutari_tl: number; net_odeme_tl: number }
export interface KoopRow { id: number; ilce: string; koy_belde: string; koop_turu: string; baskan: string; telefon: string; ortak_sayisi: number | null }
export interface KoopListResponse { data: KoopRow[]; total: number; page: number; pages: number; limit: number }
export interface KoopOzet { data: { koop_turu: string; sayi: number; ilce_sayisi: number }[]; toplam: number }
export interface HayvRow { ilce: string; koy: string; sigir: number; manda: number; koyun: number; keci: number; sigir_isletme: number; manda_isletme: number; koyun_isletme: number; keci_isletme: number; toplam_isletme: number }
export interface HayvListResponse { data: HayvRow[]; total: number; page: number; pages: number; limit: number }
export interface HayvOzet { sigir_toplam: number; manda_toplam: number; koyun_toplam: number; keci_toplam: number; sigir_isletme: number; manda_isletme: number; koyun_isletme: number; keci_isletme: number; toplam_isletme: number; koy_sayisi: number }
export interface HayvImportResponse { ok: boolean; ilce: string; yil: number; koy_sayisi: number; silinen: number; sure_sn: number }

function qs(p: Record<string, unknown>) { const s = new URLSearchParams(); for (const [k,v] of Object.entries(p)) if (v!=null&&v!=='') s.set(k,String(v)); const r=s.toString(); return r?`?${r}`:''; }
async function get<T>(path: string, p: Record<string, unknown>={}): Promise<T> { const r=await fetch(`${BASE}${path}${qs(p)}`,{headers:{'Content-Type':'application/json'}}); if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.detail??`HTTP ${r.status}`)} return r.json(); }
async function postForm<T>(path: string, fd: FormData): Promise<T> { const r=await fetch(`${BASE}${path}`,{method:'POST',body:fd}); const j=await r.json(); if(!r.ok) throw new Error(typeof j.detail==='string'?j.detail:JSON.stringify(j)); return j; }

export const api = {
  listUretim: (p:{yil?:number;ilce?:string;koy?:string;urun?:string;tarim_sekli?:string;uretim_cesidi?:string;group_by?:string;sort_by?:string;sort_dir?:'asc'|'desc';page?:number;limit?:number}) => get<ListResponse>('/api/uretim',p as Record<string,unknown>),
  ozet: (p:{yil?:number;ilce?:string;group_by?:string;limit?:number}) => get<OzetResponse>('/api/uretim/ozet',p as Record<string,unknown>),
  urunler: (yil=2025,ilce?:string) => get<{data:{urun:string;toplam_alan:number}[]}>('/api/uretim/urunler',{yil,ilce}),
  ilceler: (yil=2025) => get<{data:{ilce:string;koy_sayisi:number;toplam_alan:number}[]}>('/api/uretim/ilceler',{yil}),
  log: (limit=20) => get<{data:Record<string,unknown>[]}>('/api/uretim/log',{limit}),
  importExcel: async(file:File,yil:string,truncate=true):Promise<ImportResponse> => { const fd=new FormData();fd.append('file',file);fd.append('yil',yil);fd.append('truncate',String(truncate));return postForm('/api/import',fd) },
  listHayvancilik: (p:{yil:number;ilce?:string;koy?:string;page?:number;limit?:number}) => get<HayvListResponse>('/api/hayvancilik',p),
  hayvOzet: (p:{yil:number;ilce?:string}) => get<HayvOzet>('/api/hayvancilik/ozet',p),
  importHayvancilik: async(file:File,yil:string,truncate=true):Promise<HayvImportResponse> => { const fd=new FormData();fd.append('yil',yil);fd.append('truncate',String(truncate));fd.append('file',file,file.name);return postForm('/api/import/hayvancilik',fd) },
  listKooperatif: (p:{ilce?:string;koop_turu?:string;ara?:string;page?:number;limit?:number}) => get<KoopListResponse>('/api/kooperatif',p),
  koopOzet: () => get<KoopOzet>('/api/kooperatif/ozet',{}),
  importKooperatif: async(file:File,truncate=true):Promise<ImportResponse> => { const fd=new FormData();fd.append('truncate',String(truncate));fd.append('file',file,file.name);return postForm('/api/import/kooperatif',fd) },
  listSut: (p:{yil?:number;donem?:string;ilce?:string;koy?:string;sort_by?:string;sort_dir?:'asc'|'desc';page?:number;limit?:number}) => get<SutListResponse>('/api/sut',p),
  sutOzet: (p:{yil?:number;ilce?:string}) => get<SutOzet>('/api/sut/ozet',p),
  sutDonemler: () => get<{data:{donem:string;yil:number}[]}>('/api/sut/donemler',{}),
  importSut: async(file:File,donem:string,yil:string,truncate=false):Promise<SutImportResponse> => { const fd=new FormData();fd.append('donem',donem);fd.append('yil',yil);fd.append('truncate',String(truncate));fd.append('file',file,file.name);return postForm('/api/import/sut',fd) },
  importAlanBazli: async(file:File,truncate=false) => { const fd=new FormData();fd.append('truncate',String(truncate));fd.append('file',file,file.name);return postForm<{ok:boolean;eklenen:number;silinen:number;sure_sn:number}>('/api/import/alan-bazli',fd) },
  importFarkPrim: async(file:File,truncate=false) => { const fd=new FormData();fd.append('truncate',String(truncate));fd.append('file',file,file.name);return postForm<{ok:boolean;eklenen:number;silinen:number;sure_sn:number}>('/api/import/fark-prim',fd) },
  importHayvDestek: async(file:File,truncate=false) => { const fd=new FormData();fd.append('truncate',String(truncate));fd.append('file',file,file.name);return postForm<{ok:boolean;eklenen:number;silinen:number;sure_sn:number}>('/api/import/hayvancilik-destek',fd) },
  importGenelDestek: async(file:File,truncate=false) => { const fd=new FormData();fd.append('truncate',String(truncate));fd.append('file',file,file.name);return postForm<{ok:boolean;eklenen:number;silinen:number;sure_sn:number}>('/api/import/genel-destek',fd) },
  listBitkiselDestek: (p:{yil?:number;ilce?:string;koy?:string;urun?:string;sort_by?:string;sort_dir?:'asc'|'desc';page?:number;limit?:number}) => get<{data:BitkiselDestekRow[];total:number;page:number;pages:number;limit:number}>('/api/bitkisel-destek',p as Record<string,unknown>),
  bitkiselDestekOzet: (p:{yil?:number;ilce?:string;group_by?:string}) => get<{group_by:string;data:Record<string,unknown>[]}>('/api/bitkisel-destek/ozet',p as Record<string,unknown>),
  importBitkiselDestek: async(file:File,yil:string,truncate=false) => { const fd=new FormData();fd.append('file',file,file.name);fd.append('yil',yil);fd.append('truncate',String(truncate));return postForm<{ok:boolean;yil:number;eklenen:number;guncellenen:number;sure_sn:number}>('/api/import/bitkisel-destek',fd) },
  importCksSayisi: async(file:File,yil:string) => { const fd=new FormData();fd.append('yil',yil);fd.append('truncate','false');fd.append('file',file,file.name);return postForm<{ok:boolean;yil:number;eklenen:number;silinen:number;sure_sn:number}>('/api/import/cks-sayisi',fd) },
}
