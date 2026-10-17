from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import AuditLog, Case, PatientIdentity, Referral, Task as DbTask, User
from app.api.deps import get_current_user, require_roles
from app.core.audit_chain import verify_audit_chain
from app.services.fhir_builder import build_fhir_care_capsule

router = APIRouter(tags=["Audit Trail & FHIR Interoperability"])

@router.get("/audit")
def list_audit_trail(
    case_id: Optional[str] = None,
    limit: int = 100,
    current_user: User = Depends(require_roles("AUDITOR", "PM", "ADMIN")),
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    if case_id:
        query = query.filter(AuditLog.object == case_id)
    entries = query.order_by(AuditLog.id.desc()).limit(limit).all()

    return [
        {
            "id": e.id,
            "ts": e.ts.isoformat(),
            "actor": e.actor,
            "role": e.role,
            "action": e.action,
            "object": e.object,
            "detail": e.detail,
            "prev_hash": e.prev_hash,
            "hash": e.hash
        }
        for e in entries
    ]

@router.get("/audit/verify")
def verify_audit_chain_endpoint(
    current_user: User = Depends(require_roles("AUDITOR", "PM", "ADMIN")),
    db: Session = Depends(get_db)
):
    """
    Verifies that all entries in the append-only audit log are SHA-256 hash-chained and intact.
    Detects if any entry has been altered, deleted, or tampered with.
    """
    all_entries = db.query(AuditLog).order_by(AuditLog.id.asc()).all()
    intact, first_broken = verify_audit_chain(all_entries)

    return {
        "intact": intact,
        "total_entries": len(all_entries),
        "first_broken_entry": first_broken,
        "status_message": "All audit log entries cryptographically intact and validated." if intact else f"Tampering or chain break detected at entry ID: {first_broken}"
    }

# FHIR Interoperability Endpoints
@router.get("/fhir/Bundle/{case_id}")
def get_fhir_bundle(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return build_fhir_care_capsule(db, case)

@router.get("/fhir/Patient/{id}")
def get_fhir_patient(id: str, db: Session = Depends(get_db)):
    patient = db.query(PatientIdentity).filter(PatientIdentity.patient_id == id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {
        "resourceType": "Patient",
        "id": patient.patient_id,
        "name": [{"use": "official", "text": patient.name}],
        "birthDate": patient.dob,
        "telecom": [{"system": "phone", "value": patient.phone}]
    }

@router.get("/fhir/ServiceRequest/{id}")
def get_fhir_service_request(id: str, db: Session = Depends(get_db)):
    ref = db.query(Referral).filter(Referral.id == id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="ServiceRequest not found")
    return {
        "resourceType": "ServiceRequest",
        "id": ref.id,
        "status": "active" if ref.status in ("SENT", "ACCEPTED") else "completed",
        "intent": "order",
        "priority": "urgent" if ref.urgency == "CRITICAL" else "routine",
        "subject": {"reference": f"Patient/{ref.case.patient_id}" if ref.case else "N/A"},
        "reasonCode": [{"text": ref.reason}],
        "performer": [{"display": ref.to_facility}]
    }

@router.get("/fhir/Task/{id}")
def get_fhir_task(id: str, db: Session = Depends(get_db)):
    task = db.query(DbTask).filter(DbTask.id == id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {
        "resourceType": "Task",
        "id": f"Task/{task.id}",
        "status": "completed" if task.status == "COMPLETED" else "in-progress",
        "intent": "plan",
        "for": {"reference": f"Case/{task.case_id}"},
        "owner": {"display": f"Role: {task.assigned_role}"}
    }
