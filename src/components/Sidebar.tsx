import { MODULES, type ModuleKey } from '@/data/navigation'

interface Props { activeModule: ModuleKey; activePage: string; onSwitchPage: (pageId: string) => void }

export default function Sidebar({ activeModule, activePage, onSwitchPage }: Props) {
  const module = MODULES.find(m => m.key === activeModule)
  if (!module) return null
  return (
    <aside>
      <div className="sb-module-label">{module.emoji} {module.label}</div>
      <nav className="sb-nav">
        {module.items.map(item => (
          <button key={item.pageId} className={`sbi${activePage===item.pageId?' on':''}`} onClick={()=>onSwitchPage(item.pageId)}>
            <span className="sbi-ico">{item.icon}</span>
            <span className="sbi-label">{item.label}</span>
            {activePage===item.pageId && <span className="sbi-dot" />}
          </button>
        ))}
      </nav>
    </aside>
  )
}
