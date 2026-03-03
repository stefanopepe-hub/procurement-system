from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Enum, Text,
    ForeignKey, Date, Numeric, JSON, Float, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class RatingTriggerType(str, enum.Enum):
    DDT_BENI = "ddt_beni"           # ORD, ORN, OS con DDT registrato
    FT_BENI_OSD = "ft_beni_osd"     # OSD con fattura registrata
    OPR_COMPLETATO = "opr_completato"  # OPR/OSP completato/fatturato


class SemaforoStatus(str, enum.Enum):
    VERDE = "verde"    # media >= 4.0
    GIALLO = "giallo"  # 2.5 <= media < 4.0
    ROSSO = "rosso"    # media < 2.5
    GRIGIO = "grigio"  # nessuna valutazione


class VendorRatingRequest(Base):
    """
    Richiesta di survey inviata al richiedente originale dell'ordine
    in seguito a: registrazione DDT, registrazione FT, completamento OPR.
    Una per ogni evento Alyante ricevuto.
    """
    __tablename__ = "vendor_rating_requests"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)

    # --- Dati ordine (da Alyante webhook) ---
    alyante_order_id = Column(String(100), nullable=True, index=True)   # ID univoco ordine in Alyante
    protocollo_ordine = Column(String(100), nullable=True, index=True)
    numero_pubblicazione = Column(String(100), nullable=True)
    tipo_trigger = Column(Enum(RatingTriggerType), nullable=False)
    tipo_documento = Column(String(20), nullable=True)  # ORD, ORN, OS, OSD, OPR, OSP
    data_ordine = Column(Date, nullable=True)
    data_registrazione = Column(Date, nullable=True)    # data DDT o Fattura registrata
    data_consegna_richiesta = Column(Date, nullable=True)
    data_consegna_ricevuta = Column(Date, nullable=True)
    quantita_richiesta = Column(Numeric(15, 3), nullable=True)
    quantita_ricevuta = Column(Numeric(15, 3), nullable=True)
    cdc_commessa = Column(String(255), nullable=True)
    responsabile = Column(String(255), nullable=True)
    pi_riferimento = Column(String(255), nullable=True)

    # --- Richiedente (chi ha creato RDA/Ordine) ---
    valutatore_email = Column(String(255), nullable=False)
    valutatore_nome = Column(String(255), nullable=True)

    # --- Survey token (30gg TTL) ---
    survey_token = Column(String(128), unique=True, nullable=False, index=True)
    survey_sent_at = Column(DateTime(timezone=True), nullable=True)
    survey_expires_at = Column(DateTime(timezone=True), nullable=False)
    survey_completed_at = Column(DateTime(timezone=True), nullable=True)
    survey_expired = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    supplier = relationship("Supplier", back_populates="vendor_rating_requests")
    rating = relationship("VendorRating", back_populates="request", uselist=False)


class VendorRating(Base):
    """
    Valutazione del richiedente (KPI 1-4 stelline 1-5)
    + KPI automatici calcolati (5-6)
    + KPI7 da tool Non Conformità
    """
    __tablename__ = "vendor_ratings"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("vendor_rating_requests.id"), unique=True, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)

    # --- KPI utente (NULL = non espresso, NON concorre alla media) ---
    kpi1_qualita_prezzo = Column(Float, nullable=True)      # Qualità prezzo/fornitura
    kpi2_qualita_relazionale = Column(Float, nullable=True) # Qualità relazionale fornitore
    kpi3_qualita_tecnica = Column(Float, nullable=True)     # Qualità tecnica fornitura
    kpi4_affidabilita_tempi = Column(Float, nullable=True)  # Affidabilità tempi dichiarati

    # --- KPI5: puntualità (delta giorni + score normalizzato 1-5) ---
    kpi5_delta_giorni = Column(Float, nullable=True)   # >0 anticipata, <0 ritardo
    kpi5_score = Column(Float, nullable=True)          # Score 1-5 normalizzato

    # --- KPI6: precisione fornitura (% ricevuta/richiesta + score) ---
    kpi6_precisione_pct = Column(Float, nullable=True)
    kpi6_score = Column(Float, nullable=True)

    # --- KPI7: non conformità (popolato da webhook tool NC) ---
    kpi7_non_conformita = Column(Integer, default=0)

    # --- Media e semaforo dell'ordine ---
    media_kpi_utente = Column(Float, nullable=True)
    media_con_auto = Column(Float, nullable=True)       # Include KPI5-6
    media_generale = Column(Float, nullable=True)       # Include anche KPI7 penalty
    semaforo = Column(Enum(SemaforoStatus), default=SemaforoStatus.GRIGIO)

    note = Column(Text, nullable=True)                  # Obbligatorie se media < 3
    note_acquisti = Column(Text, nullable=True)

    data_valutazione = Column(DateTime(timezone=True), server_default=func.now())

    request = relationship("VendorRatingRequest", back_populates="rating")
    supplier = relationship("Supplier")


class UAYearlyReview(Base):
    """
    Valutazione annuale dell'Ufficio Acquisti sul fornitore.
    Peso 30% nella media generale finale.
    """
    __tablename__ = "ua_yearly_reviews"
    __table_args__ = (
        UniqueConstraint("supplier_id", "anno", name="uq_ua_review_supplier_anno"),
    )

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    anno = Column(Integer, nullable=False)

    # KPI da 1 a 5 (stessa scala della survey utente)
    kpi1_qualita_prezzo = Column(Float, nullable=True)
    kpi2_qualita_relazionale = Column(Float, nullable=True)
    kpi3_qualita_tecnica = Column(Float, nullable=True)
    kpi4_affidabilita_tempi = Column(Float, nullable=True)
    kpi5_gestione_nc = Column(Float, nullable=True)         # Come il fornitore gestisce le NC
    kpi6_innovazione = Column(Float, nullable=True)         # Propositività e innovazione

    media_ua = Column(Float, nullable=True)
    note = Column(Text, nullable=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    supplier = relationship("Supplier")
    reviewer = relationship("User")


class SupplierRatingSummary(Base):
    """
    Riepilogo aggregato per fornitore.
    Media finale = 70% media valutazioni utenti + 30% valutazione UA (se presente).
    """
    __tablename__ = "supplier_rating_summaries"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), unique=True, nullable=False)

    # Contatori
    total_user_ratings = Column(Integer, default=0)

    # Medie KPI utente (tutte le valutazioni)
    media_kpi1 = Column(Float, nullable=True)
    media_kpi2 = Column(Float, nullable=True)
    media_kpi3 = Column(Float, nullable=True)
    media_kpi4 = Column(Float, nullable=True)
    media_kpi5_score = Column(Float, nullable=True)
    media_kpi6_score = Column(Float, nullable=True)
    media_kpi7_nc = Column(Float, nullable=True)    # media NC aperte per ordine (lower is better)

    # Media utente complessiva (KPI 1-6, pesati)
    media_utente = Column(Float, nullable=True)

    # Valutazione UA anno corrente
    media_ua = Column(Float, nullable=True)
    anno_ua = Column(Integer, nullable=True)

    # Media finale (70% utente + 30% UA, se UA presente)
    media_generale = Column(Float, nullable=True)
    semaforo = Column(Enum(SemaforoStatus), default=SemaforoStatus.GRIGIO)

    last_updated = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    supplier = relationship("Supplier")


class NonConformita(Base):
    """
    Non conformità ricevute dal tool esterno via webhook.
    KPI7 = conteggio NC aperte per fornitore per periodo.
    """
    __tablename__ = "non_conformita"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True, index=True)
    nc_id_esterno = Column(String(100), nullable=False, unique=True)  # ID nel tool NC
    numero_ordine = Column(String(100), nullable=True, index=True)    # Collega a ordine Alyante
    codice_fornitore = Column(String(50), nullable=True)              # Per lookup se supplier_id ignoto
    descrizione = Column(Text, nullable=True)
    data_apertura = Column(Date, nullable=True)
    data_chiusura = Column(Date, nullable=True)
    stato = Column(String(50), nullable=True)     # aperta, chiusa, in_lavorazione
    gravita = Column(String(50), nullable=True)   # lieve, media, grave
    raw_payload = Column(JSON, nullable=True)     # Payload originale webhook (per debug)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    supplier = relationship("Supplier")
