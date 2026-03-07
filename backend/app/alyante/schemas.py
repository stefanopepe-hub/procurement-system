from pydantic import BaseModel
from typing import List


class AlyantOrder(BaseModel):
    id: str
    numero: str
    data: str
    stato: str
    importo: float
    oggetto: str
    tipo: str


class AlyantOrdersResponse(BaseModel):
    supplier_code: str
    orders: List[AlyantOrder]
    source: str  # "live" o "stub"


class AlyantSupplier(BaseModel):
    codice: str
    ragione_sociale: str
    partita_iva: str = ""
    email: str = ""
    telefono: str = ""
    indirizzo: str = ""
    source: str  # "live" o "stub"


class AlyantOrderConfirmResponse(BaseModel):
    order_id: str
    status: str
    message: str
    source: str  # "live" o "stub"
