from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import Case, Appointment, Referral, User, CaseEvent, EvidenceItem
from app.schemas.careloop_schemas import (
    AppointmentCreateRequest, AppointmentUpdateRequest, OutcomeReturnRequest
)
from app.api.deps import get_current_user, require_roles, append_audit_entry
from app.services.rules_engine import evaluate_case_rules
from app.services.evidence_service import record_dual_signoff

router = APIRouter(tags=["Appointments & Specialist Outcomes"])

def utc_now():
    return datetime.now(timezone.utc)

@router.post("/cases/{id}/appointments")
def create_appointment(
    id: str,
    payload: AppointmentCreateRequest,
    current_user: User = Depends(require_roles("COORD", "SPEC", "GP", "ADMIN")),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # State Machine Validation Rule:
    # "Invalid transition returns 409: CASE-1012 is REFERRAL_SENT; it must be ACCEPTED before an appointment can be booked."
    for ref in case.referrals:
        if ref.status == "SENT":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"{case.id} is REFERRAL_SENT; it must be ACCEPTED before an appointment can be booked."
            )
        elif ref.status == "REJECTED":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot book appointment: Referral was rejected ({ref.reject_reason})."
            )

    appt = Appointment(
        case_id=case.id,
        facility_code=payload.facility_code,
        slot_at=payload.slot_at,
        status="BOOKED"
    )
    db.add(appt)

    case.stage = "APPOINTMENT_SERVICE"
    case.sub_status = "BOOKED"

    db.add(CaseEvent(
        case_id=case.id,
        actor_user_id=current_user.id,
        actor_role=current_user.role,
        event_type="APPOINTMENT_BOOKED",
        payload={"facility": payload.facility_code, "slot": payload.slot_at.isoformat()},
        evidence_source="PROVIDER_VERIFIED"
    ))

    append_audit_entry(
        db=db,
        actor=current_user.email,
        role=current_user.role,
        action="BOOK_APPOINTMENT",
        object_id=case.id,
        detail=f"Booked specialist appointment at {payload.facility_code} for {payload.slot_at.isoformat()}."
    )

    db.commit()
    evaluate_case_rules(db, case.id)
    return {"appointment_id": appt.id, "status": "BOOKED", "slot_at": appt.slot_at.isoformat()}

@router.patch("/appointments/{id}")
def update_appointment(
    id: int,
    payload: AppointmentUpdateRequest,
    current_user: User = Depends(require_roles("COORD", "SPEC", "GP", "ADMIN")),
    db: Session = Depends(get_db)
):
    appt = db.query(Appointment).filter(Appointment.id == id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    appt.status = payload.status
    case = appt.case
    if case:
        case.sub_status = payload.status
        if payload.status == "ATTENDED":
            db.add(CaseEvent(
                case_id=case.id,
                actor_user_id=current_user.id,
                actor_role=current_user.role,
                event_type="APPOINTMENT_ATTENDED",
                evidence_source="PROVIDER_VERIFIED"
            ))
        elif payload.status == "NO_SHOW":
            db.add(CaseEvent(
                case_id=case.id,
                actor_user_id=current_user.id,
                actor_role=current_user.role,
                event_type="APPOINTMENT_NO_SHOW",
                evidence_source="PROVIDER_VERIFIED"
            ))

    append_audit_entry(
        db=db,
        actor=current_user.email,
        role=current_user.role,
        action="UPDATE_APPOINTMENT",
        object_id=f"APPT-{appt.id}",
        detail=f"Updated appointment status to {payload.status}."
    )

    db.commit()
    if case:
        evaluate_case_rules(db, case.id)
    return {"appointment_id": appt.id, "status": appt.status}

@router.post("/cases/{id}/outcome")
def return_specialist_outcome(
    id: str,
    payload: OutcomeReturnRequest,
    current_user: User = Depends(require_roles("SPEC", "ADMIN")),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    case.stage = "OUTCOME_RETURNED"
    case.sub_status = "OUTCOME_RECORDED"

    # Provide outcome evidence item
    ev = db.query(EvidenceItem).filter(
        EvidenceItem.case_id == case.id,
        EvidenceItem.item_code == "OUTCOME_REPORT_RETURNED"
    ).first()
    if ev:
        ev.status = "PROVIDED"
        ev.provided_by = current_user.id
        ev.provided_at = utc_now()
        ev.document_ref = f"Specialist Consultation Report: {payload.report_text[:100]}..."

    # If specialist confirms as receiver sign-off
    if payload.confirm_as_receiver:
        record_dual_signoff(
            db=db,
            case_id=case.id,
            user_id=current_user.id,
            user_role=current_user.role,
            target_role="RECEIVER",
            statement=f"Specialist assessment completed. Diagnosis confirmed and care plan established: {payload.plan_text}"
        )

    # Mark corresponding referral as COMPLETED
    for ref in case.referrals:
        if ref.status == "ACCEPTED":
            ref.status = "COMPLETED"

    db.add(CaseEvent(
        case_id=case.id,
        actor_user_id=current_user.id,
        actor_role=current_user.role,
        event_type="OUTCOME_RETURNED",
        payload={
            "report": payload.report_text,
            "plan": payload.plan_text
        },
        evidence_source="PROVIDER_VERIFIED"
    ))

    append_audit_entry(
        db=db,
        actor=current_user.email,
        role=current_user.role,
        action="RETURN_OUTCOME",
        object_id=case.id,
        detail="Receiving specialist documented clinical outcome and treatment plan."
    )

    db.commit()
    evaluate_case_rules(db, case.id)
    return {
        "status": "OUTCOME_RETURNED",
        "stage": case.stage,
        "message": "Specialist outcome recorded and receiver sign-off registered."
    }
