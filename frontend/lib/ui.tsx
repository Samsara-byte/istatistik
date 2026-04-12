'use client';
/**
 * Paylaşımlı UI bileşenleri — tek kaynak
 */
import React from 'react';
import VILLAGE_DATA from '@/data/villages.json';

export const ILCELER = [
  'AĞLASUN','ALTINYAYLA','BUCAK','ÇAVDIR','ÇELTİKÇİ',
  'GÖLHİSAR','KARAMANLI','KEMER','MERKEZ','TEFENNİ','YEŞİLOVA',
];

const VILLAGE_MAP = VILLAGE_DATA as Record<string, string[]>;
export function getVillages(ilce: string): string[] {
  if (!ilce) return [];
  const key = Object.keys(VILLAGE_MAP).find(
    k => k.toLocaleUpperCase('tr-TR') === ilce.toLocaleUpperCase('tr-TR')
  );
  return key ? VILLAGE_MAP[key] : [];
}

export const YEARS = ['2026','2025','2024','2023','2022','2021','2020'];

/* ── Form helpers ── */
export function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize:9, fontWeight:800, textTransform:'uppercase',
      letterSpacing:'.9px', color:'var(--mu)', display:'block', marginBottom:4 }}>
      {children}
    </label>
  );
}

const SEL_BASE: React.CSSProperties = {
  width:'100%', padding:'7px 26px 7px 9px', borderRadius:7,
  border:'1.5px solid var(--br2)', fontFamily:'inherit',
  fontSize:12, fontWeight:600, background:'#fff', color:'var(--tx2)',
  appearance:'none', cursor:'pointer',
  backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24'%3E%3Cpath fill='%2317472f' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E\")",
  backgroundRepeat:'no-repeat', backgroundPosition:'right 5px center',
};

export function Sel({ label, value, onChange, children, minWidth=110 }: {
  label:string; value:string; onChange:(v:string)=>void;
  children:React.ReactNode; minWidth?:number;
}) {
  return (
    <div style={{ flex:1, minWidth }}>
      <Label>{label}</Label>
      <select value={value} onChange={e=>onChange(e.target.value)} style={SEL_BASE}>{children}</select>
    </div>
  );
}

export function Inp({ label, value, onChange, placeholder, minWidth=110 }: {
  label:string; value:string; onChange:(v:string)=>void; placeholder?:string; minWidth?:number;
}) {
  return (
    <div style={{ flex:1, minWidth }}>
      <Label>{label}</Label>
      <input type="text" value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)}
        style={{ width:'100%', padding:'7px 9px', borderRadius:7, border:'1.5px solid var(--br2)',
          fontFamily:'inherit', fontSize:12, fontWeight:600, color:'var(--tx2)',
          outline:'none', boxSizing:'border-box' as const }} />
    </div>
  );
}

/* ── Layout wrappers ── */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding:'10px 14px', borderBottom:'1px solid var(--br)',
      background:'var(--sf2)',
      display:'grid',
      gridTemplateColumns:'repeat(auto-fill, minmax(130px, 1fr))',
      gap:'8px 10px',
      alignItems:'end',
    }}>
      {children}
    </div>
  );
}

export function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--br)',
      display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
      {children}
    </div>
  );
}

/* ── Buttons ── */
export function ResetBtn({ onClick }: { onClick:()=>void }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-end' }}>
      <button onClick={onClick} style={{
        width:'100%', padding:'7px 10px', border:'1.5px solid var(--br2)',
        borderRadius:7, background:'#fff', cursor:'pointer', fontSize:11,
        fontWeight:700, color:'var(--mu)', fontFamily:'inherit',
        transition:'border-color .12s, color .12s',
      }}
        onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='var(--gm)';(e.currentTarget as HTMLButtonElement).style.color='var(--gm)';}}
        onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='var(--br2)';(e.currentTarget as HTMLButtonElement).style.color='var(--mu)';}}>
        ↺ Sıfırla
      </button>
    </div>
  );
}

export function ExcelBtn({ onClick, disabled, loading }: {
  onClick:()=>void; disabled?:boolean; loading?:boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled||loading} style={{
      padding:'6px 13px', borderRadius:7, border:'none',
      cursor:(disabled||loading)?'default':'pointer',
      background:disabled?'var(--br2)':'var(--gm)', color:'#fff',
      fontSize:11, fontWeight:700, fontFamily:'inherit',
      display:'flex', alignItems:'center', gap:5,
      opacity:loading?.6:1, transition:'opacity .2s, background .15s',
      whiteSpace:'nowrap',
    }}>
      {loading ? '⏳' : '⬇'} Excel
    </button>
  );
}

/* ── Sortable table header ── */
export type SortDir = 'asc' | 'desc' | null;

export function SortableTh({ label, sortKey, currentSort, onSort, align='right', width }: {
  label:string; sortKey:string;
  currentSort:{ key:string; dir:SortDir };
  onSort:(key:string)=>void;
  align?:'left'|'right'|'center';
  width?:number;
}) {
  const active = currentSort.key === sortKey && currentSort.dir !== null;
  const dir    = currentSort.dir;

  const SortIcon = () => (
    <span style={{ display:'inline-flex', flexDirection:'column', gap:0, marginLeft:4,
      verticalAlign:'middle', lineHeight:1, opacity: active ? 1 : 0.35 }}>
      <span style={{ fontSize:7, lineHeight:'7px',
        color: active && dir==='asc' ? '#fff' : 'rgba(255,255,255,.5)' }}>▲</span>
      <span style={{ fontSize:7, lineHeight:'7px',
        color: active && dir==='desc' ? '#fff' : 'rgba(255,255,255,.5)' }}>▼</span>
    </span>
  );

  return (
    <th onClick={()=>onSort(sortKey)} title={`${label} — sıralamak için tıklayın`}
      style={{
        padding:'7px 10px', textAlign:align,
        color: active ? '#fff' : 'rgba(255,255,255,.8)',
        fontSize:10.5, fontWeight: active ? 800 : 700,
        whiteSpace:'nowrap', cursor:'pointer', userSelect:'none',
        background: active ? 'rgba(255,255,255,.14)' : 'transparent',
        borderBottom: active ? '2px solid rgba(255,255,255,.4)' : '2px solid transparent',
        transition:'all .12s',
        width: width ?? undefined,
      }}>
      <span style={{ display:'inline-flex', alignItems:'center', gap:2 }}>
        {label}<SortIcon />
      </span>
    </th>
  );
}

/* ── Pagination ── */
export function Pagination({ page, pages, total, onPage, unit='kayıt' }: {
  page:number; pages:number; total:number; onPage:(p:number)=>void; unit?:string;
}) {
  if (pages <= 1) return null;
  const start = Math.max(1, Math.min(pages-6, page-3));
  const btn = (label:React.ReactNode, p:number, dis:boolean) => (
    <button key={String(label)} onClick={()=>!dis&&onPage(p)} disabled={dis} style={{
      minWidth:28, height:28, border:'1.5px solid',
      borderColor: p===page&&typeof p==='number' ? 'var(--gd)' : 'var(--br2)',
      borderRadius:5, fontFamily:'inherit', fontSize:11, cursor:dis?'default':'pointer',
      fontWeight: p===page&&typeof p==='number' ? 800 : 600,
      background: p===page&&typeof p==='number' ? 'var(--gd)' : '#fff',
      color: dis ? 'var(--br2)' : p===page&&typeof p==='number' ? '#fff' : 'var(--tx2)',
    }}>{label}</button>
  );
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      gap:4, padding:'8px 14px', borderTop:'1px solid var(--br)',
      background:'var(--sf2)', flexWrap:'wrap' }}>
      {btn('«', 1, page===1)}
      {btn('‹', page-1, page===1)}
      {Array.from({length:Math.min(7,pages)},(_,i)=>btn(start+i, start+i, false))}
      {btn('›', page+1, page===pages)}
      {btn('»', pages, page===pages)}
      <span style={{ fontSize:10, color:'var(--mu)', fontWeight:600, marginLeft:4 }}>
        {page}/{pages} · {total.toLocaleString('tr-TR')} {unit}
      </span>
    </div>
  );
}

/* ── Sıralama yardımcısı ── */
export function useSortState(defaultKey='', defaultDir:SortDir=null) {
  const [sort, setSort] = React.useState<{ key:string; dir:SortDir }>({ key:defaultKey, dir:defaultDir });
  const onSort = React.useCallback((key:string) => {
    setSort(prev => prev.key===key
      ? { key, dir: prev.dir===null ? 'asc' : prev.dir==='asc' ? 'desc' : null }
      : { key, dir:'asc' }
    );
  }, []);
  const resetSort = React.useCallback(() => setSort({ key:defaultKey, dir:defaultDir }), [defaultKey, defaultDir]);
  return { sort, onSort, resetSort };
}

export function applySortRows<T extends Record<string,unknown>>(rows:T[], sort:{ key:string; dir:SortDir }): T[] {
  if (!sort.dir || !sort.key) return rows;
  return [...rows].sort((a,b) => {
    const av = a[sort.key]; const bv = b[sort.key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1; if (bv == null) return -1;
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv), 'tr');
    return sort.dir === 'asc' ? cmp : -cmp;
  });
}

/* ── Formatlamak ── */
export function fmt(v:unknown): string {
  if (v == null) return '—';
  const n = Number(v);
  return isNaN(n) ? String(v) : n.toLocaleString('tr-TR', { maximumFractionDigits:2 });
}

/* ── Loading/Empty states ── */
export function LoadingRow({ cols }: { cols:number }) {
  return (
    <tr><td colSpan={cols} style={{ padding:40, textAlign:'center', color:'var(--mu)', fontSize:13 }}>
      ⏳ Yükleniyor…
    </td></tr>
  );
}

export function EmptyRow({ cols, text='Sonuç bulunamadı' }: { cols:number; text?:string }) {
  return (
    <tr><td colSpan={cols} style={{ padding:36, textAlign:'center', color:'var(--mu)', fontStyle:'italic', fontSize:13 }}>
      {text}
    </td></tr>
  );
}
