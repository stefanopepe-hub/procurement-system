from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Enum, Text,
    ForeignKey, Date, Numeric, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class SupplierStatus(str, enum.Enum):
    ACCREDITATO = "accreditato"
    NON_PIU_ACCREDITATO = "non_piu_accreditato"
    SOTTO_OSSERVAZIONE = "sotto_osservazione"
    IN_RIQUALIFICA = "in_riqualifica"


class AccreditamentType(str, enum.Enum):
    STRATEGICO = "strategico"
    PREFERENZIALE = "preferenziale"


class LegalPersonType(str, enum.Enum):
    PROFESSIONISTA = "professionista"
    IMPRESA = "impresa"


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)

    # --- Dati da Alyante (sincronizzati) ---
    alyante_code = Column(String(50), unique=True, nullable=True, index=True)
    ragione_sociale = Column(String(255), nullable=False, index=True)
    partita_iva = Column(String(20), nullable=True)
    codice_fiscale = Column(String(20), nullable=True)
    legal_person_type = Column(Enum(LegalPersonType), nullable=True)
    totale_ordinato = Column(Numeric(15, 2), default=0)

    # --- Sede Legale ---
    sede_legale_indirizzo = Column(String(255), nullable=True)
    sede_legale_comune = Column(String(100), nullable=True)
    sede_legale_provincia = Column(String(5), nullable=True)
    sede_legale_regione = Column(String(100), nullable=True)
    sede_legale_cap = Column(String(10), nullable=True)
    sede_legale_nazione = Column(String(100), default="Italia")
    sede_legale_web = Column(String(255), nullable=True)

    # --- Sede Operativa ---
    sede_operativa_indirizzo = Column(String(255), nullable=True)
    sede_operativa_comune = Column(String(100), nullable=True)
    sede_operativa_provincia = Column(String(5), nullable=True)
    sede_operativa_regione = Column(String(100), nullable=True)
    sede_operativa_cap = Column(String(10), nullable=True)
    sede_operativa_nazione = Column(String(100), nullable=True)
    sede_operativa_web = Column(String(255), nullable=True)

    # --- Magazzino ---
    indirizzo_magazzino = Column(String(255), nullable=True)

    # --- Dati Albo (compilati da Ufficio Acquisti) ---
    status = Column(Enum(SupplierStatus), default=SupplierStatus.ACCREDITATO, nullable=False, index=True)
    accreditament_type = Column(Enum(AccreditamentType), nullable=True)
    data_iscrizione = Column(Date, nullable=True)        # Unica, non modificabile
    data_riqualifica = Column(Date, nullable=True)       # Riscrivibile
    settore_attivita = Column(String(255), nullable=True)
    categorie_merceologiche = Column(JSON, nullable=True)  # Array di categorie
    maggiori_clienti = Column(Text, nullable=True)
    note_interne = Column(Text, nullable=True)

    # --- Flags ---
    is_active_in_albo = Column(Boolean, default=True)    # Anche se rimosso da Alyante resta in albo
    alyante_accreditato = Column(Boolean, default=True)  # Riflette flag Alyante

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # --- Relations ---
    contacts = relationship("SupplierContact", back_populates="supplier", cascade="all, delete-orphan")
    certifications = relationship("SupplierCertification", back_populates="supplier", cascade="all, delete-orphan")
    documents = relationship("SupplierDocument", back_populates="supplier", cascade="all, delete-orphan")
    fatturati = relationship("SupplierFatturato", back_populates="supplier", cascade="all, delete-orphan")
    communications = relationship("SupplierCommunication", back_populates="supplier", cascade="all, delete-orphan")
    contracts = relationship("Contract", back_populates="supplier")
    vendor_rating_requests = relationship("VendorRatingRequest", back_populates="supplier")


class SupplierContact(Base):
    __tablename__ = "supplier_contacts"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    nome = Column(String(100), nullable=True)
    cognome = Column(String(100), nullable=True)
    qualifica = Column(String(150), nullable=True)
    telefono1 = Column(String(30), nullable=True)
    telefono2 = Column(String(30), nullable=True)
    email1 = Column(String(255), nullable=True)
    email2 = Column(String(255), nullable=True)
    is_primary = Column(Boolean, default=False)

    supplier = relationship("Supplier", back_populates="contacts")


class SupplierCertification(Base):
    __tablename__ = "supplier_certifications"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    nome = Column(String(255), nullable=False)      # Es. ISO 9001, SOA
    numero = Column(String(100), nullable=True)
    ente_rilascio = Column(String(255), nullable=True)
    data_rilascio = Column(Date, nullable=True)
    data_scadenza = Column(Date, nullable=True)
    file_path = Column(String(512), nullable=True)

    supplier = relationship("Supplier", back_populates="certifications")


class SupplierDocument(Base):
    __tablename__ = "supplier_documents"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    tipo = Column(String(100), nullable=False)       # Es. Visura camerale, DURC
    nome_file = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    data_scadenza = Column(Date, nullable=True)
    data_upload = Column(DateTime(timezone=True), server_default=func.now())
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    supplier = relationship("Supplier", back_populates="documents")


class SupplierFatturato(Base):
    __tablename__ = "supplier_fatturati"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    anno = Column(Integer, nullable=False)
    fatturato = Column(Numeric(15, 2), nullable=True)

    supplier = relationship("Supplier", back_populates="fatturati")


class SupplierCommunication(Base):
    """Tracciabilità comunicazioni (riqualifiche, notifiche, etc.)"""
    __tablename__ = "supplier_communications"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    tipo = Column(String(100), nullable=False)       # riqualifica, notifica, manuale
    oggetto = Column(String(500), nullable=False)
    corpo = Column(Text, nullable=True)
    destinatari = Column(JSON, nullable=True)        # Lista email destinatari
    inviata_at = Column(DateTime(timezone=True), nullable=True)
    sent_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_auto = Column(Boolean, default=False)         # True = invio automatico schedulato
    status = Column(String(50), default="sent")      # sent, failed, pending

    supplier = relationship("Supplier", back_populates="communications")
