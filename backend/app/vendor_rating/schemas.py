from pydantic import BaseModel, field_validator
from typing import Optional, List, Any
from datetime import date, datetime
from decimal import Decimal
from app.vendor_rating.models import RatingTriggerType, SemaforoStatus


class SurveySubmit(BaseModel):
    token: str
    kpi1: Optional[float] = None
    kpi2: Optional[float] = None
    kpi3: Optional[float] = None
    kpi4: Optional[float] = None
    note: Optional[str] = None

    @field_validator("kpi1", "kpi2", "kpi3", "kpi4", mode="before")
    @classmethod
    def validate_kpi(cls, v):
        if v is not None and not (1 <= float(v) <= 5):
            raise ValueError("KPI deve essere tra 1 e 5")
        return v


class SurveyInfo(BaseModel):
    token: str
    ragione_sociale: str
    protocollo_ordine: Optional[str] = None
    tipo_trigger: RatingTriggerType
    tipo_documento: Optional[str] = None
    data_ordine: Optional[date] = None
    data_consegna_richiesta: Optional[date] = None
    data_consegna_ricevuta: Optional[date] = None
    is_expired: bool
    is_completed: bool


class AlyanteTriggerWebhook(BaseModel):
    """Payload inviato da Alyante/DMS al verificarsi di un evento ordine."""
    alyante_order_id: str
    codice_fornitore: str
    protocollo_ordine: Optional[str] = None
    numero_pubblicazione: Optional[str] = None
    tipo_trigger: RatingTriggerType
    tipo_documento: Optional[str] = None
    data_ordine: Optional[date] = None
    data_registrazione: Optional[date] = None
    data_consegna_richiesta: Optional[date] = None
    data_consegna_ricevuta: Optional[date] = None
    quantita_richiesta: Optional[Decimal] = None
    quantita_ricevuta: Optional[Decimal] = None
    cdc_commessa: Optional[str] = None
    responsabile: Optional[str] = None
    pi_riferimento: Optional[str] = None
    richiedente_email: str
    richiedente_nome: Optional[str] = None


class NonConformitaWebhook(BaseModel):
    """Payload inviato dal tool Non Conformita."""
    nc_id: str
    numero_ordine: Optional[str] = None
    codice_fornitore: Optional[str] = None
    descrizione: Optional[str] = None
    data_apertura: Optional[date] = None
    data_chiusura: Optional[date] = None
    stato: str = "aperta"
    gravita: Optional[str] = None
    raw_payload: Optional[Any] = None


class RatingRequestCreate(BaseModel):
    supplier_id: int
    protocollo_ordine: Optional[str] = None
    numero_pubblicazione: Optional[str] = None
    tipo_trigger: RatingTriggerType
    data_ordine: Optional[date] = None
    data_registrazione: Optional[date] = None
    data_consegna_richiesta: Optional[date] = None
    data_consegna_ricevuta: Optional[date] = None
    quantita_richiesta: Optional[Decimal] = None
    quantita_ricevuta: Optional[Decimal] = None
    cdc_commessa: Optional[str] = None
    responsabile: Optional[str] = None
    valutatore_email: str
    valutatore_nome: Optional[str] = None


class UAYearlyReviewCreate(BaseModel):
    anno: int
    kpi1: Optional[float] = None
    kpi2: Optional[float] = None
    kpi3: Optional[float] = None
    kpi4: Optional[float] = None
    kpi5_gestione_nc: Optional[float] = None
    kpi6_innovazione: Optional[float] = None
    note: Optional[str] = None

    @field_validator("kpi1", "kpi2", "kpi3", "kpi4", "kpi5_gestione_nc", "kpi6_innovazione", mode="before")
    @classmethod
    def validate_kpi(cls, v):
        if v is not None and not (1 <= float(v) <= 5):
            raise ValueError("KPI deve essere tra 1 e 5")
        return v


class UAYearlyReviewRead(BaseModel):
    id: int
    supplier_id: int
    anno: int
    kpi1_qualita_prezzo: Optional[float] = None
    kpi2_qualita_relazionale: Optional[float] = None
    kpi3_qualita_tecnica: Optional[float] = None
    kpi4_affidabilita_tempi: Optional[float] = None
    kpi5_gestione_nc: Optional[float] = None
    kpi6_innovazione: Optional[float] = None
    media_ua: Optional[float] = None
    note: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class RatingDetail(BaseModel):
    id: int
    supplier_id: int
    ragione_sociale: Optional[str] = None
    protocollo_ordine: Optional[str] = None
    numero_pubblicazione: Optional[str] = None
    tipo_trigger: Optional[RatingTriggerType] = None
    tipo_documento: Optional[str] = None
    data_ordine: Optional[date] = None
    data_registrazione: Optional[date] = None
    data_valutazione: Optional[datetime] = None
    valutatore_nome: Optional[str] = None
    valutatore_email: Optional[str] = None
    cdc_commessa: Optional[str] = None
    responsabile: Optional[str] = None
    kpi1_qualita_prezzo: Optional[float] = None
    kpi2_qualita_relazionale: Optional[float] = None
    kpi3_qualita_tecnica: Optional[float] = None
    kpi4_affidabilita_tempi: Optional[float] = None
    kpi5_delta_giorni: Optional[float] = None
    kpi5_score: Optional[float] = None
    kpi6_precisione_pct: Optional[float] = None
    kpi6_score: Optional[float] = None
    kpi7_non_conformita: Optional[int] = None
    media_kpi_utente: Optional[float] = None
    media_con_auto: Optional[float] = None
    media_generale: Optional[float] = None
    semaforo: SemaforoStatus
    note: Optional[str] = None
    note_acquisti: Optional[str] = None
    model_config = {"from_attributes": True}


class SupplierRatingSummaryRead(BaseModel):
    supplier_id: int
    ragione_sociale: str = ""
    total_user_ratings: int
    media_kpi1: Optional[float] = None
    media_kpi2: Optional[float] = None
    media_kpi3: Optional[float] = None
    media_kpi4: Optional[float] = None
    media_kpi5_score: Optional[float] = None
    media_kpi6_score: Optional[float] = None
    media_kpi7_nc: Optional[float] = None
    media_utente: Optional[float] = None
    media_ua: Optional[float] = None
    anno_ua: Optional[int] = None
    media_generale: Optional[float] = None
    semaforo: SemaforoStatus
    model_config = {"from_attributes": True}


class PaginatedRatingSummary(BaseModel):
    items: List[SupplierRatingSummaryRead]
    total: int
    page: int
    page_size: int
    pages: int
