import json
import os
import random
from datetime import datetime, timezone, timedelta
from app.db.session import SessionLocal, Base, engine
from app.models.entities import (
    Facility, User, PatientIdentity, ScreeningResult, Pathway,
    Case, CaseEvent, EvidenceItem, Signoff, Referral, Appointment,
    Message, TeachBack, Task, Barrier, Consult, Rule, RuleFiring, AuditLog
)
from app.core.security import get_password_hash
from app.core.audit_chain import compute_audit_hash
from app.services.rules_engine import load_rules_from_disk
from app.services.score_calculator import calculate_loop_integrity_score

def utc_now():
    return datetime.now(timezone.utc)

def seed():
    print("Clearing existing tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    now = utc_now()

    try:
        # 1. Load Rules from disk
        load_rules_from_disk(db)

        # 2. Facilities
        facilities_data = [
            {"code": "LAB-01", "name": "Demo Central Lab", "type": "LAB", "integration_mode": "FHIR", "capacity_status": "AVAILABLE", "specialties": ["Pathology"], "distance_km": 2.0, "data_freshness": "LIVE"},
            {"code": "CLA", "name": "Clinic Alpha (Screening & Primary)", "type": "PRIMARY", "integration_mode": "FHIR", "capacity_status": "AVAILABLE", "specialties": ["Primary Care"], "distance_km": 3.5, "data_freshness": "LIVE"},
            {"code": "CLB", "name": "Clinic Bravo (Primary Care)", "type": "PRIMARY", "integration_mode": "PORTAL", "capacity_status": "AVAILABLE", "specialties": ["Primary Care"], "distance_km": 7.0, "data_freshness": "MANUAL"},
            {"code": "DEC", "name": "Demo Endocrinology Centre", "type": "SPECIALIST", "integration_mode": "MANUAL", "capacity_status": "FULL", "specialties": ["Endocrinology"], "distance_km": 4.2, "data_freshness": "LIVE"},
            {"code": "CCAD", "name": "Cleveland Clinic Abu Dhabi - Endocrine", "type": "SPECIALIST", "integration_mode": "FHIR", "capacity_status": "AVAILABLE", "specialties": ["Endocrinology", "Cardiology"], "distance_km": 11.5, "data_freshness": "LIVE"},
            {"code": "SEHA-AAM", "name": "Sheikh Shakhbout Medical City (SSMC)", "type": "SPECIALIST", "integration_mode": "PORTAL", "capacity_status": "AVAILABLE", "specialties": ["Endocrinology"], "distance_km": 16.8, "data_freshness": "MANUAL"},
            {"code": "NMC-ZAYED", "name": "Zayed Military Hospital - Endocrine", "type": "SPECIALIST", "integration_mode": "MANUAL", "capacity_status": "HIGH_LOAD", "specialties": ["Endocrinology"], "distance_km": 21.0, "data_freshness": "SIMULATED"}
        ]
        facilities = {}
        for f_dict in facilities_data:
            f = Facility(**f_dict)
            db.add(f)
            facilities[f.code] = f
        db.commit()

        # 3. Users (password "demo123", OTP "482913")
        hashed_pwd = get_password_hash("demo123")
        users_data = [
            {"email": "pm@careloop.demo", "name": "Noura Al-Zaabi", "role": "PM", "facility_code": None},
            {"email": "screening@careloop.demo", "name": "Fatima Al-Hammadi", "role": "SCR", "facility_code": "CLA"},
            {"email": "coord@careloop.demo", "name": "Mariam Al-Hosani", "role": "COORD", "facility_code": None},
            {"email": "gp@careloop.demo", "name": "Dr. Ahmed Al-Mansouri", "role": "GP", "facility_code": "CLA"},
            {"email": "specialist@careloop.demo", "name": "Dr. Tariq Al-Hashimi", "role": "SPEC", "facility_code": "DEC"},
            {"email": "chw@careloop.demo", "name": "Zainab Al-Baloushi", "role": "CHW", "facility_code": "CLA"},
            {"email": "admin@careloop.demo", "name": "Sultan Al-Dhaheri", "role": "ADMIN", "facility_code": None},
            {"email": "auditor@careloop.demo", "name": "Hamad Al-Kaabi", "role": "AUDITOR", "facility_code": None}
        ]
        users = {}
        for u_dict in users_data:
            u = User(
                email=u_dict["email"],
                name=u_dict["name"],
                role=u_dict["role"],
                facility_code=u_dict["facility_code"],
                password_hash=hashed_pwd,
                otp_required=True,
                active=True
            )
            db.add(u)
            users[u.role] = u
        db.commit()
        for u in db.query(User).all():
            users[u.role] = u

        # 4. Pathway DIAB-HBA1C
        pathway_path = os.path.join(os.path.dirname(__file__), "config", "pathway_diab_hba1c.json")
        with open(pathway_path, "r", encoding="utf-8") as f:
            p_json = json.load(f)
        
        pathway = Pathway(
            code=p_json["code"],
            name=p_json["name"],
            protocol_json=p_json["protocol_json"],
            closure_checklist_json=p_json["closure_checklist_json"],
            sla_json=p_json["sla_json"],
            version=p_json["version"],
            approved_by=p_json["approved_by"]
        )
        db.add(pathway)
        db.commit()

        # 5. Generate 150 Synthetic Patients:
        # Arabic 45%, English 30%, Hindi 15%, Urdu/Tagalog 10% (Other); 20% without smartphone
        languages_pool = ["Arabic"] * 45 + ["English"] * 30 + ["Hindi"] * 15 + ["Other"] * 10
        patients = []
        for i in range(1, 151):
            pid = f"PT-{i:04d}"
            lang = languages_pool[(i - 1) % len(languages_pool)]
            has_smart = False if (i % 5 == 0) else True # Exactly 20% without smartphone
            dob = "1975-04-12" if i in (1, 4, 12, 20) else f"19{65 + (i % 30):02d}-{(i % 12) + 1:02d}-{(i % 28) + 1:02d}"
            name = f"Patient {pid}"
            if lang == "Arabic":
                name = f"مريض {pid}"
            contact_win = "MORNING_9_12" if i % 3 == 0 else ("AFTERNOON_12_17" if i % 3 == 1 else "EVENING_17_20")
            access_needs = {
                "large_text": bool(i % 4 == 0),
                "audio_notes": bool(i % 6 == 0),
                "interpreter_needed": bool(lang not in ("Arabic", "English"))
            }
            patient = PatientIdentity(
                patient_id=pid,
                name=name,
                dob=dob,
                phone=f"+97150{1000000 + i}",
                preferred_language=lang,
                preferred_channel="SMS" if not has_smart else "WHATSAPP",
                consent_sms=True,
                consent_whatsapp=has_smart,
                consent_voice=True,
                has_smartphone=has_smart,
                contact_window=contact_win,
                accessibility_needs=access_needs
            )
            db.add(patient)
            patients.append(patient)
        db.commit()

        # 6. Screening Results & Cases
        # Total 60 actionable cases in last 60 days
        # 20 historical closed cases with full evidence and dual sign-off
        # 40 active cases across various stages
        # Exact requirements:
        # - Overdue active cases (non-critical): 5
        # - Unowned handoffs: 2 (REF-031 and REF-034)
        # - Critical unacknowledged >24h: 1 (CASE-1004, HbA1c 11.2%, SMS delivered 30 hours ago, Arabic speaker)
        # - Total referrals sent: 30; completed: 21 (70% completion)
        # - Closures without complete evidence: 0

        # We will build:
        # A) CASE-1001 (Case A, success path, HbA1c 8.4%)
        # B) CASE-1004 (Case B, stalled critical, HbA1c 11.2%)
        # C) CASE-1012 (Case C, rejected referral REF-034, HbA1c 9.5%)
        # D) CASE-1020 (Micro-consult, HbA1c 6.6%)
        # E) 20 Historical Closed Cases (CASE-1021 to CASE-1040) -> 20 completed referrals here!
        # F) 5 Overdue Active Cases (CASE-1002, CASE-1003, CASE-1005, CASE-1006, CASE-1007)
        # G) Additional active cases to bring total actionable cases to 60.
        #    Among them, REF-031 sent > 48h ago pending response (the 2nd unowned handoff).
        #    And 1 completed referral among active cases (e.g. on CASE-1001 with REF-028 outcome returned),
        #    yielding total completed referrals = 20 (historical) + 1 (CASE-1001) = 21 out of 30!

        # Let's seed results and cases:

        # --- CASE-1001 (Case A: Success Path) ---
        res_1001 = ScreeningResult(
            patient_id="PT-0001",
            facility_code="CLA",
            test_code="HBA1C",
            value=8.4,
            unit="%",
            collected_at=now - timedelta(days=25),
            issued_at=now - timedelta(days=25)
        )
        db.add(res_1001)
        db.flush()

        case_1001 = Case(
            id="CASE-1001",
            result_id=res_1001.id,
            patient_id="PT-0001",
            pathway_code="DIAB-HBA1C",
            urgency="HIGH",
            stage="OUTCOME_RETURNED",
            sub_status="OUTCOME_RECORDED",
            owner_user_id=users["GP"].id,
            owner_role="GP",
            backup_user_id=users["COORD"].id,
            escrow_holder_user_id=None,
            due_at=now + timedelta(days=5), # not overdue
            opened_at=now - timedelta(days=25)
        )
        db.add(case_1001)
        db.flush()

        # Evidence for CASE-1001: All PROVIDED except REFERRER_SIGNOFF!
        checklist = pathway.closure_checklist_json
        for item in checklist:
            code = item["item_code"]
            status_val = "PROVIDED"
            if code == "REFERRER_SIGNOFF":
                status_val = "MISSING" # Only referrer sign-off missing!
            ev = EvidenceItem(
                case_id=case_1001.id,
                item_code=code,
                status=status_val,
                provided_by=users["SPEC"].id if code == "RECEIVER_CONFIRMATION" else users["GP"].id,
                provided_at=now - timedelta(days=2),
                document_ref="HbA1c Lab & Specialist Discharge Note"
            )
            db.add(ev)

        # Specialist Receiver signoff exists on CASE-1001
        sig_spec = Signoff(
            case_id=case_1001.id,
            role="RECEIVER",
            user_id=users["SPEC"].id,
            statement="Patient evaluated at Endocrinology Centre. Metformin started; 3-month follow-up scheduled.",
            ts=now - timedelta(days=1)
        )
        db.add(sig_spec)

        # Referral REF-028 for CASE-1001 (Accepted, awaiting GP closure sign-off)
        ref_028 = Referral(
            id="REF-028",
            case_id=case_1001.id,
            from_facility="CLA",
            to_facility="DEC",
            from_user=users["GP"].id,
            to_user=users["SPEC"].id,
            reason="Confirmed HbA1c 8.4% and fasting glucose 7.8 mmol/L. Specialist endocrine plan required.",
            urgency="HIGH",
            required_docs=["HbA1c Lab Report", "Venous Fasting Glucose"],
            status="ACCEPTED",
            receipt_token="rcpt_demo_ref_028",
            sent_at=now - timedelta(days=20),
            responded_at=now - timedelta(days=19)
        )
        db.add(ref_028)

        # Appointment attended
        appt_1001 = Appointment(
            case_id=case_1001.id,
            facility_code="DEC",
            slot_at=now - timedelta(days=3),
            status="ATTENDED"
        )
        db.add(appt_1001)

        # Case events for CASE-1001
        db.add(CaseEvent(case_id=case_1001.id, actor_role="SCR", event_type="RESULT_RECEIVED", ts=now - timedelta(days=25), payload={"val": 8.4}))
        db.add(CaseEvent(case_id=case_1001.id, actor_role="SYSTEM", event_type="MESSAGE_DELIVERED", ts=now - timedelta(days=24)))
        db.add(CaseEvent(case_id=case_1001.id, actor_role="PATIENT", event_type="PATIENT_ACKNOWLEDGED", ts=now - timedelta(days=24)))
        db.add(CaseEvent(case_id=case_1001.id, actor_role="GP", event_type="CLINICAL_REVIEW_COMPLETED", ts=now - timedelta(days=21)))
        db.add(CaseEvent(case_id=case_1001.id, actor_role="GP", event_type="REFERRAL_SENT", ts=now - timedelta(days=20)))
        db.add(CaseEvent(case_id=case_1001.id, actor_role="SPEC", event_type="REFERRAL_ACCEPTED", ts=now - timedelta(days=19)))
        db.add(CaseEvent(case_id=case_1001.id, actor_role="SPEC", event_type="APPOINTMENT_ATTENDED", ts=now - timedelta(days=3)))
        db.add(CaseEvent(case_id=case_1001.id, actor_role="SPEC", event_type="OUTCOME_RETURNED", ts=now - timedelta(days=1)))


        # --- CASE-1004 (Case B: Stalled Critical) ---
        res_1004 = ScreeningResult(
            patient_id="PT-0004",
            facility_code="CLA",
            test_code="HBA1C",
            value=11.2,
            unit="%",
            collected_at=now - timedelta(hours=32),
            issued_at=now - timedelta(hours=31)
        )
        db.add(res_1004)
        db.flush()

        case_1004 = Case(
            id="CASE-1004",
            result_id=res_1004.id,
            patient_id="PT-0004",
            pathway_code="DIAB-HBA1C",
            urgency="CRITICAL",
            stage="PATIENT_NOTIFIED",
            sub_status="DELIVERED",
            owner_user_id=users["GP"].id,
            owner_role="GP",
            backup_user_id=users["COORD"].id,
            escrow_holder_user_id=None,
            due_at=now - timedelta(hours=6), # Overdue SLA
            opened_at=now - timedelta(hours=31)
        )
        db.add(case_1004)
        db.flush()

        # Evidence for CASE-1004 (All missing initially)
        for item in checklist:
            db.add(EvidenceItem(case_id=case_1004.id, item_code=item["item_code"], status="MISSING"))

        # Message delivered 30 hours ago, not acknowledged
        msg_1004 = Message(
            case_id=case_1004.id,
            channel="SMS",
            language="Arabic",
            template_id="T-CRIT-01",
            body="مرحباً مريض PT-0004، نتائج فحص السكري التراكمي (11.2%) تتطلب متابعة طبية عاجلة خلال 24 ساعة.",
            status="DELIVERED",
            ts=now - timedelta(hours=30)
        )
        db.add(msg_1004)

        db.add(CaseEvent(case_id=case_1004.id, actor_role="SYSTEM", event_type="MESSAGE_DELIVERED", ts=now - timedelta(hours=30)))

        # Rule R-ACK-24H fired and created call task for COORD
        rf_1004 = RuleFiring(
            rule_id="R-ACK-24H",
            case_id=case_1004.id,
            ts=now - timedelta(hours=6),
            reason="Critical HbA1c 11.2% result delivered 30h ago without patient acknowledgement.",
            action="Created urgent CALL task for Coordinator; alerted GP."
        )
        db.add(rf_1004)

        task_1004 = Task(
            case_id=case_1004.id,
            kind="CALL",
            assigned_role="COORD",
            assigned_user=users["COORD"].id,
            due_at=now - timedelta(hours=2),
            status="PENDING",
            created_by_rule="R-ACK-24H",
            outcome=None
        )
        db.add(task_1004)


        # --- CASE-1012 (Case C: Rejected Referral REF-034) ---
        res_1012 = ScreeningResult(
            patient_id="PT-0012",
            facility_code="CLA",
            test_code="HBA1C",
            value=9.5,
            unit="%",
            collected_at=now - timedelta(days=6),
            issued_at=now - timedelta(days=6)
        )
        db.add(res_1012)
        db.flush()

        case_1012 = Case(
            id="CASE-1012",
            result_id=res_1012.id,
            patient_id="PT-0012",
            pathway_code="DIAB-HBA1C",
            urgency="HIGH",
            stage="RECEIVER_RESPONSE",
            sub_status="REJECTED",
            owner_user_id=users["GP"].id,
            owner_role="GP",
            backup_user_id=users["COORD"].id,
            escrow_holder_user_id=users["GP"].id, # Returned to GP sender!
            due_at=now + timedelta(days=7),
            opened_at=now - timedelta(days=6)
        )
        db.add(case_1012)
        db.flush()

        for item in checklist:
            st = "PROVIDED" if item["item_code"] in ("PATIENT_ACKNOWLEDGED", "CONFIRMATORY_RESULT_OR_RATIONALE") else "MISSING"
            db.add(EvidenceItem(case_id=case_1012.id, item_code=item["item_code"], status=st))

        # REF-034 sent 3 days ago, rejected yesterday "missing lipid panel"
        # Counts as one of the 2 unowned handoffs
        ref_034 = Referral(
            id="REF-034",
            case_id=case_1012.id,
            from_facility="CLA",
            to_facility="DEC",
            from_user=users["GP"].id,
            to_user=users["SPEC"].id,
            reason="Uncontrolled type 2 diabetes with elevated cardiovascular risk.",
            urgency="HIGH",
            required_docs=["HbA1c Lab Report", "Lipid Panel", "Serum Creatinine"],
            status="REJECTED",
            reject_reason="Missing lipid panel and recent renal function test.",
            receipt_token="rcpt_demo_ref_034",
            sent_at=now - timedelta(days=3),
            responded_at=now - timedelta(days=1)
        )
        db.add(ref_034)

        db.add(CaseEvent(case_id=case_1012.id, actor_role="GP", event_type="REFERRAL_SENT", ts=now - timedelta(days=3)))
        db.add(CaseEvent(case_id=case_1012.id, actor_role="SPEC", event_type="REFERRAL_REJECTED", ts=now - timedelta(days=1), payload={"reason": "Missing lipid panel"}))


        # --- CASE-1020 (Micro-consult: HbA1c 6.6%) ---
        res_1020 = ScreeningResult(
            patient_id="PT-0020",
            facility_code="CLA",
            test_code="HBA1C",
            value=6.6,
            unit="%",
            collected_at=now - timedelta(days=4),
            issued_at=now - timedelta(days=4)
        )
        db.add(res_1020)
        db.flush()

        case_1020 = Case(
            id="CASE-1020",
            result_id=res_1020.id,
            patient_id="PT-0020",
            pathway_code="DIAB-HBA1C",
            urgency="HIGH",
            stage="CLINICAL_REVIEW",
            sub_status="LIFESTYLE_PROGRAM",
            owner_user_id=users["GP"].id,
            owner_role="GP",
            backup_user_id=users["COORD"].id,
            escrow_holder_user_id=None,
            due_at=now + timedelta(days=10),
            opened_at=now - timedelta(days=4)
        )
        db.add(case_1020)
        db.flush()

        consult_1020 = Consult(
            case_id=case_1020.id,
            from_user=users["GP"].id,
            to_specialty="Endocrinology",
            to_user=users["SPEC"].id,
            question="Mild elevation (HbA1c 6.6%) in asymptomatic 45yo patient. Repeat test in 3 months or immediate endocrine referral?",
            answer="Recommend lifestyle modification program and repeat venous HbA1c in 3 months. Formal endocrine referral not required at this stage.",
            status="ANSWERED",
            asked_at=now - timedelta(hours=20),
            answered_at=now - timedelta(hours=17)
        )
        db.add(consult_1020)


        # --- 5 Overdue Active Cases (non-critical) ---
        # CASE-1002, CASE-1003, CASE-1005, CASE-1006, CASE-1007
        overdue_case_ids = ["CASE-1002", "CASE-1003", "CASE-1005", "CASE-1006", "CASE-1007"]
        for idx, cid in enumerate(overdue_case_ids):
            pid = f"PT-{10 + idx:04d}"
            r = ScreeningResult(
                patient_id=pid,
                facility_code="CLA",
                test_code="HBA1C",
                value=7.2 + (idx * 0.4),
                unit="%",
                collected_at=now - timedelta(days=20),
                issued_at=now - timedelta(days=20)
            )
            db.add(r)
            db.flush()

            c = Case(
                id=cid,
                result_id=r.id,
                patient_id=pid,
                pathway_code="DIAB-HBA1C",
                urgency="HIGH",
                stage="CLINICAL_REVIEW",
                sub_status="PENDING_REVIEW",
                owner_user_id=users["GP"].id,
                owner_role="GP",
                backup_user_id=users["COORD"].id,
                escrow_holder_user_id=None,
                due_at=now - timedelta(days=2 + idx), # past due date!
                opened_at=now - timedelta(days=20)
            )
            db.add(c)
            db.flush()
            # Mark patient acknowledged so not counted as unacknowledged
            db.add(CaseEvent(case_id=c.id, actor_role="PATIENT", event_type="PATIENT_ACKNOWLEDGED", ts=now - timedelta(days=19)))
            for item in checklist:
                db.add(EvidenceItem(case_id=c.id, item_code=item["item_code"], status="MISSING"))


        # --- Second Unowned Handoff: REF-031 ---
        # Case CASE-1008 with REF-031 sent 3 days ago, no response > 48h!
        res_1008 = ScreeningResult(
            patient_id="PT-0008",
            facility_code="CLA",
            test_code="HBA1C",
            value=8.9,
            unit="%",
            collected_at=now - timedelta(days=8),
            issued_at=now - timedelta(days=8)
        )
        db.add(res_1008)
        db.flush()

        case_1008 = Case(
            id="CASE-1008",
            result_id=res_1008.id,
            patient_id="PT-0008",
            pathway_code="DIAB-HBA1C",
            urgency="HIGH",
            stage="REFERRAL_SENT",
            sub_status="SENT",
            owner_user_id=users["GP"].id,
            owner_role="GP",
            backup_user_id=users["COORD"].id,
            escrow_holder_user_id=users["GP"].id, # Escrow held by GP sender
            due_at=now + timedelta(days=4), # not overdue
            opened_at=now - timedelta(days=8)
        )
        db.add(case_1008)
        db.flush()
        db.add(CaseEvent(case_id=case_1008.id, actor_role="PATIENT", event_type="PATIENT_ACKNOWLEDGED", ts=now - timedelta(days=7)))

        # REF-031: Sent 55 hours ago, no response
        ref_031 = Referral(
            id="REF-031",
            case_id=case_1008.id,
            from_facility="CLA",
            to_facility="DEC",
            from_user=users["GP"].id,
            to_user=None,
            reason="Confirmed diabetes with persistent hyperglycemia. Needs specialist insulin optimization.",
            urgency="HIGH",
            required_docs=["HbA1c Lab Report", "Blood Pressure Log"],
            status="SENT", # No response!
            receipt_token="rcpt_demo_ref_031",
            sent_at=now - timedelta(hours=55),
            responded_at=None
        )
        db.add(ref_031)


        # --- 21 Historical Closed Cases (CASE-1021 to CASE-1041) ---
        # All with full evidence, dual signoff, and 21 completed referrals!
        for i in range(21, 42):
            cid = f"CASE-{1000 + i}"
            pid = f"PT-{i:04d}"
            r = ScreeningResult(
                patient_id=pid,
                facility_code="CLA",
                test_code="HBA1C",
                value=7.0 + (i % 20) * 0.15,
                unit="%",
                collected_at=now - timedelta(days=45),
                issued_at=now - timedelta(days=45)
            )
            db.add(r)
            db.flush()

            closed_case = Case(
                id=cid,
                result_id=r.id,
                patient_id=pid,
                pathway_code="DIAB-HBA1C",
                urgency="HIGH",
                stage="CLOSURE_REVIEW",
                sub_status="CLOSED",
                owner_user_id=users["GP"].id,
                owner_role="GP",
                backup_user_id=users["COORD"].id,
                escrow_holder_user_id=None,
                due_at=now - timedelta(days=10),
                opened_at=now - timedelta(days=45),
                closed_at=now - timedelta(days=5),
                disposition="CLINICALLY_RESOLVED",
                disposition_reason="Patient completed endocrinology consult and therapy protocol.",
                closure_seal=f"seal_historical_{cid.lower()}"
            )
            db.add(closed_case)
            db.flush()

            # All evidence PROVIDED
            for item in checklist:
                db.add(EvidenceItem(
                    case_id=closed_case.id,
                    item_code=item["item_code"],
                    status="PROVIDED",
                    provided_by=users["SPEC"].id if "RECEIVER" in item["item_code"] else users["GP"].id,
                    provided_at=now - timedelta(days=6)
                ))

            # Dual sign-off: SPEC as RECEIVER, GP as REFERRER
            db.add(Signoff(
                case_id=closed_case.id,
                role="RECEIVER",
                user_id=users["SPEC"].id,
                statement="Specialist assessment completed. Care plan verified.",
                ts=now - timedelta(days=6)
            ))
            db.add(Signoff(
                case_id=closed_case.id,
                role="REFERRER",
                user_id=users["GP"].id,
                statement="Referring clinician closure endorsement approved.",
                ts=now - timedelta(days=5)
            ))

            # Completed Referral (21 completed referrals: REF-201 to REF-221)
            db.add(Referral(
                id=f"REF-{180 + i:03d}",
                case_id=closed_case.id,
                from_facility="CLA",
                to_facility="DEC",
                from_user=users["GP"].id,
                to_user=users["SPEC"].id,
                reason="Specialist endocrine consult completed.",
                urgency="HIGH",
                status="COMPLETED",
                receipt_token=f"rcpt_demo_{cid.lower()}",
                sent_at=now - timedelta(days=40),
                responded_at=now - timedelta(days=38)
            ))

            db.add(CaseEvent(case_id=closed_case.id, actor_role="PATIENT", event_type="PATIENT_ACKNOWLEDGED", ts=now - timedelta(days=44)))
            db.add(CaseEvent(case_id=closed_case.id, actor_role="GP", event_type="CASE_CLOSED", ts=now - timedelta(days=5)))


        # --- Remaining Active Cases to reach exactly 60 Actionable Cases ---
        for idx in range(42, 70):
            cid = f"CASE-{1000 + idx}"
            pid = f"PT-{idx:04d}"
            r = ScreeningResult(
                patient_id=pid,
                facility_code="CLA",
                test_code="HBA1C",
                value=6.8 + (idx % 15) * 0.1,
                unit="%",
                collected_at=now - timedelta(days=12),
                issued_at=now - timedelta(days=12)
            )
            db.add(r)
            db.flush()

            # Assign stages that are ON TRACK (not overdue)
            c = Case(
                id=cid,
                result_id=r.id,
                patient_id=pid,
                pathway_code="DIAB-HBA1C",
                urgency="HIGH" if idx % 2 == 0 else "ROUTINE",
                stage="CLINICAL_REVIEW" if idx < 50 else ("REFERRAL_SENT" if idx < 58 else "PATIENT_NOTIFIED"),
                sub_status="ON_TRACK",
                owner_user_id=users["GP"].id,
                owner_role="GP",
                backup_user_id=users["COORD"].id,
                due_at=now + timedelta(days=5 + (idx % 10)), # Future due date!
                opened_at=now - timedelta(days=12)
            )
            db.add(c)
            db.flush()

            # Mark acknowledged so no unacknowledged penalty
            db.add(CaseEvent(case_id=c.id, actor_role="PATIENT", event_type="PATIENT_ACKNOWLEDGED", ts=now - timedelta(days=11)))

            # If idx in [52, 53, 54, 55, 56, 57], create 6 more referrals:
            # Sent recently (<48 hours) or ACCEPTED pending appointment, so NOT completed and NOT unowned!
            if 52 <= idx <= 57:
                ref_sub = Referral(
                    id=f"REF-{100 + idx}",
                    case_id=c.id,
                    from_facility="CLA",
                    to_facility="DEC",
                    from_user=users["GP"].id,
                    to_user=users["SPEC"].id,
                    reason="Routine specialist diabetic consult.",
                    urgency="ROUTINE",
                    status="ACCEPTED" if idx % 2 == 0 else "SENT", # sent 10h ago
                    receipt_token=f"rcpt_demo_{cid.lower()}",
                    sent_at=now - timedelta(hours=10),
                    responded_at=now - timedelta(hours=2) if idx % 2 == 0 else None
                )
                db.add(ref_sub)


        # --- 7. Barriers (history) ---
        # UNREACHABLE 6, LANGUAGE 4, TRANSPORT 3, AFFORDABILITY 2, NO_SLOT 3,
        # MISSING_DOCUMENTS 2, PATIENT_PREFERENCE 1, UNKNOWN 2
        barriers_data = (
            [("UNREACHABLE", "Secondary phone unreachable", "ESCALATE_CHW")] * 6 +
            [("LANGUAGE", "Patient speaks Urdu/Arabic dialect", "SWITCH_LANGUAGE_AR")] * 4 +
            [("TRANSPORT", "No direct bus to specialist centre", "COMMUNITY_TRANSPORT_VOUCHER")] * 3 +
            [("AFFORDABILITY", "Co-pay concerns for brand insulin", "DAMAN_COPAY_ASSISTANCE")] * 2 +
            [("NO_SLOT", "Endocrinology clinic booked for 3 weeks", "OVERBOOK_URGENT_ROSTER")] * 3 +
            [("MISSING_DOCUMENTS", "Recent lipid panel missing from file", "REQUEST_LAB_DOCUMENT")] * 2 +
            [("PATIENT_PREFERENCE", "Patient prefers lifestyle change first", "CLINICAL_INFORMED_DIALOGUE")] * 1 +
            [("UNKNOWN", "Unspecified reluctance to book", "CARE_CONFERENCE")] * 2
        )
        for idx, (bcode, bnote, bresp) in enumerate(barriers_data):
            case_target_id = f"CASE-{1021 + (idx % 20)}"
            is_resolved = (idx % 5 != 0) # 80% resolved, 20% unresolved
            b_ts = now - timedelta(days=15 - (idx % 10))
            hours_spent = float(12 + (idx % 8) * 4)
            b = Barrier(
                case_id=case_target_id,
                code=bcode,
                note=bnote,
                response_code=bresp,
                recorded_by=users["COORD"].id,
                ts=b_ts,
                resolved=is_resolved,
                resolved_at=(b_ts + timedelta(hours=hours_spent)) if is_resolved else None,
                resolution_time_hours=hours_spent if is_resolved else None
            )
            db.add(b)

        db.commit()

        # --- 8. Audit Log: 6 Hash-Chained Entries ---
        # 1. data loaded
        # 2. pathway DIAB-HBA1C v1 approved
        # 3. CASE-1004 created (CRITICAL)
        # 4. rule R-ACK-24H fired on CASE-1004
        # 5. REF-034 rejected
        # 6. outcome returned on CASE-1001
        audit_events = [
            ("system@careloop.demo", "SYSTEM", "DATA_LOADED", "SYSTEM", "Initial population screening synthetic data loaded.", now - timedelta(days=32)),
            ("pm@careloop.demo", "PM", "APPROVE_PATHWAY", "DIAB-HBA1C", "Pathway DIAB-HBA1C v1 formally approved.", now - timedelta(days=31)),
            ("screening@careloop.demo", "SCR", "CREATE_CASE", "CASE-1004", "Created critical screening case CASE-1004 (HbA1c 11.2%).", now - timedelta(hours=31)),
            ("system@careloop.demo", "SYSTEM", "RULE_FIRED", "R-ACK-24H", "Rule R-ACK-24H fired on CASE-1004 after 24h unacknowledged.", now - timedelta(hours=6)),
            ("specialist@careloop.demo", "SPEC", "REJECT_REFERRAL", "REF-034", "Referral REF-034 rejected: Missing lipid panel.", now - timedelta(days=1)),
            ("specialist@careloop.demo", "SPEC", "RETURN_OUTCOME", "CASE-1001", "Outcome report and receiver sign-off registered for CASE-1001.", now - timedelta(hours=18))
        ]

        prev_hash = "GENESIS"
        for actor, role, action, obj, detail, ts in audit_events:
            h = compute_audit_hash(ts, actor, role, action, obj, detail, prev_hash)
            entry = AuditLog(
                ts=ts,
                actor=actor,
                role=role,
                action=action,
                object=obj,
                detail=detail,
                prev_hash=prev_hash,
                hash=h
            )
            db.add(entry)
            db.flush()
            prev_hash = h
        db.commit()

        print("Synthetic demo data successfully seeded!")

        # Verify initial score: Must be 64!
        score_res = calculate_loop_integrity_score(db)
        print("="*60)
        print(f"INITIAL LOOP INTEGRITY SCORE: {score_res['score']}/100")
        print("Score Breakdown:")
        for b in score_res["breakdown"]:
            print(f" - {b['rule']}: {b['penalty']} pts ({b['explanation']})")
        print("Metrics:")
        print(json.dumps(score_res["metrics"], indent=2))
        print("="*60)

    finally:
        db.close()

if __name__ == "__main__":
    seed()
