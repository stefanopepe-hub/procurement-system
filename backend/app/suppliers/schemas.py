from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
from app.suppliers.models import SupplierStatus, AccreditamentType, LegalPersonType


class ContactBase(BaseModel):
    nome: Optional[str] = None
    cognome: Optional[str] = None
    qualifica: Optional[str] = None
    telefono1: Optional[str] = None
    telefono2: Optional[str] = None
    email1: Optional[str] = None
    email2: Optional[str] = None
    is_primary: bool = False


class ContactRead(ContactBase):
    id: int
    model_config = {"from_attributes": True}


class CertificationBase(BaseModel):
    nome: str
    numero: Optional[str] = None
    ente_rilascio: Optional[str] = None
    data_rilascio: Optional[date] = None
    data_scadenza: Optional[date] = None


class CertificationRead(CertificationBase):
    id: int
    file_path: Optional[str] = None
    model_config = {"from_attributes": True}


class DocumentRead(BaseModel):
    id: int
    tipo: str
    nome_file: str
    data_scadenza: Optional[date] = None
    data_upload: datetime
    model_config = {"from_attributes": True}


class FatturatoBase(BaseModel):
    anno: int
    fatturato: Optional[Decimal] = None


class FatturatoRead(FatturatoBase):
    id: int
    model_config = {"from_attributes": True}


class CommunicationRead(BaseModel):
    id: int
    tipo: str
    oggetto: str
    corpo: Optional[str] = None
    destinatari: Optional[list] = None
    inviata_at: Optional[datetime] = None
    is_auto: bool
    status: str
    model_config = {"from_attributes": True}


class SupplierCreate(BaseModel):
    ragione_sociale: str
    alyante_code: Optional[str] = None
    partita_iva: Optional[str] = None
    codice_fiscale: Optional[str] = None
    legal_person_type: Optional[LegalPersonType] = None
    sede_legale_indirizzo: Optional[str] = None
    sede_legale_comune: Optional[str] = None
    sede_legale_provincia: Optional[str] = None
    sede_legale_regione: Optional[str] = None
    sede_legale_cap: Optional[str] = None
    sede_legale_nazione: Optional[str] = "Italia"
    sede_legale_web: Optional[str] = None
    sede_operativa_indirizzo: Optional[str] = None
    sede_operativa_comune: Optional[str] = None
    sede_operativa_provincia: Optional[str] = None
    sede_operativa_regione: Optional[str] = None
    sede_operativa_cap: Optional[str] = None
    sede_operativa_nazione: Optional[str] = None
    sede_operativa_web: Optional[str] = None
    indirizzo_magazzino: Optional[str] = None
    accreditament_type: Optional[AccreditamentType] = None
    settore_attivita: Optional[str] = None
    categorie_merceologiche: Optional[List[str]] = None
    maggiori_clienti: Optional[str] = None
    note_interne: Optional[str] = None


class SupplierUpdate(SupplierCreate):
    ragione_sociale: Optional[str] = None
    status: Optional[SupplierStatus] = None
    data_riqualifica: Optional[date] = None
    alyante_accreditato: Optional[bool] = None


class SupplierListItem(BaseModel):
    id: int
    ragione_sociale: str
    alyante_code: Optional[str] = None
    partita_iva: Optional[str] = None
    status: SupplierStatus
    accreditament_type: Optional[AccreditamentType] = None
    data_iscrizione: Optional[date] = None
    data_riqualifica: Optional[date] = None
    settore_attivita: Optional[str] = None
    categorie_merceologiche: Optional[list] = None
    semaforo: Optional[str] = None   # Dal rating summary
    model_config = {"from_attributes": True}


class SupplierDetail(SupplierListItem):
    codice_fiscale: Optional[str] = None
    legal_person_type: Optional[LegalPersonType] = None
    totale_ordinato: Optional[Decimal] = None
    sede_legale_indirizzo: Optional[str] = None
    sede_legale_comune: Optional[str] = None
    sede_legale_provincia: Optional[str] = None
    sede_legale_regione: Optional[str] = None
    sede_legale_cap: Optional[str] = None
    sede_legale_nazione: Optional[str] = None
    sede_legale_web: Optional[str] = None
    sede_operativa_indirizzo: Optional[str] = None
    sede_operativa_comune: Optional[str] = None
    sede_operativa_provincia: Optional[str] = None
    sede_operativa_regione: Optional[str] = None
    sede_operativa_cap: Optional[str] = None
    sede_operativa_nazione: Optional[str] = None
    sede_operativa_web: Optional[str] = None
    indirizzo_magazzino: Optional[str] = None
    maggiori_clienti: Optional[str] = None
    note_interne: Optional[str] = None
    contacts: List[ContactRead] = []
    certifications: List[CertificationRead] = []
    documents: List[DocumentRead] = []
    fatturati: List[FatturatoRead] = []
    communications: List[CommunicationRead] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SupplierSearchParams(BaseModel):
    q: Optional[str] = None                                # Ricerca libera
    ragione_sociale: Optional[str] = None
    categoria_merceologica: Optional[str] = None
    certificazione: Optional[str] = None
    sede_comune: Optional[str] = None
    sede_provincia: Optional[str] = None
    referente_nome: Optional[str] = None
    status: Optional[List[SupplierStatus]] = None
    accreditament_type: Optional[AccreditamentType] = None
    page: int = 1
    page_size: int = 20


class PaginatedSuppliers(BaseModel):
    items: List[SupplierListItem]
    total: int
    page: int
    page_size: int
    pages: int
