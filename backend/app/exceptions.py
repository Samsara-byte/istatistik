"""
exceptions.py — Özel HTTP hata sınıfları

FastAPI'nin HTTPException'ından türetilmiştir.
Her sınıf belirli bir hata durumuna anlam kazandırır ve
router'larda raise ile kullanılır.

Yeni hata eklemek için: HTTPException'dan türet, status_code + mesaj ver.
"""
from __future__ import annotations

from fastapi import HTTPException


class DuplicateFileError(HTTPException):
    """Aynı dosya hash'i daha önce import_log'a kaydedilmişse fırlatılır (409 Conflict)."""
    def __init__(self, filename: str) -> None:
        super().__init__(409, f"Bu dosya daha önce yüklenmiş: {filename}")


class InvalidFileFormatError(HTTPException):
    """Yüklenen dosyanın uzantısı kabul edilmeyen türdeyse fırlatılır (400 Bad Request)."""
    def __init__(self, accepted: set[str]) -> None:
        exts = ", ".join(f".{e}" for e in sorted(accepted))
        super().__init__(400, f"Kabul edilen formatlar: {exts}")


class NoValidDataError(HTTPException):
    """Excel'den hiç geçerli satır ayrıştırılamazsa fırlatılır (422 Unprocessable)."""
    def __init__(self, skipped: int = 0) -> None:
        detail = "Geçerli veri bulunamadı"
        if skipped:
            detail += f" (atlanan satır: {skipped})"
        super().__init__(422, detail)


class ExcelParseError(HTTPException):
    """openpyxl veya binary XLS okuyucu dosyayı açamazsa fırlatılır (422)."""
    def __init__(self, reason: str) -> None:
        super().__init__(422, f"Excel okunamadı: {reason}")
