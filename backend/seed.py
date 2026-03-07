#!/usr/bin/env python3
"""
=============================================================================
PROCUREMENT SYSTEM — SCRIPT DI POPOLAMENTO DATABASE (SEED)
=============================================================================
Popola il database con dati realistici per il beta test:
  • 10 utenti di test
  • 20 fornitori
  • 60 contratti (stati variati, alcuni in scadenza)
  • 120 valutazioni fornitore (vendor ratings)
  • Survey token attivi per testare il flusso email → rating

USO:
  cd backend
  DATABASE_URL="postgresql://..." python seed.py
  oppure:
  DATABASE_URL="sqlite:///./seed_test.db" python seed.py   ← solo test locale

ATTENZIONE: lo script NON cancella dati esistenti.
Per resettare il DB prima del seed usa --reset:
  python seed.py --reset
=============================================================================
"""

import sys
import os
import random
import secrets
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

# ── Aggiungi il path del progetto ────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine, Base
# Import ALL models so SQLAlchemy mapper can resolve all relationships
from app.auth.models import User, UserRole, RefreshToken
from app.audit.models import AuditLog
from app.suppliers.models import (
    Supplier, SupplierContact, SupplierCertification,
    SupplierStatus, SupplierFatturato, SupplierDocument, SupplierCommunication
)
from app.contracts.models import (
    Contract, ContractStatus, EnteStipulante,
    ContractDocument, ContractCommunication, ContractOrder
)
from app.vendor_rating.models import (
    VendorRatingRequest, VendorRating, SupplierRatingSummary,
    UAYearlyReview, NonConformita, SemaforoStatus, RatingTriggerType
)
from app.auth.utils import get_password_hash

# ─────────────────────────────────────────────────────────────────────────────
# Dati realistici italiani
# ─────────────────────────────────────────────────────────────────────────────

FORNITORI_DATA = [
    # (ragione_sociale, partita_iva, alyante_code, categorie, accreditamento, status)
    ("Acme Informatica SRL",       "02345678901", "ALY001", ["IT", "Software"], "strategico",    "accreditato"),
    ("Biomed Diagnostics SpA",     "03456789012", "ALY002", ["Biomedicale", "Diagnostica"], "strategico", "accreditato"),
    ("Officina Meccanica Rossi",   "04567890123", "ALY003", ["Meccanica", "Manutenzione"], "preferenziale", "accreditato"),
    ("Farmaceutica Nord SRL",      "05678901234", "ALY004", ["Farmaceutico", "Reagenti"], "strategico", "accreditato"),
    ("Servizi Generali SpA",       "06789012345", "ALY005", ["Servizi", "Facility"], "preferenziale", "accreditato"),
    ("Electro Components SRL",     "07890123456", "ALY006", ["Elettronica", "Componenti"], "preferenziale", "accreditato"),
    ("Lab Supplies Italia",        "08901234567", "ALY007", ["Laboratorio", "Consumabili"], "strategico", "accreditato"),
    ("TechSolutions Roma",         "09012345678", "ALY008", ["IT", "Consulenza"], "preferenziale", "accreditato"),
    ("Cleaning Pro SRL",           "01234567890", "ALY009", ["Pulizie", "Servizi"], "preferenziale", "accreditato"),
    ("Energia Verde SpA",          "12345678901", "ALY010", ["Energia", "Utilities"], "strategico", "accreditato"),
    ("Forniture Ufficio Bianchi",  "23456789012", "ALY011", ["Cancelleria", "Ufficio"], "preferenziale", "accreditato"),
    ("Medical Device Italia",      "34567890123", "ALY012", ["Biomedicale", "Dispositivi"], "strategico", "accreditato"),
    ("Trasporti Veloci SRL",       "45678901234", "ALY013", ["Logistica", "Trasporti"], "preferenziale", "accreditato"),
    ("Chimica Avanzata SpA",       "56789012345", "ALY014", ["Chimica", "Reagenti"], "strategico", "accreditato"),
    ("Security Systems Italia",    "67890123456", "ALY015", ["Sicurezza", "Vigilanza"], "preferenziale", "accreditato"),
    ("Consulenza HR Milano",       "78901234567", "ALY016", ["HR", "Consulenza"], "preferenziale", "sotto_osservazione"),
    ("Print & Copy SRL",           "89012345678", "ALY017", ["Stampa", "Ufficio"], "preferenziale", "accreditato"),
    ("Bio Research Tools",         "90123456789", "ALY018", ["Laboratorio", "Ricerca"], "strategico", "accreditato"),
    ("Catering Executive SRL",     "01234509876", "ALY019", ["Ristorazione", "Servizi"], "preferenziale", "in_riqualifica"),
    ("IT Cloud Services SpA",      "12340987654", "ALY020", ["IT", "Cloud", "Software"], "strategico", "accreditato"),
]

OGGETTI_CONTRATTO = [
    "Fornitura server e infrastruttura IT",
    "Contratto manutenzione apparecchiature biomedicali",
    "Servizi di pulizia e sanificazione",
    "Fornitura reagenti da laboratorio",
    "Consulenza sistemi informativi",
    "Fornitura materiale d'ufficio e cancelleria",
    "Servizi di vigilanza e sicurezza",
    "Contratto energia elettrica",
    "Fornitura dispositivi medici diagnostici",
    "Servizi di logistica e trasporti",
    "Contratto licenze software enterprise",
    "Fornitura consumabili laboratorio",
    "Servizi cloud e hosting",
    "Contratto manutenzione impianti",
    "Fornitura DPI (dispositivi protezione individuale)",
    "Servizi ristorazione e catering",
    "Contratto stampa e reprografia",
    "Fornitura farmaci e principi attivi",
    "Consulenza HR e formazione",
    "Contratto telecomunicazioni",
    "Fornitura attrezzature scientifiche",
    "Servizi IT managed e helpdesk",
    "Contratto assicurazioni",
    "Fornitura arredi e complementi d'arredo",
    "Servizi di smaltimento rifiuti speciali",
]

CDC_LIST = ["CDC001", "CDC002", "CDC003", "CDC004", "CDC005", "RICERCA", "STRUTTURA", "ADMIN"]

ENTI = ["struttura", "ricerca", "entrambi"]

NOTE_VALUTAZIONE = [
    "Fornitura puntuale e conforme alle specifiche.",
    "Qualità del prodotto eccellente, supporto tecnico molto professionale.",
    "Ritardi nella consegna, ma qualità del materiale soddisfacente.",
    "Ottima comunicazione e reattività del referente commerciale.",
    "Prodotti di alta qualità, prezzi competitivi. Consigliato.",
    "Lieve difformità nelle quantità ricevute, prontamente corretta.",
    "Servizio nella norma, nessun problema rilevato.",
    "Eccellente! Consegna anticipata rispetto ai tempi concordati.",
    "Comunicazione migliorabile, ma prodotto conforme alle aspettative.",
    "Fornitura completamente soddisfacente sotto tutti gli aspetti.",
    "Qualche difficoltà nel post-vendita, ma risolto tempestivamente.",
    "Materiale di prima qualità. Fornitore affidabile e puntuale.",
    "Leggero ritardo nella prima consegna, poi tutto regolare.",
    "Supporto tecnico eccellente durante l'installazione.",
    "Prezzi leggermente superiori alla media ma qualità giustifica il costo.",
]

REFERENTI = [
    "Marco Bianchi", "Laura Rossi", "Giuseppe Verdi",
    "Anna Esposito", "Francesco Russo", "Chiara Ricci",
    "Antonio Marino", "Valentina Conti", "Roberto Gallo",
]

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def rnd_date(start_days_ago: int, end_days_ago: int = 0) -> date:
    """Ritorna una data casuale tra N e M giorni fa (o futuri se negativo)."""
    delta = random.randint(end_days_ago, start_days_ago)
    return (datetime.now() - timedelta(days=delta)).date()


def rnd_future(min_days: int, max_days: int) -> date:
    delta = random.randint(min_days, max_days)
    return (datetime.now() + timedelta(days=delta)).date()


def compute_semaforo(media: float) -> SemaforoStatus:
    if media is None:
        return SemaforoStatus.GRIGIO
    if media >= 4.0:
        return SemaforoStatus.VERDE
    if media >= 2.5:
        return SemaforoStatus.GIALLO
    return SemaforoStatus.ROSSO


# ─────────────────────────────────────────────────────────────────────────────
# Main seed function
# ─────────────────────────────────────────────────────────────────────────────

def seed():
    print("=" * 60)
    print("PROCUREMENT SYSTEM — SEED DATABASE")
    print("=" * 60)

    # Crea tutte le tabelle se non esistono
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # ── 1. UTENTI DI TEST ────────────────────────────────────────────────
        print("\n[1/5] Creazione utenti di test...")
        utenti_test = [
            ("admin_ufficio",  "Admin Ufficio Acquisti", "Admin2024!Tlt",  UserRole.ADMIN),
            ("admin_mario",    "Mario Bianchi",          "Admin2024!Tlt",  UserRole.ADMIN),
            ("admin_sara",     "Sara Colombo",           "Admin2024!Tlt",  UserRole.ADMIN),
            ("viewer_luigi",   "Luigi Esposito",         "Viewer2024!Tlt", UserRole.VIEWER),
            ("viewer_anna",    "Anna Ricci",             "Viewer2024!Tlt", UserRole.VIEWER),
            ("viewer_marco",   "Marco Verdi",            "Viewer2024!Tlt", UserRole.VIEWER),
            ("viewer_giulia",  "Giulia Romano",          "Viewer2024!Tlt", UserRole.VIEWER),
            ("admin_ricerca",  "Pietro Gallo",           "Admin2024!Tlt",  UserRole.ADMIN),
            ("admin_infra",    "Federica Marini",        "Admin2024!Tlt",  UserRole.ADMIN),
            ("viewer_test",    "Utente Test",            "Viewer2024!Tlt", UserRole.VIEWER),
        ]

        created_users = []
        for username, full_name, password, role in utenti_test:
            existing = db.query(User).filter(User.username == username).first()
            if not existing:
                u = User(
                    username=username,
                    email=f"{username}@telethon.it",
                    full_name=full_name,
                    hashed_password=get_password_hash(password),
                    role=role,
                    is_active=True,
                )
                db.add(u)
                db.flush()
                created_users.append(u)
                print(f"  ✓ {username} ({role.value}) — password: {password}")
            else:
                created_users.append(existing)
                print(f"  · {username} già esistente")

        db.commit()
        admin_users = [u for u in created_users if u.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN)]

        # ── 2. FORNITORI ─────────────────────────────────────────────────────
        print("\n[2/5] Creazione fornitori...")
        fornitori = []
        for i, (nome, piva, code, cats, acc, status) in enumerate(FORNITORI_DATA):
            existing = db.query(Supplier).filter(Supplier.partita_iva == piva).first()
            if existing:
                fornitori.append(existing)
                print(f"  · {nome} già esistente")
                continue

            s = Supplier(
                ragione_sociale=nome,
                partita_iva=piva,
                codice_fiscale=piva,
                alyante_code=code,
                status=SupplierStatus(status),
                accreditament_type=acc,
                categorie_merceologiche=cats,
                settore_attivita=cats[0] if cats else "Generale",
                sede_legale_comune=random.choice(["Milano", "Roma", "Napoli", "Torino", "Bologna", "Firenze"]),
                sede_legale_provincia=random.choice(["MI", "RM", "NA", "TO", "BO", "FI"]),
                sede_legale_cap=f"2{i:04d}",
                sede_legale_indirizzo=f"Via {random.choice(['Roma', 'Milano', 'Garibaldi', 'Mazzini'])} {random.randint(1,100)}",
                data_iscrizione=rnd_date(1800, 365),
                data_riqualifica=rnd_future(30, 730) if status == "accreditato" else rnd_future(7, 30),
                note_interne=f"Fornitore {acc} per {cats[0]}. Inserito in fase di beta test.",
                is_active_in_albo=True,
                alyante_accreditato=True,
            )
            db.add(s)
            db.flush()

            # Contatto primario
            db.add(SupplierContact(
                supplier_id=s.id,
                nome=f"Referente{i+1}",
                cognome=nome.split()[0],
                qualifica="Responsabile Commerciale",
                email1=f"referente{i+1}@{code.lower()}.it",
                telefono1=f"02{random.randint(1000000, 9999999)}",
                is_primary=True,
            ))

            # Fatturato ultimi 3 anni
            for anno_offset in range(3):
                anno = datetime.now().year - anno_offset - 1
                db.add(SupplierFatturato(
                    supplier_id=s.id,
                    anno=anno,
                    fatturato=Decimal(str(round(random.uniform(500_000, 50_000_000), 2))),
                ))

            # Certificazione (per fornitori strategici)
            if acc == "strategico":
                db.add(SupplierCertification(
                    supplier_id=s.id,
                    nome=random.choice(["ISO 9001:2015", "ISO 27001", "ISO 14001", "GMP"]),
                    numero=f"CERT-{i+1:04d}",
                    ente_rilascio="Bureau Veritas",
                    data_rilascio=rnd_date(730, 365),
                    data_scadenza=rnd_future(90, 540),
                ))

            fornitori.append(s)
            print(f"  ✓ {nome} [{acc}, {status}]")

        db.commit()

        # ── 3. CONTRATTI ─────────────────────────────────────────────────────
        print("\n[3/5] Creazione contratti...")
        contratti = []

        # Distribuzione stati: 35 attivi, 15 non attivi, 10 in rinegoziazione
        stati_pool = (
            ["attivo"] * 35 +
            ["non_attivo"] * 15 +
            ["in_rinegoziazione"] * 10
        )
        random.shuffle(stati_pool)

        for i in range(60):
            fornitore = random.choice(fornitori)
            stato = stati_pool[i]
            oggetto = random.choice(OGGETTI_CONTRATTO)
            id_contratto = f"CTR-{(i + 1):05d}"

            # Date strategiche:
            # - 8 contratti scadono nei prossimi 30 giorni (urgenti)
            # - 7 contratti scadono tra 30 e 60 giorni (attenzione)
            # - resto scadenza lontana o passata
            if i < 8 and stato == "attivo":
                data_inizio = rnd_date(730, 365)
                data_scadenza = rnd_future(1, 28)   # scade presto!
            elif i < 15 and stato == "attivo":
                data_inizio = rnd_date(730, 365)
                data_scadenza = rnd_future(30, 59)   # attenzione
            elif stato == "non_attivo":
                data_inizio = rnd_date(1800, 730)
                data_scadenza = rnd_date(365, 7)     # già scaduto
            else:
                data_inizio = rnd_date(365, 30)
                data_scadenza = rnd_future(60, 730)

            imponibile = Decimal(str(round(random.uniform(5_000, 500_000), 2)))
            iva = Decimal(str(random.choice([22, 10, 4, 0])))
            ivato = imponibile * (1 + iva / 100)

            referente = random.choice(REFERENTI)
            ente = random.choice(ENTI)

            c = Contract(
                id_contratto=id_contratto,
                ragione_sociale=fornitore.ragione_sociale,
                codice_fornitore=fornitore.alyante_code,
                supplier_id=fornitore.id,
                status=ContractStatus(stato),
                ente_stipulante=EnteStipulante(ente),
                cdc=random.choice(CDC_LIST),
                oggetto=oggetto,
                imponibile=imponibile,
                iva_percentuale=iva,
                ivato=ivato.quantize(Decimal("0.01")),
                dpa=random.random() > 0.6,
                questionario_it_gdpr=random.random() > 0.5,
                dpia=random.random() > 0.75,
                data_inizio=data_inizio,
                data_scadenza=data_scadenza,
                data_rinegoziazione=rnd_future(30, 180) if stato == "in_rinegoziazione" else None,
                rinnovo_tacito=random.random() > 0.5,
                alert_enabled=(stato == "attivo"),
                referente_interno=referente,
                referente_ufficio_acquisti=random.choice(REFERENTI),
                riferimento_gara=f"GARA-{2023 + random.randint(0,1)}-{i+1:03d}",
                cig_cup_commessa=f"Z{random.randint(10000000,99999999)}" if random.random() > 0.4 else None,
                created_by_id=random.choice(admin_users).id if admin_users else None,
            )
            db.add(c)
            contratti.append(c)

        db.flush()
        db.commit()
        print(f"  ✓ 60 contratti creati (35 attivi, 15 non attivi, 10 in rinegoziazione)")
        print(f"  ⚠ 8 contratti in scadenza entro 30 giorni")
        print(f"  ⚠ 7 contratti in scadenza entro 60 giorni")

        # ── 4. VALUTAZIONI FORNITORE ─────────────────────────────────────────
        print("\n[4/5] Creazione valutazioni fornitore (120 ratings)...")

        ratings_count = 0
        # Per ogni fornitore, crea tra 4 e 10 valutazioni
        fornitori_con_rating = random.sample(fornitori, min(18, len(fornitori)))

        for fornitore in fornitori_con_rating:
            n_ratings = random.randint(4, 10)
            supplier_ratings = []

            for j in range(n_ratings):
                if ratings_count >= 120:
                    break

                # Crea una VendorRatingRequest completata
                order_id = f"ORD-{fornitore.alyante_code}-{j+1:03d}"
                protocollo = f"PROT-{random.randint(10000, 99999)}"
                data_ordine = rnd_date(365, 30)

                req = VendorRatingRequest(
                    supplier_id=fornitore.id,
                    alyante_order_id=order_id,
                    protocollo_ordine=protocollo,
                    tipo_trigger=random.choice([
                        RatingTriggerType.DDT_BENI,
                        RatingTriggerType.FT_BENI_OSD,
                        RatingTriggerType.OPR_COMPLETATO,
                    ]),
                    tipo_documento=random.choice(["DDT", "Fattura", "OPR"]),
                    data_ordine=data_ordine,
                    data_registrazione=data_ordine + timedelta(days=random.randint(1, 5)),
                    data_consegna_richiesta=data_ordine + timedelta(days=random.randint(5, 15)),
                    data_consegna_ricevuta=data_ordine + timedelta(days=random.randint(3, 20)),
                    quantita_richiesta=Decimal(str(random.randint(10, 1000))),
                    quantita_ricevuta=Decimal(str(random.randint(9, 1000))),
                    cdc_commessa=random.choice(CDC_LIST),
                    responsabile=random.choice(REFERENTI),
                    valutatore_email=f"valutatore{j}@telethon.it",
                    valutatore_nome=random.choice(REFERENTI),
                    survey_token=secrets.token_urlsafe(64),
                    survey_expires_at=datetime.now(timezone.utc) - timedelta(days=random.randint(1, 300)),
                    survey_sent_at=datetime.now(timezone.utc) - timedelta(days=random.randint(1, 300)),
                    survey_completed_at=datetime.now(timezone.utc) - timedelta(days=random.randint(1, 280)),
                    survey_expired=False,
                )
                db.add(req)
                db.flush()

                # Genera KPI realistici (distribuiti in modo sensato per fornitore)
                # Fornitori strategici tendono ad avere rating più alti
                is_strategic = fornitore.accreditament_type == "strategico"
                base = 3.5 if is_strategic else 3.0
                spread = 0.8

                kpi1 = round(min(5, max(1, random.gauss(base, spread))), 1)
                kpi2 = round(min(5, max(1, random.gauss(base + 0.2, spread * 0.8))), 1)
                kpi3 = round(min(5, max(1, random.gauss(base + 0.1, spread))), 1)
                kpi4 = round(min(5, max(1, random.gauss(base - 0.1, spread * 1.2))), 1)

                # KPI automatici
                delta_gg = (req.data_consegna_richiesta - req.data_consegna_ricevuta).days if (req.data_consegna_richiesta and req.data_consegna_ricevuta) else None
                kpi5_sc = None
                if delta_gg is not None:
                    if delta_gg >= 0:
                        kpi5_sc = min(5.0, 4.5 + delta_gg * 0.1)
                    elif delta_gg >= -3:
                        kpi5_sc = 3.5
                    elif delta_gg >= -7:
                        kpi5_sc = 2.5
                    else:
                        kpi5_sc = 1.0

                pct = None
                if req.quantita_richiesta and req.quantita_ricevuta and req.quantita_richiesta > 0:
                    pct = float(req.quantita_ricevuta) / float(req.quantita_richiesta) * 100
                kpi6_sc = None
                if pct is not None:
                    if pct >= 100:
                        kpi6_sc = 5.0
                    elif pct < 80:
                        kpi6_sc = 1.0
                    else:
                        kpi6_sc = round(1.0 + (pct - 80) / 20 * 4.0, 2)

                kpi7_nc = 0  # nessuna non conformità nel seed

                user_vals = [v for v in [kpi1, kpi2, kpi3, kpi4] if v is not None]
                media_utente = round(sum(user_vals) / len(user_vals), 2) if user_vals else None
                auto_vals = [v for v in [kpi5_sc, kpi6_sc] if v is not None]
                all_vals = user_vals + auto_vals
                media_con_auto = round(sum(all_vals) / len(all_vals), 2) if all_vals else None
                if media_con_auto is not None:
                    nc_penalty = min(1.0, kpi7_nc * 0.2)
                    media_generale = max(1.0, round(media_con_auto - nc_penalty, 2))
                else:
                    media_generale = None

                rating = VendorRating(
                    request_id=req.id,
                    supplier_id=fornitore.id,
                    kpi1_qualita_prezzo=kpi1,
                    kpi2_qualita_relazionale=kpi2,
                    kpi3_qualita_tecnica=kpi3,
                    kpi4_affidabilita_tempi=kpi4,
                    kpi5_delta_giorni=float(delta_gg) if delta_gg is not None else None,
                    kpi5_score=kpi5_sc,
                    kpi6_precisione_pct=pct,
                    kpi6_score=kpi6_sc,
                    kpi7_non_conformita=kpi7_nc,
                    media_kpi_utente=media_utente,
                    media_con_auto=media_con_auto,
                    media_generale=media_generale,
                    semaforo=compute_semaforo(media_generale),
                    note=random.choice(NOTE_VALUTAZIONE) if random.random() > 0.3 else None,
                    data_valutazione=req.survey_completed_at,
                )
                db.add(rating)
                supplier_ratings.append(rating)
                ratings_count += 1

            db.flush()

            # Aggiorna il riepilogo del fornitore
            _update_summary_seed(db, fornitore.id, supplier_ratings)

        db.commit()
        print(f"  ✓ {ratings_count} valutazioni create")

        # ── 5. NON CONFORMITÀ ────────────────────────────────────────────────
        print("\n[4b] Creazione non conformità di test...")
        nc_count = 0
        fornitori_con_nc = random.sample(fornitori[:10], 5)
        gravita_options = ["lieve", "media", "grave"]
        stati_nc = ["aperta", "in_lavorazione", "chiusa"]
        for fornitore in fornitori_con_nc:
            n_nc = random.randint(1, 4)
            for k in range(n_nc):
                stato_nc = random.choice(stati_nc)
                data_apertura = rnd_date(180, 10)
                data_chiusura = rnd_date(9, 1) if stato_nc == "chiusa" else None
                nc = NonConformita(
                    supplier_id=fornitore.id,
                    nc_id_esterno=f"NC-EXT-{fornitore.alyante_code}-{k+1:03d}",
                    numero_ordine=f"ORD-{fornitore.alyante_code}-{random.randint(1,50):03d}",
                    codice_fornitore=fornitore.alyante_code,
                    descrizione=random.choice([
                        "Materiale consegnato non conforme alle specifiche tecniche",
                        "Quantità ricevuta inferiore all'ordinato (shortage > 5%)",
                        "Documentazione accompagnatoria incompleta o errata",
                        "Prodotto scaduto o prossimo alla scadenza",
                        "Imballaggio danneggiato - merce non integra",
                        "Difformità rispetto al campione approvato",
                        "Ritardo nella comunicazione di problemi di fornitura",
                    ]),
                    data_apertura=data_apertura,
                    data_chiusura=data_chiusura,
                    stato=stato_nc,
                    gravita=random.choice(gravita_options),
                    raw_payload={"source": "seed_test", "fornitore": fornitore.alyante_code},
                )
                db.add(nc)
                nc_count += 1

        db.commit()
        print(f"  ✓ {nc_count} non conformità create per 5 fornitori")

        # ── 6. UA YEARLY REVIEWS ─────────────────────────────────────────────
        print("\n[4c] Creazione valutazioni annuali UA...")
        anno_corrente = datetime.now().year
        ua_count = 0
        fornitori_con_ua = random.sample(fornitori, min(12, len(fornitori)))
        for fornitore in fornitori_con_ua:
            if not admin_users:
                continue
            is_strategic = fornitore.accreditament_type == "strategico"
            base_ua = 3.8 if is_strategic else 3.2
            ua = UAYearlyReview(
                supplier_id=fornitore.id,
                anno=anno_corrente,
                kpi1_qualita_prezzo=round(min(5, max(1, random.gauss(base_ua, 0.5))), 1),
                kpi2_qualita_relazionale=round(min(5, max(1, random.gauss(base_ua + 0.2, 0.4))), 1),
                kpi3_qualita_tecnica=round(min(5, max(1, random.gauss(base_ua, 0.6))), 1),
                kpi4_affidabilita_tempi=round(min(5, max(1, random.gauss(base_ua - 0.1, 0.5))), 1),
                kpi5_gestione_nc=round(min(5, max(1, random.gauss(base_ua - 0.2, 0.7))), 1),
                kpi6_innovazione=round(min(5, max(1, random.gauss(base_ua - 0.3, 0.8))), 1),
                media_ua=round(min(5, max(1, random.gauss(base_ua, 0.4))), 2),
                note=f"Valutazione annuale {anno_corrente} — fornitore {'strategico' if is_strategic else 'preferenziale'}.",
                reviewer_id=random.choice(admin_users).id,
            )
            db.add(ua)
            ua_count += 1

        db.commit()
        print(f"  ✓ {ua_count} valutazioni UA annuali create (anno {anno_corrente})")

        # ── 7. SURVEY APERTE (per testare il flusso) ────────────────────────
        print("\n[5] Creazione survey aperte per test flusso email...")
        survey_count = 0
        for fornitore in random.sample(fornitori, min(8, len(fornitori))):
            for k in range(random.randint(1, 3)):
                token = secrets.token_urlsafe(64)
                req = VendorRatingRequest(
                    supplier_id=fornitore.id,
                    alyante_order_id=f"OPEN-{fornitore.alyante_code}-{k+1}",
                    protocollo_ordine=f"OPEN-PROT-{random.randint(10000,99999)}",
                    tipo_trigger=random.choice([
                        RatingTriggerType.DDT_BENI,
                        RatingTriggerType.OPR_COMPLETATO,
                    ]),
                    tipo_documento=random.choice(["DDT", "OPR"]),
                    data_ordine=rnd_date(30, 7),
                    valutatore_email="beta.tester@telethon.it",
                    valutatore_nome="Beta Tester",
                    survey_token=token,
                    survey_expires_at=datetime.now(timezone.utc) + timedelta(days=30),
                    survey_sent_at=datetime.now(timezone.utc) - timedelta(days=random.randint(1, 10)),
                    survey_expired=False,
                )
                db.add(req)
                survey_count += 1

        db.commit()
        print(f"  ✓ {survey_count} survey aperte per test")

        # ── RIEPILOGO ─────────────────────────────────────────────────────────
        print("\n" + "=" * 60)
        print("SEED COMPLETATO CON SUCCESSO!")
        print("=" * 60)

        total_suppliers = db.query(Supplier).count()
        total_contracts = db.query(Contract).count()
        total_ratings = db.query(VendorRating).count()
        total_users = db.query(User).count()
        total_surveys_open = db.query(VendorRatingRequest).filter(
            VendorRatingRequest.survey_completed_at == None
        ).count()

        print(f"\n📊 Database attuale:")
        print(f"   👥 Utenti totali: {total_users}")
        print(f"   🏢 Fornitori:     {total_suppliers}")
        print(f"   📄 Contratti:     {total_contracts}")
        print(f"   ⭐ Valutazioni:   {total_ratings}")
        print(f"   📧 Survey aperte: {total_surveys_open}")

        print(f"\n🔐 Credenziali di test:")
        print(f"   Super Admin:   admin / Admin123456!")
        print(f"   Admin:         admin_ufficio / Admin2024!Tlt")
        print(f"   Admin:         admin_mario / Admin2024!Tlt")
        print(f"   Viewer:        viewer_luigi / Viewer2024!Tlt")

        total_nc = db.query(NonConformita).count()
        total_ua = db.query(UAYearlyReview).count()
        print(f"   📋 Non conformità: {total_nc}")
        print(f"   🏆 Valutazioni UA: {total_ua}")

        print(f"\n⚠️  Contratti urgenti (scadenza < 30gg): 8 contratti")
        print(f"⚠️  Contratti in attenzione (30-60gg):   7 contratti")

        print(f"\n✅ Piattaforma pronta per il beta test!")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"\n❌ ERRORE durante il seed: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


def _update_summary_seed(db, supplier_id: int, ratings: list):
    """Aggiorna o crea il SupplierRatingSummary per il fornitore."""
    summary = db.query(SupplierRatingSummary).filter(
        SupplierRatingSummary.supplier_id == supplier_id
    ).first()
    if not summary:
        summary = SupplierRatingSummary(supplier_id=supplier_id)
        db.add(summary)

    def avg(vals):
        vals = [v for v in vals if v is not None]
        return round(sum(vals) / len(vals), 2) if vals else None

    summary.total_user_ratings = len(ratings)
    summary.media_kpi1 = avg([r.kpi1_qualita_prezzo for r in ratings])
    summary.media_kpi2 = avg([r.kpi2_qualita_relazionale for r in ratings])
    summary.media_kpi3 = avg([r.kpi3_qualita_tecnica for r in ratings])
    summary.media_kpi4 = avg([r.kpi4_affidabilita_tempi for r in ratings])
    summary.media_kpi5_score = avg([r.kpi5_score for r in ratings])
    summary.media_kpi6_score = avg([r.kpi6_score for r in ratings])
    summary.media_kpi7_nc = avg([r.kpi7_non_conformita for r in ratings])
    summary.media_utente = avg([r.media_generale for r in ratings if r.media_generale])
    summary.media_generale = summary.media_utente
    summary.semaforo = compute_semaforo(summary.media_generale)
    summary.last_updated = datetime.now(timezone.utc)
    db.flush()


def reset_data(db):
    """Cancella tutti i dati di seed (mantiene tabelle)."""
    print("⚠️  RESET: cancellazione dati esistenti...")
    from sqlalchemy import text
    # Ordine inverso per rispettare FK
    tables = [
        "vendor_ratings", "vendor_rating_requests", "supplier_rating_summaries",
        "ua_yearly_reviews", "non_conformita",
        "contract_communications", "contract_documents", "contract_orders", "contracts",
        "supplier_communications", "supplier_documents", "supplier_certifications",
        "supplier_fatturati", "supplier_contacts", "suppliers",
        "refresh_tokens", "audit_logs",
    ]
    for t in tables:
        try:
            db.execute(text(f"DELETE FROM {t}"))
        except Exception:
            pass
    # Mantieni super_admin esistente
    db.execute(text("DELETE FROM users WHERE role != 'super_admin'"))
    db.commit()
    print("  ✓ Reset completato")


if __name__ == "__main__":
    if "--reset" in sys.argv:
        db = SessionLocal()
        Base.metadata.create_all(bind=engine)
        reset_data(db)
        db.close()

    seed()
