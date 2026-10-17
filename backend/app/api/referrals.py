import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import Case, Referral, User, CaseEvent, EvidenceItem
from app.schemas.careloop_schemas import (
    ReferralCreateRequest, ReferralActionRequest, ReceiptRespondRequest
)
from app.api.deps import get_current_user, require_roles, append_audit_entry
from app.services.rules_engine import evaluate_case_rules

router = APIRouter(tags=["Referrals, Escrow & Receipts"])

def utc_now():
    return datetime.now(timezone.utc)

@router.post("/cases/{id}/referrals")
def create_referral(
    id: str,
    payload: ReferralCreateRequest,
    current_user: User = Depends(require_roles("GP", "ADMIN")),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Escrow Rule: Sender retains ownership until accepted
    receipt_token = f"rcpt_{uuid.uuid4().hex[:16]}"
    ref_num = db.query(Referral).count() + 101
    ref_id = f"REF-{ref_num:03d}"

    referral = Referral(
        id=ref_id,
        case_id=case.id,
        from_facility=current_user.facility_code or "CLA",
        to_facility=payload.to_facility,
        from_user=current_user.id,
        to_user=payload.to_user,
        reason=payload.reason,
        urgency=payload.urgency,
        required_docs=payload.required_docs or ["HbA1c Lab Report", "Lipid Panel", "Clinical Summary"],
        status="SENT",
        receipt_token=receipt_token,
        sent_at=utc_now()
    )
    db.add(referral)

    # Set ownership escrow
    case.stage = "REFERRAL_SENT"
    case.sub_status = "SENT"
    case.escrow_holder_user_id = current_user.id # Sender remains responsible!

    db.add(CaseEvent(
        case_id=case.id,
        actor_user_id=current_user.id,
        actor_role=current_user.role,
        event_type="REFERRAL_SENT",
        channel="PORTAL",
        payload={
            "referral_id": ref_id,
            "to_facility": payload.to_facility,
            "reason": payload.reason,
            "receipt_token": receipt_token
        },
        evidence_source="PROVIDER_VERIFIED"
    ))

    append_audit_entry(
        db=db,
        actor=current_user.email,
        role=current_user.role,
        action="CREATE_REFERRAL_ESCROW",
        object_id=case.id,
        detail=f"Created {ref_id} to {payload.to_facility}. Escrow active: Sender remains accountable until accepted."
    )

    db.commit()
    evaluate_case_rules(db, case.id)

    return {
        "referral_id": ref_id,
        "receipt_token": receipt_token,
        "receipt_url": f"http://localhost:3000/receipts/{receipt_token}",
        "message": "Referral created. Sender remains responsible under escrow until receiver accepts."
    }

@router.get("/receipts/{token}")
def get_portable_receipt(token: str, db: Session = Depends(get_db)):
    """
    Public minimal-data receipt page for non-integrated specialist facilities.
    """
    ref = db.query(Referral).filter(Referral.receipt_token == token).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Handoff receipt not found or expired")

    case = ref.case
    return {
        "referral_id": ref.id,
        "case_id": case.id if case else "N/A",
        "patient_id": case.patient_id if case else "N/A",
        "patient_initials": case.patient.name[:2] if case and case.patient else "PT",
        "from_facility": ref.from_facility,
        "to_facility": ref.to_facility,
        "reason": ref.reason,
        "urgency": ref.urgency,
        "required_docs": ref.required_docs,
        "status": ref.status,
        "reject_reason": ref.reject_reason,
        "sent_at": ref.sent_at.isoformat() if ref.sent_at else None,
        "expires_in_days": 14
    }

@router.post("/receipts/{token}/respond")
def respond_portable_receipt(
    token: str,
    payload: ReceiptRespondRequest,
    db: Session = Depends(get_db)
):
    ref = db.query(Referral).filter(Referral.receipt_token == token).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Receipt not found")

    ref.status = payload.status
    ref.responded_at = utc_now()
    case = ref.case

    if payload.status == "ACCEPTED":
        case.stage = "RECEIVER_RESPONSE"
        case.sub_status = "ACCEPTED"
        case.escrow_holder_user_id = None # Escrow resolved!
        ev = db.query(EvidenceItem).filter(
            EvidenceItem.case_id == case.id,
            EvidenceItem.item_code == "REFERRAL_ACCEPTED_IF_REFERRED"
        ).first()
        if ev:
            ev.status = "PROVIDED"
            ev.provided_at = utc_now()
    elif payload.status == "REJECTED":
        ref.reject_reason = payload.reason or "Missing clinical documentation"
        case.stage = "RECEIVER_RESPONSE"
        case.sub_status = "REJECTED"
        case.escrow_holder_user_id = ref.from_user # Returned to sender!
    elif payload.status == "NEEDS_INFO":
        ref.reject_reason = payload.reason
        case.sub_status = "NEEDS_INFO"

    db.add(CaseEvent(
        case_id=case.id,
        actor_user_id=None,
        actor_role="SPEC_MANUAL",
        event_type=f"REFERRAL_{payload.status}",
        payload={"responder": payload.responder_name, "reason": payload.reason},
        evidence_source="PROVIDER_VERIFIED"
    ))

    append_audit_entry(
        db=db,
        actor=payload.responder_name,
        role="SPEC_EXTERNAL",
        action=f"REFERRAL_{payload.status}",
        object_id=ref.id,
        detail=f"Portable receipt response: {payload.status}. Reason: {payload.reason or 'None'}."
    )

    db.commit()
    evaluate_case_rules(db, case.id)
    return {"status": ref.status, "message": f"Referral {ref.id} updated to {ref.status}"}

@router.post("/referrals/{id}/accept")
def accept_referral(
    id: str,
    current_user: User = Depends(require_roles("SPEC", "ADMIN")),
    db: Session = Depends(get_db)
):
    ref = db.query(Referral).filter(Referral.id == id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Referral not found")

    ref.status = "ACCEPTED"
    ref.to_user = current_user.id
    ref.responded_at = utc_now()

    case = ref.case
    case.stage = "RECEIVER_RESPONSE"
    case.sub_status = "ACCEPTED"
    # Ownership transfers to the specialist!
    case.owner_user_id = current_user.id
    case.owner_role = "SPEC"
    case.escrow_holder_user_id = None # Escrow resolved!

    ev = db.query(EvidenceItem).filter(
        EvidenceItem.case_id == case.id,
        EvidenceItem.item_code == "REFERRAL_ACCEPTED_IF_REFERRED"
    ).first()
    if ev:
        ev.status = "PROVIDED"
        ev.provided_by = current_user.id
        ev.provided_at = utc_now()

    db.add(CaseEvent(
        case_id=case.id,
        actor_user_id=current_user.id,
        actor_role=current_user.role,
        event_type="REFERRAL_ACCEPTED",
        payload={"referral_id": ref.id, "specialist": current_user.name},
        evidence_source="PROVIDER_VERIFIED"
    ))

    append_audit_entry(
        db=db,
        actor=current_user.email,
        role=current_user.role,
        action="ACCEPT_REFERRAL",
        object_id=ref.id,
        detail=f"Specialist {current_user.name} accepted referral. Ownership transferred; escrow cleared."
    )

    db.commit()
    evaluate_case_rules(db, case.id)
    return {"status": "ACCEPTED", "owner": current_user.name, "case_id": case.id}

@router.post("/referrals/{id}/reject")
def reject_referral(
    id: str,
    payload: ReferralActionRequest,
    current_user: User = Depends(require_roles("SPEC", "ADMIN")),
    db: Session = Depends(get_db)
):
    if not payload.reject_reason:
        raise HTTPException(status_code=400, detail="Rejection reason is required")

    ref = db.query(Referral).filter(Referral.id == id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Referral not found")

    ref.status = "REJECTED"
    ref.reject_reason = payload.reject_reason
    ref.responded_at = utc_now()

    case = ref.case
    case.stage = "RECEIVER_RESPONSE"
    case.sub_status = "REJECTED"
    # Returns to sender!
    case.escrow_holder_user_id = ref.from_user

    db.add(CaseEvent(
        case_id=case.id,
        actor_user_id=current_user.id,
        actor_role=current_user.role,
        event_type="REFERRAL_REJECTED",
        payload={"reason": payload.reject_reason, "referral_id": ref.id},
        evidence_source="PROVIDER_VERIFIED"
    ))

    append_audit_entry(
        db=db,
        actor=current_user.email,
        role=current_user.role,
        action="REJECT_REFERRAL",
        object_id=ref.id,
        detail=f"Referral rejected: {payload.reject_reason}. Ownership returned to sender."
    )

    db.commit()
    evaluate_case_rules(db, case.id)
    return {"status": "REJECTED", "returned_to_user_id": ref.from_user}

@router.post("/referrals/{id}/needs-info")
def needs_info_referral(
    id: str,
    payload: ReferralActionRequest,
    current_user: User = Depends(require_roles("SPEC", "ADMIN")),
    db: Session = Depends(get_db)
):
    ref = db.query(Referral).filter(Referral.id == id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Referral not found")

    ref.status = "NEEDS_INFO"
    ref.reject_reason = payload.reject_reason
    ref.responded_at = utc_now()

    case = ref.case
    case.sub_status = "NEEDS_INFO"

    db.add(CaseEvent(
        case_id=case.id,
        actor_user_id=current_user.id,
        actor_role=current_user.role,
        event_type="REFERRAL_NEEDS_INFO",
        payload={"notes": payload.reject_reason},
        evidence_source="PROVIDER_VERIFIED"
    ))

    append_audit_entry(
        db=db,
        actor=current_user.email,
        role=current_user.role,
        action="REFERRAL_NEEDS_INFO",
        object_id=ref.id,
        detail=f"Specialist requested info: {payload.reject_reason}."
    )

    db.commit()
    evaluate_case_rules(db, case.id)
    return {"status": "NEEDS_INFO"}

@router.post("/referrals/{id}/resubmit")
def resubmit_referral(
    id: str,
    current_user: User = Depends(require_roles("GP", "ADMIN")),
    db: Session = Depends(get_db)
):
    ref = db.query(Referral).filter(Referral.id == id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Referral not found")

    ref.status = "SENT"
    ref.sent_at = utc_now()
    ref.reject_reason = None

    case = ref.case
    case.stage = "REFERRAL_SENT"
    case.sub_status = "RESUBMITTED"
    case.escrow_holder_user_id = current_user.id

    db.add(CaseEvent(
        case_id=case.id,
        actor_user_id=current_user.id,
        actor_role=current_user.role,
        event_type="REFERRAL_RESUBMITTED",
        payload={"referral_id": ref.id},
        evidence_source="PROVIDER_VERIFIED"
    ))

    append_audit_entry(
        db=db,
        actor=current_user.email,
        role=current_user.role,
        action="RESUBMIT_REFERRAL",
        object_id=ref.id,
        detail="Referring GP updated documents and resubmitted referral."
    )

    db.commit()
    evaluate_case_rules(db, case.id)
    return {"status": "SENT", "message": "Referral resubmitted to specialist centre."}
