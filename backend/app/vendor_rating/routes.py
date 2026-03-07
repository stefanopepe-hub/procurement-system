from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import math, secrets

from app.database import get_db
from app.auth.routes import require_admin, get_current_active_user
from app.auth.models import User
from app.vendor_rating.models import (
    VendorRatingRequest, VendorRating, SupplierRatingSummary,
    UAYearlyReview, NonConformita, SemaforoStatus, RatingTriggerType
)
from app.suppliers.models import Supplier
from app.vendor_rating.schemas import (
    SurveySubmit, SurveyInfo, RatingRequestCreate, RatingDetail,
    SupplierRatingSummaryRead, PaginatedRatingSummary,
    UAYearlyReviewCreate, UAYearlyReviewRead,
    NonConformitaWebhook, AlyanteTriggerWebhook,
)
from app.audit.service import log_action
from app.notifications.email import send_email, build_vendor_rating_survey_email
from app.config import settings

router = APIRouter(prefix="/vendor-rating", tags=["Vendor Rating"])


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def compute_semaforo(media):
    if media is None:
        return SemaforoStatus.GRIGIO
    if media >= 4.0:
        return SemaforoStatus.VERDE
    if media >= 2.5:
        return SemaforoStatus.GIALLO
    return SemaforoStatus.ROSSO


def _kpi5_score(delta_giorni):
    """Puntualità 1-5: anticipo→5, puntuale→4.5, ritardo crescente→1"""
    if delta_giorni is None:
        return None
    if delta_giorni >= 0:
        return min(5.0, 4.5 + delta_giorni * 0.1)
    if delta_giorni >= -3:
        return 3.5
    if delta_giorni >= -7:
        return 2.5
    return 1.0


def _kpi6_score(pct):
    """Precisione: 100%→5, <80%→1, lineare"""
    if pct is None:
        return None
    if pct >= 100:
        return 5.0
    if pct < 80:
        return 1.0
    return round(1.0 + (pct - 80) / 20 * 4.0, 2)


def _compute_order_media(kpis_user, kpi5_sc, kpi6_sc, kpi7_nc):
    """
    media_utente: media KPI 1-4 (solo quelli compilati)
    media_con_auto: media KPI 1-6
    media_generale: media_con_auto - penalità NC (0.2 per NC aperta, max -1.0)
    """
    user_vals = [v for v in kpis_user if v is not None]
    media_utente = round(sum(user_vals) / len(user_vals), 2) if user_vals else None

    auto_vals = [v for v in [kpi5_sc, kpi6_sc] if v is not None]
    all_vals = user_vals + auto_vals
    media_con_auto = round(sum(all_vals) / len(all_vals), 2) if all_vals else None

    if media_con_auto is not None:
        nc_penalty = min(1.0, kpi7_nc * 0.2)
        media_generale = max(1.0, round(media_con_auto - nc_penalty, 2))
    else:
        media_generale = None

    return media_utente, media_con_auto, media_generale


def update_summary(db, supplier_id):
    """Ricalcola il riepilogo aggregato: 70% media utente + 30% UA (anno corrente)."""
    ratings = db.query(VendorRating).filter(VendorRating.supplier_id == supplier_id).all()

    summary = db.query(SupplierRatingSummary).filter(
        SupplierRatingSummary.supplier_id == supplier_id
    ).first()
    if not summary:
        summary = SupplierRatingSummary(supplier_id=supplier_id)
        db.add(summary)

    def _avg(vals):
        vals = [v for v in vals if v is not None]
        return round(sum(vals) / len(vals), 2) if vals else None

    summary.total_user_ratings = len(ratings)
    summary.media_kpi1 = _avg([r.kpi1_qualita_prezzo for r in ratings])
    summary.media_kpi2 = _avg([r.kpi2_qualita_relazionale for r in ratings])
    summary.media_kpi3 = _avg([r.kpi3_qualita_tecnica for r in ratings])
    summary.media_kpi4 = _avg([r.kpi4_affidabilita_tempi for r in ratings])
    summary.media_kpi5_score = _avg([r.kpi5_score for r in ratings])
    summary.media_kpi6_score = _avg([r.kpi6_score for r in ratings])
    summary.media_kpi7_nc = _avg([r.kpi7_non_conformita for r in ratings])
    summary.media_utente = _avg([r.media_generale for r in ratings if r.media_generale])

    # UA review anno corrente (peso 30%)
    anno = datetime.now().year
    ua = db.query(UAYearlyReview).filter(
        UAYearlyReview.supplier_id == supplier_id,
        UAYearlyReview.anno == anno
    ).first()
    if ua and ua.media_ua:
        summary.media_ua = ua.media_ua
        summary.anno_ua = anno
        if summary.media_utente:
            summary.media_generale = round(summary.media_utente * 0.7 + ua.media_ua * 0.3, 2)
        else:
            summary.media_generale = ua.media_ua
    else:
        summary.media_ua = None
        summary.anno_ua = None
        summary.media_generale = summary.media_utente

    summary.semaforo = compute_semaforo(summary.media_generale)
    db.commit()


# ─────────────────────────────────────────────
# Webhook Alyante
# ─────────────────────────────────────────────

@router.post("/webhook/alyante", status_code=202)
def alyante_webhook(
    data: AlyanteTriggerWebhook,
    db: Session = Depends(get_db),
    x_api_key: Optional[str] = Header(None),
):
    """
    Ricevuto da Alyante/DMS quando:
    - DDT registrato su ORD/ORN/OS          → tipo_trigger = ddt_beni
    - FT registrata su OSD                  → tipo_trigger = ft_beni_osd
    - OPR/OSP completato (fattura evade)    → tipo_trigger = opr_completato
    Crea la survey e invia la mail al richiedente.
    """
    if settings.ALYANTE_API_KEY and x_api_key != settings.ALYANTE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

    supplier = db.query(Supplier).filter(
        Supplier.alyante_code == data.codice_fornitore
    ).first()

    # Evita duplicati per stesso ordine+evento
    existing = db.query(VendorRatingRequest).filter(
        VendorRatingRequest.alyante_order_id == data.alyante_order_id,
        VendorRatingRequest.tipo_trigger == data.tipo_trigger,
    ).first()
    if existing:
        return {"message": "Survey already created", "request_id": existing.id}

    token = secrets.token_urlsafe(64)
    expires = datetime.now(timezone.utc) + timedelta(days=30)

    req = VendorRatingRequest(
        supplier_id=supplier.id if supplier else 0,
        alyante_order_id=data.alyante_order_id,
        protocollo_ordine=data.protocollo_ordine,
        numero_pubblicazione=data.numero_pubblicazione,
        tipo_trigger=data.tipo_trigger,
        tipo_documento=data.tipo_documento,
        data_ordine=data.data_ordine,
        data_registrazione=data.data_registrazione,
        data_consegna_richiesta=data.data_consegna_richiesta,
        data_consegna_ricevuta=data.data_consegna_ricevuta,
        quantita_richiesta=data.quantita_richiesta,
        quantita_ricevuta=data.quantita_ricevuta,
        cdc_commessa=data.cdc_commessa,
        responsabile=data.responsabile,
        pi_riferimento=data.pi_riferimento,
        valutatore_email=data.richiedente_email,
        valutatore_nome=data.richiedente_nome,
        survey_token=token,
        survey_expires_at=expires,
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    # Invia email survey
    ragione_sociale = supplier.ragione_sociale if supplier else data.codice_fornitore
    survey_url = f"{settings.APP_BASE_URL}/survey/{token}"
    html = build_vendor_rating_survey_email(
        ragione_sociale=ragione_sociale,
        protocollo=data.protocollo_ordine or data.alyante_order_id,
        survey_url=survey_url,
        tipo_trigger=data.tipo_trigger,
        data_ordine=str(data.data_ordine) if data.data_ordine else None,
    )
    sent = send_email(
        to=[data.richiedente_email],
        subject=f"Valuta la fornitura di {ragione_sociale} – Fondazione Telethon",
        body_html=html,
    )
    if sent:
        req.survey_sent_at = datetime.now(timezone.utc)
        db.commit()

    return {"message": "Survey created", "request_id": req.id, "survey_token": token}


# ─────────────────────────────────────────────
# Webhook Non Conformità
# ─────────────────────────────────────────────

@router.post("/webhook/non-conformita", status_code=202)
def nc_webhook(
    data: NonConformitaWebhook,
    db: Session = Depends(get_db),
    x_api_key: Optional[str] = Header(None),
):
    """
    Riceve eventi dal tool Non Conformità.
    Aggiorna KPI7 sulle valutazioni relative allo stesso numero ordine.
    """
    if settings.NC_API_KEY and x_api_key != settings.NC_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

    supplier = None
    if data.codice_fornitore:
        supplier = db.query(Supplier).filter(
            Supplier.alyante_code == data.codice_fornitore
        ).first()

    # Upsert NC locale
    nc = db.query(NonConformita).filter(
        NonConformita.nc_id_esterno == data.nc_id
    ).first()
    if nc:
        nc.stato = data.stato
        nc.data_chiusura = data.data_chiusura
        nc.raw_payload = data.raw_payload
    else:
        nc = NonConformita(
            supplier_id=supplier.id if supplier else None,
            nc_id_esterno=data.nc_id,
            numero_ordine=data.numero_ordine,
            codice_fornitore=data.codice_fornitore,
            descrizione=data.descrizione,
            data_apertura=data.data_apertura,
            data_chiusura=data.data_chiusura,
            stato=data.stato,
            gravita=data.gravita,
            raw_payload=data.raw_payload,
        )
        db.add(nc)
    db.commit()

    # Aggiorna KPI7 sulle valutazioni collegate all'ordine
    if data.numero_ordine and supplier:
        reqs = db.query(VendorRatingRequest).filter(
            VendorRatingRequest.protocollo_ordine == data.numero_ordine,
            VendorRatingRequest.supplier_id == supplier.id,
        ).all()
        for req in reqs:
            if req.rating:
                nc_open = db.query(NonConformita).filter(
                    NonConformita.numero_ordine == data.numero_ordine,
                    NonConformita.supplier_id == supplier.id,
                    NonConformita.stato != "chiusa",
                ).count()
                req.rating.kpi7_non_conformita = nc_open
                kpis = [req.rating.kpi1_qualita_prezzo, req.rating.kpi2_qualita_relazionale,
                        req.rating.kpi3_qualita_tecnica, req.rating.kpi4_affidabilita_tempi]
                _, _, media_gen = _compute_order_media(kpis, req.rating.kpi5_score, req.rating.kpi6_score, nc_open)
                req.rating.media_generale = media_gen
                req.rating.semaforo = compute_semaforo(media_gen)
        db.commit()
        update_summary(db, supplier.id)

    return {"message": "NC processed", "nc_id": nc.id}


# ─────────────────────────────────────────────
# Survey pubblica (no auth)
# ─────────────────────────────────────────────

@router.get("/survey/{token}", response_model=SurveyInfo)
def get_survey(token: str, db: Session = Depends(get_db)):
    req = db.query(VendorRatingRequest).filter(
        VendorRatingRequest.survey_token == token
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Survey non trovata")
    is_expired = req.survey_expires_at < datetime.now(timezone.utc) or req.survey_expired
    supplier = db.query(Supplier).filter(Supplier.id == req.supplier_id).first()
    return SurveyInfo(
        token=token,
        ragione_sociale=supplier.ragione_sociale if supplier else "N/A",
        protocollo_ordine=req.protocollo_ordine,
        tipo_trigger=req.tipo_trigger,
        tipo_documento=req.tipo_documento,
        data_ordine=req.data_ordine,
        data_consegna_richiesta=req.data_consegna_richiesta,
        data_consegna_ricevuta=req.data_consegna_ricevuta,
        is_expired=is_expired,
        is_completed=req.survey_completed_at is not None,
    )


@router.post("/survey/submit")
def submit_survey(data: SurveySubmit, db: Session = Depends(get_db)):
    req = db.query(VendorRatingRequest).filter(
        VendorRatingRequest.survey_token == data.token
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Survey non trovata")
    if req.survey_expired or req.survey_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Survey scaduta (oltre 30 giorni dall'invio)")
    if req.survey_completed_at:
        raise HTTPException(status_code=409, detail="Survey già compilata")

    # KPI automatici
    kpi5_delta = None
    if req.data_consegna_richiesta and req.data_consegna_ricevuta:
        kpi5_delta = float((req.data_consegna_richiesta - req.data_consegna_ricevuta).days)
    kpi5_sc = _kpi5_score(kpi5_delta)

    kpi6_pct = None
    if req.quantita_richiesta and req.quantita_ricevuta and req.quantita_richiesta > 0:
        kpi6_pct = round(float(req.quantita_ricevuta) / float(req.quantita_richiesta) * 100, 2)
    kpi6_sc = _kpi6_score(kpi6_pct)

    nc_count = 0
    if req.protocollo_ordine:
        nc_count = db.query(NonConformita).filter(
            NonConformita.numero_ordine == req.protocollo_ordine,
            NonConformita.supplier_id == req.supplier_id,
            NonConformita.stato != "chiusa",
        ).count()

    kpis_user = [data.kpi1, data.kpi2, data.kpi3, data.kpi4]
    media_utente, media_con_auto, media_generale = _compute_order_media(kpis_user, kpi5_sc, kpi6_sc, nc_count)

    if media_utente and media_utente < 3 and not data.note:
        raise HTTPException(
            status_code=422,
            detail="Le note sono obbligatorie per valutazioni sotto la sufficienza (media < 3)"
        )

    rating = VendorRating(
        request_id=req.id,
        supplier_id=req.supplier_id,
        kpi1_qualita_prezzo=data.kpi1,
        kpi2_qualita_relazionale=data.kpi2,
        kpi3_qualita_tecnica=data.kpi3,
        kpi4_affidabilita_tempi=data.kpi4,
        kpi5_delta_giorni=kpi5_delta,
        kpi5_score=kpi5_sc,
        kpi6_precisione_pct=kpi6_pct,
        kpi6_score=kpi6_sc,
        kpi7_non_conformita=nc_count,
        media_kpi_utente=media_utente,
        media_con_auto=media_con_auto,
        media_generale=media_generale,
        semaforo=compute_semaforo(media_generale),
        note=data.note,
    )
    db.add(rating)
    req.survey_completed_at = datetime.now(timezone.utc)
    db.commit()
    update_summary(db, req.supplier_id)
    return {"message": "Valutazione registrata con successo", "semaforo": rating.semaforo}


# ─────────────────────────────────────────────
# Admin: Dashboard + dettagli fornitore + UA review
# ─────────────────────────────────────────────

@router.get("/dashboard", response_model=PaginatedRatingSummary)
def dashboard(
    q: Optional[str] = Query(None),
    semaforo: Optional[SemaforoStatus] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    query = db.query(SupplierRatingSummary).join(Supplier)
    if semaforo:
        query = query.filter(SupplierRatingSummary.semaforo == semaforo)
    if q:
        query = query.filter(Supplier.ragione_sociale.ilike(f"%{q}%"))
    total = query.count()
    summaries = query.order_by(SupplierRatingSummary.media_generale.desc().nullslast()) \
        .offset((page - 1) * page_size).limit(page_size).all()
    items = []
    for s in summaries:
        supplier = db.query(Supplier).filter(Supplier.id == s.supplier_id).first()
        item = SupplierRatingSummaryRead.model_validate(s)
        item.ragione_sociale = supplier.ragione_sociale if supplier else "N/A"
        items.append(item)
    return PaginatedRatingSummary(
        items=items, total=total, page=page,
        page_size=page_size, pages=math.ceil(total / page_size) if total else 1
    )


@router.get("/supplier/{supplier_id}/ratings", response_model=List[RatingDetail])
def get_supplier_ratings(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    ratings = db.query(VendorRating).filter(VendorRating.supplier_id == supplier_id).all()
    result = []
    for r in ratings:
        detail = RatingDetail.model_validate(r)
        if r.request:
            detail.protocollo_ordine = r.request.protocollo_ordine
            detail.numero_pubblicazione = r.request.numero_pubblicazione
            detail.tipo_trigger = r.request.tipo_trigger
            detail.tipo_documento = r.request.tipo_documento
            detail.data_ordine = r.request.data_ordine
            detail.data_registrazione = r.request.data_registrazione
            detail.valutatore_nome = r.request.valutatore_nome
            detail.valutatore_email = r.request.valutatore_email
            detail.cdc_commessa = r.request.cdc_commessa
            detail.responsabile = r.request.responsabile
        supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
        if supplier:
            detail.ragione_sociale = supplier.ragione_sociale
        result.append(detail)
    return result


@router.get("/supplier/{supplier_id}/summary", response_model=SupplierRatingSummaryRead)
def get_supplier_summary(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    summary = db.query(SupplierRatingSummary).filter(
        SupplierRatingSummary.supplier_id == supplier_id
    ).first()
    if not summary:
        raise HTTPException(status_code=404, detail="Nessun dato di rating per questo fornitore")
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    result = SupplierRatingSummaryRead.model_validate(summary)
    result.ragione_sociale = supplier.ragione_sociale if supplier else "N/A"
    return result


@router.get("/supplier/{supplier_id}/ua-reviews", response_model=List[UAYearlyReviewRead])
def list_ua_reviews(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return db.query(UAYearlyReview).filter(
        UAYearlyReview.supplier_id == supplier_id
    ).order_by(UAYearlyReview.anno.desc()).all()


@router.post("/supplier/{supplier_id}/ua-reviews", response_model=UAYearlyReviewRead, status_code=201)
def create_or_update_ua_review(
    supplier_id: int,
    data: UAYearlyReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Crea o aggiorna la valutazione annuale UA (una per anno per fornitore)."""
    kpis = [data.kpi1, data.kpi2, data.kpi3, data.kpi4, data.kpi5_gestione_nc, data.kpi6_innovazione]
    vals = [v for v in kpis if v is not None]
    media = round(sum(vals) / len(vals), 2) if vals else None

    review = db.query(UAYearlyReview).filter(
        UAYearlyReview.supplier_id == supplier_id,
        UAYearlyReview.anno == data.anno,
    ).first()
    if review:
        review.kpi1_qualita_prezzo = data.kpi1
        review.kpi2_qualita_relazionale = data.kpi2
        review.kpi3_qualita_tecnica = data.kpi3
        review.kpi4_affidabilita_tempi = data.kpi4
        review.kpi5_gestione_nc = data.kpi5_gestione_nc
        review.kpi6_innovazione = data.kpi6_innovazione
        review.media_ua = media
        review.note = data.note
        review.reviewer_id = current_user.id
    else:
        review = UAYearlyReview(
            supplier_id=supplier_id,
            anno=data.anno,
            kpi1_qualita_prezzo=data.kpi1,
            kpi2_qualita_relazionale=data.kpi2,
            kpi3_qualita_tecnica=data.kpi3,
            kpi4_affidabilita_tempi=data.kpi4,
            kpi5_gestione_nc=data.kpi5_gestione_nc,
            kpi6_innovazione=data.kpi6_innovazione,
            media_ua=media,
            note=data.note,
            reviewer_id=current_user.id,
        )
        db.add(review)
    db.commit()
    db.refresh(review)
    update_summary(db, supplier_id)
    log_action(db, current_user.id, "UA_REVIEW", "vendor_rating", str(supplier_id),
               {"anno": data.anno, "media_ua": media})
    return review


@router.get("/non-conformita")
def list_nc(
    supplier_id: Optional[int] = Query(None),
    numero_ordine: Optional[str] = Query(None),
    stato: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    query = db.query(NonConformita)
    if supplier_id:
        query = query.filter(NonConformita.supplier_id == supplier_id)
    if numero_ordine:
        query = query.filter(NonConformita.numero_ordine == numero_ordine)
    if stato:
        query = query.filter(NonConformita.stato == stato)
    total = query.count()
    ncs = query.order_by(NonConformita.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    items = []
    for nc in ncs:
        supplier_name = None
        if nc.supplier_id:
            s = db.query(Supplier).filter(Supplier.id == nc.supplier_id).first()
            supplier_name = s.ragione_sociale if s else None
        items.append({
            "id": nc.id, "nc_id_esterno": nc.nc_id_esterno,
            "supplier_id": nc.supplier_id, "ragione_sociale": supplier_name,
            "numero_ordine": nc.numero_ordine, "descrizione": nc.descrizione,
            "data_apertura": str(nc.data_apertura) if nc.data_apertura else None,
            "data_chiusura": str(nc.data_chiusura) if nc.data_chiusura else None,
            "stato": nc.stato, "gravita": nc.gravita,
            "created_at": str(nc.created_at) if nc.created_at else None,
        })
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/pending-count")
def pending_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Restituisce il conteggio delle survey pending (non completate e non scadute)
    e le ultime 10 richieste per il dropdown notifiche.
    """
    now = datetime.now(timezone.utc)
    pending_q = (
        db.query(VendorRatingRequest)
        .filter(
            VendorRatingRequest.survey_completed_at.is_(None),
            VendorRatingRequest.survey_expired == False,
            VendorRatingRequest.survey_expires_at > now,
        )
        .order_by(VendorRatingRequest.created_at.desc())
    )
    total = pending_q.count()
    requests_raw = pending_q.limit(10).all()
    requests = []
    for r in requests_raw:
        supplier = db.query(Supplier).filter(Supplier.id == r.supplier_id).first()
        ragione_sociale = supplier.ragione_sociale if supplier else f"Fornitore #{r.supplier_id}"
        requests.append({
            "supplier_id": r.supplier_id,
            "ragione_sociale": ragione_sociale,
            "requested_at": r.created_at.isoformat() if r.created_at else None,
            "expires_at": r.survey_expires_at.isoformat() if r.survey_expires_at else None,
            "tipo": r.tipo_trigger.value if r.tipo_trigger else None,
            "request_id": r.id,
        })
    return {"pending": total, "requests": requests}


@router.post("/requests", status_code=201)
def create_rating_request(
    data: RatingRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    token = secrets.token_urlsafe(64)
    expires = datetime.now(timezone.utc) + timedelta(days=30)
    req = VendorRatingRequest(
        supplier_id=data.supplier_id,
        protocollo_ordine=data.protocollo_ordine,
        tipo_trigger=data.tipo_trigger,
        data_ordine=data.data_ordine,
        data_consegna_richiesta=data.data_consegna_richiesta,
        data_consegna_ricevuta=data.data_consegna_ricevuta,
        quantita_richiesta=data.quantita_richiesta,
        quantita_ricevuta=data.quantita_ricevuta,
        cdc_commessa=data.cdc_commessa,
        valutatore_email=data.valutatore_email,
        valutatore_nome=data.valutatore_nome,
        survey_token=token,
        survey_expires_at=expires,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return {"id": req.id, "survey_token": token, "survey_url": f"/survey/{token}"}
