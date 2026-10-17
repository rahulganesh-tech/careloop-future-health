from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import User, AuditLog
from app.core.security import decode_access_token
from app.core.audit_chain import compute_audit_hash
from datetime import datetime, timezone

security_scheme = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header"
        )
    
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token"
        )
    
    # Check if this is an OTP-stage token
    if payload.get("stage") == "otp":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTP verification required before API access."
        )

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User identity not found in token"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account inactive or not found"
        )
    
    return user

def require_roles(*allowed_roles: str):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Your role ({current_user.role}) cannot do this."
            )
        return current_user
    return role_checker

def append_audit_entry(
    db: Session,
    actor: str,
    role: str,
    action: str,
    object_id: str,
    detail: str = ""
) -> AuditLog:
    """
    Appends a new hash-chained entry to the immutable audit_log.
    """
    last_entry = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
    prev_hash = last_entry.hash if last_entry else "GENESIS"
    now_ts = datetime.now(timezone.utc)
    ts_str = now_ts.isoformat()

    entry_hash = compute_audit_hash(
        ts_str=ts_str,
        actor=actor,
        role=role,
        action=action,
        obj=object_id,
        detail=detail,
        prev_hash=prev_hash
    )

    audit_entry = AuditLog(
        ts=now_ts,
        actor=actor,
        role=role,
        action=action,
        object=object_id,
        detail=detail,
        prev_hash=prev_hash,
        hash=entry_hash
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)
    return audit_entry
