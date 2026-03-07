"""
Alyante HTTP client with stub fallback.

If ALYANTE_BASE_URL is empty the client operates in stub mode and returns
the same static data previously served by the /alyante/stub/* endpoints.
When ALYANTE_BASE_URL is set, the client uses Basic Auth (username+password)
or an X-API-Key header (if ALYANTE_API_KEY is set) and performs real HTTP
calls with a 10 s timeout and up to 3 retries with exponential back-off
(1 s, 2 s, 4 s).
"""

import asyncio
import logging
from typing import List, Dict, Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Static stub data — mirrors the original /alyante/stub/orders endpoint
# ---------------------------------------------------------------------------

_STUB_ORDERS: List[Dict[str, Any]] = [
    {
        "id": "ORD-2024-001",
        "numero": "2024/001",
        "data": "2024-01-15",
        "stato": "consegnato",
        "importo": 15000.00,
        "oggetto": "Fornitura materiale informatico",
        "tipo": "ORD",
    },
    {
        "id": "ORD-2024-002",
        "numero": "2024/002",
        "data": "2024-03-10",
        "stato": "fatturato",
        "importo": 8500.00,
        "oggetto": "Manutenzione server",
        "tipo": "OS",
    },
]

_STUB_SUPPLIER: Dict[str, Any] = {
    "codice": "",
    "ragione_sociale": "Fornitore Demo S.r.l.",
    "partita_iva": "12345678901",
    "email": "demo@fornitore.it",
    "telefono": "+39 02 1234567",
    "indirizzo": "Via Roma 1, 20100 Milano",
}


# ---------------------------------------------------------------------------
# Field mapping: Alyante API (PascalCase) → internal (snake_case)
# ---------------------------------------------------------------------------

def _map_order(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize a raw Alyante order dict to the internal schema."""
    return {
        "id": str(raw.get("NumeroOrdine", raw.get("id", ""))),
        "numero": str(raw.get("NumeroOrdine", raw.get("numero", ""))),
        "data": str(raw.get("DataDocumento", raw.get("data", ""))),
        "stato": str(raw.get("Stato", raw.get("stato", ""))),
        "importo": float(raw.get("ImportoTotale", raw.get("importo", 0.0))),
        "oggetto": str(raw.get("Oggetto", raw.get("Descrizione", raw.get("oggetto", "")))),
        "tipo": str(raw.get("TipoDocumento", raw.get("tipo", ""))),
    }


def _map_supplier(raw: Dict[str, Any], supplier_code: str) -> Dict[str, Any]:
    """Normalize a raw Alyante supplier dict to the internal schema."""
    return {
        "codice": str(raw.get("CodiceFornitore", supplier_code)),
        "ragione_sociale": str(raw.get("RagioneSociale", raw.get("ragione_sociale", ""))),
        "partita_iva": str(raw.get("PartitaIva", raw.get("partita_iva", ""))),
        "email": str(raw.get("Email", raw.get("email", ""))),
        "telefono": str(raw.get("Telefono", raw.get("telefono", ""))),
        "indirizzo": str(raw.get("Indirizzo", raw.get("indirizzo", ""))),
    }


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

class AlyantClient:
    """Async Alyante API client with retry and stub fallback."""

    _RETRY_DELAYS = (1, 2, 4)  # seconds between retries
    _TIMEOUT = 10.0             # seconds

    def is_configured(self) -> bool:
        """Return True when ALYANTE_BASE_URL is non-empty."""
        return bool(settings.ALYANTE_BASE_URL.strip())

    def _build_client(self) -> httpx.AsyncClient:
        """Build an httpx.AsyncClient with the appropriate auth headers."""
        headers: Dict[str, str] = {}
        auth = None

        if settings.ALYANTE_API_KEY:
            headers["X-API-Key"] = settings.ALYANTE_API_KEY
        elif settings.ALYANTE_USERNAME:
            auth = (settings.ALYANTE_USERNAME, settings.ALYANTE_PASSWORD)

        return httpx.AsyncClient(
            base_url=settings.ALYANTE_BASE_URL.rstrip("/"),
            headers=headers,
            auth=auth,
            timeout=self._TIMEOUT,
        )

    async def _request(self, method: str, path: str, **kwargs) -> httpx.Response:
        """Execute an HTTP request with up to 3 retries and exponential back-off."""
        last_exc: Exception = RuntimeError("No attempts made")

        for attempt, delay in enumerate(self._RETRY_DELAYS, start=1):
            try:
                async with self._build_client() as client:
                    response = await client.request(method, path, **kwargs)
                    response.raise_for_status()
                    return response
            except (httpx.NetworkError, httpx.TimeoutException) as exc:
                last_exc = exc
                logger.warning(
                    "Alyante request %s %s attempt %d/%d failed: %s",
                    method, path, attempt, len(self._RETRY_DELAYS), exc,
                )
                if attempt < len(self._RETRY_DELAYS):
                    await asyncio.sleep(delay)
            except httpx.HTTPStatusError as exc:
                # 4xx / 5xx — do not retry, propagate immediately
                logger.error("Alyante HTTP error %s %s: %s", method, path, exc)
                raise

        raise last_exc

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def get_orders(self, supplier_code: str) -> Dict[str, Any]:
        """Return orders for a supplier.  Falls back to stub if not configured."""
        if not self.is_configured():
            logger.info("Alyante not configured – returning stub orders for %s", supplier_code)
            return {
                "supplier_code": supplier_code,
                "orders": _STUB_ORDERS,
                "source": "stub",
            }

        logger.info("Alyante live: fetching orders for supplier %s", supplier_code)
        response = await self._request("GET", f"/orders/{supplier_code}")
        raw = response.json()

        # Alyante may return a list or a dict with an "orders" key
        raw_orders = raw if isinstance(raw, list) else raw.get("orders", raw.get("Ordini", []))
        orders = [_map_order(o) for o in raw_orders]

        return {
            "supplier_code": supplier_code,
            "orders": orders,
            "source": "live",
        }

    async def get_supplier(self, supplier_code: str) -> Dict[str, Any]:
        """Return supplier details.  Falls back to stub if not configured."""
        if not self.is_configured():
            logger.info("Alyante not configured – returning stub supplier for %s", supplier_code)
            stub = dict(_STUB_SUPPLIER)
            stub["codice"] = supplier_code
            stub["source"] = "stub"
            return stub

        logger.info("Alyante live: fetching supplier %s", supplier_code)
        response = await self._request("GET", f"/suppliers/{supplier_code}")
        raw = response.json()
        supplier = _map_supplier(raw, supplier_code)
        supplier["source"] = "live"
        return supplier

    async def confirm_order(self, order_id: str) -> Dict[str, Any]:
        """Confirm an order.  Falls back to stub if not configured."""
        if not self.is_configured():
            logger.info("Alyante not configured – stub confirm for order %s", order_id)
            return {
                "order_id": order_id,
                "status": "confirmed",
                "message": "Ordine confermato (stub)",
                "source": "stub",
            }

        logger.info("Alyante live: confirming order %s", order_id)
        response = await self._request("POST", f"/orders/{order_id}/confirm")
        raw = response.json()
        return {
            "order_id": order_id,
            "status": str(raw.get("Stato", raw.get("status", "confirmed"))),
            "message": str(raw.get("Messaggio", raw.get("message", "OK"))),
            "source": "live",
        }


# Module-level singleton
alyante_client = AlyantClient()
