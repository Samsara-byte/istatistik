import { MODULES, type ModuleKey } from '@/data/navigation'

interface Props { activeModule: ModuleKey; activePage: string; onSwitchModule: (mod: ModuleKey) => void; onOpenImport: () => void }

export default function TopNav({ activeModule, onSwitchModule, onOpenImport }: Props) {
  return (
    <nav className="topnav">
      <div className="tnb-group">
        {MODULES.map(m => (
          <button key={m.key} className={`tnb${activeModule===m.key?' on':''}`} onClick={()=>onSwitchModule(m.key)}>
            <span className="tnb-emoji">{m.emoji}</span>
            <span className="tnb-label">{m.label}</span>
          </button>
        ))}
      </div>
      <button className="tnb-import" onClick={onOpenImport}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        İçeri Aktar
      </button>
    </nav>
  )
}
