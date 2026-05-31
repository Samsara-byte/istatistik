# Burdur Tarım API

FastAPI + PostgreSQL tabanlı tarımsal veri yönetim sistemi.

## Hızlı Başlangıç

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # .env içinde DATABASE_URL'i düzenle
uvicorn app.main:app --reload --port 8000
```

- Swagger UI → http://localhost:8000/docs  
- Sağlık     → http://localhost:8000/health  
- Tam belge  → DOKUMANTASYON.md

## Endpoint Özeti

| Metot | URL | Açıklama |
|---|---|---|
| GET | /api/uretim | Bitkisel üretim listesi |
| GET | /api/uretim/ozet | Özet (ilçe/ürün) |
| GET | /api/hayvancilik | Hayvancılık verileri |
| GET | /api/sut | Süt destekleme |
| GET | /api/kooperatif | Kooperatif listesi |
| GET | /api/bitkisel-destek | Bitkisel destek |
| GET | /api/cks-sayisi | ÇKS çiftçi sayıları |
| GET | /api/alan-bazli | Alan bazlı destek |
| GET | /api/fark-prim | Fark prim desteği |
| GET | /api/hayvancilik-destek | Hayvancılık desteği |
| GET | /api/genel-destek | Genel destekler |
| POST | /api/import/uretim | Üretim XLSX aktar |
| POST | /api/import/hayvancilik | Hayvancılık XLS aktar |
| POST | /api/import/kooperatif | Kooperatif XLS aktar |
| POST | /api/import/sut | Süt XLSX aktar |
| POST | /api/import/bitkisel-destek | Bitkisel XLS aktar |
| POST | /api/import/cks-sayisi | ÇKS XLSX aktar |
| POST | /api/import/alan-bazli | Alan bazlı XLS aktar |
| POST | /api/import/fark-prim | Fark prim XLS aktar |
| DELETE | /api/{kaynak}/temizle | Veri sil |
| GET | /health | Sağlık kontrolü |
