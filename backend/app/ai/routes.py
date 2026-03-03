"""
AI Analysis Routes
POST /ai/contracts/{contract_id}/analyze/{document_id}
  → Analyses a contract PDF document and returns structured insights.
"""
import os
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.auth.routes import require_admin
from app.contracts.models import Contract, ContractDocument
from app.ai.service import extract_pdf_text, analyze_contract_with_ai

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Analysis"])


@router.post("/contracts/{contract_id}/analyze/{document_id}")
def analyze_contract_document(
    contract_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    """
    Analyse an uploaded contract document with Claude AI.
    Returns clauses, criticalities, compliance score and recommendations.
    Requires ANTHROPIC_API_KEY to be configured.
    """
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail=(
                "Analisi AI non configurata. "
                "Imposta ANTHROPIC_API_KEY nel file .env del backend."
            ),
        )

    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contratto non trovato")

    document = db.query(ContractDocument).filter(
        ContractDocument.id == document_id,
        ContractDocument.contract_id == contract_id,
    ).first()
    if not document:
        raise HTTPException(status_code=404, detail="Documento non trovato")

    # Build absolute path
    file_path = os.path.join(settings.UPLOAD_DIR, document.file_path)
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail="File non trovato sul server. Potrebbe essere stato eliminato.",
        )

    # Only PDFs are supported for text extraction
    if not document.nome_file.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=422,
            detail="Soltanto i file PDF sono supportati per l'analisi AI.",
        )

    # Read file bytes
    with open(file_path, "rb") as fh:
        file_bytes = fh.read()

    # Extract text from PDF
    try:
        text = extract_pdf_text(file_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("PDF extraction error")
        raise HTTPException(
            status_code=422,
            detail=f"Impossibile estrarre il testo dal PDF: {exc}",
        )

    if len(text.strip()) < 200:
        raise HTTPException(
            status_code=422,
            detail=(
                "Il testo estratto dal PDF è troppo breve per un'analisi significativa. "
                "Verifica che il documento non sia una scansione non OCR-izzata."
            ),
        )

    # Run AI analysis
    try:
        result = analyze_contract_with_ai(text, document.nome_file)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        logger.exception("AI analysis error")
        raise HTTPException(
            status_code=500,
            detail=f"Errore durante l'analisi AI: {exc}",
        )

    # Augment with server-side metadata
    result["contract_id"] = contract_id
    result["document_id"] = document_id
    result["documento_nome"] = document.nome_file
    result["testo_estratto_chars"] = len(text)

    return result
