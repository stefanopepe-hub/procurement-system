from fastapi import FastAPI, Request, status, Depends
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import logging

from app.config import settings
from app.database import Base, engine
from app.auth.routes import router as auth_router, get_current_active_user
from app.suppliers.routes import router as suppliers_router
from app.contracts.routes import router as contracts_router
from app.vendor_rating.routes import router as vendor_rating_router
from app.ai.routes import router as ai_router
from app.alyante.routes import router as alyante_router
from app.notifications.scheduler import (
    start_scheduler, scheduler,
    check_contract_notifications,
)

# Import all models to register them with SQLAlchemy
from app.auth.models import User, RefreshToken
from app.audit.models import AuditLog
from app.suppliers.models import (
    Supplier, SupplierContact, SupplierCertification,
    SupplierDocument, SupplierFatturato, SupplierCommunication
)
from app.contracts.models import Contract, ContractDocument, ContractCommunication, ContractOrder
from app.vendor_rating.models import (
    VendorRatingRequest, VendorRating, SupplierRatingSummary,
    UAYearlyReview, NonConformita
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Starting notification scheduler...")
    start_scheduler()
    yield
    # Shutdown
    logger.info("Stopping scheduler...")
    if scheduler.running:
        scheduler.shutdown()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
    openapi_url="/api/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan,
)

# --- Security Middleware ---
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
    expose_headers=["X-Total-Count"],
)

# Security headers middleware
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if not settings.DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    import logging
    logger = logging.getLogger(__name__)
    logger.error(f"Unhandled error on {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Errore interno del server. Riprova più tardi."}
    )


@app.get("/health", tags=["system"])
async def health_check():
    from datetime import datetime
    try:
        from .database import engine
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "version": "1.0.0",
        "db": db_status,
        "timestamp": datetime.utcnow().isoformat()
    }


# --- Routers ---
app.include_router(auth_router, prefix="/api/v1")
app.include_router(suppliers_router, prefix="/api/v1")
app.include_router(contracts_router, prefix="/api/v1")
app.include_router(vendor_rating_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(alyante_router, prefix="/api/v1")


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "version": settings.APP_VERSION}


@app.post("/api/v1/admin/check-expiries", tags=["admin"])
def admin_check_expiries(current_user=Depends(get_current_active_user)):
    """Trigger contract-expiry notification checks on demand (admin only).

    This endpoint runs the same logic as the daily APScheduler job so that
    operators or an external cron can force an immediate check without waiting
    for the next scheduled run.
    """
    from app.auth.models import UserRole
    if current_user.role not in (UserRole.ADMIN, UserRole.SUPERADMIN):
        from fastapi import HTTPException, status as http_status
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Solo gli amministratori possono eseguire questo controllo.",
        )
    try:
        check_contract_notifications()
        return {"status": "ok", "detail": "Controllo scadenze contratti eseguito."}
    except Exception as exc:
        logger.error("admin_check_expiries error: %s", exc)
        return {"status": "error", "detail": str(exc)}


@app.get("/api/v1/alyante/stub/orders/{supplier_code}", tags=["Alyante"])
async def alyante_stub_orders(supplier_code: str):
    """Retrocompatibilità: reindirizza al nuovo endpoint /alyante/orders/{supplier_code}"""
    from app.alyante.client import alyante_client
    return await alyante_client.get_orders(supplier_code)
