from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func
from typing import List, Optional
from datetime import date, datetime, timezone
import mimetypes
import os, shutil, math, csv, io

from app.database import get_db
from app.auth.routes import get_current_active_user, require_admin
from app.auth.models import User, UserRole
from app.suppliers.models import (
    Supplier, SupplierContact, SupplierCertification, SupplierDocument,
    SupplierFatturato, SupplierCommunication, SupplierStatus, AccreditamentType
)
from app.suppliers.schemas import (
    SupplierCreate, SupplierUpdate, SupplierDetail, SupplierListItem,
    PaginatedSuppliers, ContactBase, ContactRead, CertificationBase,
    CertificationRead, FatturatoBase, FatturatoRead
)
from app.audit.service import log_action
from app.config import settings

router = APIRouter(prefix="/suppliers", tags=["Albo Fornitori"])


def _apply_search_filters(query, q=None, ragione_sociale=None, categoria=None,
                           certificazione=None, sede_comune=None, sede_provincia=None,
                           referente_nome=None, status_list=None, accreditament_type=None):
    if q:
        query = query.filter(or_(
            Supplier.ragione_sociale.ilike(f"%{q}%"),
            Supplier.partita_iva.ilike(f"%{q}%"),
            Supplier.alyante_code.ilike(f"%{q}%"),
            Supplier.settore_attivita.ilike(f"%{q}%"),
        ))
    if ragione_sociale:
        query = query.filter(Supplier.ragione_sociale.ilike(f"%{ragione_sociale}%"))
    if sede_comune:
        query = query.filter(or_(
            Supplier.sede_legale_comune.ilike(f"%{sede_comune}%"),
            Supplier.sede_operativa_comune.ilike(f"%{sede_comune}%"),
        ))
    if sede_provincia:
        query = query.filter(or_(
            Supplier.sede_legale_provincia.ilike(f"%{sede_provincia}%"),
            Supplier.sede_operativa_provincia.ilike(f"%{sede_provincia}%"),
        ))
    if status_list:
        query = query.filter(Supplier.status.in_(status_list))
    if accreditament_type:
        query = query.filter(Supplier.accreditament_type == accreditament_type)
    if certificazione:
        query = query.join(SupplierCertification).filter(
            SupplierCertification.nome.ilike(f"%{certificazione}%")
        )
    if referente_nome:
        query = query.join(SupplierContact).filter(or_(
            SupplierContact.nome.ilike(f"%{referente_nome}%"),
            SupplierContact.cognome.ilike(f"%{referente_nome}%"),
        ))
    return query


@router.get("", response_model=PaginatedSuppliers)
def list_suppliers(
    request: Request,
    q: Optional[str] = Query(None),
    ragione_sociale: Optional[str] = Query(None),
    categoria_merceologica: Optional[str] = Query(None),
    certificazione: Optional[str] = Query(None),
    sede_comune: Optional[str] = Query(None),
    sede_provincia: Optional[str] = Query(None),
    referente_nome: Optional[str] = Query(None),
    status: Optional[List[SupplierStatus]] = Query(None),
    accreditament_type: Optional[AccreditamentType] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = db.query(Supplier)
    query = _apply_search_filters(
        query, q, ragione_sociale, categoria_merceologica, certificazione,
        sede_comune, sede_provincia, referente_nome, status, accreditament_type
    )

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    # Attach semaforo from rating summary
    result = []
    for s in items:
        item = SupplierListItem.model_validate(s)
        if hasattr(s, "vendor_ratings") and s.vendor_ratings:
            from app.vendor_rating.models import SupplierRatingSummary
            summary = db.query(SupplierRatingSummary).filter(
                SupplierRatingSummary.supplier_id == s.id
            ).first()
            if summary:
                item.semaforo = summary.semaforo
        result.append(item)

    return PaginatedSuppliers(
        items=result, total=total, page=page,
        page_size=page_size, pages=math.ceil(total / page_size)
    )


@router.get("/export/csv")
def export_suppliers_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Esporta tutti i fornitori in formato CSV."""
    suppliers = db.query(Supplier).order_by(Supplier.ragione_sociale).all()

    output = io.StringIO()
    writer = csv.writer(output, delimiter=';', quoting=csv.QUOTE_ALL)
    writer.writerow([
        'ID', 'Ragione Sociale', 'Partita IVA', 'Codice Fiscale',
        'Categoria Merceologica', 'Stato', 'Tipo Accreditamento',
        'Codice Alyante', 'Settore Attività',
        'Indirizzo Sede Legale', 'Comune Sede Legale', 'Provincia Sede Legale',
        'Data Iscrizione', 'Data Riqualifica',
        'Note Interne', 'Creato Il',
    ])
    for s in suppliers:
        categorie = ''
        if s.categorie_merceologiche:
            if isinstance(s.categorie_merceologiche, list):
                categorie = ', '.join(str(c) for c in s.categorie_merceologiche)
            else:
                categorie = str(s.categorie_merceologiche)
        indirizzo = ' '.join(filter(None, [
            s.sede_legale_indirizzo or '',
        ])).strip()
        writer.writerow([
            s.id,
            s.ragione_sociale or '',
            s.partita_iva or '',
            s.codice_fiscale or '',
            categorie,
            s.status.value if s.status else '',
            s.accreditament_type.value if s.accreditament_type else '',
            s.alyante_code or '',
            s.settore_attivita or '',
            indirizzo,
            s.sede_legale_comune or '',
            s.sede_legale_provincia or '',
            str(s.data_iscrizione) if s.data_iscrizione else '',
            str(s.data_riqualifica) if s.data_riqualifica else '',
            s.note_interne or '',
            str(s.created_at) if s.created_at else '',
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type='text/csv; charset=utf-8',
        headers={'Content-Disposition': 'attachment; filename="fornitori.csv"'},
    )


@router.get("/{supplier_id}", response_model=SupplierDetail)
def get_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    supplier = db.query(Supplier).options(
        joinedload(Supplier.contacts),
        joinedload(Supplier.certifications),
        joinedload(Supplier.fatturati),
        joinedload(Supplier.communications),
    ).filter(Supplier.id == supplier_id).first()

    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    log_action(db, current_user.id, "VIEW", "supplier", str(supplier_id))

    detail = SupplierDetail.model_validate(supplier)

    # Documents visible only to admin
    if current_user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        docs = db.query(SupplierDocument).filter(SupplierDocument.supplier_id == supplier_id).all()
        from app.suppliers.schemas import DocumentRead
        detail.documents = [DocumentRead.model_validate(d) for d in docs]

    return detail


@router.post("", response_model=SupplierDetail, status_code=201)
def create_supplier(
    data: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    supplier = Supplier(
        **data.model_dump(exclude_none=True),
        data_iscrizione=date.today(),
        status=SupplierStatus.ACCREDITATO,
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    log_action(db, current_user.id, "CREATE", "supplier", str(supplier.id), {"ragione_sociale": supplier.ragione_sociale})

    # Notifica email al team acquisti per nuovo fornitore iscritto all'Albo
    try:
        from app.notifications.email import send_email
        categorie = ", ".join(supplier.categorie_merceologiche) if supplier.categorie_merceologiche else "N/D"
        html = f"""<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0"
       style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
  <tr>
    <td style="background:linear-gradient(135deg,#1a3a5c 0%,#2a5a8c 100%);padding:28px 36px;text-align:center;">
      <div style="font-size:11px;letter-spacing:3px;color:rgba(255,255,255,0.6);text-transform:uppercase;margin-bottom:6px;">Fondazione Telethon · Albo Fornitori</div>
      <div style="font-size:22px;font-weight:800;color:#fff;">Nuovo Fornitore Inserito</div>
    </td>
  </tr>
  <tr>
    <td style="padding:32px 36px;">
      <p style="font-size:15px;color:#333;margin:0 0 20px;">
        Un nuovo fornitore è stato aggiunto all'Albo Fornitori da <strong>{current_user.full_name}</strong>.
      </p>
      <table width="100%" style="background:#f8faff;border-radius:10px;overflow:hidden;margin-bottom:24px;">
        <tr><td style="padding:10px 16px;color:#666;font-size:14px;border-bottom:1px solid #eee;">Ragione Sociale</td>
            <td style="padding:10px 16px;font-weight:700;font-size:14px;border-bottom:1px solid #eee;color:#1a3a5c;">{supplier.ragione_sociale}</td></tr>
        <tr><td style="padding:10px 16px;color:#666;font-size:14px;border-bottom:1px solid #eee;">Partita IVA</td>
            <td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #eee;">{supplier.partita_iva or "N/D"}</td></tr>
        <tr><td style="padding:10px 16px;color:#666;font-size:14px;border-bottom:1px solid #eee;">Categoria</td>
            <td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #eee;">{categorie}</td></tr>
        <tr><td style="padding:10px 16px;color:#666;font-size:14px;">Data Iscrizione</td>
            <td style="padding:10px 16px;font-size:14px;">{supplier.data_iscrizione}</td></tr>
      </table>
    </td>
  </tr>
  <tr><td style="background:#1a3a5c;padding:16px 36px;text-align:center;">
    <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:0;">
      <strong style="color:rgba(255,255,255,0.9);">Fondazione Telethon</strong> · Ufficio Acquisti
    </p></td></tr>
</table></td></tr></table>
</body></html>"""
        send_email(
            to=[settings.EMAIL_ALBO_FORNITORI],
            subject=f"[Albo Fornitori] Nuovo fornitore: {supplier.ragione_sociale}",
            body_html=html,
        )
    except Exception as _e:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Notifica nuovo fornitore non inviata: {_e}")

    return SupplierDetail.model_validate(supplier)


@router.patch("/{supplier_id}", response_model=SupplierDetail)
def update_supplier(
    supplier_id: int,
    data: SupplierUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    before = {"status": str(supplier.status), "accreditament_type": str(supplier.accreditament_type)}
    update_data = data.model_dump(exclude_none=True)

    # data_iscrizione is immutable
    update_data.pop("data_iscrizione", None)

    # Handle Alyante de-accreditation: change status but keep in albo
    if "alyante_accreditato" in update_data and not update_data["alyante_accreditato"]:
        if supplier.status == SupplierStatus.ACCREDITATO:
            supplier.status = SupplierStatus.NON_PIU_ACCREDITATO
        supplier.is_active_in_albo = True  # Always stays in albo

    for field, value in update_data.items():
        setattr(supplier, field, value)

    db.commit()
    db.refresh(supplier)
    log_action(db, current_user.id, "UPDATE", "supplier", str(supplier_id), {"before": before})
    return SupplierDetail.model_validate(supplier)


# --- Contacts ---
@router.post("/{supplier_id}/contacts", response_model=ContactRead, status_code=201)
def add_contact(supplier_id: int, data: ContactBase, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    contact = SupplierContact(supplier_id=supplier_id, **data.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.put("/{supplier_id}/contacts/{contact_id}", response_model=ContactRead)
def update_contact(supplier_id: int, contact_id: int, data: ContactBase, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    contact = db.query(SupplierContact).filter(SupplierContact.id == contact_id, SupplierContact.supplier_id == supplier_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    for field, value in data.model_dump().items():
        setattr(contact, field, value)
    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{supplier_id}/contacts/{contact_id}", status_code=204)
def delete_contact(supplier_id: int, contact_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    contact = db.query(SupplierContact).filter(SupplierContact.id == contact_id, SupplierContact.supplier_id == supplier_id).first()
    if not contact:
        raise HTTPException(status_code=404)
    db.delete(contact)
    db.commit()


# --- Certifications ---
@router.post("/{supplier_id}/certifications", response_model=CertificationRead, status_code=201)
def add_certification(supplier_id: int, data: CertificationBase, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    cert = SupplierCertification(supplier_id=supplier_id, **data.model_dump())
    db.add(cert)
    db.commit()
    db.refresh(cert)
    return cert


# --- Fatturato ---
@router.post("/{supplier_id}/fatturato", response_model=FatturatoRead, status_code=201)
def add_fatturato(supplier_id: int, data: FatturatoBase, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    fat = SupplierFatturato(supplier_id=supplier_id, **data.model_dump())
    db.add(fat)
    db.commit()
    db.refresh(fat)
    return fat


# --- Document upload ---
@router.post("/{supplier_id}/documents", status_code=201)
def upload_document(
    supplier_id: int,
    tipo: str,
    data_scadenza: Optional[date] = None,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if file.size and file.size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large")

    upload_path = os.path.join(settings.UPLOAD_DIR, "suppliers", str(supplier_id))
    os.makedirs(upload_path, exist_ok=True)
    safe_name = os.path.basename(file.filename or "document")
    file_path = os.path.join(upload_path, safe_name)

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    doc = SupplierDocument(
        supplier_id=supplier_id, tipo=tipo, nome_file=safe_name,
        file_path=file_path, data_scadenza=data_scadenza,
        uploaded_by_id=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    log_action(db, current_user.id, "UPLOAD", "supplier_document", str(doc.id), {"tipo": tipo})
    return {"id": doc.id, "nome_file": safe_name, "message": "Uploaded successfully"}


# --- Document download ---
@router.get("/documents/{doc_id}/download")
def download_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    doc = db.query(SupplierDocument).filter(SupplierDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Only admin/super_admin can download supplier documents
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized to download this document")

    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    mimetype, _ = mimetypes.guess_type(doc.nome_file)
    if mimetype is None:
        mimetype = "application/octet-stream"

    log_action(db, current_user.id, "DOWNLOAD", "supplier_document", str(doc.id), {"nome_file": doc.nome_file})

    return FileResponse(
        path=doc.file_path,
        media_type=mimetype,
        filename=doc.nome_file,
    )


# --- GDPR Art. 17 — Diritto all'oblio / Anonimizzazione fornitore ---
@router.post("/{supplier_id}/gdpr-erasure", status_code=200, tags=["GDPR"])
def gdpr_erasure_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Anonimizza i dati personali di un fornitore (GDPR Art. 17 — Diritto all'oblio).
    I dati aziendali (partita IVA, ragione sociale) vengono rimpiazzati con token anonimi,
    i contatti vengono eliminati e i documenti fisici vengono cancellati dal disco.
    Il record fornitore rimane per mantenere l'integrità referenziale con contratti e rating.
    Solo SUPER_ADMIN può eseguire questa operazione."""
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Solo super_admin può eseguire la cancellazione GDPR")

    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Fornitore non trovato")

    anon_token = f"GDPR_ERASED_{supplier_id}"

    # Anonimizza dati identificativi
    supplier.ragione_sociale = anon_token
    supplier.partita_iva = anon_token
    supplier.codice_fiscale = None
    supplier.email_pec = None
    supplier.email_aziendale = None
    supplier.telefono = None
    supplier.sito_web = None
    supplier.sede_legale_indirizzo = None
    supplier.sede_legale_comune = None
    supplier.sede_legale_cap = None
    supplier.alyante_code = None
    supplier.note = None
    supplier.status = SupplierStatus.NON_PIU_ACCREDITATO
    supplier.is_active_in_albo = False

    # Elimina contatti personali
    db.query(SupplierContact).filter(SupplierContact.supplier_id == supplier_id).delete()

    # Elimina documenti fisici e record DB
    docs = db.query(SupplierDocument).filter(SupplierDocument.supplier_id == supplier_id).all()
    for doc in docs:
        if os.path.exists(doc.file_path):
            try:
                os.remove(doc.file_path)
            except OSError:
                pass
        db.delete(doc)

    db.commit()
    log_action(
        db, current_user.id, "GDPR_ERASURE", "supplier", str(supplier_id),
        {"note": "Anonimizzazione GDPR Art.17 eseguita"}
    )
    return {"message": f"Fornitore {supplier_id} anonimizzato con successo (GDPR Art. 17)."}
