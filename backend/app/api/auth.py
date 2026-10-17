from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import User, PatientIdentity, Case
from app.schemas.careloop_schemas import LoginRequest, LoginResponse, OTPVerifyRequest, PatientLinkRequest
from app.core.security import (
    verify_password,
    create_access_token,
    create_patient_token,
    decode_patient_token
)
from app.core.config import settings
from app.api.deps import get_current_user, append_audit_entry

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check account lockout
    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise HTTPException(
            status_code=403,
            detail=f"Account temporarily locked due to multiple failed attempts. Try again later."
        )

    if not verify_password(payload.password, user.password_hash):
        user.failed_logins += 1
        if user.failed_logins >= 5:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Reset failed login count
    user.failed_logins = 0
    db.commit()

    user_info = {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "facility_code": user.facility_code
    }

    # Clinical & Admin roles require OTP
    if user.otp_required:
        # Issue an OTP-stage token (cannot call general API yet)
        otp_token = create_access_token({
            "sub": user.email,
            "user_id": user.id,
            "role": user.role,
            "stage": "otp"
        }, expires_delta=timedelta(minutes=5))
        
        append_audit_entry(
            db=db,
            actor=user.email,
            role=user.role,
            action="LOGIN_OTP_CHALLENGE",
            object_id=f"USER-{user.id}",
            detail="User passed password check, 2-step OTP required."
        )
        return {
            "stage": "otp",
            "token": otp_token,
            "user": user_info
        }
    else:
        # Full token
        token = create_access_token({
            "sub": user.email,
            "user_id": user.id,
            "role": user.role,
            "stage": "full"
        })
        append_audit_entry(
            db=db,
            actor=user.email,
            role=user.role,
            action="LOGIN_SUCCESS",
            object_id=f"USER-{user.id}",
            detail="User logged in directly (no OTP required)."
        )
        return {
            "stage": "full",
            "token": token,
            "user": user_info
        }

@router.post("/otp", response_model=LoginResponse)
def verify_otp(payload: OTPVerifyRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Validate OTP demo code
    if payload.otp_code != settings.OTP_DEMO_CODE:
        user.failed_logins += 1
        if user.failed_logins >= 5:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid OTP code")

    user.failed_logins = 0
    db.commit()

    token = create_access_token({
        "sub": user.email,
        "user_id": user.id,
        "role": user.role,
        "stage": "full"
    })

    append_audit_entry(
        db=db,
        actor=user.email,
        role=user.role,
        action="LOGIN_OTP_VERIFIED",
        object_id=f"USER-{user.id}",
        detail="User successfully completed 2-step OTP verification."
    )

    return {
        "stage": "full",
        "token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "facility_code": user.facility_code
        }
    }

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
        "facility_code": current_user.facility_code
    }

patient_router = APIRouter(prefix="/patient", tags=["Patient Auth & Access"])

@patient_router.post("/link/{token}")
def exchange_patient_link(token: str, payload: PatientLinkRequest, db: Session = Depends(get_db)):
    """
    Exchanges a one-time secure link token + date-of-birth check for a 30-minute patient session.
    """
    # Accept token formats: e.g. "patient_demo_PT-0042" or standard JWT
    patient_id = None
    if token.startswith("patient_demo_"):
        patient_id = token.replace("patient_demo_", "")
    else:
        decoded = decode_patient_token(token)
        if decoded:
            patient_id = decoded.get("patient_id")
    
    if not patient_id:
        raise HTTPException(status_code=400, detail="Invalid or expired patient access link")

    patient = db.query(PatientIdentity).filter(PatientIdentity.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    # DOB Check
    if patient.dob != payload.dob:
        raise HTTPException(status_code=401, detail="Date of birth does not match our records.")

    session_token = create_patient_token(patient_id=patient.patient_id)
    return {
        "patient_token": session_token,
        "patient_id": patient.patient_id,
        "name": patient.name,
        "preferred_language": patient.preferred_language,
        "expires_in_minutes": settings.PATIENT_LINK_EXPIRE_MINUTES
    }
