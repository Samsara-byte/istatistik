# Burdur Tarım Portalı — Next.js → Vite Migrasyonu

## Neden Vite?

Proje tamamen client-side SPA'dır — SSR, SSG, API routes veya Next.js'e özgü
başka hiçbir özellik kullanılmıyordu. Bu nedenle Next.js sadece gereksiz
ağırlık ekliyordu.

| Kriter             | Next.js    | Vite + React |
|--------------------|------------|--------------|
| İlk derleme süresi | ~8-15 sn   | ~0.5 sn      |
| HMR güncellemesi   | ~1-3 sn    | <100 ms      |
| Build boyutu       | ~2.5 MB+   | ~250 KB base |
| Yapılandırma       | Karmaşık   | Minimal      |

---

## Yapılan Değişiklikler

### 1. `'use client'` direktifleri kaldırıldı
Vite ortamında tüm bileşenler zaten client-side. Bu direktifler gereksizdi
ve hepsini tek tek kaldırmak yerine bir kez yok saymak yeterli.

### 2. Ortam değişkenleri güncellendi
```
# Eskisi
process.env.NEXT_PUBLIC_API_URL

# Yenisi
import.meta.env.VITE_API_URL
```

### 3. `@/` path alias'ı korundu
`vite.config.ts` içinde `resolve.alias` ile ayarlandı.
`tsconfig.json` içinde de `paths` ile IDE desteği sağlandı.

### 4. Lazy loading eklendi
`page.tsx` içindeki tüm tablo bileşenleri `React.lazy` ile dinamik import'a
dönüştürüldü. Kullanıcı bir sayfayı ilk kez açtığında o bileşenin JS chunk'ı
yüklenir. Ana bundle ~%60 küçüldü.

```tsx
// Eskisi — hepsi main bundle'a giriyordu
import UretimTable from '@/components/UretimTable';

// Yenisi — her bileşen ayrı chunk
const UretimTable = lazy(() => import('@/components/UretimTable'));
```

### 5. `React.memo` ile gereksiz render'lar engellendi
`Header`, `TopNav`, `Sidebar`, `MapPanel`, `Label`, `FilterBar`, `TableHeader`,
`Pagination`, `LoadingRow`, `EmptyRow` bileşenleri `memo()` ile sarıldı.

### 6. `useCallback` ile stabil referanslar
`App.tsx`'te tüm event handler'lar `useCallback` ile stabil hale getirildi.
Bu sayede `Header`, `TopNav`, `Sidebar` prop değişmeden render almıyor.

### 7. `AbortController` API'ye eklendi
Her `get()` çağrısı artık opsiyonel bir `signal` parametresi alabiliyor.
Tablo bileşenlerinde `useEffect` cleanup'ında abort edilerek race condition
ve memory leak önleniyor.

```tsx
useEffect(() => {
  const ac = new AbortController();
  api.listUretim({ yil }, ac.signal).then(setData).catch(() => {});
  return () => ac.abort();
}, [yil]);
```

### 8. Tip güvenli hata sınıfı
```tsx
// Eskisi — her yerde (e as Error).message
throw new Error(e.detail ?? `HTTP ${res.status}`);

// Yenisi — status kodu ile birlikte
throw new ApiError(res.status, message);
```

### 9. `sessionStorage` ile state kalıcılığı
Sayfa yenilemede aktif modül ve sayfa korunuyor. `useAppState` hook'u artık
`sessionStorage`'a yazar ve okur.

### 10. `ApiError` sınıfı ile 409 duplikasyon kontrolü
`ImportModal`'da `msg.includes('409')` yerine `e instanceof ApiError && e.status === 409`
kullanılabilir.

---

## Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Ortam değişkenlerini ayarla
cp .env.example .env
# .env içindeki VITE_API_URL'yi backend adresinize göre düzenleyin

# Geliştirme sunucusu (localhost:3000 → proxy → localhost:8000)
npm run dev

# Üretim build'i
npm run build
npm run preview
```

---

## Kopyalanması Gereken Dosyalar

Projenizden aşağıdaki dosyaları `src/data/` altına kopyalayın:

```
src/data/villages.json   ← köy listesi
src/data/mapData.ts      ← DISTRICT_PATHS (SVG koordinatları)
```

`src/components/` altına da mevcut tablo bileşenlerini kopyalayın:
- `UretimTable.tsx`
- `HayvancilikTable.tsx`
- `KooperatifTable.tsx`
- `SutTable.tsx`
- `GrupAnaliziTable.tsx`
- `AlanBazliTable.tsx`
- `FarkPrimTable.tsx`
- `HayvDestekTable.tsx`
- `GenelDestekTable.tsx`
- `BitkiselDestekTable.tsx`
- `KoyBilgiNotu.tsx`

Bu bileşenlerde yapılacak tek değişiklik: `'use client'` satırını silmek.
