"""
Pydantic response şemaları.
Tüm endpoint'ler bu modelleri döndürür → otomatik OpenAPI docs.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


# ── Ortak ────────────────────────────────────────────────────────────────────

class PageMeta(BaseModel):
    total: int
    page:  int
    limit: int
    pages: int


class Page(BaseModel, Generic[T]):
    data:  list[T]
    total: int
    page:  int
    limit: int
    pages: int


class DeleteResult(BaseModel):
    silinen: int


class ImportResult(BaseModel):
    ok:          bool = True
    tablo:       str
    yil:         Optional[int] = None
    ilce:        Optional[str] = None
    eklenen:     int  = 0
    guncellenen: int  = 0
    silinen:     int  = 0
    atlandi:     int  = 0
    sure_sn:     float


class HealthResponse(BaseModel):
    durum:    str
    versiyon: str


# ── Üretim ───────────────────────────────────────────────────────────────────

class UretimRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uretim_yili:    int
    il:             str
    ilce:           str
    koy:            str
    urun:           str
    tarim_sekli:    str
    uretim_cesidi:  str
    ekili_alan:     Decimal
    ciftci_sayisi:  Optional[int] = None


class UretimKoyOzet(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    ilce:         str
    koy:          str
    urun_cesidi:  int
    kayit_sayisi: int
    toplam_alan:  Decimal


class UretimUrunOzet(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    urun:         str
    tarim_sekli:  str
    ilce_sayisi:  int
    koy_sayisi:   int
    kayit_sayisi: int
    toplam_alan:  Decimal


class UretimOzetRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    kayit_sayisi:   int
    toplam_alan_da: Decimal
    toplam_alan_ha: Decimal


class UretimOzetResponse(BaseModel):
    group_by:       str
    data:           list[dict[str, Any]]
    toplam_alan_da: float
    toplam_kayit:   int


# ── Hayvancılık ──────────────────────────────────────────────────────────────

class HayvancilikRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    ilce:           str
    koy:            str
    sigir:          int
    manda:          int
    koyun:          int
    keci:           int
    sigir_isletme:  int
    manda_isletme:  int
    koyun_isletme:  int
    keci_isletme:   int
    toplam_isletme: int


class HayvancilikOzet(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    sigir_toplam:   int
    manda_toplam:   int
    koyun_toplam:   int
    keci_toplam:    int
    sigir_isletme:  int
    manda_isletme:  int
    koyun_isletme:  int
    keci_isletme:   int
    toplam_isletme: int
    koy_sayisi:     int


# ── Kooperatif ───────────────────────────────────────────────────────────────

class KooperatifRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:           int
    ilce:         str
    koy_belde:    str
    koop_turu:    str
    ortak_sayisi: Optional[int]
    baskan:       Optional[str]
    telefon:      Optional[str]


# ── Süt Destekleme ───────────────────────────────────────────────────────────

class SutRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    il:             str
    ilce:           str
    koy:            str
    temel_sut_lt:   Decimal
    destek_tutari:  Decimal
    uretici_sayisi: int


class SutOzet(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    toplam_sut_lt:  Optional[Decimal]
    toplam_tutar:   Optional[Decimal]
    uretici_sayisi: int
    koy_sayisi:     int
    ilce_sayisi:    int


# ── Bitkisel Destek ──────────────────────────────────────────────────────────

class BitkiselRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:                  int
    yil:                 int
    il:                  str
    ilce:                str
    koy:                 str
    urun:                str
    feromon_adet:        Decimal
    feromon_tuzak_adet:  Decimal
    faydali_bocek_adet:  Decimal
    desteklenen_alan_da: Decimal
    destek_tutari_tl:    Decimal
    net_odeme_tl:        Decimal


# ── Destek Tabloları (özet) ───────────────────────────────────────────────────

class DestekRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    yil:      int
    tutar_tl: Decimal


# ── Import Log ───────────────────────────────────────────────────────────────

class ImportLogRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:           int
    dosya_adi:    str
    tablo:        Optional[str]
    ilce:         Optional[str]
    yil:          Optional[int]
    kayit_sayisi: Optional[int]
    silinen:      Optional[int]
    sure_sn:      Optional[Decimal]
    durum:        str
    hata_mesaji:  Optional[str]
