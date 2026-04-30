

import { useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { ILCELER, getVillages } from "@/lib/ui";
import urunGruplari from "@/data/urun_gruplari.json";
import { BAKANLIK_LOGO, BURDUR_VAL_LOGO } from "@/data/logos";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ─────────────────────────────────────────────────────────────
// TİPLER
// ─────────────────────────────────────────────────────────────
interface UretimRow { urun:string; ekili_alan:number; tarim_sekli:string; uretim_cesidi:string; }
interface HayvRow   { sigir:number; manda:number; koyun:number; keci:number; sigir_isletme:number; manda_isletme:number; koyun_isletme:number; keci_isletme:number; toplam_isletme:number; }
interface KoopRow   { koop_turu:string; baskan:string; ortak_sayisi:number|null; telefon:string; koy_belde:string; }
interface SutOzet   { toplam_sut_lt:number; toplam_tutar:number; uretici_sayisi:number; }
interface BitkDRow  { urun:string; feromon_adet:number; feromon_tuzak_adet:number; faydali_bocek_adet:number; desteklenen_alan_da:number; destek_tutari_tl:number; net_odeme_tl:number; }
interface DestekRow { destek_adi?:string; kategori?:string; yil:number; tutar_tl:number; }

// ─────────────────────────────────────────────────────────────
// ÜRÜN GRUPLARI
// ─────────────────────────────────────────────────────────────
const GRUP_LABEL: Record<string,string> = {
  "tahıllar":"Tahıllar","baklagil":"Baklagil","endüstri bitkileri":"Endüstri Bitkileri",
  "meyve":"Meyve","sebze":"Sebze","yem bitkileri":"Yem Bitkileri",
  "tıbbi aromatik":"Tıbbi Aromatik","süs bitkileri":"Süs Bitkileri",
  "yumru bitkiler":"Yumru Bitkiler","orman emvali ürün":"Orman Emvali",
  "nadas-boş bırakılan arazi":"Nadas",
};
const GRUP_COLOR: Record<string,string> = {
  "tahıllar":"#e67e22","baklagil":"#27ae60","endüstri bitkileri":"#8e44ad",
  "meyve":"#e74c3c","sebze":"#2ecc71","yem bitkileri":"#f39c12",
  "tıbbi aromatik":"#1abc9c","süs bitkileri":"#e91e63",
  "yumru bitkiler":"#795548","orman emvali ürün":"#4caf50",
  "nadas-boş bırakılan arazi":"#9e9e9e",
};
const urun_to_grup = urunGruplari.urun_to_grup as Record<string,string>;
const getGrup = (u:string) => urun_to_grup[u] ?? "diğer";

// ─────────────────────────────────────────────────────────────
// PASTA GRAFİK (SVG, print-safe)
// ─────────────────────────────────────────────────────────────
function PieChart({ slices }:{ slices:{label:string;value:number;color:string}[] }) {
  const total = slices.reduce((s,d)=>s+d.value,0);
  if (!total) return null;
  const cx=60,cy=60,r=50; let cum=-90;
  const paths = slices.filter(d=>d.value>0).map(d=>{
    const angle=(d.value/total)*360;
    const toXY=(deg:number)=>{ const rad=deg*Math.PI/180; return {x:+(cx+r*Math.cos(rad)).toFixed(2),y:+(cy+r*Math.sin(rad)).toFixed(2)}; };
    const s=toXY(cum); cum+=angle; const e=toXY(cum);
    return {...d,pct:d.value/total,path:`M${cx},${cy} L${s.x},${s.y} A${r},${r} 0 ${angle>180?1:0},1 ${e.x},${e.y} Z`};
  });
  return (
    <svg viewBox="0 0 120 120" style={{width:100,height:100,flexShrink:0}}>
      {paths.map((p,i)=><path key={i} d={p.path} fill={p.color} stroke="#fff" strokeWidth={1.2}><title>{p.label}: %{(p.pct*100).toFixed(1)}</title></path>)}
      <circle cx={cx} cy={cy} r={16} fill="white"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// FORMATLAYICILAR
// ─────────────────────────────────────────────────────────────
const tl  = (v:number|null|undefined) => v==null||isNaN(+v)||+v===0 ? "—" : (+v).toLocaleString("tr-TR",{maximumFractionDigits:0})+" ₺";
const da  = (v:number|null|undefined) => v==null||isNaN(+v)||+v===0 ? "—" : (+v).toLocaleString("tr-TR",{maximumFractionDigits:1})+" da";
const bas = (v:number|null|undefined,u="") => v==null||isNaN(+v)||+v===0 ? "—" : (+v).toLocaleString("tr-TR",{maximumFractionDigits:0})+(u?" "+u:"");

// ─────────────────────────────────────────────────────────────
// UI BİLEŞENLERİ (kompakt, print-safe)
// ─────────────────────────────────────────────────────────────
const GRN  = "#17472f";
const GRN2 = "#2d6a4f";
const GOLD = "#a07010";
const BLUE = "#1a4a6b";

function SHead({ title, icon, bg=GRN }:{ title:string; icon:string; bg?:string }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",background:bg,borderRadius:"6px 6px 0 0",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}>
      <span style={{fontSize:13}}>{icon}</span>
      <span style={{fontSize:10,fontWeight:800,color:"#fff",letterSpacing:".5px",textTransform:"uppercase"}}>{title}</span>
    </div>
  );
}

function Card({ title, icon, children, bg=GRN }:{ title:string; icon:string; children:React.ReactNode; bg?:string }) {
  return (
    <div style={{marginBottom:8,borderRadius:8,overflow:"hidden",border:"1.5px solid #ddd",pageBreakInside:"avoid"}}>
      <SHead title={title} icon={icon} bg={bg}/>
      <div style={{background:"#fff"}}>{children}</div>
    </div>
  );
}

function Row({ label, value, hi }:{ label:string; value:React.ReactNode; hi?:boolean }) {
  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderBottom:"1px solid #f0f0f0",background:hi?"#f0f7f3":"#fff",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}>
      <span style={{padding:"4px 10px",fontSize:10.5,color:"#555",fontWeight:600}}>{label}</span>
      <span style={{padding:"4px 10px",fontSize:11,fontWeight:700,color:hi?GRN:"#222"}}>{value}</span>
    </div>
  );
}

function THead({ cols }:{ cols:string[] }) {
  return (
    <div style={{display:"grid",gridTemplateColumns:`repeat(${cols.length},1fr)`,padding:"3px 10px",background:"#eef5f0",borderBottom:"1px solid #ddd",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}>
      {cols.map((c,i)=><span key={i} style={{fontSize:9,fontWeight:800,color:"#444",textTransform:"uppercase"}}>{c}</span>)}
    </div>
  );
}

function Empty({ t="Veri yok" }:{ t?:string }) {
  return <div style={{padding:"10px",textAlign:"center",color:"#bbb",fontSize:11,fontStyle:"italic"}}>{t}</div>;
}

// ─────────────────────────────────────────────────────────────
// ANA BİLEŞEN
// ─────────────────────────────────────────────────────────────
export default function KoyBilgiNotu() {
  const [ilce, setIlce] = useState("");
  const [koy,  setKoy]  = useState("");
  const [yil,  setYil]  = useState("2025");
  const [loading, setLoading]   = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const [uretim,   setUretim]   = useState<UretimRow[]>([]);
  const [hayv,     setHayv]     = useState<HayvRow|null>(null);
  const [koop,     setKoop]     = useState<KoopRow[]>([]);
  const [sut,      setSut]      = useState<SutOzet|null>(null);
  const [bitkDest, setBitkDest] = useState<BitkDRow[]>([]);
  const [alanB,    setAlanB]    = useState<DestekRow[]>([]);
  const [fark,     setFark]     = useState<DestekRow[]>([]);
  const [hayvD,    setHayvD]    = useState<DestekRow[]>([]);
  const [genelD,   setGenelD]   = useState<DestekRow[]>([]);
  const [cks,      setCks]      = useState<number|null>(null);

  const villages = getVillages(ilce);
  const hasData  = uretim.length>0 || hayv!==null || koop.length>0;

  const fetchAll = useCallback(async()=>{
    if (!ilce||!koy) return;
    setLoading(true); setError("");
    const q=(s:string)=>encodeURIComponent(s);
    const ok=async(url:string)=>{ try{ const r=await fetch(url); return await r.json(); }catch{ return null; } };
    const [u,h,k,s,bd,ab,fp,hd,gd,cs] = await Promise.all([
      ok(`${BASE}/api/uretim?yil=${yil}&ilce=${q(ilce)}&koy=${q(koy)}&limit=500`),
      ok(`${BASE}/api/hayvancilik?yil=${yil}&ilce=${q(ilce)}&koy=${q(koy)}&limit=1`),
      ok(`${BASE}/api/kooperatif?ilce=${q(ilce)}&ara=${q(koy)}&limit=20`),
      ok(`${BASE}/api/sut/ozet?yil=${yil}&ilce=${q(ilce)}`),
      ok(`${BASE}/api/bitkisel-destek?yil=${yil}&ilce=${q(ilce)}&koy=${q(koy)}&limit=50`),
      ok(`${BASE}/api/alan-bazli?yil=${yil}&limit=999`),
      ok(`${BASE}/api/fark-prim?yil=${yil}&limit=999`),
      ok(`${BASE}/api/hayvancilik-destek?yil=${yil}&limit=999`),
      ok(`${BASE}/api/genel-destek?yil=${yil}&limit=999`),
      ok(`${BASE}/api/cks-sayisi?yil=${yil}`),
    ]);
    setUretim(u?.data??[]);
    setHayv((h?.data??[])[0]??null);
    setKoop(k?.data??[]);
    setSut(s?.toplam_tutar?s:null);
    setBitkDest(bd?.data??[]);
    setAlanB(ab?.data??[]);
    setFark(fp?.data??[]);
    setHayvD(hd?.data??[]);
    setGenelD(gd?.data??[]);
    const cr:any[]=cs?.data??[];
    setCks(cr.find(r=>r.ilce.toUpperCase()===ilce.toUpperCase()&&r.koy.toUpperCase()===koy.toUpperCase())?.sayi??null);
    setLoading(false);
  },[ilce,koy,yil]);

  // Hesaplamalar
  const gt: Record<string,number> = {};
  for (const r of uretim) { const g=getGrup(r.urun); gt[g]=(gt[g]??0)+Number(r.ekili_alan??0); }
  const toplamAlan = uretim.reduce((s,r)=>s+Number(r.ekili_alan??0),0);
  const top10      = [...uretim].sort((a,b)=>Number(b.ekili_alan)-Number(a.ekili_alan)).slice(0,10);
  const pieData    = Object.entries(gt).filter(([,v])=>v>0).map(([g,v])=>({label:GRUP_LABEL[g]??g,value:v,color:GRUP_COLOR[g]??"#aaa"}));

  const sutT   = sut?.toplam_tutar??0;
  const bdT    = bitkDest.reduce((s,r)=>s+Number(r.destek_tutari_tl??0),0);
  const abT    = alanB.reduce((s,r)=>s+Number(r.tutar_tl??0),0);
  const fpT    = fark.reduce((s,r)=>s+Number(r.tutar_tl??0),0);
  const hdT    = hayvD.reduce((s,r)=>s+Number(r.tutar_tl??0),0);
  const gdT    = genelD.reduce((s,r)=>s+Number(r.tutar_tl??0),0);
  const genelT = sutT+bdT+abT+fpT+hdT+gdT;

  const bugun = new Date().toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"});

  // Excel
  const exportExcel = useCallback(async()=>{
    if (!koy) return; setExporting(true);
    try {
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.aoa_to_sheet([
        [`${ilce} — ${koy.toUpperCase()} KÖYÜ BİLGİ NOTU ${yil}`],[`Tarih: ${bugun}`],[],
        ["BİTKİSEL ÜRETİM"],["Grup","Alan (da)"],
        ...Object.entries(gt).filter(([,v])=>v>0).map(([g,v])=>[GRUP_LABEL[g]??g,v]),
        ["Toplam",toplamAlan],[],
        ["HAYVANSAL ÜRETİM"],
        ["Sığır",hayv?.sigir??0],["Manda",hayv?.manda??0],["Koyun",hayv?.koyun??0],["Keçi",hayv?.keci??0],["Toplam İşletme",hayv?.toplam_isletme??0],[],
        ["DESTEKLER"],["Süt",sutT],["Bitkisel",bdT],["Alan Bazlı",abT],["Fark/Prim",fpT],["Hayvancılık",hdT],["Genel",gdT],["TOPLAM",genelT],[],
        ["ÇKS İşletme",cks??0],
      ]);
      ws1["!cols"]=[{wch:35},{wch:18}];
      XLSX.utils.book_append_sheet(wb,ws1,"Özet");
      if (uretim.length>0) {
        const ws2=XLSX.utils.aoa_to_sheet([["Ürün","Grup","Tarım Şekli","Alan (da)"],...uretim.map(r=>[r.urun,GRUP_LABEL[getGrup(r.urun)]??getGrup(r.urun),r.tarim_sekli,r.ekili_alan])]);
        ws2["!cols"]=[{wch:30},{wch:18},{wch:14},{wch:12}];
        XLSX.utils.book_append_sheet(wb,ws2,"Ürün Detay");
      }
      XLSX.writeFile(wb,`${ilce}_${koy}_bilgi_notu_${yil}.xlsx`);
    } finally { setExporting(false); }
  },[ilce,koy,yil,gt,toplamAlan,hayv,sutT,bdT,abT,fpT,hdT,gdT,genelT,cks,uretim,bitkDest,bugun]);

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <div style={{background:"#edf0ec",minHeight:"100vh",paddingBottom:40}}>

      {/* ── Kontrol Paneli (ekranda görünür, baskıda gizli) ─── */}
      <div className="no-print" style={{background:"linear-gradient(135deg,#0e2d1e,#1a6b3a)",padding:"0",boxShadow:"0 2px 12px #0004",position:"sticky",top:0,zIndex:100}}>
        {/* Kurumsal başlık */}
        <div style={{display:"flex",alignItems:"center",gap:14,padding:"8px 20px",borderBottom:"1px solid rgba(255,255,255,.1)"}}>
          <img src={BAKANLIK_LOGO} alt="Bakanlık" style={{height:42,borderRadius:4,background:"#fff",padding:2,flexShrink:0}}/>
          <div style={{flex:1,lineHeight:1.3}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,.5)",letterSpacing:1.2,textTransform:"uppercase"}}>T.C. Tarım ve Orman Bakanlığı</div>
            <div style={{fontSize:15,color:"#fff",fontWeight:900}}>Burdur İl Tarım ve Orman Müdürlüğü</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,.55)"}}>Köy Bilgi Notu Sistemi</div>
          </div>
          <img src={BURDUR_VAL_LOGO} alt="Burdur Valiliği" style={{height:42,borderRadius:4,background:"#fff",padding:2,flexShrink:0}}/>
        </div>
        {/* Seçiciler */}
        <div style={{display:"flex",alignItems:"flex-end",gap:10,padding:"8px 20px 10px",flexWrap:"wrap"}}>
          {[["Yıl","yil"],["İlçe","ilce"],["Köy","koy"]].map(([l])=>(
            <div key={l}>
              <div style={{fontSize:9,color:"rgba(255,255,255,.45)",fontWeight:700,textTransform:"uppercase",letterSpacing:.9,marginBottom:3}}>{l}</div>
              {l==="Yıl" && (
                <select value={yil} onChange={e=>setYil(e.target.value)} style={{padding:"6px 10px",borderRadius:6,border:"1px solid rgba(255,255,255,.2)",background:"rgba(255,255,255,.1)",color:"#fff",fontFamily:"inherit",fontSize:12,fontWeight:700,width:80}}>
                  {["2026","2025","2024","2023"].map(y=><option key={y} value={y} style={{color:"#000"}}>{y}</option>)}
                </select>
              )}
              {l==="İlçe" && (
                <select value={ilce} onChange={e=>{setIlce(e.target.value);setKoy("");}} style={{padding:"6px 10px",borderRadius:6,border:"1px solid rgba(255,255,255,.2)",background:"rgba(255,255,255,.1)",color:ilce?"#fff":"rgba(255,255,255,.4)",fontFamily:"inherit",fontSize:12,fontWeight:700,minWidth:130}}>
                  <option value="" style={{color:"#000"}}>— Seçiniz —</option>
                  {ILCELER.map(i=><option key={i} value={i} style={{color:"#000"}}>{i}</option>)}
                </select>
              )}
              {l==="Köy" && (
                <select value={koy} onChange={e=>setKoy(e.target.value)} disabled={!ilce} style={{padding:"6px 10px",borderRadius:6,border:"1px solid rgba(255,255,255,.2)",background:"rgba(255,255,255,.1)",color:koy?"#fff":"rgba(255,255,255,.4)",fontFamily:"inherit",fontSize:12,fontWeight:700,minWidth:170,opacity:ilce?1:.5}}>
                  <option value="" style={{color:"#000"}}>{ilce?"— Seçiniz —":"— Önce İlçe —"}</option>
                  {villages.map(v=><option key={v} value={v} style={{color:"#000"}}>{v}</option>)}
                </select>
              )}
            </div>
          ))}
          <button onClick={fetchAll} disabled={!ilce||!koy||loading}
            style={{padding:"7px 18px",borderRadius:7,border:"none",cursor:ilce&&koy?"pointer":"default",background:ilce&&koy?"#4aaa72":"rgba(255,255,255,.15)",color:"#fff",fontSize:13,fontWeight:800,fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
            {loading?"⏳ Yükleniyor…":"🔍 Getir"}
          </button>
          {hasData&&<>
            <button onClick={()=>window.print()} style={{padding:"7px 14px",borderRadius:7,border:"1px solid rgba(255,255,255,.25)",background:"rgba(255,255,255,.1)",color:"#fff",fontSize:11,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>🖨️ PDF / Yazdır</button>
            <button onClick={exportExcel} disabled={exporting} style={{padding:"7px 14px",borderRadius:7,border:"1px solid rgba(255,255,255,.25)",background:"rgba(255,255,255,.1)",color:"#fff",fontSize:11,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
              {exporting?"⏳":"⬇️"} Excel
            </button>
          </>}
        </div>
      </div>

      {error&&<div style={{margin:"10px 20px",padding:10,background:"#fdf0ef",border:"1px solid #f5b8b5",borderRadius:7,color:"#c0392b",fontSize:12}}>⚠️ {error}</div>}

      {/* Boş durum */}
      {!hasData&&!loading&&(
        <div style={{textAlign:"center",padding:"80px 20px"}}>
          <div style={{fontSize:52,marginBottom:12}}>📋</div>
          <div style={{fontSize:17,fontWeight:800,color:"#555",marginBottom:8}}>Köy Bilgi Notu</div>
          <div style={{fontSize:12,color:"#999"}}>Üst bardan ilçe ve köy seçerek bilgi notunu görüntüleyin.</div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          BASKI ALANI — A4 tek sayfa optimized
         ════════════════════════════════════════════════════ */}
      {hasData&&(
        <div id="bilgi-notu-print" style={{maxWidth:1140,margin:"14px auto",padding:"0 14px"}}>

          {/* ── Resmi Başlık (baskıda da görünür) ─────────── */}
          <div style={{background:"linear-gradient(135deg,#0e2d1e,#17472f)",borderRadius:10,padding:"12px 20px",marginBottom:10,display:"flex",alignItems:"center",gap:14,WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}>
            <img src={BAKANLIK_LOGO} alt="Bakanlık" style={{height:50,borderRadius:4,background:"#fff",padding:2,flexShrink:0}}/>
            <div style={{flex:1,textAlign:"center"}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,.6)",letterSpacing:1}}>T.C. TARIM VE ORMAN BAKANLIĞI</div>
              <div style={{fontSize:16,color:"#fff",fontWeight:900,letterSpacing:.3}}>BURDUR İL TARIM VE ORMAN MÜDÜRLÜĞÜ</div>
              <div style={{fontSize:13,color:"#6fe099",fontWeight:700,marginTop:2}}>{ilce} İLÇESİ — {koy.toUpperCase()} KÖYÜ BİLGİ NOTU</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.5)",marginTop:2}}>
                {yil} Yılı
                {cks!==null&&<> · {cks} ÇKS İşletme</>}
                {toplamAlan>0&&<> · {toplamAlan.toLocaleString("tr-TR",{maximumFractionDigits:0})} da Ekili Alan</>}
                <span style={{marginLeft:12}}>H.T. {bugun}</span>
              </div>
            </div>
            <img src={BURDUR_VAL_LOGO} alt="Burdur Valiliği" style={{height:50,borderRadius:4,background:"#fff",padding:2,flexShrink:0}}/>
          </div>

          {/* ── 3 KOLON GRID ──────────────────────────────── */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,alignItems:"start"}}>

            {/* ═ SOL ═ */}
            <div>
              <Card title="Bitkisel Üretim" icon="🌾">
                <Row label="Toplam Ekili Alan" value={da(toplamAlan)} hi/>
                <Row label="ÇKS Kayıtlı İşletme" value={cks!==null?`${cks} Kişi`:"—"} hi/>
                <THead cols={["Grup","Alan (da)"]}/>
                {Object.entries(GRUP_LABEL).map(([g,lbl])=>{
                  const v=gt[g]; if(!v) return null;
                  return (
                    <div key={g} style={{display:"grid",gridTemplateColumns:"1fr auto",borderBottom:"1px solid #f0f0f0",padding:"3px 10px",alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11}}>
                        <span style={{width:7,height:7,borderRadius:"50%",background:GRUP_COLOR[g]??"#aaa",flexShrink:0}}/>
                        {lbl}
                      </div>
                      <span style={{fontSize:11,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{v.toLocaleString("tr-TR",{maximumFractionDigits:1})}</span>
                    </div>
                  );
                })}
                {/* Pasta + legenda */}
                {pieData.length>0&&(
                  <div style={{padding:"8px 10px",display:"flex",gap:8,alignItems:"center",borderTop:"1px solid #eee"}}>
                    <PieChart slices={pieData}/>
                    <div style={{flex:1}}>
                      {pieData.slice(0,8).map((d,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}>
                          <span style={{width:7,height:7,borderRadius:1,background:d.color,flexShrink:0}}/>
                          <span style={{fontSize:9.5,color:"#555",flex:1}}>{d.label}</span>
                          <span style={{fontSize:9.5,fontWeight:700,color:"#222"}}>%{((d.value/toplamAlan)*100).toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              {top10.length>0&&(
                <Card title="İlk 10 Ürün" icon="📊">
                  <THead cols={["#","Ürün","da"]}/>
                  {top10.map((r,i)=>(
                    <div key={i} style={{display:"grid",gridTemplateColumns:"18px 1fr auto",borderBottom:"1px solid #f0f0f0",padding:"3px 10px",background:i%2===0?"#fff":"#fafafa",alignItems:"center"}}>
                      <span style={{fontSize:9.5,color:"#bbb"}}>{i+1}</span>
                      <span style={{fontSize:11,fontWeight:600}}>{r.urun}</span>
                      <span style={{fontSize:11,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:GRN}}>{Number(r.ekili_alan).toLocaleString("tr-TR",{maximumFractionDigits:1})}</span>
                    </div>
                  ))}
                </Card>
              )}
            </div>

            {/* ═ ORTA ═ */}
            <div>
              <Card title="Hayvansal Üretim" icon="🐄">
                {hayv ? <>
                  <Row label="Sığır" value={bas(hayv.sigir,"Baş")} hi/>
                  <Row label="Sığır İşletme" value={bas(hayv.sigir_isletme,"Adet")}/>
                  <Row label="Manda" value={bas(hayv.manda,"Baş")} hi/>
                  <Row label="Koyun" value={bas(hayv.koyun,"Baş")} hi/>
                  <Row label="Koyun İşletme" value={bas(hayv.koyun_isletme,"Adet")}/>
                  <Row label="Keçi" value={bas(hayv.keci,"Baş")} hi/>
                  <Row label="Keçi İşletme" value={bas(hayv.keci_isletme,"Adet")}/>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"5px 10px",background:"#f0f7f3",borderTop:"1.5px solid #2d6a4f44"}}>
                    <span style={{fontSize:11,fontWeight:800,color:GRN}}>Toplam İşletme</span>
                    <span style={{fontSize:13,fontWeight:900,color:GRN,fontFamily:"'JetBrains Mono',monospace"}}>{bas(hayv.toplam_isletme,"Adet")}</span>
                  </div>
                </> : <Empty/>}
              </Card>

              <Card title="Kooperatif / Örgütlenme" icon="🤝">
                {koop.length>0 ? koop.map((k,i)=>(
                  <div key={i} style={{padding:"7px 10px",borderBottom:"1px solid #f0f0f0"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                      <span style={{fontSize:10,fontWeight:800,color:GRN,textTransform:"uppercase",letterSpacing:.4}}>{k.koop_turu}</span>
                      {k.ortak_sayisi&&<span style={{fontSize:10,fontWeight:700,color:"#666"}}>{k.ortak_sayisi} Ortak</span>}
                    </div>
                    {k.koy_belde&&<div style={{fontSize:10,color:"#888"}}>📍 {k.koy_belde}</div>}
                    {k.baskan&&<div style={{fontSize:11,color:"#333"}}><span style={{color:"#aaa"}}>Başkan: </span>{k.baskan}</div>}
                    {k.telefon&&<div style={{fontSize:10,color:"#888",fontFamily:"'JetBrains Mono',monospace"}}>📞 {k.telefon}</div>}
                  </div>
                )) : <Empty/>}
              </Card>

              <Card title="Süt Destekleme" icon="🥛" bg={GOLD}>
                {sut ? <>
                  <Row label="Süt Miktarı" value={`${sut.toplam_sut_lt?.toLocaleString("tr-TR",{maximumFractionDigits:0})} lt`} hi/>
                  <Row label="Destek Tutarı" value={tl(sut.toplam_tutar)} hi/>
                  <Row label="Üretici Sayısı" value={`${sut.uretici_sayisi??0} Kişi`}/>
                </> : <Empty/>}
              </Card>

              <Card title="Bitkisel Destekler" icon="🌿" bg={GOLD}>
                {bitkDest.length>0 ? <>
                  <THead cols={["Ürün","Alan","Destek ₺"]}/>
                  {bitkDest.slice(0,6).map((r,i)=>(
                    <div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto auto",borderBottom:"1px solid #f5f5f5",padding:"3px 10px",background:i%2===0?"#fff":"#fffbf0",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:10.5,fontWeight:600}}>{r.urun}</span>
                      <span style={{fontSize:10,color:"#888",fontFamily:"'JetBrains Mono',monospace"}}>{Number(r.desteklenen_alan_da).toLocaleString("tr-TR",{maximumFractionDigits:1})}</span>
                      <span style={{fontSize:10,fontWeight:700,color:GOLD,fontFamily:"'JetBrains Mono',monospace"}}>{Number(r.destek_tutari_tl).toLocaleString("tr-TR",{maximumFractionDigits:0})}</span>
                    </div>
                  ))}
                  <div style={{display:"flex",justifyContent:"space-between",padding:"4px 10px",background:"#fffbf0",borderTop:`1.5px solid ${GOLD}44`}}>
                    <span style={{fontSize:10,fontWeight:800}}>TOPLAM</span>
                    <span style={{fontSize:11,fontWeight:900,color:GOLD,fontFamily:"'JetBrains Mono',monospace"}}>{tl(bdT)}</span>
                  </div>
                </> : <Empty/>}
              </Card>
            </div>

            {/* ═ SAĞ ═ */}
            <div>
              <Card title="Destekler Özeti (İl Geneli)" icon="💰" bg={GOLD}>
                <Row label="Süt Destekleme"       value={tl(sutT)} hi/>
                <Row label="Bitkisel Üretim"       value={tl(bdT)}  hi/>
                <Row label="Alan Bazlı"            value={tl(abT)}/>
                <Row label="Fark / Prim"           value={tl(fpT)}/>
                <Row label="Hayvancılık Desteği"  value={tl(hdT)}/>
                <Row label="Genel Destekler"       value={tl(gdT)}/>
                <div style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:`linear-gradient(90deg,#fffbf0,#fff8e6)`,borderTop:`2px solid ${GOLD}55`,WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}>
                  <span style={{fontSize:11,fontWeight:900,color:GOLD}}>GENEL TOPLAM</span>
                  <span style={{fontSize:13,fontWeight:900,color:GOLD,fontFamily:"'JetBrains Mono',monospace"}}>{tl(genelT)}</span>
                </div>
              </Card>

              {alanB.length>0&&(
                <Card title="Alan Bazlı Destekler" icon="🌾" bg={BLUE}>
                  <THead cols={["Destek Adı","TL"]}/>
                  {alanB.slice(0,8).map((r,i)=>(
                    <div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto",borderBottom:"1px solid #f0f0f0",padding:"3px 10px",background:i%2===0?"#fff":"#f8fbff",alignItems:"center"}}>
                      <span style={{fontSize:10.5,color:"#444"}}>{r.destek_adi}</span>
                      <span style={{fontSize:10,fontWeight:700,color:BLUE,fontFamily:"'JetBrains Mono',monospace"}}>{Number(r.tutar_tl).toLocaleString("tr-TR",{maximumFractionDigits:0})}</span>
                    </div>
                  ))}
                </Card>
              )}

              {fark.length>0&&(
                <Card title="Fark / Prim Ödemeleri" icon="💵" bg={BLUE}>
                  <THead cols={["Kategori","TL"]}/>
                  {fark.slice(0,6).map((r,i)=>(
                    <div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto",borderBottom:"1px solid #f0f0f0",padding:"3px 10px",background:i%2===0?"#fff":"#f8fbff",alignItems:"center"}}>
                      <span style={{fontSize:10.5,color:"#444"}}>{r.kategori}</span>
                      <span style={{fontSize:10,fontWeight:700,color:BLUE,fontFamily:"'JetBrains Mono',monospace"}}>{Number(r.tutar_tl).toLocaleString("tr-TR",{maximumFractionDigits:0})}</span>
                    </div>
                  ))}
                </Card>
              )}

              {hayvD.length>0&&(
                <Card title="Hayvancılık Destekleri" icon="🐄" bg={BLUE}>
                  <THead cols={["Destek","TL"]}/>
                  {hayvD.slice(0,6).map((r,i)=>(
                    <div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto",borderBottom:"1px solid #f0f0f0",padding:"3px 10px",background:i%2===0?"#fff":"#f8fbff",alignItems:"center"}}>
                      <span style={{fontSize:10.5,color:"#444"}}>{r.destek_adi}</span>
                      <span style={{fontSize:10,fontWeight:700,color:BLUE,fontFamily:"'JetBrains Mono',monospace"}}>{Number(r.tutar_tl).toLocaleString("tr-TR",{maximumFractionDigits:0})}</span>
                    </div>
                  ))}
                </Card>
              )}

              <Card title="Su Ürünleri" icon="🐟">
                {["Avcılık (Tekne)","Yetiştiricilik (Ton)"].map(row=>(
                  <div key={row} style={{display:"grid",gridTemplateColumns:"1fr auto",borderBottom:"1px solid #f0f0f0",padding:"4px 10px"}}>
                    <span style={{fontSize:11,color:"#555"}}>{row}</span>
                    <span style={{fontSize:11,color:"#ddd"}}>—</span>
                  </div>
                ))}
              </Card>

              <Card title="Gıda & Yem İşletmeleri" icon="🏭">
                {["Satış-Toplu Tüketim","Üretim İşletmeleri","Onaylı Üretim","Yem İşletmeleri"].map(row=>(
                  <div key={row} style={{display:"grid",gridTemplateColumns:"1fr auto",borderBottom:"1px solid #f0f0f0",padding:"4px 10px"}}>
                    <span style={{fontSize:11,color:"#555"}}>{row}</span>
                    <span style={{fontSize:11,color:"#ddd"}}>—</span>
                  </div>
                ))}
              </Card>
            </div>
          </div>

          {/* Alt bilgi */}
          <div style={{textAlign:"center",padding:"8px 0 0",fontSize:9.5,color:"#bbb",borderTop:"1px solid #ddd",marginTop:6}}>
            T.C. Burdur İl Tarım ve Orman Müdürlüğü · Köy Bilgi Notu Sistemi · {bugun}
          </div>
        </div>
      )}

      {/* ══ PRINT / PDF CSS ══════════════════════════════════ */}
      <style>{`
        .no-print { }

        @media print {
          /* Sayfa ayarı — yatay A4 */
          @page {
            size: A4 landscape;
            margin: 8mm 8mm 8mm 8mm;
          }

          /* Site genel öğelerini gizle */
          header, nav, aside, footer,
          .no-print, .topnav, .app > aside,
          [class*="topnav"], [class*="sidebar"] {
            display: none !important;
          }

          /* Arkaplanlar baskıda görünsün */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body {
            background: white !important;
            margin: 0;
            padding: 0;
          }

          /* Baskı alanını tam ekran yap */
          #bilgi-notu-print {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Kolonlar tek sayfaya sığsın */
          #bilgi-notu-print > div[style*="grid"] {
            display: grid !important;
            grid-template-columns: 1fr 1fr 1fr !important;
            gap: 6px !important;
          }

          /* Kart sayfa kırılmasın */
          div[style*="pageBreakInside"] {
            page-break-inside: avoid !important;
          }

          /* Font boyutlarını küçült */
          #bilgi-notu-print {
            font-size: 9pt !important;
          }

          /* Başlık bandı */
          #bilgi-notu-print > div:first-child {
            margin-bottom: 6px !important;
          }
        }
      `}</style>
    </div>
  );
}
