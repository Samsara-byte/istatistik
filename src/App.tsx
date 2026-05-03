import { useEffect, useState, useCallback } from 'react'
import Header from '@/components/Header'
import TopNav from '@/components/TopNav'
import Sidebar from '@/components/Sidebar'
import MapPanel from '@/components/MapPanel'
import ImportModal from '@/components/ImportModal'
import UretimTable from '@/components/UretimTable'
import HayvancilikTable from '@/components/HayvancilikTable'
import KooperatifTable from '@/components/KooperatifTable'
import SutTable from '@/components/SutTable'
import GrupAnaliziTable from '@/components/GrupAnaliziTable'
import AlanBazliTable from '@/components/AlanBazliTable'
import FarkPrimTable from '@/components/FarkPrimTable'
import HayvDestekTable from '@/components/HayvDestekTable'
import GenelDestekTable from '@/components/GenelDestekTable'
import BitkiselDestekTable from '@/components/BitkiselDestekTable'
import KoyBilgiNotu from '@/components/KoyBilgiNotu'
import { useAppState } from '@/hooks/useAppState'
import type { ModuleKey } from '@/data/navigation'

type MP = {
  pageId: string
  activeDistrict: string | null
  activeDistrictName: string | null
  selectedVillage: string
  onPickDistrict: (id: string, name: string) => void
  onPickVillage: (pageId: string, village: string) => void
}

function PgHeader({ breadcrumb, title, sub, tag }: {
  breadcrumb: string; title: string; sub?: string; tag?: string
}) {
  return (
    <div className="pg-header">
      <div>
        <div className="bc" dangerouslySetInnerHTML={{ __html: breadcrumb }} />
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {tag && <div className="pg-tag">BURDUR İLİ · <strong>{tag}</strong></div>}
    </div>
  )
}

function ComingSoon({ icon = '🔧', text = 'Bu sekmeye ait veriler yakında yüklenecektir.' }: {
  icon?: string; text?: string
}) {
  return (
    <div className="coming-soon">
      <div className="cs-icon">{icon}</div>
      <div className="cs-title">Veriler Hazırlanıyor</div>
      <div className="cs-text">{text}</div>
    </div>
  )
}

function SutDestPage(mp: MP) {
  return <div><PgHeader breadcrumb="Tarımsal Destekler <span>›</span> Süt Destekleme" title="Süt Destekleme İcmali" tag="Süt Destekleme" /><MapPanel {...mp} /><SutTable /></div>
}
function BitkiselDestPage(mp: MP) {
  return <div><PgHeader breadcrumb="Tarımsal Destekler <span>›</span> Bitkisel Destekler" title="Bitkisel Destekler" tag="Bitkisel Destekler" /><MapPanel {...mp} /><BitkiselDestekTable defaultIlce={mp.activeDistrictName?.toLocaleUpperCase('tr-TR') ?? ''} defaultKoy={mp.selectedVillage} /></div>
}
function GenelPage(mp: MP) {
  return <div><PgHeader breadcrumb="Tarımsal Destekler <span>›</span> Genel Veriler" title="Genel Veriler – Tarımsal Destekler" tag="Tarımsal Destekler" /><MapPanel {...mp} /><GenelDestekTable /><ComingSoon /></div>
}
function AlanBazliPage(mp: MP) {
  return <div><PgHeader breadcrumb="Tarımsal Destekler <span>›</span> Alan Bazlı Destekler" title="Alan Bazlı Destekler" tag="Alan Bazlı" /><MapPanel {...mp} /><AlanBazliTable /></div>
}
function FarkPrimPage(mp: MP) {
  return <div><PgHeader breadcrumb="Tarımsal Destekler <span>›</span> Fark/Prim Ödemeleri" title="Fark/Prim Ödemeleri" tag="Fark-Prim" /><FarkPrimTable /></div>
}
function HayvDestekPage(mp: MP) {
  return <div><PgHeader breadcrumb="Tarımsal Destekler <span>›</span> Hayvancılık Destekleri" title="Hayvancılık Destekleri" tag="Hayvancılık Desteği" /><HayvDestekTable /></div>
}
function BitkPage(mp: MP) {
  return <div><PgHeader breadcrumb="Tarımsal İstatistikler <span>›</span> Bitkisel Üretim" title="Bitkisel Üretim İstatistikleri" tag="Bitkisel Üretim" /><MapPanel {...mp} /><UretimTable defaultIlce={mp.activeDistrictName?.toLocaleUpperCase('tr-TR') ?? ''} defaultKoy={mp.selectedVillage} /><div className="note">* Meyve üretim verilerinde zeytin eziyet miktarı dahil edilmemiştir.</div></div>
}
function HayvIstPage(mp: MP) {
  return <div><PgHeader breadcrumb="Tarımsal İstatistikler <span>›</span> Hayvancılık" title="Hayvancılık İstatistikleri" tag="Hayvancılık" /><MapPanel {...mp} /><HayvancilikTable defaultIlce={mp.activeDistrictName?.toLocaleUpperCase('tr-TR') ?? ''} defaultKoy={mp.selectedVillage} /></div>
}
function GrupPage(mp: MP) {
  return <div><PgHeader breadcrumb="Tarımsal İstatistikler <span>›</span> Ürün Grup Analizi" title="Ürün Grup Analizi" tag="Grup Analizi" /><MapPanel {...mp} /><GrupAnaliziTable /></div>
}
function SuPage(mp: MP) {
  return <div><PgHeader breadcrumb="Tarımsal İstatistikler <span>›</span> Su Ürünleri" title="Su Ürünleri İstatistikleri" tag="Su Ürünleri" /><MapPanel {...mp} /><ComingSoon icon="🐟" text="Burdur Gölü ve diğer su kaynaklarına ait veriler işlenmektedir." /></div>
}
function EkonomikPage(mp: MP) {
  return <div><PgHeader breadcrumb="Kırsal Kalkınma <span>›</span> Ekonomik Yatırımlar" title="Ekonomik Yatırımlar" tag="Kırsal Kalkınma" /><MapPanel {...mp} /><ComingSoon icon="🏭" /></div>
}
function MakinePage(mp: MP) {
  return <div><PgHeader breadcrumb="Kırsal Kalkınma <span>›</span> Makine – Ekipman" title="Makine – Ekipman Destekleri" sub="(2015 yılında sona ermiştir)" tag="Makine-Ekipman" /><MapPanel {...mp} /><ComingSoon icon="⚙️" /><div className="updr"><div className="upd">Son Güncelleme: <strong>03.10.2019</strong></div></div></div>
}
function KoopPage(mp: MP) {
  return <div><PgHeader breadcrumb="Kırsal Kalkınma <span>›</span> Kooperatif Destekleri" title="Kooperatif Destekleri" tag="Kooperatif" /><MapPanel {...mp} /><ComingSoon icon="🤝" /></div>
}
function TkdkPage(mp: MP) {
  return <div><PgHeader breadcrumb="Kırsal Kalkınma <span>›</span> TKDK-IPARD" title="TKDK-IPARD Destekleri" tag="TKDK-IPARD" /><MapPanel {...mp} /><ComingSoon icon="🏷️" /></div>
}
function GencPage(mp: MP) {
  return <div><PgHeader breadcrumb="Kırsal Kalkınma <span>›</span> Genç Çiftçilere Proje Desteği" title="Genç Çiftçilere Proje Desteği" tag="Genç Çiftçi" /><MapPanel {...mp} /><ComingSoon icon="👨‍🌾" /></div>
}
function MuhtarlarPage(mp: MP) {
  return <div><PgHeader breadcrumb="Özel Bilgiler <span>›</span> Muhtarlar" title="Köy ve Mahalle Muhtarları" tag="Muhtarlar" /><MapPanel {...mp} /><ComingSoon icon="👤" text="Muhtar bilgileri yakında eklenecektir." /></div>
}
function KooperatiflerPage(_mp: MP) {
  return <div><PgHeader breadcrumb="Özel Bilgiler <span>›</span> Kooperatifler" title="Kooperatifler & Birlikler" tag="Kooperatifler" /><KooperatifTable /></div>
}
function GidaPage(mp: MP) {
  return <div><PgHeader breadcrumb="Diğer Veriler <span>›</span> Gıda Denetimleri" title="Gıda Denetimleri" tag="Gıda Denetimi" /><MapPanel {...mp} /><ComingSoon icon="🔍" /></div>
}

export default function App() {
  const { state, switchModule, switchPage, pickDistrict, pickVillage } = useAppState()
  const [footerDate, setFooterDate] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setFooterDate(new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }))
  }, [])

  // Ekran boyutunu takip et
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Sayfa değişince drawer kapansın
  useEffect(() => {
    setSidebarOpen(false)
  }, [state.activePage])

  // ESC tuşu ile drawer kapansın
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const handleSwitchModule = useCallback((mod: ModuleKey) => {
    switchModule(mod)
    setSidebarOpen(false)
  }, [switchModule])

  const mp: MP = {
    pageId: state.activePage,
    activeDistrict: state.activeDistrict,
    activeDistrictName: state.activeDistrictName,
    selectedVillage: state.villageByPage[state.activePage] ?? '',
    onPickDistrict: pickDistrict,
    onPickVillage: pickVillage,
  }

  const renderPage = () => {
    switch (state.activePage) {
      case 'p-bilginotu':      return <KoyBilgiNotu />
      case 'p-genel':          return <GenelPage {...mp} />
      case 'p-alan':           return <AlanBazliPage {...mp} />
      case 'p-fark':           return <FarkPrimPage {...mp} />
      case 'p-hayv-d':         return <HayvDestekPage {...mp} />
      case 'p-sut-dest':       return <SutDestPage {...mp} />
      case 'p-bitkisel-dest':  return <BitkiselDestPage {...mp} />
      case 'p-bitk':           return <BitkPage {...mp} />
      case 'p-grup':           return <GrupPage {...mp} />
      case 'p-hayv-ist':       return <HayvIstPage {...mp} />
      case 'p-su':             return <SuPage {...mp} />
      case 'p-ekonomik':       return <EkonomikPage {...mp} />
      case 'p-makine':         return <MakinePage {...mp} />
      case 'p-koop':           return <KoopPage {...mp} />
      case 'p-tkdk':           return <TkdkPage {...mp} />
      case 'p-genc':           return <GencPage {...mp} />
      case 'p-muhtarlar':      return <MuhtarlarPage {...mp} />
      case 'p-kooperatifler':  return <KooperatiflerPage {...mp} />
      case 'p-gida':           return <GidaPage {...mp} />
      default:                 return <GenelPage {...mp} />
    }
  }

  const showSidebar = state.activeModule !== 'bilginotu'

  return (
    <>
      <Header
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(o => !o)}
        showHam={showSidebar && isMobile}
      />
      <TopNav
        activeModule={state.activeModule}
        activePage={state.activePage}
        onSwitchModule={handleSwitchModule}
        onOpenImport={() => setShowImport(true)}
      />
      <div className="app">
        {showSidebar && (
          <Sidebar
            activeModule={state.activeModule}
            activePage={state.activePage}
            onSwitchPage={switchPage}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        )}
        <main style={!showSidebar ? { width: '100%' } : undefined}>
          <div className="page on">{renderPage()}</div>
        </main>
      </div>
      <footer>
        <span>© {new Date().getFullYear()} Burdur İl Tarım ve Orman Müdürlüğü</span>
        <span><strong>Veri Tarihi:</strong> {footerDate}</span>
      </footer>
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onDone={() => setShowImport(false)} />
      )}
    </>
  )
}