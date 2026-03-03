from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
from app.contracts.models import ContractStatus, EnteStipulante


class ContractCreate(BaseModel):
    supplier_id: Optional[int] = None
    ragione_sociale: str
    codice_fornitore: Optional[str] = None
    status: ContractStatus = ContractStatus.ATTIVO
    ente_stipulante: Optional[EnteStipulante] = None
    cdc: Optional[str] = None
    oggetto: str
    imponibile: Optional[Decimal] = None
    iva_percentuale: Optional[Decimal] = None
    ivato: Optional[Decimal] = None
    dpa: bool = False
    questionario_it_gdpr: bool = False
    dpia: bool = False
    data_inizio: Optional[date] = None
    data_scadenza: Optional[date] = None
    data_rinegoziazione: Optional[date] = None
    recesso_anticipato: Optional[str] = None
    rinnovo_tacito: bool = False
    alert_enabled: bool = True
    referente_interno: Optional[str] = None
    referente_ufficio_acquisti: Optional[str] = None
    riferimento_gara: Optional[str] = None
    cig_cup_commessa: Optional[str] = None
    ordini_alyante: Optional[List[str]] = None

    @model_validator(mode="after")
    def calc_ivato(self):
        if self.imponibile and self.iva_percentuale and not self.ivato:
            self.ivato = self.imponibile * (1 + self.iva_percentuale / 100)
        return self


class ContractUpdate(ContractCreate):
    ragione_sociale: Optional[str] = None
    oggetto: Optional[str] = None


class ContractListItem(BaseModel):
    id: int
    id_contratto: str
    ragione_sociale: str
    codice_fornitore: Optional[str] = None
    status: ContractStatus
    ente_stipulante: Optional[EnteStipulante] = None
    cdc: Optional[str] = None
    oggetto: str
    imponibile: Optional[Decimal] = None
    ivato: Optional[Decimal] = None
    data_inizio: Optional[date] = None
    data_scadenza: Optional[date] = None
    data_rinegoziazione: Optional[date] = None
    alert_enabled: bool
    dpa: bool
    questionario_it_gdpr: bool
    dpia: bool
    rinnovo_tacito: bool
    supplier_id: Optional[int] = None
    model_config = {"from_attributes": True}


class DocumentRead(BaseModel):
    id: int
    tipo: str
    nome_file: str
    data_upload: datetime
    model_config = {"from_attributes": True}


class CommunicationRead(BaseModel):
    id: int
    tipo: str
    oggetto: str
    inviata_at: Optional[datetime] = None
    is_auto: bool
    status: str
    model_config = {"from_attributes": True}


class ContractDetail(ContractListItem):
    referente_interno: Optional[str] = None
    referente_ufficio_acquisti: Optional[str] = None
    riferimento_gara: Optional[str] = None
    cig_cup_commessa: Optional[str] = None
    recesso_anticipato: Optional[str] = None
    ordini_alyante: Optional[list] = None
    documents: List[DocumentRead] = []
    communications: List[CommunicationRead] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ContractSearchParams(BaseModel):
    q: Optional[str] = None
    ragione_sociale: Optional[str] = None
    status: Optional[List[ContractStatus]] = None
    cdc: Optional[str] = None
    ente_stipulante: Optional[EnteStipulante] = None
    data_scadenza_from: Optional[date] = None
    data_scadenza_to: Optional[date] = None
    data_rinegoziazione_from: Optional[date] = None
    data_rinegoziazione_to: Optional[date] = None
    dpa: Optional[bool] = None
    questionario_it_gdpr: Optional[bool] = None
    dpia: Optional[bool] = None
    page: int = 1
    page_size: int = 20


class PaginatedContracts(BaseModel):
    items: List[ContractListItem]
    total: int
    page: int
    page_size: int
    pages: int


class ContractOrderRead(BaseModel):
    id: int
    contract_id: int
    alyante_order_id: str
    protocollo: Optional[str] = None
    numero_pubblicazione: Optional[str] = None
    tipo_documento: Optional[str] = None
    data_ordine: Optional[date] = None
    importo: Optional[Decimal] = None
    oggetto: Optional[str] = None
    stato: Optional[str] = None
    cdc: Optional[str] = None
    richiedente_email: Optional[str] = None
    associato_at: Optional[datetime] = None
    model_config = {"from_attributes": True}
