FROM python:3.12-slim

# Sistem bağımlılıkları (asyncpg derleme için build-essential gerekebilir)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Önce requirements (cache için ayrı layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Uygulama kodunu kopyala
COPY . .

EXPOSE 8000

# app/main.py → uvicorn app.main:app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
