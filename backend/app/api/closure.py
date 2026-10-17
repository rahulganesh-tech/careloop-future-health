from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import Case, EvidenceItem, Signoff, User, CaseEvent
from app.schemas.careloop_schemas import SignoffRequest, CaseCloseRequest
from app.api.deps import get_current_user, require_roles, append_audit_entry
from app.services.evidence_service import (
    check_closure_readiness, record_dual_signoff, generate_closure_seal
)
from app.services.rules_engine import evaluate_case_rules

router = APIRouter(tags=["Evidence Gate & Case Closure"])

def utc_now():
    return datetime.now(timezone.utc)

@router.get("/cases/{id}/closure-check")
def get_case_closure_check(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    status_data = check_closure_readiness(db, case.id)
    return status_data

@router.post("/cases/{id}/signoff")
def submit_case_signoff(
    id: str,
    payload: SignoffRequest,
    current_user: User = Depends(require_roles("GP", "SPEC", "ADMIN")),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    signoff = record_dual_signoff(
        db=db,
        case_id=case.id,
        user_id=current_user.id,
        user_role=current_user.role,
        target_role=payload.role,
        statement=payload.statement
    )

    append_audit_entry(
        db=db,
        actor=current_user.email,
        role=current_user.role,
        action=f"SIGNOFF_{payload.role}",
        object_id=case.id,
        detail=f"Clinician sign-off recorded as {payload.role}: {payload.statement}"
    )

    return {
        "status": "RECORDED",
        "role": payload.role,
        "signed_by": current_user.name,
        "ts": signoff.ts.isoformat()
    }

@router.post("/cases/{id}/close")
def close_case_evidence_gate(
    id: str,
    payload: CaseCloseRequest,
    current_user: User = Depends(require_roles("GP", "ADMIN")),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Strict Evidence Gate Verification
    readiness = check_closure_readiness(db, case.id)
    if not readiness["ready"]:
        missing_names = [m["name"] for m in readiness["missing"]]
        detail_msg = f"Cannot close {case.id}: {', '.join(missing_names)} are missing."
        if readiness.get("errors"):
            detail_msg += f" Additional errors: {' '.join(readiness['errors'])}"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail_msg
        )

    # Validated! Proceed with closure
    seal_hash = generate_closure_seal(case, payload.disposition, payload.reason)
    
    case.stage = "CLOSURE_REVIEW"
    case.sub_status = "CLOSED"
    case.closed_at = utc_now()
    case.disposition = payload.disposition
    case.disposition_reason = payload.reason
    case.closure_seal = seal_hash

    # Mark DISPOSITION_RECORDED evidence item
    ev = db.query(EvidenceItem).filter(
        EvidenceItem.case_id == case.id,
        EvidenceItem.item_code == "DISPOSITION_RECORDED"
    ).first()
    if ev:
        ev.status = "PROVIDED"
        ev.provided_by = current_user.id
        ev.provided_at = utc_now()
        ev.document_ref = f"Disposition: {payload.disposition}"

    # Timeline event
    db.add(CaseEvent(
        case_id=case.id,
        actor_user_id=current_user.id,
        actor_role=current_user.role,
        event_type="CASE_CLOSED",
        payload={
            "disposition": payload.disposition,
            "reason": payload.reason,
            "seal": seal_hash
        },
        evidence_source="PROVIDER_VERIFIED"
    ))

    # Append to immutable audit log
    append_audit_entry(
        db=db,
        actor=current_user.email,
        role=current_user.role,
        action="CLOSE_CASE",
        object_id=case.id,
        detail=f"Case closed with disposition {payload.disposition}. Cryptographic seal: {seal_hash}"
    )

    db.commit()
    evaluate_case_rules(db, case.id)

    return {
        "status": "CLOSED",
        "case_id": case.id,
        "disposition": case.disposition,
        "closure_seal": seal_hash,
        "message": f"Case {case.id} successfully closed and sealed in audit log."
    }
