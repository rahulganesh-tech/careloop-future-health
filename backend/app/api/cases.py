from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
import csv
import io
import json

from app.db.session import get_db
from app.models.entities import (
    Case, ScreeningResult, PatientIdentity, CaseEvent, EvidenceItem,
    User, Pathway, Task, Message, Referral, Appointment, Barrier, Consult, RuleFiring
)
from app.schemas.careloop_schemas import CaseAssignRequest, CaseReviewRequest, ResultImportRow
from app.api.deps import get_current_user, require_roles, append_audit_entry
from app.services.evidence_service import initialize_evidence_items
from app.services.rules_engine import evaluate_case_rules
from app.services.score_calculator import calculate_loop_integrity_score

router = APIRouter(prefix="/cases", tags=["Case Engine & Lifecycle"])

def utc_now():
    return datetime.now(timezone.utc)

@router.get("")
def list_cases(
    stage: Optional[str] = None,
    urgency: Optional[str] = None,
    owner: Optional[str] = None,
    overdue: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Case).filter(Case.archived == False)

    # RLS Enforcement: GP / SCR see their facility; SPEC sees addressed referrals/accepted cases; COORD/PM see all
    if current_user.role in ("GP", "SCR") and current_user.facility_code:
        query = query.join(ScreeningResult).filter(ScreeningResult.facility_code == current_user.facility_code)
    elif current_user.role == "SPEC" and current_user.facility_code:
        # Specialist sees cases with referral to their facility
        query = query.join(Referral, Referral.case_id == Case.id, isouter=True).filter(
            (Referral.to_facility == current_user.facility_code) | (Case.owner_user_id == current_user.id)
        )

    if stage:
        query = query.filter(Case.stage == stage)
    if urgency:
        query = query.filter(Case.urgency == urgency)
    if owner == "me":
        query = query.filter(Case.owner_user_id == current_user.id)

    cases = query.all()

    now = utc_now()
    if overdue:
        filtered = []
        for c in cases:
            if not c.closed_at and c.due_at:
                due = c.due_at.replace(tzinfo=timezone.utc) if c.due_at.tzinfo is None else c.due_at
                if now > due:
                    filtered.append(c)
        cases = filtered

    results = []
    for c in cases:
        results.append({
            "id": c.id,
            "patient_id": c.patient_id,
            "patient_name": c.patient.name if c.patient else "Anonymous",
            "urgency": c.urgency,
            "stage": c.stage,
            "sub_status": c.sub_status,
            "owner_user_id": c.owner_user_id,
            "owner_role": c.owner_role,
            "backup_user_id": c.backup_user_id,
            "escrow_holder_user_id": c.escrow_holder_user_id,
            "due_at": c.due_at.isoformat() if c.due_at else None,
            "opened_at": c.opened_at.isoformat() if c.opened_at else None,
            "closed_at": c.closed_at.isoformat() if c.closed_at else None,
            "disposition": c.disposition,
            "hba1c_value": c.result.value if c.result else None
        })
    return results

@router.get("/{id}")
def get_case_detail(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Audit the view
    append_audit_entry(
        db=db,
        actor=current_user.email,
        role=current_user.role,
        action="VIEW_CASE",
        object_id=case.id,
        detail="User viewed comprehensive case journey details."
    )

    # Build timeline
    timeline = []
    for ev in sorted(case.events, key=lambda x: x.ts):
        timeline.append({
            "id": ev.id,
            "ts": ev.ts.isoformat(),
            "actor_user_id": ev.actor_user_id,
            "actor_role": ev.actor_role,
            "event_type": ev.event_type,
            "channel": ev.channel,
            "payload": ev.payload,
            "evidence_source": ev.evidence_source
        })

    # Evidence items
    evidence = []
    for item in case.evidence:
        evidence.append({
            "id": item.id,
            "item_code": item.item_code,
            "status": item.status,
            "provided_by": item.provided_by,
            "provided_at": item.provided_at.isoformat() if item.provided_at else None,
            "document_ref": item.document_ref,
            "source": item.source
        })

    # Signoffs
    signoffs = [{"id": s.id, "role": s.role, "user_id": s.user_id, "statement": s.statement, "ts": s.ts.isoformat()} for s in case.signoffs]

    # Referrals
    referrals = []
    for r in case.referrals:
        referrals.append({
            "id": r.id,
            "from_facility": r.from_facility,
            "to_facility": r.to_facility,
            "status": r.status,
            "reason": r.reason,
            "urgency": r.urgency,
            "receipt_token": r.receipt_token,
            "reject_reason": r.reject_reason,
            "sent_at": r.sent_at.isoformat() if r.sent_at else None
        })

    # Messages
    messages = []
    for m in case.messages:
        messages.append({
            "id": m.id,
            "channel": m.channel,
            "language": m.language,
            "template_id": m.template_id,
            "status": m.status,
            "body": m.body,
            "ts": m.ts.isoformat()
        })

    # Consults
    consults = []
    for con in case.consults:
        consults.append({
            "id": con.id,
            "to_specialty": con.to_specialty,
            "question": con.question,
            "answer": con.answer,
            "status": con.status,
            "asked_at": con.asked_at.isoformat() if con.asked_at else None,
            "answered_at": con.answered_at.isoformat() if con.answered_at else None
        })

    # Barriers
    barriers = []
    for b in case.barriers:
        barriers.append({
            "id": b.id,
            "code": b.code,
            "note": b.note,
            "response_code": b.response_code,
            "resolved": b.resolved,
            "ts": b.ts.isoformat()
        })

    # Tasks
    tasks = []
    for t in case.tasks:
        tasks.append({
            "id": t.id,
            "kind": t.kind,
            "assigned_role": t.assigned_role,
            "status": t.status,
            "due_at": t.due_at.isoformat() if t.due_at else None,
            "created_by_rule": t.created_by_rule,
            "outcome": t.outcome
        })

    # Rule firings
    firings = []
    for rf in case.rule_firings:
        firings.append({
            "id": rf.id,
            "rule_id": rf.rule_id,
            "reason": rf.reason,
            "action": rf.action,
            "overridden_by": rf.overridden_by,
            "override_reason": rf.override_reason,
            "ts": rf.ts.isoformat()
        })

    return {
        "id": case.id,
        "patient": {
            "patient_id": case.patient.patient_id,
            "name": case.patient.name,
            "dob": case.patient.dob,
            "phone": case.patient.phone,
            "preferred_language": case.patient.preferred_language,
            "preferred_channel": case.patient.preferred_channel,
            "has_smartphone": case.patient.has_smartphone
        } if case.patient else None,
        "result": {
            "test_code": case.result.test_code,
            "value": case.result.value,
            "unit": case.result.unit,
            "issued_at": case.result.issued_at.isoformat() if case.result else None
        } if case.result else None,
        "urgency": case.urgency,
        "stage": case.stage,
        "sub_status": case.sub_status,
        "owner_user_id": case.owner_user_id,
        "owner_role": case.owner_role,
        "backup_user_id": case.backup_user_id,
        "escrow_holder_user_id": case.escrow_holder_user_id,
        "due_at": case.due_at.isoformat() if case.due_at else None,
        "opened_at": case.opened_at.isoformat() if case.opened_at else None,
        "closed_at": case.closed_at.isoformat() if case.closed_at else None,
        "disposition": case.disposition,
        "disposition_reason": case.disposition_reason,
        "closure_seal": case.closure_seal,
        "timeline": timeline,
        "evidence": evidence,
        "signoffs": signoffs,
        "referrals": referrals,
        "messages": messages,
        "consults": consults,
        "barriers": barriers,
        "tasks": tasks,
        "rule_firings": firings
    }

@router.post("/{id}/assign")
def assign_case_owner(
    id: str,
    payload: CaseAssignRequest,
    current_user: User = Depends(require_roles("GP", "COORD", "PM", "ADMIN")),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    target_owner = db.query(User).filter(User.id == payload.owner_user_id).first()
    if not target_owner:
        raise HTTPException(status_code=404, detail="Assigned owner user not found")

    case.owner_user_id = target_owner.id
    case.owner_role = payload.owner_role
    case.backup_user_id = payload.backup_user_id
    case.due_at = payload.due_at or (utc_now() + timedelta(days=14))
    
    # Progress stage if currently RESULT_RECEIVED
    if case.stage == "RESULT_RECEIVED":
        case.stage = "OWNER_ASSIGNED"
        case.sub_status = "ASSIGNED"
        # Initialize evidence items checklist
        initialize_evidence_items(db, case)

    # Event
    db.add(CaseEvent(
        case_id=case.id,
        actor_user_id=current_user.id,
        actor_role=current_user.role,
        event_type="OWNER_ASSIGNED",
        payload={
            "owner_user_id": target_owner.id,
            "owner_name": target_owner.name,
            "owner_role": payload.owner_role
        },
        evidence_source="SYSTEM"
    ))

    # Audit Log
    append_audit_entry(
        db=db,
        actor=current_user.email,
        role=current_user.role,
        action="ASSIGN_OWNER",
        object_id=case.id,
        detail=f"Assigned owner {target_owner.name} ({payload.owner_role})"
    )

    db.commit()
    evaluate_case_rules(db, case.id)
    return {"message": f"Case {case.id} assigned to {target_owner.name}", "stage": case.stage}

@router.post("/{id}/review")
def review_case_clinician(
    id: str,
    payload: CaseReviewRequest,
    current_user: User = Depends(require_roles("GP")),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    case.stage = "CLINICAL_REVIEW"
    case.sub_status = payload.next_step

    # If confirmatory test is not needed, mark evidence item with rationale
    if not payload.confirmatory_test_needed:
        ev = db.query(EvidenceItem).filter(
            EvidenceItem.case_id == case.id,
            EvidenceItem.item_code == "CONFIRMATORY_RESULT_OR_RATIONALE"
        ).first()
        if ev:
            ev.status = "PROVIDED"
            ev.provided_by = current_user.id
            ev.provided_at = utc_now()
            ev.document_ref = f"Clinical rationale: {payload.rationale}"

    # Timeline event
    db.add(CaseEvent(
        case_id=case.id,
        actor_user_id=current_user.id,
        actor_role=current_user.role,
        event_type="CLINICAL_REVIEW_COMPLETED",
        payload={
            "rationale": payload.rationale,
            "next_step": payload.next_step,
            "confirmatory_test_needed": payload.confirmatory_test_needed
        },
        evidence_source="PROVIDER_VERIFIED"
    ))

    # Audit Log
    append_audit_entry(
        db=db,
        actor=current_user.email,
        role=current_user.role,
        action="CLINICAL_REVIEW",
        object_id=case.id,
        detail=f"Clinician completed review. Decision: {payload.next_step}."
    )

    db.commit()
    evaluate_case_rules(db, case.id)
    return {"message": "Clinical review recorded successfully", "stage": case.stage}

results_router = APIRouter(prefix="/results", tags=["Intake & Results"])

@results_router.post("/import")
def import_screening_results(
    rows: List[ResultImportRow],
    current_user: User = Depends(require_roles("SCR", "ADMIN")),
    db: Session = Depends(get_db)
):
    created_cases = []
    errors = []

    for idx, row in enumerate(rows):
        try:
            # Check or create patient identity
            patient = db.query(PatientIdentity).filter(PatientIdentity.patient_id == row.patient_id).first()
            if not patient:
                patient = PatientIdentity(
                    patient_id=row.patient_id,
                    name=row.name,
                    dob=row.dob,
                    phone=row.phone,
                    preferred_language=row.preferred_language,
                    has_smartphone=row.has_smartphone
                )
                db.add(patient)
                db.flush()

            # Create screening result
            facility_code = current_user.facility_code or "CLA"
            res = ScreeningResult(
                patient_id=patient.patient_id,
                facility_code=facility_code,
                test_code=row.test_code,
                value=row.value,
                unit=row.unit
            )
            db.add(res)
            db.flush()

            # Classify urgency
            if row.value >= 10.0:
                urgency = "CRITICAL"
                due_hours = 24
            elif row.value >= 6.5:
                urgency = "HIGH"
                due_hours = 336 # 14 days
            else:
                urgency = "ROUTINE"
                due_hours = 720 # 30 days

            case_num = db.query(Case).count() + 1001
            case_id = f"CASE-{case_num}"

            new_case = Case(
                id=case_id,
                result_id=res.id,
                patient_id=patient.patient_id,
                pathway_code="DIAB-HBA1C",
                urgency=urgency,
                stage="RESULT_RECEIVED",
                sub_status="PENDING_OWNER",
                due_at=utc_now() + timedelta(hours=due_hours),
                opened_at=utc_now()
            )
            db.add(new_case)
            db.flush()

            # Event
            db.add(CaseEvent(
                case_id=new_case.id,
                actor_user_id=current_user.id,
                actor_role=current_user.role,
                event_type="RESULT_RECEIVED",
                payload={"test": row.test_code, "value": row.value, "unit": row.unit},
                evidence_source="PROVIDER_VERIFIED"
            ))

            append_audit_entry(
                db=db,
                actor=current_user.email,
                role=current_user.role,
                action="IMPORT_RESULT",
                object_id=new_case.id,
                detail=f"Created case {new_case.id} for {patient.patient_id} with {row.test_code} {row.value}% ({urgency})"
            )

            created_cases.append(new_case.id)
        except Exception as e:
            errors.append({"row_index": idx, "patient_id": row.patient_id, "error": str(e)})

    db.commit()
    return {
        "imported_count": len(created_cases),
        "created_cases": created_cases,
        "errors": errors
    }
