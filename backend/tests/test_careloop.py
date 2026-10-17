import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.entities import Case, Referral, AuditLog, User, EvidenceItem, Signoff, Task
from app.services.score_calculator import calculate_loop_integrity_score
from app.core.audit_chain import verify_audit_chain
from seed_data import seed

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_database():
    seed()

def test_login_and_otp_flow():
    # 1. Wrong password returns 401
    resp = client.post("/auth/login", json={"email": "gp@careloop.demo", "password": "wrong"})
    assert resp.status_code == 401

    # 2. Correct password returns stage 'otp'
    resp = client.post("/auth/login", json={"email": "gp@careloop.demo", "password": "demo123"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["stage"] == "otp"
    otp_token = data["token"]

    # 3. OTP-stage token cannot call general API (401)
    me_resp = client.get("/auth/me", headers={"Authorization": f"Bearer {otp_token}"})
    assert me_resp.status_code == 401

    # 4. Verify OTP with correct code '482913' returns full token
    otp_resp = client.post("/auth/otp", json={"email": "gp@careloop.demo", "otp_code": "482913"})
    assert otp_resp.status_code == 200
    assert otp_resp.json()["stage"] == "full"
    full_token = otp_resp.json()["token"]

    # 5. Full token succeeds on API
    me_resp = client.get("/auth/me", headers={"Authorization": f"Bearer {full_token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "gp@careloop.demo"

def test_role_authorization():
    # Authenticate admin
    resp = client.post("/auth/otp", json={"email": "admin@careloop.demo", "otp_code": "482913"})
    admin_token = resp.json()["token"]

    # Admin cannot perform clinical review (GP only) -> 403
    review_resp = client.post(
        "/cases/CASE-1004/review",
        json={"rationale": "Test rationale", "next_step": "REFERRAL"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert review_resp.status_code == 403
    assert "Your role (ADMIN) cannot do this" in review_resp.json()["detail"]

def test_state_machine_and_referral_conflict_409():
    # Authenticate GP
    resp = client.post("/auth/otp", json={"email": "gp@careloop.demo", "otp_code": "482913"})
    gp_token = resp.json()["token"]

    # Trying to book appointment for CASE-1008 (which has referral REF-031 in SENT status)
    # Must return 409 Conflict
    book_resp = client.post(
        "/cases/CASE-1008/appointments",
        json={"facility_code": "DEC", "slot_at": datetime.now(timezone.utc).isoformat()},
        headers={"Authorization": f"Bearer {gp_token}"}
    )
    assert book_resp.status_code == 409
    assert "must be ACCEPTED before an appointment can be booked" in book_resp.json()["detail"]

def test_ownership_escrow():
    db = SessionLocal()
    try:
        # Check CASE-1008 where REF-031 is SENT
        c = db.query(Case).filter(Case.id == "CASE-1008").first()
        assert c.escrow_holder_user_id is not None # Sender holds escrow!
        
        # Check CASE-1012 where REF-034 was REJECTED
        c_rej = db.query(Case).filter(Case.id == "CASE-1012").first()
        assert c_rej.escrow_holder_user_id is not None # Returned to sender!
    finally:
        db.close()

def test_evidence_gate_blocks_closure():
    # Authenticate GP
    resp = client.post("/auth/otp", json={"email": "gp@careloop.demo", "otp_code": "482913"})
    gp_token = resp.json()["token"]

    # CASE-1001 only has REFERRER_SIGNOFF missing
    # Attempting to close should return 400 with missing details
    close_resp = client.post(
        "/cases/CASE-1001/close",
        json={"disposition": "CLINICALLY_RESOLVED", "reason": "Patient stable on medication."},
        headers={"Authorization": f"Bearer {gp_token}"}
    )
    assert close_resp.status_code == 400
    assert "missing" in close_resp.json()["detail"].lower()

def test_dual_signoff_rejection_for_same_user():
    # Authenticate GP
    resp = client.post("/auth/otp", json={"email": "gp@careloop.demo", "otp_code": "482913"})
    gp_token = resp.json()["token"]

    # CASE-1001 already has specialist signoff
    # If the same specialist tries to sign as referrer, or same user signs both, reject!
    db = SessionLocal()
    try:
        spec_sig = db.query(Signoff).filter(Signoff.case_id == "CASE-1001", Signoff.role == "RECEIVER").first()
        assert spec_sig is not None
        spec_user_id = spec_sig.user_id
    finally:
        db.close()

    # Now login as specialist
    resp_spec = client.post("/auth/otp", json={"email": "specialist@careloop.demo", "otp_code": "482913"})
    spec_token = resp_spec.json()["token"]

    # Specialist cannot sign as REFERRER
    sig_resp = client.post(
        "/cases/CASE-1001/signoff",
        json={"role": "REFERRER", "statement": "I am signing as referrer too"},
        headers={"Authorization": f"Bearer {spec_token}"}
    )
    assert sig_resp.status_code in (403, 409)

def test_audit_log_cryptographic_verification():
    db = SessionLocal()
    try:
        entries = db.query(AuditLog).order_by(AuditLog.id.asc()).all()
        intact, broken = verify_audit_chain(entries)
        assert intact is True
        assert broken is None

        # Simulate tampering on entry 3
        tampered_entry = entries[2]
        original_action = tampered_entry.action
        tampered_entry.action = "TAMPERED_ACTION"
        
        tampered_intact, tampered_broken = verify_audit_chain(entries)
        assert tampered_intact is False
        assert tampered_broken == tampered_entry.id

        # Restore
        tampered_entry.action = original_action
    finally:
        db.close()

def test_demo_journey_score_progression_64_72_76_78():
    """
    Validates exact score progression specified in Challenge Demo:
    64 -> 72 -> 76 -> 78 and referral completion 70% -> 73%
    """
    db = SessionLocal()
    try:
        # Step 0: Baseline score is 64
        s0 = calculate_loop_integrity_score(db)
        assert s0["score"] == 64
        assert s0["metrics"]["referral_completion_rate"] == 70.0

        # Step 1: Coordinator calls CASE-1004, records LANGUAGE, patient acknowledges in Arabic
        # Patient PT-0004 acknowledges
        c_1004 = db.query(Case).filter(Case.id == "CASE-1004").first()
        c_1004.sub_status = "ACKNOWLEDGED"
        # Clinical review is due within 48h of case opening (Prompt 4 Pathway protocol)
        c_1004.due_at = c_1004.opened_at + timedelta(hours=48)
        from app.models.entities import CaseEvent, Barrier
        db.add(Barrier(
            case_id="CASE-1004",
            code="LANGUAGE",
            note="Patient spoke Arabic only, explained via Arabic voice script",
            response_code="SWITCH_LANGUAGE_AR",
            resolved=True
        ))
        db.add(CaseEvent(
            case_id="CASE-1004",
            actor_role="PATIENT",
            event_type="PATIENT_ACKNOWLEDGED",
            channel="VOICE",
            evidence_source="SELF_REPORT"
        ))
        db.commit()

        # Score should increase from 64 to 72 (+8 pts because critical unack penalty is cleared!)
        s1 = calculate_loop_integrity_score(db)
        assert s1["score"] == 72

        # Step 2: GP resubmits REF-034 with lipid panel, specialist accepts
        ref_034 = db.query(Referral).filter(Referral.id == "REF-034").first()
        ref_034.status = "ACCEPTED"
        c_1012 = db.query(Case).filter(Case.id == "CASE-1012").first()
        c_1012.stage = "RECEIVER_RESPONSE"
        c_1012.sub_status = "ACCEPTED"
        c_1012.escrow_holder_user_id = None
        db.commit()

        # Score should increase from 72 to 76 (+4 pts because unowned handoffs decreased from 2 to 1!)
        s2 = calculate_loop_integrity_score(db)
        assert s2["score"] == 76

        # Step 3: GP signs off CASE-1001, case closes as CLINICALLY_RESOLVED
        gp_user = db.query(User).filter(User.role == "GP").first()
        db.add(Signoff(
            case_id="CASE-1001",
            role="REFERRER",
            user_id=gp_user.id,
            statement="Referring GP final sign-off completed."
        ))
        ev_sig = db.query(EvidenceItem).filter(
            EvidenceItem.case_id == "CASE-1001",
            EvidenceItem.item_code == "REFERRER_SIGNOFF"
        ).first()
        if ev_sig:
            ev_sig.status = "PROVIDED"
        
        c_1001 = db.query(Case).filter(Case.id == "CASE-1001").first()
        c_1001.stage = "CLOSURE_REVIEW"
        c_1001.sub_status = "CLOSED"
        c_1001.closed_at = datetime.now(timezone.utc)
        c_1001.disposition = "CLINICALLY_RESOLVED"
        
        # REF-028 becomes COMPLETED upon case closure!
        ref_028 = db.query(Referral).filter(Referral.id == "REF-028").first()
        if ref_028:
            ref_028.status = "COMPLETED"
        
        # Now total completed referrals = 22 out of 30!
        # Completion rate = 22 / 30 = 73.3% -> shortfall = 80 - 73.3 = 6.7%, penalty = 6 // 2 = 3
        # Previously penalty was 5. Score increases by 2 points: 76 + 2 = 78!
        db.commit()

        s3 = calculate_loop_integrity_score(db)
        assert s3["score"] == 78
        assert s3["metrics"]["referral_completion_rate"] == 73.3
    finally:
        db.close()

def test_fhir_care_capsule_bundle():
    resp = client.get("/fhir/Bundle/CASE-1001")
    assert resp.status_code == 200
    bundle = resp.json()
    assert bundle["resourceType"] == "Bundle"
    assert bundle["type"] == "collection"

    # Find Task resource
    task_entries = [e for e in bundle["entry"] if e["resource"]["resourceType"] == "Task"]
    assert len(task_entries) > 0
    task_res = task_entries[0]["resource"]
    assert "User ID" in task_res["owner"]["display"]

# ==============================================================================
# Prompt 7B Tests: Recovery Simulator, Barrier Analytics, Proof Pack & Capacity
# ==============================================================================

def test_recovery_simulator_never_changes_case_state():
    """Verify simulation mode cannot alter any real case attributes."""
    db = SessionLocal()
    try:
        case_before = db.query(Case).filter(Case.id == "CASE-1004").first()
        orig_stage = case_before.stage
        orig_owner = case_before.owner_user_id
        orig_due = case_before.due_at

        # Login as PM
        pm_resp = client.post("/auth/otp", json={"email": "pm@careloop.demo", "otp_code": "482913"})
        pm_token = pm_resp.json()["token"]

        # Run simulation
        sim_resp = client.post(
            "/recovery/simulate",
            json={"case_id": "CASE-1004"},
            headers={"Authorization": f"Bearer {pm_token}"}
        )
        assert sim_resp.status_code == 200
        data = sim_resp.json()
        assert "run_token" in data
        assert len(data["options"]) > 0

        # Assert case in DB is 100% UNCHANGED
        case_after = db.query(Case).filter(Case.id == "CASE-1004").first()
        assert case_after.stage == orig_stage
        assert case_after.owner_user_id == orig_owner
        assert case_after.due_at == orig_due
    finally:
        db.close()

def test_recovery_simulator_deterministic_reproducibility():
    """Verify identical inputs produce identical simulation results (reproducible, no ML)."""
    pm_resp = client.post("/auth/otp", json={"email": "pm@careloop.demo", "otp_code": "482913"})
    pm_token = pm_resp.json()["token"]

    sim1 = client.post(
        "/recovery/simulate",
        json={"scenario_template": "CRITICAL_UNACK"},
        headers={"Authorization": f"Bearer {pm_token}"}
    ).json()

    sim2 = client.post(
        "/recovery/simulate",
        json={"scenario_template": "CRITICAL_UNACK"},
        headers={"Authorization": f"Bearer {pm_token}"}
    ).json()

    # Verify baseline and recommendations match identically
    assert sim1["baseline"]["projected_completion_rate"] == sim2["baseline"]["projected_completion_rate"]
    assert sim1["recommendation"]["recommended_option_code"] == sim2["recommendation"]["recommended_option_code"]
    assert sim1["recommendation"]["delta_completion"] == sim2["recommendation"]["delta_completion"]
    assert len(sim1["options"]) == len(sim2["options"])
    for i in range(len(sim1["options"])):
        assert sim1["options"][i]["option_code"] == sim2["options"][i]["option_code"]
        assert sim1["options"][i]["projected_completion_rate"] == sim2["options"][i]["projected_completion_rate"]
        assert sim1["options"][i]["label"] == "ILLUSTRATIVE - SIMULATED"

def test_recovery_simulator_apply_requires_approval_and_links_task():
    """Verify Apply action creates real task with link to run token."""
    pm_resp = client.post("/auth/otp", json={"email": "pm@careloop.demo", "otp_code": "482913"})
    pm_token = pm_resp.json()["token"]

    # 1. Run simulation
    sim_data = client.post(
        "/recovery/simulate",
        json={"case_id": "CASE-1004"},
        headers={"Authorization": f"Bearer {pm_token}"}
    ).json()
    run_id = sim_data["run_id"]
    run_token = sim_data["run_token"]

    # 2. Apply action
    apply_resp = client.post(
        "/recovery/apply",
        json={
            "run_id": run_id,
            "option_code": "CHW_VISIT",
            "review_notes": "Programme Manager approved field intervention"
        },
        headers={"Authorization": f"Bearer {pm_token}"}
    )
    assert apply_resp.status_code == 200
    res = apply_resp.json()
    assert res["status"] == "APPLIED"
    assert res["run_token"] == run_token
    assert res["task_id"] is not None

    # Check task exists and has link to run
    db = SessionLocal()
    try:
        task = db.query(Task).filter(Task.id == res["task_id"]).first()
        assert task is not None
        assert run_token in task.created_by_rule
        assert res["approved_option_code"] == "CHW_VISIT"
    finally:
        db.close()

def test_patient_journey_proof_pack_matches_timeline_and_audit():
    """Verify proof pack produces comprehensive timeline, provenance, and valid audit verification."""
    gp_resp = client.post("/auth/otp", json={"email": "gp@careloop.demo", "otp_code": "482913"})
    gp_token = gp_resp.json()["token"]

    resp = client.get("/cases/CASE-1001/proof-pack", headers={"Authorization": f"Bearer {gp_token}"})
    assert resp.status_code == 200
    pack = resp.json()

    assert pack["watermark"] == "SYNTHETIC DEMO DATA — NOT FOR CLINICAL USE"
    assert pack["case_summary"]["case_id"] == "CASE-1001"
    assert "timeline" in pack
    assert len(pack["timeline"]) > 0
    # Provenance field present on events
    assert "provenance" in pack["timeline"][0]
    assert len(pack["owner_history"]) > 0
    assert "audit_verification" in pack
    assert pack["audit_verification"]["chain_valid"] is True
    assert pack["audit_verification"]["tamper_detected"] is False

def test_capacity_routing_preserves_owner():
    """Verify capacity routing suggests slots and maintains sender escrow ownership."""
    gp_resp = client.post("/auth/otp", json={"email": "gp@careloop.demo", "otp_code": "482913"})
    gp_token = gp_resp.json()["token"]

    # Get suggestions
    sug_resp = client.get("/routing/suggestions?case_id=CASE-1012&specialty=Endocrinology", headers={"Authorization": f"Bearer {gp_token}"})
    assert sug_resp.status_code == 200
    sug_data = sug_resp.json()
    assert len(sug_data["providers"]) > 0
    assert sug_data["requires_clinician_approval"] is True
    # Verify data freshness tag exists
    assert sug_data["providers"][0]["data_freshness"] in ["LIVE", "MANUAL", "SIMULATED"]

    # Apply rerouting to CCAD
    reroute_resp = client.post(
        "/routing/apply",
        json={"case_id": "CASE-1012", "target_facility": "CCAD", "rationale": "DEC operating at capacity limit."},
        headers={"Authorization": f"Bearer {gp_token}"}
    )
    assert reroute_resp.status_code == 200
    assert reroute_resp.json()["status"] == "REROUTED"

    # Verify sender keeps escrow ownership
    db = SessionLocal()
    try:
        c = db.query(Case).filter(Case.id == "CASE-1012").first()
        assert c.stage == "REFERRAL_SENT"
        assert c.escrow_holder_user_id is not None
    finally:
        db.close()

def test_barrier_analytics_reconciles_and_shows_denominators():
    """Verify barrier analytics returns denominators, resolution rates, and n<10 warnings."""
    pm_resp = client.post("/auth/otp", json={"email": "pm@careloop.demo", "otp_code": "482913"})
    pm_token = pm_resp.json()["token"]

    resp = client.get("/analytics/barriers", headers={"Authorization": f"Bearer {pm_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "summary" in data
    assert data["summary"]["total_barriers"] > 0
    assert "barriers" in data
    for b in data["barriers"]:
        assert "numerator" in b
        assert "denominator" in b
        assert b["numerator"] <= b["denominator"]
        assert "low_sample_warning" in b
        assert "median_time_to_resolve_hours" in b
    assert "disclaimer" in data
    assert "associations" in data["disclaimer"].lower()

def test_kpi_metrics_show_denominators_and_value_types():
    """Verify every KPI shows denominator and carries value_type badge."""
    pm_resp = client.post("/auth/otp", json={"email": "pm@careloop.demo", "otp_code": "482913"})
    pm_token = pm_resp.json()["token"]
    dash_resp = client.get("/dashboard", headers={"Authorization": f"Bearer {pm_token}"})
    assert dash_resp.status_code == 200
    data = dash_resp.json()
    metrics = data["metrics"]

    assert "barrier_resolution_numerator" in metrics
    assert "barrier_resolution_denominator" in metrics
    assert "value_types" in metrics
    assert metrics["value_types"]["score"] == "ACTUAL"
    assert metrics["value_types"]["target_completion_rate"] == "TARGET"
    assert metrics["value_types"]["coordinator_minutes_per_journey"] == "ESTIMATED"

