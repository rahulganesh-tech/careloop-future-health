from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, require_roles
from app.models.entities import User, PatientIdentity
from app.services.recovery_simulator import (
    run_recovery_simulation, approve_and_apply_simulation, load_assumptions
)
from app.services.barrier_analytics import get_barrier_analytics
from app.services.proof_pack_service import generate_journey_proof_pack
from app.services.capacity_router import (
    get_capacity_routing_suggestions, apply_capacity_rerouting
)

router = APIRouter(tags=["Prompt 7B Recovery, Proof Pack & Capacity"])

# 1. Recovery Simulator Endpoints
@router.get("/recovery/assumptions")
def get_simulation_assumptions_endpoint(
    current_user: User = Depends(get_current_user)
):
    """Returns versioned simulation assumptions configuration."""
    return load_assumptions()

@router.post("/recovery/simulate")
def simulate_recovery_endpoint(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("PM", "COORD", "ADMIN"))
):
    """
    Executes deterministic Recovery Simulation for a stalled case or scenario template.
    Strictly NO ML / LLM hallucination.
    Does NOT modify the case.
    """
    case_id = payload.get("case_id")
    scenario_template = payload.get("scenario_template")
    custom_options = payload.get("custom_options")
    try:
        return run_recovery_simulation(
            db=db,
            user=current_user,
            case_id=case_id,
            scenario_template=scenario_template,
            custom_options=custom_options
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/recovery/apply")
def apply_simulation_action_endpoint(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("PM", "COORD", "ADMIN"))
):
    """
    Applies an approved simulation action to the real system.
    Leaves simulation mode, creates a real Task linked to the run token, and logs to audit trail.
    """
    run_id = payload.get("run_id")
    option_code = payload.get("option_code")
    review_notes = payload.get("review_notes", "Clinician approved simulated recovery action.")
    if not run_id or not option_code:
        raise HTTPException(status_code=422, detail="Missing run_id or option_code.")

    try:
        return approve_and_apply_simulation(
            db=db,
            user=current_user,
            run_id=run_id,
            option_code=option_code,
            review_notes=review_notes
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 2. Barrier-to-Outcome Analytics Endpoint
@router.get("/analytics/barriers")
def get_barrier_analytics_endpoint(
    facility: Optional[str] = Query(None),
    language: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
    barrier_code: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns disaggregated barrier frequency, resolution rate, median duration,
    referral completion rate, n<10 warnings, and non-causal disclaimer.
    """
    return get_barrier_analytics(
        db=db,
        facility_code=facility,
        language=language,
        channel=channel,
        barrier_code=barrier_code
    )

# 3. Patient Journey Proof Pack Endpoint
@router.get("/cases/{case_id}/proof-pack")
def get_case_proof_pack_endpoint(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    One-click Patient Journey Proof Pack built from FHIR Care Capsule and Cryptographic Audit Log.
    Watermarked with SYNTHETIC DEMO DATA.
    """
    try:
        return generate_journey_proof_pack(db=db, case_id=case_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# 4. Capacity-Aware Routing Endpoints
@router.get("/routing/suggestions")
def get_routing_suggestions_endpoint(
    case_id: str = Query(...),
    specialty: str = Query("Endocrinology"),
    max_distance_km: float = Query(25.0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("GP", "COORD", "PM", "ADMIN"))
):
    """
    Suggests participating secondary providers with open slot wait, distance,
    and data freshness indicator. Never invents an unverified slot.
    """
    try:
        return get_capacity_routing_suggestions(
            db=db,
            case_id=case_id,
            specialty=specialty,
            max_distance_km=max_distance_km
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/routing/apply")
def apply_rerouting_endpoint(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("GP", "COORD", "ADMIN"))
):
    """
    Applies capacity-aware rerouting. Preserves escrow ownership with sending GP until accepted.
    """
    case_id = payload.get("case_id")
    target_facility = payload.get("target_facility")
    rationale = payload.get("rationale", "Capacity-aware re-routing due to slot unavailability.")
    if not case_id or not target_facility:
        raise HTTPException(status_code=422, detail="Missing case_id or target_facility.")

    try:
        return apply_capacity_rerouting(
            db=db,
            user=current_user,
            case_id=case_id,
            target_facility_code=target_facility,
            rationale=rationale
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 5. Patient Contact Preferences Endpoint
@router.put("/patients/{patient_id}/preferences")
def update_patient_preferences_endpoint(
    patient_id: str,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Updates contact window, accessibility needs, and channel consent.
    Decoupled from understanding (teach-back) and acknowledgment.
    """
    patient = db.query(PatientIdentity).filter(PatientIdentity.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found.")

    if "contact_window" in payload:
        patient.contact_window = payload["contact_window"]
    if "accessibility_needs" in payload:
        patient.accessibility_needs = payload["accessibility_needs"]
    if "consent_sms" in payload:
        patient.consent_sms = bool(payload["consent_sms"])
    if "consent_whatsapp" in payload:
        patient.consent_whatsapp = bool(payload["consent_whatsapp"])
    if "consent_voice" in payload:
        patient.consent_voice = bool(payload["consent_voice"])

    db.commit()
    db.refresh(patient)

    return {
        "status": "UPDATED",
        "patient_id": patient.patient_id,
        "contact_window": patient.contact_window,
        "accessibility_needs": patient.accessibility_needs,
        "consents": {
            "sms": patient.consent_sms,
            "whatsapp": patient.consent_whatsapp,
            "voice": patient.consent_voice
        }
    }
