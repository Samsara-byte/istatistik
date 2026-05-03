"""
FastAPI Dependency Injection.

Kullanım router'larda:
    @router.get("/...")
    async def handler(conn: ReadConn):   # sadece okuma
        rows = (await conn.execute(text(sql), params)).mappings().all()

    @router.post("/...")
    async def handler(conn: WriteConn):  # transaction (otomatik commit/rollback)
        await conn.execute(text(sql), params)
"""
from __future__ import annotations

from typing import Annotated, AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncConnection

from app.database import get_engine


async def _read_conn() -> AsyncGenerator[AsyncConnection, None]:
    """Okuma bağlantısı — transaction açmaz, autoflush yok."""
    async with get_engine().connect() as conn:
        yield conn


async def _write_conn() -> AsyncGenerator[AsyncConnection, None]:
    """Yazma bağlantısı — transaction açar, hata yoksa commit, hata varsa rollback."""
    async with get_engine().begin() as conn:
        yield conn


ReadConn  = Annotated[AsyncConnection, Depends(_read_conn)]
WriteConn = Annotated[AsyncConnection, Depends(_write_conn)]
