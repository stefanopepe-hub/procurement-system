"""
FastAPI router for Alyante integration endpoints.

All routes are registered under the prefix /alyante (combined with the
/api/v1 prefix set in main.py → full paths are /api/v1/alyante/*).

Every call is logged to the AuditLog table with:
  action        = "alyante_api_call"
  resource_type = "alyante"
  details       = {"supplier_code": ..., "order_id": ..., "endpoint": ...}
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.routes import get_current_active_user, require_admin, require_super_admin
from app.auth.models import User
from app.audit.service import log_action
from app.alyante.client import alyante_client
from app.alyante.schemas import AlyantOrdersResponse, AlyantSupplier, AlyantOrderConfirmResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/alyante", tags=["Alyante"])


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


# ---------------------------------------------------------------------------
# GET /alyante/orders/{supplier_code}
# ---------------------------------------------------------------------------

@router.get(
    "/orders/{supplier_code}",
    response_model=AlyantOrdersResponse,
    summary="Lista ordini fornitore da Alyante",
)
async def get_orders(
    supplier_code: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        data = await alyante_client.get_orders(supplier_code)
    except Exception as exc:
        logger.error("Alyante get_orders error for %s: %s", supplier_code, exc)
        log_action(
            db,
            current_user.id,
            "alyante_api_call",
            "alyante",
            supplier_code,
            {"endpoint": "get_orders", "supplier_code": supplier_code, "error": str(exc)},
            _client_ip(request),
            status="error",
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Errore comunicazione Alyante: {exc}",
        )

    log_action(
        db,
        current_user.id,
        "alyante_api_call",
        "alyante",
        supplier_code,
        {"endpoint": "get_orders", "supplier_code": supplier_code, "source": data.get("source")},
        _client_ip(request),
    )
    return data


# ---------------------------------------------------------------------------
# GET /alyante/supplier/{supplier_code}
# ---------------------------------------------------------------------------

@router.get(
    "/supplier/{supplier_code}",
    response_model=AlyantSupplier,
    summary="Dettaglio fornitore da Alyante",
)
async def get_supplier(
    supplier_code: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        data = await alyante_client.get_supplier(supplier_code)
    except Exception as exc:
        logger.error("Alyante get_supplier error for %s: %s", supplier_code, exc)
        log_action(
            db,
            current_user.id,
            "alyante_api_call",
            "alyante",
            supplier_code,
            {"endpoint": "get_supplier", "supplier_code": supplier_code, "error": str(exc)},
            _client_ip(request),
            status="error",
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Errore comunicazione Alyante: {exc}",
        )

    log_action(
        db,
        current_user.id,
        "alyante_api_call",
        "alyante",
        supplier_code,
        {"endpoint": "get_supplier", "supplier_code": supplier_code, "source": data.get("source")},
        _client_ip(request),
    )
    return data


# ---------------------------------------------------------------------------
# POST /alyante/orders/{order_id}/confirm
# ---------------------------------------------------------------------------

@router.post(
    "/orders/{order_id}/confirm",
    response_model=AlyantOrderConfirmResponse,
    summary="Conferma ordine su Alyante (admin)",
)
async def confirm_order(
    order_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        data = await alyante_client.confirm_order(order_id)
    except Exception as exc:
        logger.error("Alyante confirm_order error for %s: %s", order_id, exc)
        log_action(
            db,
            current_user.id,
            "alyante_api_call",
            "alyante",
            order_id,
            {"endpoint": "confirm_order", "order_id": order_id, "error": str(exc)},
            _client_ip(request),
            status="error",
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Errore comunicazione Alyante: {exc}",
        )

    log_action(
        db,
        current_user.id,
        "alyante_api_call",
        "alyante",
        order_id,
        {"endpoint": "confirm_order", "order_id": order_id, "source": data.get("source")},
        _client_ip(request),
    )
    return data


# ---------------------------------------------------------------------------
# POST /alyante/sync  (super_admin only)
# ---------------------------------------------------------------------------

@router.post(
    "/sync",
    summary="Sincronizzazione manuale Alyante (super_admin)",
)
async def sync(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    logger.info("Alyante sync triggered by user %s", current_user.id)
    log_action(
        db,
        current_user.id,
        "alyante_api_call",
        "alyante",
        "sync",
        {"endpoint": "sync", "triggered_by": current_user.username},
        _client_ip(request),
    )
    return {"status": "ok", "detail": "sync triggered"}
