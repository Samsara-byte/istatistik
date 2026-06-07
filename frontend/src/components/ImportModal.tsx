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
  | 'cks-sayisi' | 'genel-destek' | 'bitkisel-destek'
  | 'planli-uretim' | 'sertifikali-fidan' | 'sertifikali-tohum' | 'temel-destek' | 'yem-bitkileri' | 'zirai-don';

// 'duplikat' yeni özel durum — hata sayılmaz, uyarı olarak gösterilir
type FileStatus = 'bekliyor' | 'yukleniyor' | 'tamam' | 'hata' | 'duplikat';

interface FileResult {
  name: string;
  status: FileStatus;
  result?: ImportResponse & { koy_sayisi?: number };
  error?: string;
}

const CATS: { id: Category; icon: string; label: string; desc: string; accept: string }[] = [
  { id: 'uretim',           icon: '🌾', label: 'Bitkisel Üretim (ÇKS)',    desc: 'İlçe bazlı .xlsx dosyaları',              accept: '.xlsx,.xls,.xlsm,.ods' },
  { id: 'hayvancilik',      icon: '🐄', label: 'Hayvancılık',               desc: 'İlçe bazlı .xls dosyaları',               accept: '.xls,.xlsx' },
  { id: 'kooperatif',       icon: '🤝', label: 'Kooperatifler & Birlikler', desc: 'Tek .xls dosyası (tüm ilçeler)',           accept: '.xls,.xlsx' },
  { id: 'sut',              icon: '🥛', label: 'Süt Destekleme İcmali',     desc: 'Dönemlik .xlsx icmal dosyası',             accept: '.xlsx,.xls' },
  { id: 'alan-bazli',       icon: '🌾', label: 'Alan Bazlı Destekler',      desc: 'Yıllık .xls özet dosyası',                accept: '.xls,.xlsx' },
  { id: 'fark-prim',        icon: '💰', label: 'Fark/Prim Ödemeleri',       desc: 'Yıllık .xls özet dosyası',                accept: '.xls,.xlsx' },
  { id: 'hayv-destek',      icon: '🐄', label: 'Hayvancılık Destekleri',    desc: 'Yıllık .xls özet dosyası',                accept: '.xls,.xlsx' },
  { id: 'cks-sayisi',       icon: '👨‍🌾', label: 'ÇKS Çiftçi Sayısı',     desc: 'Yıllık .xlsx köy bazlı sayım',             accept: '.xlsx,.xls' },
  { id: 'genel-destek',     icon: '📊', label: 'Genel Destekler Özeti',     desc: 'Yıllık .xls özet dosyası',                accept: '.xls,.xlsx' },
  { id: 'bitkisel-destek',  icon: '🌿', label: 'Bitkisel Destekler',        desc: 'Feromon/Biyolojik .xls icmal dosyaları',  accept: '.xls,.xlsx,.xlsm' },
  { id: 'planli-uretim',    icon: '📋', label: 'Planlı Üretim Desteği',     desc: 'İlçe bazlı İCMAL-2 .xls dosyaları',      accept: '.xls,.xlsx,.xlsm' },
  { id: 'sertifikali-fidan',icon: '🌱', label: 'Sertifikalı Fidan Desteği', desc: 'İCMAL-2 fidan kullanım .xls dosyaları',  accept: '.xls,.xlsx,.xlsm' },
  { id: 'sertifikali-tohum',icon: '🌾', label: 'Sertifikalı Tohum Desteği', desc: 'İCMAL-2 tohum kullanım .xls dosyaları',  accept: '.xls,.xlsx,.xlsm' },
  { id: 'temel-destek',      icon: '🌱', label: 'Temel Destek',                 desc: 'İCMAL-2 temel destek .xls dosyaları',    accept: '.xls,.xlsx,.xlsm' },
  { id: 'yem-bitkileri',     icon: '🌿', label: 'Yem Bitkileri Desteği',          desc: 'İCMAL-2 yem bitkileri .xls dosyaları',   accept: '.xls,.xlsx,.xlsm' },
  { id: 'zirai-don',         icon: '❄️', label: 'Zirai Don Desteği',              desc: 'İCMAL-2 zirai don .xls dosyaları',       accept: '.xls,.xlsx,.xlsm' },
];

const STATUS_ICON: Record<FileStatus, string> = {
  bekliyor:   '⏸',
  yukleniyor: '⏳',
  tamam:      '✅',
  hata:       '❌',
  duplikat:   '🔁',
};

const STATUS_COLOR: Record<FileStatus, string> = {
  bekliyor:   'var(--mu)',
  yukleniyor: 'var(--am)',
  tamam:      'var(--gm)',
  hata:       'var(--red)',
  duplikat:   '#b45309',   // amber-700 — uyarı tonu, hata değil
};

const STATUS_BG: Record<FileStatus, string> = {
  bekliyor:   '#f8f9fa',
  yukleniyor: '#fffbeb',
  tamam:      '#edfaf3',
  hata:       '#fdf0ef',
  duplikat:   '#fffbeb',  // amber tonu
};

const STATUS_BORDER: Record<FileStatus, string> = {
  bekliyor:   'var(--br)',
  yukleniyor: '#fcd34d44',
  tamam:      '#bbf7d044',
  hata:       '#fca5a544',
  duplikat:   '#fcd34d88',
};

/** 409 veya backend mesajından duplicate tespiti */
function isDuplicate(msg: string): boolean {
  return (
    msg.includes('409') ||
    msg.includes('daha önce yüklenmiş') ||
    msg.toLowerCase().includes('conflict') ||
    msg.toLowerCase().includes('duplicate')
  );
}

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
          case 'hayvancilik':      res = await api.importHayvancilik(files[i], year);         break;
          case 'kooperatif':       res = await api.importKooperatif(files[i]);                break;
          case 'sut':              res = await api.importSut(files[i], donem, year);          break;
          case 'alan-bazli':       res = await api.importAlanBazli(files[i]);                 break;
          case 'fark-prim':        res = await api.importFarkPrim(files[i]);                  break;
          case 'hayv-destek':      res = await api.importHayvDestek(files[i]);                break;
          case 'cks-sayisi':       res = await api.importCksSayisi(files[i], year);           break;
          case 'genel-destek':     res = await api.importGenelDestek(files[i]);               break;
          case 'bitkisel-destek':  res = await api.importBitkiselDestek(files[i], year);      break;
          case 'planli-uretim':    res = await api.importPlanliUretim(files[i], year);        break;
          case 'sertifikali-fidan':res = await api.importSertifikaliFidan(files[i], year);    break;
          case 'sertifikali-tohum': res = await api.importSertifikaliTohum(files[i], year);    break;
          case 'temel-destek':      res = await api.importTemelDestek(files[i], year);       break;
          case 'yem-bitkileri':      res = await api.importYemBitkileri(files[i], year);    break;
          case 'zirai-don':          res = await api.importZiraiDon(files[i], year);        break;
          default:                 res = await api.importExcel(files[i], year);
        }
        setResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'tamam', result: res as ImportResponse & { koy_sayisi?: number } } : r,
        ));
      } catch (e) {
        const msg = (e as Error).message;
        if (isDuplicate(msg)) {
          // Duplicate → özel 'duplikat' durumu, hata sayılmaz
          setResults(prev => prev.map((r, idx) =>
            idx === i ? { ...r, status: 'duplikat', error: 'Bu dosya daha önce yüklenmiş' } : r,
          ));
        } else {
          setResults(prev => prev.map((r, idx) =>
            idx === i ? { ...r, status: 'hata', error: msg } : r,
          ));
        }
      }
    }
    setRunning(false);

    // onDone yalnızca tüm dosyalar başarılıysa çağrılır.
    // Hata veya duplikat varsa modal açık kalır, sonuç ekranı gösterilir.
    setResults(prev => {
      const anyProblem = prev.some(r => r.status === 'hata' || r.status === 'duplikat');
      if (!anyProblem) onDone?.();
      return prev;
    });
    setDone(true);
  }, [files, year, cat, donem, onDone]);

  const totalKayit   = results.filter(r => r.status === 'tamam').reduce((s, r) => s + (r.result?.eklenen ?? r.result?.koy_sayisi ?? 0), 0);
  const hatalar      = results.filter(r => r.status === 'hata').length;
  const duplikatlar  = results.filter(r => r.status === 'duplikat').length;

  return (
    <div className="im-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="im-box" style={{ width: 'min(720px, 96vw)', maxHeight: '96vh', display: 'flex', flexDirection: 'column' }}>

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
        <div className="im-body" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}>

          {/* ADIM 1: Kategori */}
          {step === 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
              {CATS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  style={{
                    padding: '7px 8px', border: '1.5px solid',
                    borderColor: cat === c.id ? 'var(--gm)' : 'var(--br2)',
                    borderRadius: 7, background: cat === c.id ? 'var(--gp)' : '#fff',
                    cursor: 'pointer', textAlign: 'left', transition: 'all .12s',
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 13, marginBottom: 2 }}>{c.icon}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--tx)', lineHeight: 1.3 }}>{c.label}</div>
                  <div style={{ fontSize: 9, color: 'var(--mu)', marginTop: 1 }}>{c.desc}</div>
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
                    const st: FileStatus | undefined = r?.status;
                    return (
                      <div key={f.name} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '5px 10px', borderRadius: 7,
                        border: `1px solid ${st ? STATUS_BORDER[st] : 'var(--br)'}`,
                        background: st ? STATUS_BG[st] : '#f8f9fa',
                        transition: 'background .2s, border-color .2s',
                      }}>
                        <span style={{ fontSize: 13 }}>{st ? STATUS_ICON[st] : '📄'}</span>
                        <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.name}
                        </span>

                        {/* Durum etiketleri */}
                        {st === 'tamam' && (
                          <span style={{ fontSize: 10.5, color: 'var(--gm)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {r.result?.eklenen ? `+${r.result.eklenen.toLocaleString('tr-TR')} kayıt` : `+${r.result?.koy_sayisi} köy`}
                          </span>
                        )}
                        {st === 'duplikat' && (
                          <span style={{ fontSize: 10.5, color: '#b45309', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            Daha önce yüklendi
                          </span>
                        )}
                        {st === 'hata' && (
                          <span
                            title={r.error}
                            style={{ fontSize: 10, color: 'var(--red)', cursor: 'help', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}
                          >
                            {r.error?.slice(0, 55)}
                          </span>
                        )}
                        {st === 'yukleniyor' && (
                          <span style={{ fontSize: 10.5, color: 'var(--am)', fontWeight: 700 }}>Yükleniyor…</span>
                        )}
                        {!st && !running && (
                          <button onClick={e => { e.stopPropagation(); removeFile(i); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--mu)' }}>✕</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Duplikat uyarı banner'ı — yükleme sonrası canlı gösterim ── */}
              {duplikatlar > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', borderRadius: 8,
                  background: '#fffbeb',
                  border: '1.5px solid #fcd34d',
                  marginTop: 4,
                }}>
                  <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>🔁</span>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#92400e', marginBottom: 2 }}>
                      {duplikatlar} dosya daha önce yüklenmiş
                    </div>
                    <div style={{ fontSize: 10.5, color: '#b45309', lineHeight: 1.5 }}>
                      Sistem aynı dosyanın tekrar yüklenmesini önler.
                      Yeniden yüklemek için veritabanındaki kayıt silinmeli:{' '}
                      <code style={{ fontFamily: 'monospace', background: '#fef3c7', padding: '1px 4px', borderRadius: 3 }}>
                        DELETE FROM import_log WHERE dosya_adi = '…'
                      </code>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Hata banner'ı — hata varsa canlı gösterim ── */}
              {hatalar > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', borderRadius: 8,
                  background: '#fef2f2',
                  border: '1.5px solid #fca5a5',
                  marginTop: 4,
                }}>
                  <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>❌</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>
                      {hatalar} dosyada hata oluştu
                    </div>
                    {results.filter(r => r.status === 'hata').map((r, i) => (
                      <div key={i} style={{ fontSize: 10.5, color: '#b91c1c', lineHeight: 1.6, marginBottom: 2 }}>
                        <strong style={{ fontWeight: 700 }}>{r.name}:</strong>{' '}
                        <span title={r.error} style={{ cursor: 'help' }}>{r.error ?? 'Bilinmeyen hata'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ADIM 3: Sonuç */}
          {done && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              {/* Durum ikonu */}
              <div style={{ fontSize: 34, marginBottom: 8 }}>
                {hatalar > 0 ? '❌' : duplikatlar > 0 && totalKayit === 0 ? '🔁' : duplikatlar > 0 ? '⚠️' : '🎉'}
              </div>

              {/* Başlık */}
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gd)', marginBottom: 12 }}>
                {hatalar > 0
                  ? `${results.length - hatalar - duplikatlar} başarılı · ${hatalar} hatalı${duplikatlar > 0 ? ` · ${duplikatlar} tekrar` : ''}`
                  : duplikatlar > 0 && totalKayit === 0
                    ? 'Dosyalar zaten yüklü'
                    : duplikatlar > 0
                      ? `${results.length - duplikatlar} yüklendi · ${duplikatlar} tekrar`
                      : 'Tüm dosyalar yüklendi!'}
              </div>

              {/* Özet sayılar */}
              <div className="im-summary">
                <div className="im-summary-row">
                  <span className="im-summary-key">Dosya</span>
                  <span className="im-summary-val">{results.length}</span>
                </div>
                {totalKayit > 0 && (
                  <div className="im-summary-row">
                    <span className="im-summary-key">{cat === 'hayvancilik' ? 'Kaydedilen Köy' : 'Eklenen Kayıt'}</span>
                    <span className="im-summary-val" style={{ color: 'var(--gm)', fontSize: 14 }}>
                      {totalKayit.toLocaleString('tr-TR')}
                    </span>
                  </div>
                )}
                {duplikatlar > 0 && (
                  <div className="im-summary-row">
                    <span className="im-summary-key">Tekrar (atlandı)</span>
                    <span className="im-summary-val" style={{ color: '#b45309' }}>{duplikatlar}</span>
                  </div>
                )}
              </div>

              {/* Dosya bazlı satır listesi */}
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {results.map((r, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 10px', borderRadius: 6, textAlign: 'left',
                    background: STATUS_BG[r.status],
                    border: `1px solid ${STATUS_BORDER[r.status]}`,
                  }}>
                    <span>{STATUS_ICON[r.status]}</span>
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--tx)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                    </span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: STATUS_COLOR[r.status], whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>
                      {r.status === 'tamam'
                        ? r.result?.eklenen ? `+${r.result.eklenen.toLocaleString('tr-TR')}` : `${r.result?.koy_sayisi} köy`
                        : r.status === 'duplikat'
                          ? 'Daha önce yüklendi'
                          : <span title={r.error ?? ''}>{r.error?.slice(0, 40) ?? ''}</span>}
                    </span>
                  </div>
                ))}
              </div>

              {/* Duplikat açıklama kutusu — sadece duplikat varsa */}
              {duplikatlar > 0 && (
                <div style={{
                  marginTop: 12, padding: '10px 12px', borderRadius: 8, textAlign: 'left',
                  background: '#fffbeb', border: '1.5px solid #fcd34d',
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <span style={{ fontSize: 15, flexShrink: 0 }}>ℹ️</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 3 }}>
                      Tekrar yükleme neden engellendi?
                    </div>
                    <div style={{ fontSize: 10.5, color: '#b45309', lineHeight: 1.6 }}>
                      Her dosyanın SHA-256 özeti saklanır; aynı dosya tekrar yüklenemez.
                      Zorla yüklemek için <code style={{ fontFamily: 'monospace', background: '#fef3c7', padding: '1px 4px', borderRadius: 3, fontSize: 10 }}>import_log</code> tablosundan
                      ilgili kaydı silin:
                    </div>
                    {results.filter(r => r.status === 'duplikat').map((r, i) => (
                      <code key={i} style={{
                        display: 'block', marginTop: 4, fontFamily: 'monospace', fontSize: 10,
                        background: '#fef3c7', padding: '3px 6px', borderRadius: 4,
                        color: '#92400e', wordBreak: 'break-all',
                      }}>
                        DELETE FROM import_log WHERE dosya_adi = '{r.name}';
                      </code>
                    ))}
                  </div>
                </div>
              )}
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
                  ? `⏳ ${results.filter(r => r.status === 'tamam' || r.status === 'hata' || r.status === 'duplikat').length}/${files.length} işleniyor…`
                  : `📥 ${files.length} Dosyayı Aktar`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}