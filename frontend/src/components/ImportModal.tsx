import { useState, useRef, useCallback } from 'react';
import { api, type ImportResponse } from '@/lib/api';

interface Props {
  onClose: () => void;
  onDone?: () => void;
}

const YEARS = Array.from({ length: 10 }, (_, i) => String(2026 - i));

type Category =
  | 'uretim' | 'hayvancilik' | 'kooperatif' | 'sut'
  | 'alan-bazli' | 'fark-prim' | 'hayv-destek'
  | 'cks-sayisi' | 'genel-destek' | 'bitkisel-destek' | 'planli-uretim';

interface FileResult {
  name: string;
  status: 'bekliyor' | 'yukleniyor' | 'tamam' | 'hata';
  result?: ImportResponse & { koy_sayisi?: number };
  error?: string;
}

const CATS: { id: Category; icon: string; label: string; desc: string; accept: string }[] = [
  { id: 'uretim',          icon: '🌾', label: 'Bitkisel Üretim (ÇKS)',    desc: 'İlçe bazlı .xlsx dosyaları',                accept: '.xlsx,.xls,.xlsm,.ods' },
  { id: 'hayvancilik',     icon: '🐄', label: 'Hayvancılık',               desc: 'İlçe bazlı .xls dosyaları',                accept: '.xls,.xlsx' },
  { id: 'kooperatif',      icon: '🤝', label: 'Kooperatifler & Birlikler', desc: 'Tek .xls dosyası (tüm ilçeler)',            accept: '.xls,.xlsx' },
  { id: 'sut',             icon: '🥛', label: 'Süt Destekleme İcmali',     desc: 'Dönemlik .xlsx icmal dosyası',             accept: '.xlsx,.xls' },
  { id: 'alan-bazli',      icon: '🌾', label: 'Alan Bazlı Destekler',      desc: 'Yıllık .xls özet dosyası',                 accept: '.xls,.xlsx' },
  { id: 'fark-prim',       icon: '💰', label: 'Fark/Prim Ödemeleri',       desc: 'Yıllık .xls özet dosyası',                 accept: '.xls,.xlsx' },
  { id: 'hayv-destek',     icon: '🐄', label: 'Hayvancılık Destekleri',    desc: 'Yıllık .xls özet dosyası',                 accept: '.xls,.xlsx' },
  { id: 'cks-sayisi',      icon: '👨‍🌾', label: 'ÇKS Çiftçi Sayısı',      desc: 'Yıllık .xlsx köy bazlı sayım',             accept: '.xlsx,.xls' },
  { id: 'genel-destek',    icon: '📊', label: 'Genel Destekler Özeti',     desc: 'Yıllık .xls özet dosyası',                 accept: '.xls,.xlsx' },
  { id: 'bitkisel-destek', icon: '🌿', label: 'Bitkisel Destekler',        desc: 'Feromon/Biyolojik .xls icmal dosyaları',   accept: '.xls,.xlsx,.xlsm' },
  { id: 'planli-uretim',  icon: '📋', label: 'Planlı Üretim Desteği',     desc: 'İlçe bazlı İCMAL-2 .xls dosyaları',        accept: '.xls,.xlsx,.xlsm' },
];

const STATUS_ICON: Record<FileResult['status'], string> = {
  bekliyor: '⏸', yukleniyor: '⏳', tamam: '✅', hata: '❌',
};
const STATUS_COLOR: Record<FileResult['status'], string> = {
  bekliyor: 'var(--mu)', yukleniyor: 'var(--am)', tamam: 'var(--gm)', hata: 'var(--red)',
};

export default function ImportModal({ onClose, onDone }: Props) {
  const [step, setStep]       = useState<1 | 2 | 3>(1);
  const [cat, setCat]         = useState<Category>('uretim');
  const [year, setYear]       = useState('2025');
  const [files, setFiles]     = useState<File[]>([]);
  const [drag, setDrag]       = useState(false);
  const [results, setResults] = useState<FileResult[]>([]);
  const [running, setRunning] = useState(false);
  const [donem, setDonem]     = useState('');
  const [done, setDone]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedCat = CATS.find(c => c.id === cat)!;

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const accept = selectedCat.accept.split(',');
    const valid = Array.from(incoming).filter(f => {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      return accept.includes(ext);
    });
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...valid.filter(f => !names.has(f.name))];
    });
  }, [selectedCat]);

  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const reset = () => { setStep(1); setFiles([]); setResults([]); setDone(false); };

  const handleUpload = useCallback(async () => {
    if (!files.length) return;
    setRunning(true);
    setDone(false);
    setResults(files.map(f => ({ name: f.name, status: 'bekliyor' })));

    for (let i = 0; i < files.length; i++) {
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'yukleniyor' } : r));
      try {
        let res;
        switch (cat) {
          case 'hayvancilik':     res = await api.importHayvancilik(files[i], year); break;
          case 'kooperatif':      res = await api.importKooperatif(files[i]);         break;
          case 'sut':             res = await api.importSut(files[i], donem, year);  break;
          case 'alan-bazli':      res = await api.importAlanBazli(files[i]);          break;
          case 'fark-prim':       res = await api.importFarkPrim(files[i]);            break;
          case 'hayv-destek':     res = await api.importHayvDestek(files[i]);          break;
          case 'cks-sayisi':      res = await api.importCksSayisi(files[i], year);    break;
          case 'genel-destek':    res = await api.importGenelDestek(files[i]);         break;
          case 'bitkisel-destek': res = await api.importBitkiselDestek(files[i], year); break;
          case 'planli-uretim':  res = await api.importPlanliUretim(files[i], year);  break;
          default:                res = await api.importExcel(files[i], year);
        }
        setResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'tamam', result: res as ImportResponse & { koy_sayisi?: number } } : r,
        ));
      } catch (e) {
        const msg = (e as Error).message;
        const isDup = msg.includes('daha önce yüklenmiş') || msg.includes('409');
        setResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'hata', error: isDup ? '⚠️ Aynı dosya daha önce yüklenmiş' : msg } : r,
        ));
      }
    }
    setRunning(false);
    setDone(true);
    onDone?.();
  }, [files, year, cat, donem, onDone]);

  const totalKayit = results
    .filter(r => r.status === 'tamam')
    .reduce((s, r) => s + (r.result?.eklenen ?? r.result?.koy_sayisi ?? 0), 0);
  const hatalar = results.filter(r => r.status === 'hata').length;

  return (
    <div className="im-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="im-box">
        {/* Başlık */}
        <div className="im-head">
          <div className="im-head-left">
            <div className="im-head-icon">📥</div>
            <div>
              <div className="im-head-title">Veri Aktarımı</div>
              <div className="im-head-sub">
                {step === 1 ? 'Kategori seçin' : step === 2 ? `${selectedCat.label} · ${year}` : 'Aktarım tamamlandı'}
              </div>
            </div>
          </div>
          <button className="im-close" onClick={onClose}>✕</button>
        </div>

        {/* Adım göstergesi */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--br)', background: 'var(--sf2)' }}>
          {(['Kategori', 'Dosya', 'Sonuç'] as const).map((label, i) => (
            <div key={label} style={{
              flex: 1, padding: '8px 0', textAlign: 'center',
              fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px',
              color: step === i + 1 ? 'var(--gm)' : 'var(--mu)',
              borderBottom: step === i + 1 ? '2px solid var(--gm)' : '2px solid transparent',
              transition: 'all .15s',
            }}>
              <span style={{ opacity: .5 }}>{i + 1}.</span> {label}
            </div>
          ))}
        </div>

        {/* Gövde */}
        <div className="im-body">
          {/* ADIM 1: Kategori */}
          {step === 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {CATS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  style={{
                    padding: '9px 10px', border: '1.5px solid',
                    borderColor: cat === c.id ? 'var(--gm)' : 'var(--br2)',
                    borderRadius: 8, background: cat === c.id ? 'var(--gp)' : '#fff',
                    cursor: 'pointer', textAlign: 'left', transition: 'all .12s',
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 15, marginBottom: 3 }}>{c.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx)', lineHeight: 1.3 }}>{c.label}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--mu)', marginTop: 2 }}>{c.desc}</div>
                </button>
              ))}
            </div>
          )}

          {/* ADIM 2: Yıl + Dosya */}
          {step === 2 && !done && (
            <>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="im-field" style={{ flex: 1 }}>
                  <label className="im-label">Yıl</label>
                  <select className="im-select" value={year} onChange={e => setYear(e.target.value)}>
                    {YEARS.map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
                {cat === 'sut' && (
                  <div className="im-field" style={{ flex: 2 }}>
                    <label className="im-label">Dönem</label>
                    <input
                      className="im-select"
                      placeholder="örn: 2024/1. Dönem"
                      value={donem}
                      onChange={e => setDonem(e.target.value)}
                      style={{ background: '#fff', fontFamily: 'inherit', outline: 'none' }}
                    />
                  </div>
                )}
              </div>

              {/* Dropzone */}
              <div
                className={`im-dropzone${drag ? ' drag' : ''}${files.length ? ' has-file' : ''}`}
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept={selectedCat.accept}
                  onChange={e => addFiles(e.target.files)}
                  style={{ display: 'none' }}
                />
                <div className="im-dz-icon">{files.length ? '📂' : '📁'}</div>
                <div className="im-dz-text">
                  {files.length ? `${files.length} dosya seçildi` : 'Dosyaları buraya sürükleyin'}
                </div>
                <div className="im-dz-hint">{selectedCat.accept} · veya tıklayın</div>
              </div>

              {/* Dosya listesi */}
              {files.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
                  {files.map((f, i) => {
                    const r = results[i];
                    return (
                      <div key={f.name} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '5px 10px', borderRadius: 7, border: '1px solid var(--br)',
                        background: r
                          ? r.status === 'tamam' ? '#edfaf3' : r.status === 'hata' ? '#fdf0ef' : '#f8f9fa'
                          : '#f8f9fa',
                      }}>
                        <span style={{ fontSize: 13 }}>{r ? STATUS_ICON[r.status] : '📄'}</span>
                        <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.name}
                        </span>
                        {r?.status === 'tamam' && (
                          <span style={{ fontSize: 10.5, color: 'var(--gm)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {r.result?.eklenen ? `+${r.result.eklenen.toLocaleString('tr-TR')} kayıt` : `+${r.result?.koy_sayisi} köy`}
                          </span>
                        )}
                        {r?.status === 'hata' && (
                          <span style={{ fontSize: 10, color: 'var(--red)' }}>{r.error?.slice(0, 40)}</span>
                        )}
                        {r?.status === 'yukleniyor' && (
                          <span style={{ fontSize: 10.5, color: 'var(--am)', fontWeight: 700 }}>Yükleniyor…</span>
                        )}
                        {!r && !running && (
                          <button onClick={e => { e.stopPropagation(); removeFile(i); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--mu)' }}>✕</button>
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
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>{hatalar === 0 ? '🎉' : '⚠️'}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gd)', marginBottom: 12 }}>
                {hatalar === 0 ? 'Tüm dosyalar yüklendi!' : `${results.length - hatalar} başarılı, ${hatalar} hatalı`}
              </div>
              <div className="im-summary">
                <div className="im-summary-row">
                  <span className="im-summary-key">Dosya</span>
                  <span className="im-summary-val">{results.length}</span>
                </div>
                <div className="im-summary-row">
                  <span className="im-summary-key">{cat === 'hayvancilik' ? 'Kaydedilen Köy' : 'Eklenen Kayıt'}</span>
                  <span className="im-summary-val" style={{ color: 'var(--gm)', fontSize: 14 }}>
                    {totalKayit.toLocaleString('tr-TR')}
                  </span>
                </div>
              </div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {results.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 6, background: '#f8f9fa', border: '1px solid var(--br)', textAlign: 'left' }}>
                    <span>{STATUS_ICON[r.status]}</span>
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--tx)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: STATUS_COLOR[r.status], whiteSpace: 'nowrap' }}>
                      {r.status === 'tamam'
                        ? r.result?.eklenen ? `+${r.result.eklenen.toLocaleString('tr-TR')}` : `${r.result?.koy_sayisi} köy`
                        : (r.error?.slice(0, 30) ?? '')}
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
              <button className="im-btn im-btn-ghost" onClick={reset}>Yeni Aktarım</button>
              <button className="im-btn im-btn-success" onClick={onClose}>✓ Kapat</button>
            </>
          ) : step === 1 ? (
            <>
              <button className="im-btn im-btn-ghost" onClick={onClose}>İptal</button>
              <button className="im-btn im-btn-primary" onClick={() => setStep(2)}>Devam →</button>
            </>
          ) : (
            <>
              <button className="im-btn im-btn-ghost" onClick={() => { setStep(1); setFiles([]); setResults([]); }}>← Geri</button>
              <button
                className="im-btn im-btn-primary"
                disabled={!files.length || running || (cat === 'sut' && !donem.trim())}
                onClick={handleUpload}
              >
                {running
                  ? `⏳ ${results.filter(r => r.status === 'tamam' || r.status === 'hata').length}/${files.length} yükleniyor…`
                  : `📥 ${files.length} Dosyayı Aktar`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}