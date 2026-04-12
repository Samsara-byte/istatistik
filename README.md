# Burdur Tarım İstatistik Portalı

```
burdur-proje/
├── backend/                  ← FastAPI + PostgreSQL
│   ├── main.py               ← Uygulama girişi (uvicorn main:app)
│   ├── config.py             ← .env ayarları
│   ├── database.py           ← asyncpg bağlantı havuzu
│   ├── schema.sql            ← DB şeması
│   ├── requirements.txt
│   ├── .env.example
│   ├── routers/
│   │   ├── uretim.py         ← GET /api/uretim  /ozet  /urunler  /ilceler  /log
│   │   └── import_router.py  ← POST /api/import
│   └── etl/
│       └── bulk_import.py    ← Toplu Excel yükleme scripti
│
└── frontend/                 ← Next.js 14
    ├── app/
    │   ├── page.tsx          ← Ana sayfa (tüm sayfalar)
    │   ├── layout.tsx
    │   └── globals.css
    ├── components/
    │   ├── Header.tsx
    │   ├── Sidebar.tsx
    │   ├── TopNav.tsx
    │   ├── MapPanel.tsx
    │   ├── UretimTable.tsx   ← Filtreli veri tablosu
    │   └── ImportModal.tsx   ← Excel yükleme modali
    ├── data/
    │   ├── navigation.ts
    │   ├── mapData.ts
    │   └── villages.json
    ├── hooks/useAppState.ts
    ├── lib/api.ts            ← Tip güvenli API istemcisi
    ├── package.json
    ├── next.config.js
    └── .env.local.example
```

---

## 1. PostgreSQL Kur

```bash
createdb burdurdb
psql -d burdurdb -f backend/schema.sql
```

---

## 2. Backend Başlat

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

# .env dosyası oluştur
cp .env.example .env
# DATABASE_URL satırını düzenle

uvicorn main:app --reload --port 8000
```

Swagger UI: http://localhost:8000/docs

---

## 3. Frontend Başlat

```bash
cd frontend
npm install

cp .env.local.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
```

Portal: http://localhost:3000

---

## 4. Excel Verilerini Yükle (İlk Kurulum)

### A) Tek seferlik toplu yükleme (önerilen):
```bash
cd backend
python etl/bulk_import.py \
  --db "postgresql://postgres:sifre@localhost:5432/burdurdb" \
  --dir /excel/dosyalarinin/bulundugu/klasor
```

### B) Uygulama üzerinden (tek dosya):
Portal'da üst bar'daki **Excel Aktar** butonuna tıkla → Yıl ve kategori seç → Dosyayı yükle

---

## API Referansı

| Method | URL | Açıklama |
|--------|-----|----------|
| GET | `/api/uretim` | Filtreli liste (`ilce`, `koy`, `urun`, `tarim_sekli`, `group_by`, `page`, `limit`) |
| GET | `/api/uretim/ozet` | Aggregate özet (`group_by=ilce\|koy\|urun`) |
| GET | `/api/uretim/urunler` | Ürün listesi |
| GET | `/api/uretim/ilceler` | İlçe listesi |
| GET | `/api/uretim/log` | Import geçmişi |
| POST | `/api/import` | Excel yükle (`file`, `yil`, `truncate`) |
