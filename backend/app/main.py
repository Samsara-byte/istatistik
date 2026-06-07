"""
main.py — FastAPI uygulama girişi

Burdur Tarım API v2.0
Başlatmak için: uvicorn app.main:app --reload --port 8000

Dosya sorumlulukları:
  - Loglama konfigürasyonu
  - Lifespan (başlangıç/bitiş işlemleri)
  - CORS middleware
  - Global exception handler
  - Router kayıtları
  - /health endpoint'i
"""
from __future__ import annotations

import logging
import logging.config
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import settings
from app.database import close_db, engine, init_db

# Tüm router'lar tek tek import edilir
from app.routers import bitkisel, cks, destekler, hayvancilik, imports, kooperatif, planli_uretim, sertifikali_fidan, sertifikali_tohum, sut, temel_destek, uretim, yem_bitkileri, zirai_don

# ── Loglama ──────────────────────────────────────────────────────────
# settings.DEBUG=True → DEBUG, False → INFO seviyesi
logging.config.dictConfig({
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"default": {
        "format": "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        "datefmt": "%Y-%m-%d %H:%M:%S",
    }},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "default"}},
    "root": {"level": "DEBUG" if settings.DEBUG else "INFO", "handlers": ["console"]},
})

logger = logging.getLogger(__name__)


# ── Lifespan ─────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Uygulama başlarken:  veritabanı tablolarını oluşturur (init_db).
    Uygulama kapanırken: bağlantı havuzunu temizler (close_db).
    """
    logger.info("🚀  Başlatılıyor: %s v%s", settings.APP_NAME, settings.APP_VERSION)
    await init_db()
    yield
    await close_db()
    logger.info("👋  Kapatıldı")


# ── Uygulama ─────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",    # Swagger UI
    redoc_url="/redoc",  # ReDoc
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────
# Geliştirme ortamı için * açık; prod'da FRONTEND_URL ile kısıtla
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global hata yakalayıcı ────────────────────────────────────────────
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    HTTPException dışında kalan beklenmedik hataları yakalar.
    500 döner, detay loglanır ama kullanıcıya sızdırılmaz.
    """
    logger.exception("Beklenmedik hata: %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": "Sunucu hatası. Lütfen daha sonra tekrar deneyin."},
    )


# ── Router kayıtları ─────────────────────────────────────────────────
# YENİ MODÜL EKLEMEK: buraya import et ve listeye ekle
for _router in (
    uretim.router,
    hayvancilik.router,
    kooperatif.router,
    sut.router,
    destekler.router,
    bitkisel.router,
    planli_uretim.router,
    sertifikali_fidan.router,
    sertifikali_tohum.router,
    temel_destek.router,
    yem_bitkileri.router,
    zirai_don.router,
    cks.router,
    imports.router,
):
    app.include_router(_router)


# ── Sağlık kontrolü ──────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check() -> dict[str, Any]:
    """
    Kubernetes/Docker liveness + readiness probe olarak kullanılabilir.
    Veritabanına SELECT 1 yaparak bağlantıyı doğrular.
    """
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }