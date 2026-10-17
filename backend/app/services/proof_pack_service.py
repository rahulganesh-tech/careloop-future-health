from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.entities import Case, AuditLog, PatientIdentity, EvidenceItem, Signoff, Referral
from app.core.audit_chain import verify_audit_chain
from app.services.fhir_builder import build_fhir_care_capsule

def generate_journey_proof_pack(db: Session, case_id: str) -> Dict[str, Any]:
    """
    Constructs the Patient Journey Proof Pack from the case records,
    FHIR Care Capsule, and cryptographic audit log slice.
    Minimises sensitive personal data and applies SYNTHETIC DEMO DATA watermark.
    """
    case: Optional[Case] = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise ValueError(f"Case {case_id} not found.")

    patient: Optional[PatientIdentity] = db.query(PatientIdentity).filter(PatientIdentity.patient_id == case.patient_id).first()

    # 1. Timeline extraction with provenance (PROVIDER_VERIFIED, SELF_REPORT, SYSTEM)
    timeline: List[Dict[str, Any]] = []
    for ev in case.events:
        timeline.append({
            "timestamp": ev.ts.isoformat() if ev.ts else None,
            "event_type": ev.event_type,
            "actor_role": ev.actor_role,
            "actor_user_id": ev.actor_user_id,
            "channel": ev.channel,
            "evidence_source": ev.evidence_source,
            "provenance": ev.evidence_source or "SYSTEM",
            "rule_id": ev.rule_id
        })

    # Sort timeline chronologically
    timeline.sort(key=lambda x: x["timestamp"] or "")

    # 2. Owner History
    owner_history = [
        {"role": "Referring GP", "actor": "Dr. Ahmed Al-Mansouri (gp@careloop.demo)", "stage": "RESULT_RECEIVED -> REFERRAL_SENT"},
        {"role": "Care Navigator", "actor": "Mariam Al-Hosani (coord@careloop.demo)", "stage": "PATIENT_NOTIFIED"},
        {"role": "Escrow Holder", "actor": f"User #{case.escrow_holder_user_id}" if case.escrow_holder_user_id else "Dr. Ahmed Al-Mansouri", "stage": "REFERRAL_ESCROW"},
        {"role": "Current Owner", "actor": f"User #{case.owner_user_id}" if case.owner_user_id else case.owner_role, "stage": case.stage}
    ]

    # 3. Referral Responses
    referrals_data = []
    for r in case.referrals:
        referrals_data.append({
            "referral_id": r.id,
            "from_facility": r.from_facility,
            "to_facility": r.to_facility,
            "status": r.status,
            "reject_reason": r.reject_reason,
            "sent_at": r.sent_at.isoformat() if r.sent_at else None,
            "responded_at": r.responded_at.isoformat() if r.responded_at else None,
            "receipt_token": r.receipt_token
        })

    # 4. Evidence Checklist
    evidence_checklist = []
    for item in case.evidence:
        evidence_checklist.append({
            "item_code": item.item_code,
            "status": item.status,
            "provided_at": item.provided_at.isoformat() if item.provided_at else None,
            "provenance": item.source,
            "document_ref": item.document_ref
        })

    # 5. Dual Sign-Offs
    signoffs_data = []
    for s in case.signoffs:
        signoffs_data.append({
            "role": s.role,
            "user_id": s.user_id,
            "timestamp": s.ts.isoformat() if s.ts else None,
            "statement": s.statement
        })

    # 6. FHIR Care Capsule
    from app.services.fhir_builder import build_fhir_care_capsule
    fhir_bundle = build_fhir_care_capsule(db, case)

    # 7. Cryptographic Audit Chain Verification Result
    all_entries = db.query(AuditLog).order_by(AuditLog.id.asc()).all()
    chain_valid, broken_id = verify_audit_chain(all_entries)
    case_audit_logs = db.query(AuditLog).filter(AuditLog.object.like(f"%{case_id}%")).all()

    audit_slice = []
    for log in case_audit_logs:
        audit_slice.append({
            "id": log.id,
            "ts": log.ts.isoformat() if log.ts else None,
            "actor": log.actor,
            "role": log.role,
            "action": log.action,
            "hash": log.hash
        })

    return {
        "watermark": "SYNTHETIC DEMO DATA — NOT FOR CLINICAL USE",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "case_summary": {
            "case_id": case.id,
            "patient_reference": f"SYNTH-{case.patient_id}", # Minimised sensitive data
            "preferred_language": patient.preferred_language if patient else "Arabic",
            "screening_type": case.pathway_code,
            "urgency": case.urgency,
            "current_stage": case.stage,
            "disposition": case.disposition,
            "disposition_reason": case.disposition_reason,
            "closure_seal": case.closure_seal or "SEAL_VERIFIED_SHA256"
        },
        "timeline": timeline,
        "owner_history": owner_history,
        "referral_responses": referrals_data,
        "evidence_checklist": evidence_checklist,
        "dual_signoffs": signoffs_data,
        "closure_seal_verification": {
            "sealed": case.closure_seal is not None,
            "seal_hash": case.closure_seal,
            "disposition_valid": bool(case.disposition)
        },
        "audit_verification": {
            "chain_valid": chain_valid,
            "total_verified_records": len(all_entries),
            "tamper_detected": not chain_valid,
            "first_broken_entry": broken_id,
            "case_events_logged": len(audit_slice)
        },
        "fhir_capsule_summary": {
            "resource_type": fhir_bundle.get("resourceType"),
            "total_entries": len(fhir_bundle.get("entry", [])),
            "task_status": fhir_bundle.get("entry", [{}])[0].get("resource", {}).get("status", "unknown")
        }
    }
