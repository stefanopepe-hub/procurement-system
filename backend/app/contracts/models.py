from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Enum, Text,
    ForeignKey, Date, Numeric, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class ContractStatus(str, enum.Enum):
    ATTIVO = "attivo"
    NON_ATTIVO = "non_attivo"
    IN_RINEGOZIAZIONE = "in_rinegoziazione"


class EnteStipulante(str, enum.Enum):
    STRUTTURA = "struttura"
    RICERCA = "ricerca"
    ENTRAMBI = "entrambi"


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, index=True)

    # --- Identificativi ---
    id_contratto = Column(String(20), unique=True, nullable=False, index=True)  # Auto-generato: CTR-00001
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)    # Può non essere in albo
    ragione_sociale = Column(String(255), nullable=False)                       # Denormalizzato per ricerca
    codice_fornitore = Column(String(50), nullable=True)

    # --- Stato ---
    status = Column(Enum(ContractStatus), default=ContractStatus.ATTIVO, nullable=False, index=True)

    # --- Dati contrattuali ---
    ente_stipulante = Column(Enum(EnteStipulante), nullable=True)
    cdc = Column(String(100), nullable=True, index=True)
    oggetto = Column(Text, nullable=False)
    imponibile = Column(Numeric(15, 2), nullable=True)
    iva_percentuale = Column(Numeric(5, 2), nullable=True)
    ivato = Column(Numeric(15, 2), nullable=True)

    # --- Privacy / IT ---
    dpa = Column(Boolean, default=False)
    questionario_it_gdpr = Column(Boolean, default=False)
    dpia = Column(Boolean, default=False)

    # --- Date ---
    data_inizio = Column(Date, nullable=True)
    data_scadenza = Column(Date, nullable=True, index=True)
    data_rinegoziazione = Column(Date, nullable=True, index=True)
    recesso_anticipato = Column(Text, nullable=True)     # Campo libero
    rinnovo_tacito = Column(Boolean, default=False)

    # --- Notifiche ---
    alert_enabled = Column(Boolean, default=True)        # NO inibisce tutte le notifiche
    notifica_60gg_sent = Column(Boolean, default=False)
    notifica_30gg_sent = Column(Boolean, default=False)
    notifica_rinegoziazione_60gg_sent = Column(Boolean, default=False)
    notifica_rinegoziazione_30gg_sent = Column(Boolean, default=False)

    # --- Riferimenti ---
    referente_interno = Column(String(255), nullable=True)
    referente_ufficio_acquisti = Column(String(255), nullable=True)
    riferimento_gara = Column(String(255), nullable=True)
    cig_cup_commessa = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # --- Relations ---
    supplier = relationship("Supplier", back_populates="contracts")
    documents = relationship("ContractDocument", back_populates="contract", cascade="all, delete-orphan")
    communications = relationship("ContractCommunication", back_populates="contract", cascade="all, delete-orphan")
    ordini = relationship("ContractOrder", back_populates="contract", cascade="all, delete-orphan")


class ContractDocument(Base):
    __tablename__ = "contract_documents"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    tipo = Column(String(100), nullable=False)           # Es. "Contratto firmato", "Allegato tecnico"
    nome_file = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    data_upload = Column(DateTime(timezone=True), server_default=func.now())
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    contract = relationship("Contract", back_populates="documents")


class ContractCommunication(Base):
    __tablename__ = "contract_communications"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    tipo = Column(String(100), nullable=False)           # notifica_scadenza, notifica_rinegoziazione, manuale
    oggetto = Column(String(500), nullable=False)
    corpo = Column(Text, nullable=True)
    destinatari = Column(JSON, nullable=True)
    inviata_at = Column(DateTime(timezone=True), server_default=func.now())
    is_auto = Column(Boolean, default=False)
    status = Column(String(50), default="sent")

    contract = relationship("Contract", back_populates="communications")


class ContractOrder(Base):
    """
    Associazione manuale (con spunta) tra un contratto e un ordine Alyante.
    Un ordine può essere associato a un solo contratto; un contratto può avere N ordini.
    Un fornitore può avere N contratti e N ordini indipendenti.
    """
    __tablename__ = "contract_orders"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)

    # Dati ordine (denormalizzati da Alyante per lookup rapido)
    alyante_order_id = Column(String(100), nullable=False, index=True)
    protocollo = Column(String(100), nullable=True)
    numero_pubblicazione = Column(String(100), nullable=True)
    tipo_documento = Column(String(20), nullable=True)  # ORD, ORN, OS, OPR, OSP, OSD
    data_ordine = Column(Date, nullable=True)
    importo = Column(Numeric(15, 2), nullable=True)
    oggetto = Column(String(500), nullable=True)
    stato = Column(String(50), nullable=True)           # ordinato, consegnato, fatturato
    cdc = Column(String(100), nullable=True)
    richiedente_email = Column(String(255), nullable=True)

    associato_da_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    associato_at = Column(DateTime(timezone=True), server_default=func.now())

    contract = relationship("Contract", back_populates="ordini")
