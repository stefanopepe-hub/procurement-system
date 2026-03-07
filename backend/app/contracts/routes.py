from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_
from typing import List, Optional
from datetime import date
import os, shutil, math, csv, io

from app.database import get_db
from app.auth.routes import require_admin
from app.auth.models import User
from app.contracts.models import (
    Contract, ContractDocument, ContractCommunication, ContractOrder,
    ContractStatus, EnteStipulante
)
from app.contracts.schemas import (
    ContractCreate, ContractUpdate, ContractDetail, ContractListItem,
    PaginatedContracts, DocumentRead, CommunicationRead, ContractOrderRead
)
from app.audit.service import log_action
from app.config import settings

router = APIRouter(prefix="/contracts", tags=["Database Contratti"])


def generate_contract_id(db: Session) -> str:
    count = db.query(Contract).count()
    return f"CTR-{(count + 1):05d}"


def apply_filters(query, q=None, ragione_sociale=None, status_list=None,
                  cdc=None, ente=None, scad_from=None, scad_to=None,
                  rineg_from=None, rineg_to=None, dpa=None, gdpr=None, dpia=None):
    if q:
        query = query.filter(or_(
            Contract.ragione_sociale.ilike(f"%{q}%"),
            Contract.oggetto.ilike(f"%{q}%"),
            Contract.id_contratto.ilike(f"%{q}%"),
            Contract.cdc.ilike(f"%{q}%"),
            Contract.cig_cup_commessa.ilike(f"%{q}%"),
        ))
    if ragione_sociale:
        query = query.filter(Contract.ragione_sociale.ilike(f"%{ragione_sociale}%"))
    if status_list:
        query = query.filter(Contract.status.in_(status_list))
    if cdc:
        query = query.filter(Contract.cdc.ilike(f"%{cdc}%"))
    if ente:
        query = query.filter(Contract.ente_stipulante == ente)
    if scad_from:
        query = query.filter(Contract.data_scadenza >= scad_from)
    if scad_to:
        query = query.filter(Contract.data_scadenza <= scad_to)
    if rineg_from:
        query = query.filter(Contract.data_rinegoziazione >= rineg_from)
    if rineg_to:
        query = query.filter(Contract.data_rinegoziazione <= rineg_to)
    if dpa is not None:
        query = query.filter(Contract.dpa == dpa)
    if gdpr is not None:
        query = query.filter(Contract.questionario_it_gdpr == gdpr)
    if dpia is not None:
        query = query.filter(Contract.dpia == dpia)
    return query


@router.get("", response_model=PaginatedContracts)
def list_contracts(
    q: Optional[str] = Query(None),
    ragione_sociale: Optional[str] = Query(None),
    status: Optional[List[ContractStatus]] = Query(None),
    cdc: Optional[str] = Query(None),
    ente_stipulante: Optional[EnteStipulante] = Query(None),
    data_scadenza_from: Optional[date] = Query(None),
    data_scadenza_to: Optional[date] = Query(None),
    data_rinegoziazione_from: Optional[date] = Query(None),
    data_rinegoziazione_to: Optional[date] = Query(None),
    dpa: Optional[bool] = Query(None),
    questionario_it_gdpr: Optional[bool] = Query(None),
    dpia: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    query = db.query(Contract)
    query = apply_filters(
        query, q, ragione_sociale, status, cdc, ente_stipulante,
        data_scadenza_from, data_scadenza_to,
        data_rinegoziazione_from, data_rinegoziazione_to,
        dpa, questionario_it_gdpr, dpia,
    )
    total = query.count()
    items = query.order_by(Contract.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return PaginatedContracts(
        items=[ContractListItem.model_validate(c) for c in items],
        total=total, page=page, page_size=page_size,
        pages=math.ceil(total / page_size),
    )


@router.get("/export/csv")
def export_contracts_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Esporta tutti i contratti in formato CSV."""
    contracts = db.query(Contract).order_by(Contract.id_contratto).all()

    output = io.StringIO()
    writer = csv.writer(output, delimiter=';', quoting=csv.QUOTE_ALL)
    writer.writerow([
        'ID', 'Riferimento Contratto', 'Oggetto', 'Fornitore', 'Codice Fornitore',
        'Stato', 'Ente Stipulante', 'CDC',
        'Imponibile (€)', 'IVA (%)', 'Ivato (€)',
        'Data Inizio', 'Data Scadenza', 'Data Rinegoziazione',
        'CIG/CUP/Commessa', 'Referente Interno', 'Referente Ufficio Acquisti',
        'DPA', 'Questionario IT GDPR', 'DPIA',
        'Alert Scadenza', 'Creato Il',
    ])
    for c in contracts:
        writer.writerow([
            c.id,
            c.id_contratto or '',
            c.oggetto or '',
            c.ragione_sociale or '',
            c.codice_fornitore or '',
            c.status.value if c.status else '',
            c.ente_stipulante.value if c.ente_stipulante else '',
            c.cdc or '',
            str(c.imponibile) if c.imponibile is not None else '',
            str(c.iva_percentuale) if c.iva_percentuale is not None else '',
            str(c.ivato) if c.ivato is not None else '',
            str(c.data_inizio) if c.data_inizio else '',
            str(c.data_scadenza) if c.data_scadenza else '',
            str(c.data_rinegoziazione) if c.data_rinegoziazione else '',
            c.cig_cup_commessa or '',
            c.referente_interno or '',
            c.referente_ufficio_acquisti or '',
            'Sì' if c.dpa else 'No',
            'Sì' if c.questionario_it_gdpr else 'No',
            'Sì' if c.dpia else 'No',
            'Sì' if c.alert_enabled else 'No',
            str(c.created_at) if c.created_at else '',
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type='text/csv; charset=utf-8',
        headers={'Content-Disposition': 'attachment; filename="contratti.csv"'},
    )


@router.get("/{contract_id}", response_model=ContractDetail)
def get_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    contract = db.query(Contract).options(
        joinedload(Contract.documents),
        joinedload(Contract.communications),
    ).filter(Contract.id == contract_id).first()

    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    log_action(db, current_user.id, "VIEW", "contract", str(contract_id))
    return ContractDetail.model_validate(contract)


@router.post("", response_model=ContractDetail, status_code=201)
def create_contract(
    data: ContractCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    contract = Contract(
        **data.model_dump(exclude_none=True),
        id_contratto=generate_contract_id(db),
        created_by_id=current_user.id,
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    log_action(db, current_user.id, "CREATE", "contract", str(contract.id), {"id_contratto": contract.id_contratto})
    return ContractDetail.model_validate(contract)


@router.patch("/{contract_id}", response_model=ContractDetail)
def update_contract(
    contract_id: int,
    data: ContractUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    before = {"status": str(contract.status), "data_scadenza": str(contract.data_scadenza)}
    update_data = data.model_dump(exclude_none=True)

    # Reset notification flags if dates changed
    if "data_scadenza" in update_data:
        contract.notifica_60gg_sent = False
        contract.notifica_30gg_sent = False
    if "data_rinegoziazione" in update_data:
        contract.notifica_rinegoziazione_60gg_sent = False
        contract.notifica_rinegoziazione_30gg_sent = False

    for field, value in update_data.items():
        setattr(contract, field, value)

    db.commit()
    db.refresh(contract)
    log_action(db, current_user.id, "UPDATE", "contract", str(contract_id), {"before": before})
    return ContractDetail.model_validate(contract)


@router.delete("/{contract_id}", status_code=204)
def delete_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404)
    log_action(db, current_user.id, "DELETE", "contract", str(contract_id), {"id_contratto": contract.id_contratto})
    db.delete(contract)
    db.commit()


# --- Documents ---
@router.post("/{contract_id}/documents", status_code=201)
def upload_document(
    contract_id: int,
    tipo: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    upload_path = os.path.join(settings.UPLOAD_DIR, "contracts", str(contract_id))
    os.makedirs(upload_path, exist_ok=True)
    safe_name = os.path.basename(file.filename or "document")
    file_path = os.path.join(upload_path, safe_name)

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    doc = ContractDocument(
        contract_id=contract_id, tipo=tipo, nome_file=safe_name,
        file_path=file_path, uploaded_by_id=current_user.id,
    )
    db.add(doc)
    db.commit()
    return {"id": doc.id, "nome_file": safe_name}


# ─────────────────────────────────────────────
# Ordini associati al contratto (spunta manuale)
# ─────────────────────────────────────────────

@router.get("/{contract_id}/orders", response_model=List[ContractOrderRead])
def list_contract_orders(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Ritorna gli ordini Alyante associati al contratto."""
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return db.query(ContractOrder).filter(ContractOrder.contract_id == contract_id).all()


@router.post("/{contract_id}/orders", response_model=ContractOrderRead, status_code=201)
def associate_order(
    contract_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Associa manualmente un ordine Alyante a questo contratto (con spunta).
    I dati dell'ordine sono passati direttamente (da Alyante stub o frontend).
    """
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # Un ordine può essere associato a un solo contratto
    existing = db.query(ContractOrder).filter(
        ContractOrder.alyante_order_id == data.get("alyante_order_id")
    ).first()
    if existing and existing.contract_id != contract_id:
        raise HTTPException(
            status_code=409,
            detail=f"Ordine già associato al contratto {existing.contract_id}"
        )

    from datetime import date as date_type
    order = ContractOrder(
        contract_id=contract_id,
        alyante_order_id=data["alyante_order_id"],
        protocollo=data.get("protocollo"),
        numero_pubblicazione=data.get("numero_pubblicazione"),
        tipo_documento=data.get("tipo_documento"),
        data_ordine=data.get("data_ordine"),
        importo=data.get("importo"),
        oggetto=data.get("oggetto"),
        stato=data.get("stato"),
        cdc=data.get("cdc"),
        richiedente_email=data.get("richiedente_email"),
        associato_da_id=current_user.id,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    log_action(db, current_user.id, "ASSOCIATE_ORDER", "contract", str(contract_id),
               {"alyante_order_id": data["alyante_order_id"]})
    return order


@router.delete("/{contract_id}/orders/{order_id}", status_code=204)
def disassociate_order(
    contract_id: int,
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Rimuove l'associazione di un ordine dal contratto."""
    order = db.query(ContractOrder).filter(
        ContractOrder.id == order_id,
        ContractOrder.contract_id == contract_id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order association not found")
    db.delete(order)
    db.commit()


@router.get("/supplier/{supplier_id}/available-orders")
def get_available_orders(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Ritorna gli ordini Alyante del fornitore non ancora associati a nessun contratto.
    Usa lo stub Alyante; in produzione chiamerà l'API reale.
    """
    from app.suppliers.models import Supplier
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier or not supplier.alyante_code:
        return []

    # Ordini già associati a qualsiasi contratto
    associated_ids = {
        row.alyante_order_id
        for row in db.query(ContractOrder.alyante_order_id).all()
    }

    # Stub: in produzione → chiamata API Alyante
    stub_orders = [
        {"alyante_order_id": "ORD-2024-001", "protocollo": "2024/001", "data_ordine": "2024-01-15",
         "tipo_documento": "ORD", "importo": 15000.00, "oggetto": "Fornitura materiale informatico",
         "stato": "consegnato", "cdc": "IT-001"},
        {"alyante_order_id": "ORD-2024-002", "protocollo": "2024/002", "data_ordine": "2024-03-10",
         "tipo_documento": "OS", "importo": 8500.00, "oggetto": "Manutenzione server",
         "stato": "fatturato", "cdc": "IT-002"},
        {"alyante_order_id": "ORD-2024-003", "protocollo": "2024/003", "data_ordine": "2024-06-20",
         "tipo_documento": "OPR", "importo": 22000.00, "oggetto": "Fornitura reagenti laboratorio",
         "stato": "ordinato", "cdc": "RIC-005"},
    ]
    return [o for o in stub_orders if o["alyante_order_id"] not in associated_ids]
