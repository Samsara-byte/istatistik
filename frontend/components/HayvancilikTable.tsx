'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, type HayvRow } from '@/lib/api';
import * as XLSX from 'xlsx';
import {
  ILCELER, getVillages, Sel, FilterBar, TableHeader, ResetBtn, ExcelBtn,
  SortableTh, Pagination, fmt, YEARS, useSortState, applySortRows, LoadingRow, EmptyRow,
} from '@/lib/ui';

const ANIMALS = [
  { key:'sigir', ik:'sigir_isletme', label:'Sığır', color:'#2d6a4f' },
  { key:'manda', ik:'manda_isletme', label:'Manda', color:'#6b4226' },
  { key:'koyun', ik:'koyun_isletme', label:'Koyun', color:'#7b6fa0' },
  { key:'keci',  ik:'keci_isletme',  label:'Keçi',  color:'#b5722a' },
];
type Col = { key:string; label:string; color:string; isText?:boolean };
const COLS: Col[] = [
  { key:'ilce', label:'İlçe', color:'', isText:true },
  { key:'koy',  label:'Köy',  color:'', isText:true },
  { key:'sigir',         label:'Sığır',         color:'#2d6a4f' },
  { key:'sigir_isletme', label:'Sığır İşl.',     color:'#2d6a4f' },
  { key:'manda',         label:'Manda',          color:'#6b4226' },
  { key:'manda_isletme', label:'Manda İşl.',     color:'#6b4226' },
  { key:'koyun',         label:'Koyun',          color:'#7b6fa0' },
  { key:'koyun_isletme', label:'Koyun İşl.',     color:'#7b6fa0' },
  { key:'keci',          label:'Keçi',           color:'#b5722a' },
  { key:'keci_isletme',  label:'Keçi İşl.',      color:'#b5722a' },
  { key:'toplam_isletme',label:'Toplam İşletme', color:'#1a3a2a' },
];
const BORDER_KEYS = new Set(['sigir','manda','koyun','keci','toplam_isletme']);

export default function HayvancilikTable({ defaultIlce='', defaultKoy='' }: { defaultIlce?:string; defaultKoy?:string }) {
  const [yil,  setYil]  = useState('2025');
  const [ilce, setIlce] = useState(defaultIlce.toLocaleUpperCase('tr-TR'));
  const [koy,  setKoy]  = useState(defaultKoy);
  const [data, setData]  = useState<HayvRow[]>([]);
  const [ozet, setOzet]  = useState<Record<string,number>>({});
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page,  setPage]  = useState(1);
  const [loading,   setLoading]   = useState(false);
  const [exporting, setExporting] = useState(false);
  const { sort, onSort, resetSort } = useSortState();
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { setIlce(defaultIlce.toLocaleUpperCase('tr-TR')); }, [defaultIlce]);
  useEffect(() => { setKoy(defaultKoy); }, [defaultKoy]);
  const villages = getVillages(ilce);
  const sorted = applySortRows(data as Record<string,unknown>[], sort) as HayvRow[];

  const fetchData = useCallback(async (pg: number) => {
    setLoading(true);
    try {
      const [res, oz] = await Promise.all([
        api.listHayvancilik({ yil:parseInt(yil), ilce:ilce||undefined, koy:koy||undefined, page:pg, limit:100 }),
        api.hayvOzet({ yil:parseInt(yil), ilce:ilce||undefined }),
      ]);
      setData(res.data); setTotal(res.total); setPages(res.pages); setPage(res.page);
      setOzet(oz as unknown as Record<string,number>);
    } finally { setLoading(false); }
  }, [yil, ilce, koy]);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { setPage(1); fetchData(1); }, 350);
    return () => clearTimeout(debounce.current);
  }, [fetchData]);

  const exportExcel = useCallback(async () => {
    setExporting(true);
    try {
      const res = await api.listHayvancilik({ yil:parseInt(yil), ilce:ilce||undefined, koy:koy||undefined, page:1, limit:50000 });
      const ws = XLSX.utils.aoa_to_sheet([
        COLS.map(c=>c.label),
        ...res.data.map(r=>COLS.map(c=>r[c.key as keyof HayvRow]??0)),
      ]);
      ws['!cols'] = COLS.map((_,i)=>({wch:i<2?20:14}));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Hayvancılık');
      XLSX.writeFile(wb, ['hayvancilik',yil,ilce||'tum',koy||''].filter(Boolean).join('_')+'.xlsx');
    } finally { setExporting(false); }
  }, [yil, ilce, koy]);

  return (
    <div className="dc" style={{ marginTop:16 }}>
      {/* Özet kartlar */}
      {Object.keys(ozet).length > 0 && (
        <div style={{ display:'flex', gap:8, padding:'10px 14px', borderBottom:'1px solid var(--br)', flexWrap:'wrap' }}>
          {[...ANIMALS.map(a=>({
            key:a.key, label:a.label, color:a.color,
            val:ozet[`${a.key}_toplam`]??0, sub:`${(ozet[`${a.key}_isletme`]??0).toLocaleString('tr-TR')} işl.`,
          })), {
            key:'toplam', label:'İşletme', color:'#1a3a8a',
            val:ozet.toplam_isletme??0, sub:`${(ozet.koy_sayisi??0).toLocaleString('tr-TR')} köy`,
          }].map(a=>(
            <div key={a.key} style={{ flex:1, minWidth:100, padding:'9px 12px', borderRadius:8,
              background:'#fafbfa', border:`1.5px solid ${a.color}22` }}>
              <div style={{ fontSize:9.5, fontWeight:700, color:a.color, marginBottom:2, textTransform:'uppercase', letterSpacing:'.5px' }}>{a.label}</div>
              <div style={{ fontSize:16, fontWeight:800, color:'var(--tx)', fontFamily:"'JetBrains Mono',monospace", lineHeight:1 }}>
                {a.val.toLocaleString('tr-TR')}
              </div>
              <div style={{ fontSize:9.5, color:'var(--mu)', marginTop:2 }}>{a.sub}</div>
            </div>
          ))}
        </div>
      )}

      <TableHeader>
        <h2 style={{ margin:0, fontSize:13, fontWeight:800, color:'var(--gd)' }}>Köy Bazlı Hayvancılık</h2>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, color:'var(--mu)', fontWeight:600 }}>{total.toLocaleString('tr-TR')} köy</span>
          <ExcelBtn onClick={exportExcel} disabled={total===0} loading={exporting} />
        </div>
      </TableHeader>

      <FilterBar>
        <Sel label="Yıl" value={yil} onChange={setYil}>
          {YEARS.slice(0,4).map(y=><option key={y}>{y}</option>)}
        </Sel>
        <Sel label="İlçe" value={ilce} onChange={v=>{setIlce(v);setKoy('');}}>
          <option value="">— Tümü —</option>
          {ILCELER.map(i=><option key={i} value={i}>{i}</option>)}
        </Sel>
        {ilce && villages.length > 0 && (
          <Sel label="Köy" value={koy} onChange={setKoy}>
            <option value="">— Tümü —</option>
            {villages.map(v=><option key={v} value={v}>{v}</option>)}
          </Sel>
        )}
        <ResetBtn onClick={()=>{setIlce(defaultIlce.toLocaleUpperCase('tr-TR'));setKoy('');setYil('2025'); resetSort();}} />
      </FilterBar>

      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ background:'var(--gd)' }}>
              <th style={{ padding:'7px 8px', color:'rgba(255,255,255,.35)', fontSize:9, fontWeight:700, width:28, textAlign:'center' }}>#</th>
              {COLS.map(col=>(
                <SortableTh key={col.key} label={col.label} sortKey={col.key}
                  currentSort={sort} onSort={onSort}
                  align={col.isText?'left':'right'} />
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <LoadingRow cols={COLS.length+1} /> :
             sorted.length===0 ? <EmptyRow cols={COLS.length+1} text="Veri bulunamadı — İçeri Aktar ile hayvancılık verisi yükleyin" /> :
             sorted.map((row,ri)=>(
              <tr key={ri} style={{ borderBottom:'1px solid var(--br)', background:ri%2===0?'#fff':'var(--sf2)' }}
                onMouseEnter={e=>(e.currentTarget.style.background='var(--gp)')}
                onMouseLeave={e=>(e.currentTarget.style.background=ri%2===0?'#fff':'var(--sf2)')}>
                <td style={{ padding:'5px 8px', textAlign:'center', color:'var(--mu)', fontSize:10 }}>{(page-1)*100+ri+1}</td>
                {COLS.map(col=>{
                  const v = row[col.key as keyof HayvRow] as number|string;
                  const numV = Number(v)||0;
                  return (
                    <td key={col.key} style={{
                      padding:'5px 10px', textAlign:col.isText?'left':'right',
                      fontFamily:col.isText?'inherit':"'JetBrains Mono',monospace",
                      fontSize:col.isText?12:11.5,
                      fontWeight:col.key==='koy'?600:col.key==='toplam_isletme'?700:400,
                      color:!col.isText&&numV===0?'var(--br2)':col.color||'var(--tx)',
                      borderLeft:BORDER_KEYS.has(col.key)?'1px solid var(--br)':'none',
                    }}>
                      {col.isText ? String(v??'—') : fmt(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={pages} total={total} onPage={fetchData} unit="köy" />
    </div>
  );
}
