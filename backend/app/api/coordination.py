from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import (
    Case, Task, Barrier, Consult, RuleFiring, User, CaseEvent, EvidenceItem
)
from app.schemas.careloop_schemas import (
    TaskCreateRequest, TaskCompleteRequest, BarrierRecordRequest,
    ConsultCreateRequest, ConsultAnswerRequest, RuleOverrideRequest
)
from app.api.deps import get_current_user, require_roles, append_audit_entry
from app.services.rules_engine import evaluate_case_rules

router = APIRouter(tags=["Coordination, Tasks & Micro-Consults"])

def utc_now():
    return datetime.now(timezone.utc)

BARRIER_RESPONSES = {
    "LANGUAGE": "Switch to preferred language (Arabic/Hindi); activate bilingual voice call script; offer translator.",
    "TRANSPORT": "Coordinate Abu Dhabi Community Transport voucher; offer telehealth / clinic closer to residence.",
    "AFFORDABILITY": "Enroll in Daman health insurance subsidy or charity healthcare support fund.",
    "NO_SLOT": "Activate urgent secondary clinic roster; escalate to facility coordinator for overbook slot.",
    "MISSING_DOCUMENTS": "Generate missing document checklist; request electronic lab sync or patient photo upload.",
    "UNREACHABLE": "Escalate to secondary phone contact; initiate Community Health Worker home outreach.",
    "PATIENT_PREFERENCE": "Conduct informed clinical dialogue regarding risk of unmonitored diabetes.",
    "CRITERIA_MISMATCH": "Reroute referral to appropriate clinical sub-specialty or general internal medicine.",
    "CLINICAL_ESCALATION": "Immediate triage to emergency department or urgent assessment clinic.",
    "UNKNOWN": "Conduct holistic care-barrier assessment interview."
}

@router.get("/queue/stalled")
def get_stalled_queue(
    current_user: User = Depends(require_roles("COORD", "PM", "GP", "ADMIN")),
    db: Session = Depends(get_db)
):
    """
    Returns stalled and overdue cases sorted by urgency (CRITICAL first), then time overdue.
    """
    now = utc_now()
    cases = db.query(Case).filter(Case.archived == False, Case.closed_at == None).all()
    stalled_items = []

    for c in cases:
        # Check if stalled: overdue, or has pending tasks/rule firings, or critical unacknowledged
        is_ack = any(e.event_type in ("PATIENT_ACKNOWLEDGED", "TEACH_BACK_PASSED") for e in c.events)
        opened = c.opened_at.replace(tzinfo=timezone.utc) if c.opened_at and c.opened_at.tzinfo is None else (c.opened_at or now)
        hours_open = (now - opened).total_seconds() / 3600.0

        is_critical_unack = (c.urgency == "CRITICAL" and not is_ack and hours_open >= 24)
        is_overdue = False
        hours_overdue = 0.0

        if c.due_at:
            due = c.due_at.replace(tzinfo=timezone.utc) if c.due_at.tzinfo is None else c.due_at
            if now > due:
                is_overdue = True
                hours_overdue = (now - due).total_seconds() / 3600.0

        has_pending_tasks = any(t.status == "PENDING" for t in c.tasks)
        has_barriers = any(not b.resolved for b in c.barriers)

        if is_critical_unack or is_overdue or has_pending_tasks or has_barriers:
            urgency_rank = {"CRITICAL": 0, "HIGH": 1, "ROUTINE": 2}.get(c.urgency, 3)
            stalled_items.append({
                "case_id": c.id,
                "patient_id": c.patient_id,
                "patient_name": c.patient.name if c.patient else "Unknown",
                "phone": c.patient.phone if c.patient else "",
                "preferred_language": c.patient.preferred_language if c.patient else "Arabic",
                "hba1c": c.result.value if c.result else None,
                "urgency": c.urgency,
                "urgency_rank": urgency_rank,
                "stage": c.stage,
                "sub_status": c.sub_status,
                "owner_role": c.owner_role,
                "due_at": c.due_at.isoformat() if c.due_at else None,
                "hours_overdue": round(hours_overdue, 1),
                "is_critical_unack": is_critical_unack,
                "pending_tasks": [
                    {"id": t.id, "kind": t.kind, "created_by_rule": t.created_by_rule, "outcome": t.outcome}
                    for t in c.tasks if t.status == "PENDING"
                ],
                "active_barriers": [b.code for b in c.barriers if not b.resolved]
            })

    # Sort by urgency_rank ascending, then hours_overdue descending
    stalled_items.sort(key=lambda x: (x["urgency_rank"], -x["hours_overdue"]))
    return stalled_items

@router.post("/tasks/{id}/complete")
def complete_task(
    id: int,
    payload: TaskCompleteRequest,
    current_user: User = Depends(require_roles("COORD", "GP", "SPEC", "ADMIN")),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.status = "COMPLETED"
    task.outcome = payload.outcome
    task.assigned_user = current_user.id

    db.add(CaseEvent(
        case_id=task.case_id,
        actor_user_id=current_user.id,
        actor_role=current_user.role,
        event_type="TASK_COMPLETED",
        payload={"task_id": task.id, "kind": task.kind, "outcome": payload.outcome},
        evidence_source="PROVIDER_VERIFIED"
    ))

    append_audit_entry(
        db=db,
        actor=current_user.email,
        role=current_user.role,
        action="COMPLETE_TASK",
        object_id=f"TASK-{task.id}",
        detail=f"Completed {task.kind} task: {payload.outcome}"
    )

    db.commit()
    evaluate_case_rules(db, task.case_id)
    return {"status": "COMPLETED", "task_id": task.id}

@router.post("/cases/{id}/barriers")
def record_case_barrier(
    id: str,
    payload: BarrierRecordRequest,
    current_user: User = Depends(require_roles("COORD", "GP", "CHW", "ADMIN")),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    recommended_response = payload.response_code or BARRIER_RESPONSES.get(payload.code, "Initiate case conference.")

    barrier = Barrier(
        case_id=case.id,
        code=payload.code,
        note=payload.note,
        response_code=recommended_response,
        recorded_by=current_user.id,
        ts=utc_now(),
        resolved=False
    )
    db.add(barrier)

    db.add(CaseEvent(
        case_id=case.id,
        actor_user_id=current_user.id,
        actor_role=current_user.role,
        event_type="BARRIER_RECORDED",
        payload={"code": payload.code, "note": payload.note, "response": recommended_response},
        evidence_source="PROVIDER_VERIFIED"
    ))

    append_audit_entry(
        db=db,
        actor=current_user.email,
        role=current_user.role,
        action="RECORD_BARRIER",
        object_id=case.id,
        detail=f"Recorded care barrier: {payload.code}. Action protocol: {recommended_response}"
    )

    db.commit()
    evaluate_case_rules(db, case.id)
    return {
        "barrier_id": barrier.id,
        "code": barrier.code,
        "response_code": barrier.response_code,
        "message": "Care barrier recorded and response strategy activated."
    }

# Micro-Consults
@router.post("/cases/{id}/consults")
def create_micro_consult(
    id: str,
    payload: ConsultCreateRequest,
    current_user: User = Depends(require_roles("GP", "ADMIN")),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    consult = Consult(
        case_id=case.id,
        from_user=current_user.id,
        to_specialty=payload.to_specialty,
        to_user=payload.to_user,
        question=payload.question,
        status="OPEN",
        asked_at=utc_now()
    )
    db.add(consult)

    db.add(CaseEvent(
        case_id=case.id,
        actor_user_id=current_user.id,
        actor_role=current_user.role,
        event_type="CONSULT_REQUESTED",
        payload={"specialty": payload.to_specialty, "question": payload.question},
        evidence_source="PROVIDER_VERIFIED"
    ))

    append_audit_entry(
        db=db,
        actor=current_user.email,
        role=current_user.role,
        action="CREATE_MICRO_CONSULT",
        object_id=case.id,
        detail=f"GP submitted curbside micro-consult to {payload.to_specialty}: {payload.question}"
    )

    db.commit()
    return {"consult_id": consult.id, "status": "OPEN", "specialty": consult.to_specialty}

@router.post("/consults/{id}/answer")
def answer_micro_consult(
    id: int,
    payload: ConsultAnswerRequest,
    current_user: User = Depends(require_roles("SPEC", "ADMIN")),
    db: Session = Depends(get_db)
):
    consult = db.query(Consult).filter(Consult.id == id).first()
    if not consult:
        raise HTTPException(status_code=404, detail="Consult not found")

    consult.answer = payload.answer
    consult.status = "ANSWERED"
    consult.answered_at = utc_now()
    consult.to_user = current_user.id

    # Record advice as clinical evidence on the case
    case = consult.case
    if case:
        db.add(CaseEvent(
            case_id=case.id,
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            event_type="CONSULT_ANSWERED",
            payload={"specialist": current_user.name, "answer": payload.answer},
            evidence_source="PROVIDER_VERIFIED"
        ))

    append_audit_entry(
        db=db,
        actor=current_user.email,
        role=current_user.role,
        action="ANSWER_MICRO_CONSULT",
        object_id=f"CONSULT-{consult.id}",
        detail=f"Specialist answered micro-consult: {payload.answer}"
    )

    db.commit()
    return {"status": "ANSWERED", "consult_id": consult.id, "answer": consult.answer}

@router.post("/consults/{id}/convert")
def convert_consult_to_referral(
    id: int,
    current_user: User = Depends(require_roles("SPEC", "GP", "ADMIN")),
    db: Session = Depends(get_db)
):
    consult = db.query(Consult).filter(Consult.id == id).first()
    if not consult:
        raise HTTPException(status_code=404, detail="Consult not found")

    consult.status = "CONVERTED_TO_REFERRAL"
    db.commit()
    return {"status": "CONVERTED_TO_REFERRAL", "consult_id": consult.id}

@router.post("/rule-firings/{id}/override")
def override_rule_firing(
    id: int,
    payload: RuleOverrideRequest,
    current_user: User = Depends(require_roles("GP", "COORD", "PM", "ADMIN")),
    db: Session = Depends(get_db)
):
    rf = db.query(RuleFiring).filter(RuleFiring.id == id).first()
    if not rf:
        raise HTTPException(status_code=404, detail="Rule firing not found")

    rf.overridden_by = current_user.id
    rf.override_reason = payload.override_reason

    append_audit_entry(
        db=db,
        actor=current_user.email,
        role=current_user.role,
        action="OVERRIDE_RULE_FIRING",
        object_id=f"RULE-FIRING-{rf.id}",
        detail=f"Overrode rule {rf.rule_id} for case {rf.case_id}. Reason: {payload.override_reason}"
    )

    db.commit()
    return {"status": "OVERRIDDEN", "rule_firing_id": rf.id, "reason": rf.override_reason}
