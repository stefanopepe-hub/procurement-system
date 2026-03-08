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
from app.database import Base, engine, SessionLocal
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

import json as _json

class _JSONFormatter(logging.Formatter):
    """Structured JSON log formatter — ottimale per Railway/Datadog/Cloudwatch."""
    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%SZ"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            entry["exc"] = self.formatException(record.exc_info)
        if hasattr(record, "extra"):
            entry.update(record.extra)
        return _json.dumps(entry, ensure_ascii=False)

_handler = logging.StreamHandler()
_handler.setFormatter(_JSONFormatter())
logging.root.setLevel(logging.INFO)
logging.root.handlers = [_handler]
# Silence noisy libraries
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
logging.getLogger("apscheduler").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)


_ADMIN_USERNAME = "admin"
_ADMIN_PASSWORD = "Admin2024!Telethon"
_ADMIN_EMAIL    = "admin@telethon.it"
_ADMIN_FULLNAME = "Super Amministratore"


def _ensure_admin_ready():
    """Ensure the super_admin user exists with correct credentials and is unlocked.
    Runs synchronously at startup before the HTTP server accepts requests.
    Safe to call on every restart."""
    try:
        from app.auth.models import User as _User, UserRole as _Role
        from app.auth.utils import get_password_hash as _hash
        from datetime import datetime, timezone

        with SessionLocal() as _db:
            existing = _db.query(_User).filter(_User.username == _ADMIN_USERNAME).first()
            if existing:
                # Always unlock and update password to the required value
                existing.hashed_password = _hash(_ADMIN_PASSWORD)
                existing.is_active = True
                existing.failed_login_attempts = 0
                existing.locked_until = None
                existing.role = _Role.SUPER_ADMIN
                existing.email = _ADMIN_EMAIL
                _db.commit()
                logger.info("Super admin account reset and unlocked.")
            else:
                _db.add(_User(
                    username=_ADMIN_USERNAME,
                    email=_ADMIN_EMAIL,
                    full_name=_ADMIN_FULLNAME,
                    hashed_password=_hash(_ADMIN_PASSWORD),
                    role=_Role.SUPER_ADMIN,
                    is_active=True,
                    failed_login_attempts=0,
                ))
                _db.commit()
                logger.info("Super admin account created.")
    except Exception as _err:
        logger.error(f"_ensure_admin_ready failed: {_err}", exc_info=True)


def _auto_seed_if_empty():
    """Run seed.py in a daemon thread if there are no suppliers yet.
    Non-blocking: HTTP server starts immediately, seed runs in background."""
    import threading

    def _run():
        try:
            from app.suppliers.models import Supplier as _Supplier
            with SessionLocal() as _db:
                count = _db.query(_Supplier).count()
            if count < 10:
                logger.info(f"Only {count} suppliers — running seed to populate database...")
                import sys as _sys
                _sys.path.insert(0, "/app")
                from seed import seed as _seed
                _seed()
                logger.info("Auto-seed completed successfully.")
            else:
                logger.info(f"Database has {count} suppliers — skipping auto-seed.")
        except Exception as _err:
            logger.error(f"Auto-seed failed: {_err}", exc_info=True)

    threading.Thread(target=_run, daemon=True, name="auto-seed").start()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    _ensure_admin_ready()   # Always runs — guarantees admin login works
    _auto_seed_if_empty()   # Runs only if suppliers table is empty
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
    allow_origins=settings.ALLOWED_ORIGINS,
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
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
        "font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';"
    )
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
    if current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
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


@app.post("/api/v1/admin/send-test-email", tags=["admin"])
def admin_send_test_email(
    email_to: str = "pepe@tigem.it",
    current_user=Depends(get_current_active_user),
):
    """Crea una survey di test e invia l'email a pepe@tigem.it (o indirizzo specificato)."""
    from app.auth.models import UserRole
    if current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        from fastapi import HTTPException as _HTTPException
        raise _HTTPException(status_code=403, detail="Solo amministratori possono inviare email di test.")

    from app.suppliers.models import Supplier
    from app.vendor_rating.models import VendorRatingRequest, RatingTriggerType
    from app.notifications.email import send_email, build_vendor_rating_survey_email
    from datetime import datetime, timezone, timedelta
    import secrets

    db = SessionLocal()
    try:
        supplier = db.query(Supplier).filter(Supplier.is_active_in_albo == True).first()
        if not supplier:
            return {"status": "error", "detail": "Nessun fornitore nel database. Eseguire prima il seed."}

        token = secrets.token_urlsafe(64)
        expires = datetime.now(timezone.utc) + timedelta(days=30)
        req = VendorRatingRequest(
            supplier_id=supplier.id,
            alyante_order_id=f"TEST-UAT-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            protocollo_ordine="UAT-ORD-2026-001",
            tipo_trigger=RatingTriggerType.OPR_COMPLETATO,
            tipo_documento="OPR",
            valutatore_email=email_to,
            valutatore_nome="UAT Tester",
            survey_token=token,
            survey_expires_at=expires,
            survey_sent_at=datetime.now(timezone.utc),
        )
        db.add(req)
        db.commit()

        survey_url = f"{settings.APP_BASE_URL}/survey/{token}"
        html = build_vendor_rating_survey_email(
            ragione_sociale=supplier.ragione_sociale,
            protocollo="UAT-ORD-2026-001",
            survey_url=survey_url,
            tipo_trigger="opr_completato",
        )
        sent = send_email(
            to=[email_to],
            subject=f"[UAT] Valuta la fornitura di {supplier.ragione_sociale} – Fondazione Telethon",
            body_html=html,
        )
        return {
            "status": "sent" if sent else "smtp_not_configured",
            "survey_url": survey_url,
            "email_to": email_to,
            "supplier": supplier.ragione_sociale,
            "detail": "Email inviata con successo" if sent else "SMTP non configurato — usa il link survey direttamente.",
        }
    finally:
        db.close()


@app.post("/api/v1/admin/run-seed", tags=["admin"])
def admin_run_seed(current_user=Depends(get_current_active_user)):
    """Esegue il seed del database (solo super_admin). Sicuro da rieseguire: non duplica dati."""
    from app.auth.models import UserRole
    if current_user.role != UserRole.SUPER_ADMIN:
        from fastapi import HTTPException as _HTTPException
        raise _HTTPException(status_code=403, detail="Solo super_admin può eseguire il seed.")
    try:
        import sys as _sys
        _sys.path.insert(0, "/app")
        from seed import seed as _seed
        _seed()
        return {"status": "ok", "detail": "Seed completato con successo."}
    except Exception as e:
        logger.error(f"admin_run_seed error: {e}", exc_info=True)
        return {"status": "error", "detail": str(e)}
