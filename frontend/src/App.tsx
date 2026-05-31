import { lazy, Suspense, useEffect, useState, useCallback } from "react";
import Header      from "@/components/Header";
import TopNav      from "@/components/TopNav";
import Sidebar     from "@/components/Sidebar";
import MapPanel    from "@/components/MapPanel";
import ImportModal from "@/components/ImportModal";
import { useAppState } from "@/hooks/useAppState";
import type { ModuleKey } from "@/data/navigation";

// ── Lazy imports ──────────────────────────────────────────────────
const UretimTable         = lazy(() => import("@/components/UretimTable"));
const HayvancilikTable    = lazy(() => import("@/components/HayvancilikTable"));
const KooperatifTable     = lazy(() => import("@/components/KooperatifTable"));
const SutTable            = lazy(() => import("@/components/SutTable"));
const GrupAnaliziTable    = lazy(() => import("@/components/GrupAnaliziTable"));
const AlanBazliTable      = lazy(() => import("@/components/AlanBazliTable"));
const FarkPrimTable       = lazy(() => import("@/components/FarkPrimTable"));
const HayvDestekTable     = lazy(() => import("@/components/HayvDestekTable"));
const GenelDestekTable    = lazy(() => import("@/components/GenelDestekTable"));
const BitkiselDestekTable = lazy(() => import("@/components/BitkiselDestekTable"));
const PlanliUretimTable   = lazy(() => import("@/components/PlanliUretimTable"));
const KoyBilgiNotu        = lazy(() => import("@/components/KoyBilgiNotu"));

// ── Tipler ────────────────────────────────────────────────────────
interface MP {
  pageId: string;
  activeDistrict: string | null;
  activeDistrictName: string | null;
  selectedVillage: string;
  onPickDistrict: (id: string, name: string) => void;
  onPickVillage: (pageId: string, village: string) => void;
}

// ── Paylaşımlı yardımcı bileşenler ──────────────────────────────
function PgHeader({ breadcrumb, title, sub, tag }: {
  breadcrumb: string; title: string; sub?: string; tag?: string;
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
  );
}

function ComingSoon({
  icon = "🔧",
  text = "Bu sekmeye ait veriler yakında yüklenecektir.",
}: {
  icon?: string; text?: string;
}) {
  return (
    <div className="coming-soon">
      <div className="cs-icon">{icon}</div>
      <div className="cs-title">Veriler Hazırlanıyor</div>
      <div className="cs-text">{text}</div>
    </div>
  );
}

function PageLoader() {
  return (
    <div style={{ padding: 48, textAlign: "center", color: "var(--mu)", fontSize: 13 }}>
      ⏳ Yükleniyor…
    </div>
  );
}

// ── Sayfa bileşenleri ─────────────────────────────────────────────
function BitkPage(mp: MP) {
  return (
    <div>
      <PgHeader breadcrumb="Tarımsal İstatistikler <span>›</span> Bitkisel Üretim" title="Bitkisel Üretim İstatistikleri" tag="Bitkisel Üretim" />
      <MapPanel {...mp} />
      <UretimTable
        defaultIlce={mp.activeDistrictName?.toLocaleUpperCase("tr-TR") ?? ""}
        defaultKoy={mp.selectedVillage}
      />
      <div className="note">* Meyve üretim verilerinde zeytin eziyet miktarı dahil edilmemiştir.</div>
    </div>
  );
}

function HayvIstPage(mp: MP) {
  return (
    <div>
      <PgHeader breadcrumb="Tarımsal İstatistikler <span>›</span> Hayvancılık" title="Hayvancılık İstatistikleri" tag="Hayvancılık" />
      <MapPanel {...mp} />
      <HayvancilikTable
        defaultIlce={mp.activeDistrictName?.toLocaleUpperCase("tr-TR") ?? ""}
        defaultKoy={mp.selectedVillage}
      />
    </div>
  );
}

function GrupPage(mp: MP) {
  return (
    <div>
      <PgHeader breadcrumb="Tarımsal İstatistikler <span>›</span> Ürün Grup Analizi" title="Ürün Grup Analizi" tag="Grup Analizi" />
      <MapPanel {...mp} />
      <GrupAnaliziTable />
    </div>
  );
}

function BitkiselDestPage(mp: MP) {
  return (
    <div>
      <PgHeader breadcrumb="Tarımsal Destekler <span>›</span> Bitkisel Destekler" title="Bitkisel Destekler" tag="Bitkisel Destekler" />
      <MapPanel {...mp} />
      <BitkiselDestekTable
        defaultIlce={mp.activeDistrictName?.toLocaleUpperCase("tr-TR") ?? ""}
        defaultKoy={mp.selectedVillage}
      />
    </div>
  );
}

function SutDestPage(mp: MP) {
  return (
    <div>
      <PgHeader breadcrumb="Tarımsal Destekler <span>›</span> Süt Destekleme" title="Süt Destekleme İcmali" tag="Süt Destekleme" />
      <MapPanel {...mp} />
      <SutTable />
    </div>
  );
}

function AlanBazliPage(mp: MP) {
  return (
    <div>
      <PgHeader breadcrumb="Tarımsal Destekler <span>›</span> Alan Bazlı Destekler" title="Alan Bazlı Destekler" tag="Alan Bazlı" />
      <MapPanel {...mp} />
      <AlanBazliTable />
    </div>
  );
}

function KooperatiflerPage() {
  return (
    <div>
      <PgHeader breadcrumb="Özel Bilgiler <span>›</span> Kooperatifler" title="Kooperatifler & Birlikler" tag="Kooperatifler" />
      <KooperatifTable />
    </div>
  );
}

function GidaPage() {
  return (
    <div>
      <PgHeader
        breadcrumb="Diğer Veriler <span>&rsaquo;</span> Gıda Denetimleri"
        title="Gıda ve Yem Denetimleri"
        sub="Faaliyet Raporu · 2026 Yılı İlk Üç Ay"
        tag="Gıda Denetimi"
      />
      <GidaDenetimleriTable />
    </div>
  );
}

// ComingSoon sayfaları — aynı şablondan üretilir
function makeComingPage(
  breadcrumb: string, title: string, tag: string,
  icon?: string, text?: string, sub?: string, note?: string,
) {
  return function Page(mp: MP) {
    return (
      <div>
        <PgHeader breadcrumb={breadcrumb} title={title} tag={tag} sub={sub} />
        <MapPanel {...mp} />
        <ComingSoon icon={icon} text={text} />
        {note && (
          <div className="updr"><div className="upd">Son Güncelleme: <strong>{note}</strong></div></div>
        )}
      </div>
    );
  };
}

function GenelPage(mp: MP) {
  return (
    <div>
      <PgHeader
        breadcrumb="Tarımsal Destekler <span>›</span> Genel Veriler"
        title="Genel Veriler – Tarımsal Destekler"
        tag="Tarımsal Destekler"
      />
      <MapPanel {...mp} />
      <GenelDestekTable />
    </div>
  );
}

function PlanliUretimPage(mp: MP) {
  return (
    <div>
      <PgHeader
        breadcrumb="Tarımsal Destekler <span>›</span> Planlı Üretim Desteği"
        title="Planlı Üretim Desteği"
        tag="Planlı Üretim"
      />
      <MapPanel {...mp} />
      <PlanliUretimTable
        defaultIlce={mp.activeDistrictName?.toLocaleUpperCase("tr-TR") ?? ""}
        defaultKoy={mp.selectedVillage}
      />
    </div>
  );
}
const SuPage       = makeComingPage("Tarımsal İstatistikler <span>›</span> Su Ürünleri",    "Su Ürünleri İstatistikleri",         "Su Ürünleri", "🐟", "Burdur Gölü ve diğer su kaynaklarına ait veriler işlenmektedir.");
const EkonomikPage = makeComingPage("Kırsal Kalkınma <span>›</span> Ekonomik Yatırımlar",  "Ekonomik Yatırımlar",                "Kırsal Kalkınma", "🏭");
const MakinePage   = makeComingPage("Kırsal Kalkınma <span>›</span> Makine – Ekipman",     "Makine – Ekipman Destekleri",        "Makine-Ekipman", "⚙️", undefined, "(2015 yılında sona ermiştir)", "03.10.2019");
const KoopPage     = makeComingPage("Kırsal Kalkınma <span>›</span> Kooperatif Destekleri","Kooperatif Destekleri",              "Kooperatif", "🤝");
const TkdkPage     = makeComingPage("Kırsal Kalkınma <span>›</span> TKDK-IPARD",           "TKDK-IPARD Destekleri",              "TKDK-IPARD", "🏷️");
const GencPage     = makeComingPage("Kırsal Kalkınma <span>›</span> Genç Çiftçilere Proje Desteği", "Genç Çiftçilere Proje Desteği", "Genç Çiftçi", "👨‍🌾");
const MuhtarlarPage = makeComingPage("Özel Bilgiler <span>›</span> Muhtarlar",             "Köy ve Mahalle Muhtarları",          "Muhtarlar", "👤", "Muhtar bilgileri yakında eklenecektir.");

// ── Sayfa render fonksiyonu ───────────────────────────────────────
function renderPage(pageId: string, mp: MP) {
  const wrap = (node: React.ReactElement) => (
    <Suspense fallback={<PageLoader />}>{node}</Suspense>
  );

  switch (pageId) {
    case "p-bilginotu":     return wrap(<KoyBilgiNotu />);
    case "p-genel":         return wrap(<GenelPage {...mp} />);
    case "p-alan":          return wrap(<AlanBazliPage {...mp} />);
    case "p-fark":          return wrap(<FarkPrimTable />);
    case "p-hayv-d":        return wrap(<HayvDestekTable />);
    case "p-sut-dest":      return wrap(<SutDestPage {...mp} />);
    case "p-bitkisel-dest": return wrap(<BitkiselDestPage {...mp} />);
    case "p-planli-uretim": return wrap(<PlanliUretimPage {...mp} />);
    case "p-bitk":          return wrap(<BitkPage {...mp} />);
    case "p-grup":          return wrap(<GrupPage {...mp} />);
    case "p-hayv-ist":      return wrap(<HayvIstPage {...mp} />);
    case "p-su":            return wrap(<SuPage {...mp} />);
    case "p-ekonomik":      return wrap(<EkonomikPage {...mp} />);
    case "p-makine":        return wrap(<MakinePage {...mp} />);
    case "p-koop":          return wrap(<KoopPage {...mp} />);
    case "p-tkdk":          return wrap(<TkdkPage {...mp} />);
    case "p-genc":          return wrap(<GencPage {...mp} />);
    case "p-muhtarlar":     return wrap(<MuhtarlarPage {...mp} />);
    case "p-kooperatifler": return wrap(<KooperatiflerPage />);
    case "p-gida":          return wrap(<GidaPage />);
    default:                return wrap(<GenelPage {...mp} />);
  }
}

// ═══════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════
export default function App() {
  const { state, switchModule, switchPage, pickDistrict, pickVillage } = useAppState();
  const [footerDate, setFooterDate] = useState("");
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    setFooterDate(
      new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }),
    );
  }, []);

  const handleSwitchModule = useCallback((mod: ModuleKey) => switchModule(mod), [switchModule]);
  const handleSwitchPage   = useCallback((pageId: string) => switchPage(pageId), [switchPage]);
  const handlePickDistrict = useCallback((id: string, name: string) => pickDistrict(id, name), [pickDistrict]);
  const handlePickVillage  = useCallback((pageId: string, village: string) => pickVillage(pageId, village), [pickVillage]);

  const mp: MP = {
    pageId: state.activePage,
    activeDistrict: state.activeDistrict,
    activeDistrictName: state.activeDistrictName,
    selectedVillage: state.villageByPage[state.activePage] ?? "",
    onPickDistrict: handlePickDistrict,
    onPickVillage: handlePickVillage,
  };

  const isBilgiNotu = state.activeModule === "bilginotu";

  return (
    <>
      <Header />
      <TopNav
        activeModule={state.activeModule}
        activePage={state.activePage}
        onSwitchModule={handleSwitchModule}
        onOpenImport={() => setShowImport(true)}
      />
      <div className="app">
        {!isBilgiNotu && (
          <Sidebar
            activeModule={state.activeModule}
            activePage={state.activePage}
            onSwitchPage={handleSwitchPage}
          />
        )}
        <main style={isBilgiNotu ? { width: "100%" } : undefined}>
          <div className="page on">
            {renderPage(state.activePage, mp)}
          </div>
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
  );
}