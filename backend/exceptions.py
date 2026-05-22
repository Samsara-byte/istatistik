from __future__ import annotations

from fastapi import HTTPException


class DuplicateFileError(HTTPException):
    def __init__(self, filename: str) -> None:
        super().__init__(
            status_code=409,
            detail=f"Bu dosya daha önce yüklenmiş: {filename}",
        )


class InvalidFileFormatError(HTTPException):
    def __init__(self, accepted: set[str]) -> None:
        exts = ", ".join(f".{e}" for e in sorted(accepted))
        super().__init__(
            status_code=400,
            detail=f"Kabul edilen formatlar: {exts}",
        )


class NoValidDataError(HTTPException):
    def __init__(self, skipped: int = 0) -> None:
        detail = "Geçerli veri bulunamadı"
        if skipped:
            detail += f" (atlanan satır: {skipped})"
        super().__init__(status_code=422, detail=detail)


class ExcelParseError(HTTPException):
    def __init__(self, reason: str) -> None:
        super().__init__(status_code=422, detail=f"Excel okunamadı: {reason}")
