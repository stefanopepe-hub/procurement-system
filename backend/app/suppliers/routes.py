from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func
from typing import List, Optional
from datetime import date, datetime, timezone
import mimetypes
import os, shutil, math

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
