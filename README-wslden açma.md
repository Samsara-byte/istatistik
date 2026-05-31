# Burdur Tarım — Docker Kurulumu (WSL)

## Klasör yapısı (olması gereken)

```
/mnt/c/Users/Sami ASLANCAN/Documents/istatistik/
├── docker-compose.yml     ← ZIP'ten koy
├── .env                   ← ZIP'ten koy
├── backend/
│   ├── Dockerfile         ← ZIP'ten koy
│   ├── requirements.txt   (mevcut)
│   └── app/
│       ├── main.py        (mevcut)
│       └── config.py      (mevcut)
└── frontend/
    ├── Dockerfile         ← ZIP'ten koy
    ├── nginx.conf         ← ZIP'ten koy
    ├── package.json       (mevcut)
    ├── index.html         (mevcut)
    └── src/               (mevcut)
```

---

## 🚀 Başlatma (WSL terminali)

```bash
# 1 — Proje klasörüne git
cd "/mnt/c/Users/Sami ASLANCAN/Documents/istatistik"

# 2 — Tek komutla başlat
docker compose up -d --build
```

**Tarayıcı:** http://localhost

---

## Sık kullanılan komutlar

```bash
# Proje klasörüne kısayol (isteğe bağlı — ~/.bashrc'ye ekleyebilirsin)
alias tarim='cd "/mnt/c/Users/Sami ASLANCAN/Documents/istatistik"'

# İlk kurulum / kod değişikliği sonrası
docker compose up -d --build

# Durumu gör
docker compose ps

# Canlı log izle (Ctrl+C ile çık)
docker compose logs -f

# Servis bazlı log
docker compose logs -f backend
docker compose logs -f db

# Durdur
docker compose down

# Yeniden başlat
docker compose restart

# Temiz başlangıç — VERİYİ SİLER
docker compose down -v && docker compose up -d --build
```

---

## Frontend geliştirme (WSL'den)

```bash
cd "/mnt/c/Users/Sami ASLANCAN/Documents/istatistik/frontend"
npm install
npm run dev        # http://localhost:3000
```

## Backend geliştirme (WSL'den)

```bash
cd "/mnt/c/Users/Sami ASLANCAN/Documents/istatistik/backend"

# Virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# .env'yi yükle ve başlat
export $(grep -v '^#' ../.env | xargs)
uvicorn app.main:app --reload --port 8000
```

---

## Servisler

| Servis   | Teknoloji         | Port | Dışarıya açık      |
|----------|-------------------|------|--------------------|
| db       | PostgreSQL 16     | 5432 | ❌ (sadece dahili) |
| backend  | FastAPI + uvicorn | 8000 | ❌ (nginx proxy)   |
| frontend | Nginx + React     | 80   | ✅ http://localhost |

---

## Veri kalıcılığı

PostgreSQL verisi `pg_data` volume'unda kalıcı saklanır.

```bash
# Volume bilgisi
docker volume inspect istatistik_pg_data

# Veritabanı yedeği al
docker compose exec db pg_dump -U postgres burdurdb \
  > "/mnt/c/Users/Sami ASLANCAN/Documents/burdurdb_backup.sql"

# Yedeği geri yükle
cat "/mnt/c/Users/Sami ASLANCAN/Documents/burdurdb_backup.sql" \
  | docker compose exec -T db psql -U postgres burdurdb
```

---

## Alembic migration varsa

Container içinden çalıştır:
```bash
docker compose exec backend alembic upgrade head
```

Ya da `backend/Dockerfile`'a ekle (CMD'den önce):
```dockerfile
RUN alembic upgrade head
```

---

## Sorun giderme

```bash
# Docker Desktop çalışıyor mu?
docker info

# WSL'de "docker: command not found" hatası
# → Docker Desktop → Settings → Resources → WSL Integration → Ubuntu ✅ yap

# Port 80 meşgulse (Windows IIS vb.)
# docker-compose.yml'de değiştir:  "8080:80"
# Sonra: http://localhost:8080

# Backend DB'ye bağlanamıyor
docker compose logs db       # DB hazır mı?
docker compose logs backend  # Hata mesajı ne?

# config.py localhost yerine db okumuyor mu?
docker compose exec backend env | grep DATABASE_URL
# postgresql+asyncpg://postgres:postgres@db:5432/burdurdb  ← doğru olan bu
```
