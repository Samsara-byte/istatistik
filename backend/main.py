"""
Burdur Tarım API — v2.0
uvicorn app.main:app --reload --port 8000
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
from app.database import close_db, get_db, init_db
from app.routers import (
    bitkisel,
    cks,
    destekler,
    hayvancilik,
    imports,
    kooperatif,
    sut,
    uretim,
)

# ── Logging ──────────────────────────────────────────────────────────
logging.config.dictConfig({
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
        }
    },
    "root": {"level": "DEBUG" if settings.DEBUG else "INFO", "handlers": ["console"]},
})

logger = logging.getLogger(__name__)


# ── Lifespan ─────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀  Starting %s v%s", settings.APP_NAME, settings.APP_VERSION)
    await init_db()
    yield
    await close_db()
    logger.info("👋  Shutdown complete")


# ── App factory ───────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global exception handler ──────────────────────────────────────────
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": "Sunucu hatası. Lütfen daha sonra tekrar deneyin."},
    )


# ── Routers ───────────────────────────────────────────────────────────
for _router in (
    uretim.router,
    hayvancilik.router,
    kooperatif.router,
    sut.router,
    destekler.router,
    bitkisel.router,
    cks.router,
    imports.router,
):
    app.include_router(_router)


# ── Health check ──────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check() -> dict[str, Any]:
    """Liveness + readiness probe."""
    from app.database import engine
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return {
        "status": "healthy",
        "app":    settings.APP_NAME,
        "version": settings.APP_VERSION,
    }
