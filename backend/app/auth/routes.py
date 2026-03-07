from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.database import get_db
from app.auth.models import User, UserRole, RefreshToken
from app.auth.schemas import (
    LoginRequest, TokenResponse, UserCreate, UserRead,
    UserUpdate, RefreshRequest, ChangePasswordRequest
)
from app.auth.utils import (
    verify_password, get_password_hash, create_access_token,
    create_refresh_token, decode_token, get_current_user,
    check_account_locked, handle_failed_login, handle_successful_login,
    validate_password_strength
)
from app.audit.service import log_action
from app.config import settings
from typing import List
import secrets

router = APIRouter(prefix="/auth", tags=["Authentication"])


def get_current_active_user(request: Request, db: Session = Depends(get_db)) -> User:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = auth_header.split(" ")[1]
    user = get_current_user(db, token)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return user


def require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return current_user


def require_super_admin(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin required")
    return current_user


@router.post("/login", response_model=TokenResponse)
def login(request: Request, data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        (User.username == data.username) | (User.email == data.username)
    ).first()

    ip = request.client.host if request.client else "unknown"

    if not user or not verify_password(data.password, user.hashed_password):
        if user:
            handle_failed_login(db, user)
        log_action(db, None, "LOGIN_FAILED", "auth", data.username, {"ip": ip}, ip, status="failure")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if check_account_locked(user):
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail="Account temporarily locked")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    handle_successful_login(db, user)
    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    refresh_token = create_refresh_token(db, user.id)

    log_action(db, user.id, "LOGIN", "auth", str(user.id), {"ip": ip}, ip)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserRead.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(data: RefreshRequest, db: Session = Depends(get_db)):
    db_token = db.query(RefreshToken).filter(
        RefreshToken.token == data.refresh_token,
        RefreshToken.revoked == False,
    ).first()
    if not db_token or db_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    db_token.revoked = True
    db.commit()

    user = db.query(User).filter(User.id == db_token.user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    new_refresh_token = create_refresh_token(db, user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserRead.model_validate(user),
    )


@router.post("/logout")
def logout(request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    db.query(RefreshToken).filter(RefreshToken.user_id == current_user.id).update({"revoked": True})
    db.commit()
    log_action(db, current_user.id, "LOGOUT", "auth", str(current_user.id))
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_active_user)):
    return current_user


@router.post("/users", response_model=UserRead)
def create_user(data: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
    if not validate_password_strength(data.password):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 12 chars with uppercase, lowercase, digit and special character"
        )
    if db.query(User).filter((User.email == data.email) | (User.username == data.username)).first():
        raise HTTPException(status_code=400, detail="Email or username already exists")

    user = User(
        email=data.email,
        username=data.username,
        full_name=data.full_name,
        hashed_password=get_password_hash(data.password),
        role=data.role,
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=List[UserRead])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
    return db.query(User).all()


@router.patch("/users/{user_id}", response_model=UserRead)
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from app.auth.utils import verify_password
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if not validate_password_strength(data.new_password):
        raise HTTPException(status_code=400, detail="New password does not meet security requirements")
    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    log_action(db, current_user.id, "CHANGE_PASSWORD", "auth", str(current_user.id))
    return {"message": "Password changed successfully"}


@router.get("/admin/stats")
def get_admin_stats(db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
    """System stats for AdminPanel – super_admin only."""
    from app.suppliers.models import Supplier
    from app.contracts.models import Contract
    from app.audit.models import AuditLog

    total_suppliers = db.query(Supplier).count()
    total_contracts = db.query(Contract).count()
    total_users = db.query(User).count()
    total_audit_entries = db.query(AuditLog).count()
    total_documents = db.execute(
        text("SELECT COALESCE(SUM(cnt),0) FROM ("
             "SELECT COUNT(*) AS cnt FROM supplier_documents "
             "UNION ALL "
             "SELECT COUNT(*) AS cnt FROM contract_documents"
             ") t")
    ).scalar()

    return {
        "total_suppliers": total_suppliers,
        "total_contracts": total_contracts,
        "total_users": total_users,
        "total_documents": int(total_documents or 0),
        "total_audit_entries": total_audit_entries,
    }


@router.get("/admin/audit-log")
def get_audit_log(db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
    """Last 50 audit log entries – super_admin only."""
    from app.audit.models import AuditLog
    entries = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": e.id,
            "user_id": e.user_id,
            "action": e.action,
            "resource_type": e.resource_type,
            "resource_id": e.resource_id,
            "ip_address": e.ip_address,
            "status": e.status,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in entries
    ]


@router.post("/bootstrap", status_code=201, tags=["Authentication"])
def bootstrap_admin(db: Session = Depends(get_db)):
    """Crea il primo super admin. Funziona solo se non esistono utenti."""
    if db.query(User).count() > 0:
        raise HTTPException(status_code=403, detail="Bootstrap already done")
    user = User(
        email="admin@procurement.it",
        username="admin",
        full_name="Administrator",
        hashed_password=get_password_hash("Admin123456!"),
        role=UserRole.SUPER_ADMIN,
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    return {"message": "Admin created", "username": "admin", "note": "Cambiare la password al primo accesso tramite il menu utente."}
