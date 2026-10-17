import hashlib
import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.entities import Case, EvidenceItem, Signoff, CaseEvent, AuditLog
from app.core.audit_chain import compute_audit_hash

def utc_now():
    return datetime.now(timezone.utc)

def initialize_evidence_items(db: Session, case: Case):
    """
    Initializes evidence items for a case from its clinical pathway closure checklist.
    """
    if not case.pathway or not case.pathway.closure_checklist_json:
        return

    checklist = case.pathway.closure_checklist_json
    existing_items = {e.item_code for e in case.evidence}

    for item in checklist:
        code = item.get("item_code")
        if code and code not in existing_items:
            ev = EvidenceItem(
                case_id=case.id,
                item_code=code,
                status="MISSING",
                source="PROVIDER_VERIFIED"
            )
            db.add(ev)
    db.commit()

def check_closure_readiness(db: Session, case_id: str) -> Dict[str, Any]:
    """
    Evaluates evidence checklist, referral status, and dual clinician sign-off.
    Returns: {ready: bool, missing: [{"item": str, "owner": str, "name": str}], errors: List[str]}
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    missing = []
    errors = []

    # 1. Check evidence items
    checklist_meta = {}
    if case.pathway and case.pathway.closure_checklist_json:
        for item in case.pathway.closure_checklist_json:
            checklist_meta[item.get("item_code")] = item

    for ev in case.evidence:
        if ev.status == "MISSING":
            meta = checklist_meta.get(ev.item_code, {})
            missing.append({
                "item": ev.item_code,
                "owner": meta.get("owner_role", "GP"),
                "name": meta.get("name", ev.item_code)
            })

    # 2. Check dual sign-off
    receiver_signoff = db.query(Signoff).filter(Signoff.case_id == case.id, Signoff.role == "RECEIVER").first()
    referrer_signoff = db.query(Signoff).filter(Signoff.case_id == case.id, Signoff.role == "REFERRER").first()

    if not receiver_signoff:
        errors.append("Receiving specialist outcome confirmation sign-off is missing.")
        missing.append({"item": "RECEIVER_SIGNOFF", "owner": "SPEC", "name": "Receiving Specialist Sign-Off"})

    if not referrer_signoff:
        errors.append("Referring clinician (GP) final review sign-off is missing.")
        missing.append({"item": "REFERRER_SIGNOFF", "owner": "GP", "name": "Referring Clinician Sign-Off"})

    if receiver_signoff and referrer_signoff:
        if receiver_signoff.user_id == referrer_signoff.user_id:
            errors.append("Dual sign-off violation: The same user cannot act as both receiving specialist and referring clinician.")

    # 3. Check referrals if any were sent
    for ref in case.referrals:
        if ref.status in ("SENT", "NO_RESPONSE", "NEEDS_INFO"):
            errors.append(f"Referral {ref.id} is still pending response. Escrow handoff unresolved.")
        elif ref.status == "REJECTED":
            errors.append(f"Referral {ref.id} was rejected and has not been resolved.")

    ready = (len(missing) == 0 and len(errors) == 0)
    return {
        "ready": ready,
        "missing": missing,
        "errors": errors
    }

def record_dual_signoff(
    db: Session,
    case_id: str,
    user_id: int,
    user_role: str,
    target_role: str, # RECEIVER or REFERRER
    statement: str
) -> Signoff:
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Verify authorization
    if target_role == "RECEIVER" and user_role not in ("SPEC", "ADMIN"):
        raise HTTPException(status_code=403, detail="Only a receiving specialist (SPEC) can submit the RECEIVER sign-off.")
    if target_role == "REFERRER" and user_role not in ("GP", "ADMIN"):
        raise HTTPException(status_code=403, detail="Only the referring clinician (GP) can submit the REFERRER sign-off.")

    # Check if other signoff already exists with same user
    other_role = "REFERRER" if target_role == "RECEIVER" else "RECEIVER"
    other_signoff = db.query(Signoff).filter(Signoff.case_id == case.id, Signoff.role == other_role).first()
    if other_signoff and other_signoff.user_id == user_id:
        raise HTTPException(
            status_code=409,
            detail="Dual sign-off policy violated: The same individual cannot sign as both receiver and referrer."
        )

    existing = db.query(Signoff).filter(Signoff.case_id == case.id, Signoff.role == target_role).first()
    if existing:
        existing.statement = statement
        existing.user_id = user_id
        existing.ts = utc_now()
        signoff = existing
    else:
        signoff = Signoff(
            case_id=case.id,
            role=target_role,
            user_id=user_id,
            statement=statement,
            ts=utc_now()
        )
        db.add(signoff)

    # Update evidence items if applicable
    item_code = "RECEIVER_CONFIRMATION" if target_role == "RECEIVER" else "REFERRER_SIGNOFF"
    ev = db.query(EvidenceItem).filter(EvidenceItem.case_id == case.id, EvidenceItem.item_code == item_code).first()
    if ev:
        ev.status = "PROVIDED"
        ev.provided_by = user_id
        ev.provided_at = utc_now()

    # Timeline event
    db.add(CaseEvent(
        case_id=case.id,
        actor_user_id=user_id,
        actor_role=user_role,
        event_type=f"SIGNOFF_{target_role}",
        payload={"statement": statement, "target_role": target_role},
        evidence_source="PROVIDER_VERIFIED"
    ))
    db.commit()
    return signoff

def generate_closure_seal(case: Case, disposition: str, reason: str) -> str:
    """
    Computes a cryptographic SHA-256 seal of the full evidence package and signatures.
    """
    ev_summary = [{"code": e.item_code, "status": e.status, "source": e.source} for e in case.evidence]
    sig_summary = [{"role": s.role, "user_id": s.user_id, "statement": s.statement} for s in case.signoffs]
    payload = {
        "case_id": case.id,
        "disposition": disposition,
        "reason": reason,
        "evidence": ev_summary,
        "signoffs": sig_summary,
        "closed_at": utc_now().isoformat()
    }
    raw = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
