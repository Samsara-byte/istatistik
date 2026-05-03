import { MODULES, type ModuleKey } from '@/data/navigation'

interface Props {
  activeModule: ModuleKey
  activePage: string
  onSwitchPage: (pageId: string) => void
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ activeModule, activePage, onSwitchPage, isOpen, onClose }: Props) {
  const module = MODULES.find(m => m.key === activeModule)
  if (!module) return null

  const handlePageClick = (pageId: string) => {
    onSwitchPage(pageId)
    onClose() // mobilde sayfa değişince drawer kapanır
  }

  return (
    <>
      {/* Overlay — sadece mobilde, drawer açıkken */}
      {isOpen && (
        <div
          className="sb-overlay visible"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={isOpen ? 'open' : ''}>
        {/* Mobil kapat butonu */}
        <button className="sb-close-btn" onClick={onClose}>
          <span style={{ fontSize: 11, color: 'var(--mu)', fontWeight: 700 }}>Kapat</span>
          <span style={{ fontSize: 16, lineHeight: 1 }}>✕</span>
        </button>

        <div className="sb-module-label">{module.emoji} {module.label}</div>
        <nav className="sb-nav">
          {module.items.map(item => (
            <button
              key={item.pageId}
              className={`sbi${activePage === item.pageId ? ' on' : ''}`}
              onClick={() => handlePageClick(item.pageId)}
            >
              <span className="sbi-ico">{item.icon}</span>
              <span className="sbi-label">{item.label}</span>
              {activePage === item.pageId && <span className="sbi-dot" />}
            </button>
          ))}
        </nav>
      </aside>
    </>
  )
}