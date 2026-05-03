"""
Burdur Tarım İstatistik API — v3.0
Çalıştır: uvicorn app.main:app --reload
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import close_engine, init_engine
from app.routers import ALL_ROUTERS


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀  Burdur Tarım API başlatılıyor...")
    await init_engine()
    print(f"🌐  Hazır — {settings.FRONTEND_URLS[0]}")
    yield
    await close_engine()
    print("🛑  API kapatıldı.")


app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.FRONTEND_URLS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in ALL_ROUTERS:
    app.include_router(router)
