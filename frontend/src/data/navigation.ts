export type ModuleKey =
  | "dest" | "ist" | "kirsal" | "diger" | "ozel" | "bilginotu";

export interface SidebarItem {
  icon: string;
  label: string;
  pageId: string;
}

export interface Module {
  key: ModuleKey;
  label: string;
  emoji: string;
  sidebarId: string;
  firstPage: string;
  items: SidebarItem[];
}

export const MODULES: Module[] = [
  {
    key: "bilginotu",
    label: "Köy Bilgi Notu",
    emoji: "📋",
    sidebarId: "sb-bilginotu",
    firstPage: "p-bilginotu",
    items: [{ icon: "📄", label: "Köy Bilgi Notu", pageId: "p-bilginotu" }],
  },
  {
    key: "dest",
    label: "Tarımsal Destekler",
    emoji: "🌱",
    sidebarId: "sb-dest",
    firstPage: "p-genel",
    items: [
      { icon: "📈", label: "Genel Veriler",          pageId: "p-genel" },
      { icon: "🌾", label: "Alan Bazlı Destekler",   pageId: "p-alan" },
      { icon: "💰", label: "Fark/Prim Ödemeleri",    pageId: "p-fark" },
      { icon: "🐄", label: "Hayvancılık Destekleri", pageId: "p-hayv-d" },
      { icon: "🥛", label: "Süt Destekleme",         pageId: "p-sut-dest" },
      { icon: "🌿", label: "Bitkisel Destekler",     pageId: "p-bitkisel-dest" },
      { icon: "📋", label: "Planlı Üretim Desteği",        pageId: "p-planli-uretim" },
      { icon: "🌱", label: "Sertifikalı Fidan Desteği",    pageId: "p-sertifikali-fidan" },
      { icon: "🌾", label: "Sertifikalı Tohum Desteği",    pageId: "p-sertifikali-tohum" },
      { icon: "🌱", label: "Temel Destek",                     pageId: "p-temel-destek" },
      { icon: "🌿", label: "Yem Bitkileri Desteği",            pageId: "p-yem-bitkileri" },
      { icon: "❄️", label: "Zirai Don Desteği",                 pageId: "p-zirai-don" },
    ],
  },
  {
    key: "ist",
    label: "Tarımsal İstatistikler",
    emoji: "📊",
    sidebarId: "sb-ist",
    firstPage: "p-bitk",
    items: [
      { icon: "🌿", label: "Bitkisel Üretim", pageId: "p-bitk" },
      { icon: "🐂", label: "Hayvancılık",     pageId: "p-hayv-ist" },
      { icon: "🐟", label: "Su Ürünleri",     pageId: "p-su" },
    ],
  },
  {
    key: "ozel",
    label: "Özel Bilgiler",
    emoji: "🗂️",
    sidebarId: "sb-ozel",
    firstPage: "p-muhtarlar",
    items: [
      { icon: "👤", label: "Muhtarlar",     pageId: "p-muhtarlar" },
      { icon: "🤝", label: "Kooperatifler", pageId: "p-kooperatifler" },
    ],
  },
  {
    key: "kirsal",
    label: "Kırsal Kalkınma",
    emoji: "🏘️",
    sidebarId: "sb-kirsal",
    firstPage: "p-ekonomik",
    items: [
      { icon: "🏭", label: "Ekonomik Yatırımlar",    pageId: "p-ekonomik" },
      { icon: "⚙️", label: "Makine – Ekipman",       pageId: "p-makine" },
      { icon: "🤝", label: "Kooperatif Destekleri",  pageId: "p-koop" },
      { icon: "🏷️", label: "TKDK-IPARD",             pageId: "p-tkdk" },
      { icon: "👨‍🌾", label: "Genç Çiftçilere Proje", pageId: "p-genc" },
    ],
  },
  {
    key: "diger",
    label: "Diğer Veriler",
    emoji: "📋",
    sidebarId: "sb-diger",
    firstPage: "p-gida",
    items: [{ icon: "🔍", label: "Gıda Denetimleri", pageId: "p-gida" }],
  },
];

export const DISTRICTS = [
  "Ağlasun", "Altınyayla", "Bucak", "Çavdır", "Çeltikçi",
  "Gölhisar", "Karamanlı", "Kemer", "Merkez", "Tefenni", "Yeşilova",
];