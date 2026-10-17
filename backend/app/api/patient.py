from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import Case, Message, CaseEvent, PatientIdentity, TeachBack, Task, EvidenceItem, User
from app.schemas.careloop_schemas import (
    NotificationRequest, TeachBackAnswerRequest, PatientAcknowledgeRequest, PatientCallRequest
)
from app.api.deps import get_current_user, require_roles, append_audit_entry
from app.core.security import decode_patient_token
from app.services.channel_adapter import ChannelAdapter
from app.services.rules_engine import evaluate_case_rules

router = APIRouter(tags=["Patient Notification & Engagement"])

def utc_now():
    return datetime.now(timezone.utc)

@router.post("/cases/{id}/notify")
def notify_patient(
    id: str,
    payload: NotificationRequest,
    current_user: User = Depends(require_roles("COORD", "GP", "SCR", "ADMIN")),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    msg = ChannelAdapter.send_message(
        db=db,
        case=case,
        channel=payload.channel,
        language=payload.language
    )

    if case.stage in ("RESULT_RECEIVED", "OWNER_ASSIGNED"):
        case.stage = "PATIENT_NOTIFIED"
        case.sub_status = "SENT"

    append_audit_entry(
        db=db,
        actor=current_user.email,
        role=current_user.role,
        action="SEND_NOTIFICATION",
        object_id=case.id,
        detail=f"Sent {payload.channel} notification in {payload.language}."
    )
    db.commit()
    return {"message_id": msg.id, "status": msg.status, "channel": msg.channel}

@router.post("/webhooks/message-status")
def simulate_message_webhook(payload: Dict[str, Any], db: Session = Depends(get_db)):
    message_id = payload.get("message_id")
    status = payload.get("status", "DELIVERED") # DELIVERED, OPENED, FAILED
    
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    msg.status = status
    case = msg.case
    if case and status == "OPENED":
        case.sub_status = "OPENED"
    
    event = CaseEvent(
        case_id=msg.case_id,
        actor_user_id=None,
        actor_role="SYSTEM",
        event_type=f"MESSAGE_{status}",
        channel=msg.channel,
        payload={"message_id": msg.id, "status": status},
        evidence_source="SYSTEM"
    )
    db.add(event)
    db.commit()
    return {"status": "ok", "message_id": message_id, "new_status": status}

def get_current_patient(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> PatientIdentity:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Patient authorization token required")
    token = authorization.split(" ")[1]
    payload = decode_patient_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    
    patient_id = payload.get("patient_id")
    patient = db.query(PatientIdentity).filter(PatientIdentity.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient record not found")
    return patient

@router.get("/patient/case")
def get_patient_case_view(
    current_patient: PatientIdentity = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.patient_id == current_patient.patient_id).order_by(Case.opened_at.desc()).first()
    if not case:
        raise HTTPException(status_code=404, detail="No active case found for patient")

    # Determine step number out of 7
    stage_to_step = {
        "RESULT_RECEIVED": 1,
        "OWNER_ASSIGNED": 2,
        "PATIENT_NOTIFIED": 3,
        "CLINICAL_REVIEW": 4,
        "REFERRAL_SENT": 5,
        "RECEIVER_RESPONSE": 5,
        "APPOINTMENT_SERVICE": 6,
        "OUTCOME_RETURNED": 6,
        "CLOSURE_REVIEW": 7
    }
    step_num = stage_to_step.get(case.stage, 3)

    # Explanations in Arabic, English, Hindi
    explanations = {
        "Arabic": {
            "title": f"الخطوة {step_num} من 7: تأكيد استلام النتيجة والخطوات القادمة",
            "summary": f"أظهر فحص السكري التراكمي نتيجة ({case.result.value}%). هذه النتيجة تتطلب خطة متابعة طبية منظمة لحماية صحتك وضمان تقديم الرعاية المثلى.",
            "urgency_label": "عاجل" if case.urgency == "CRITICAL" else ("هام" if case.urgency == "HIGH" else "روتيني"),
            "next_step": "تأكيد فهم النتيجة من خلال الإجابة على الأسئلة القصيرة أدناه، أو طلب اتصال من فريق الرعاية.",
            "care_team": "د. أحمد المنصوري - عيادة ألفا لطب الأسرة (أبوظبي)"
        },
        "English": {
            "title": f"Step {step_num} of 7: Confirm your result & next care step",
            "summary": f"Your HbA1c screening result is {case.result.value}%. This actionable finding requires planned clinical follow-up to optimize your health and prevent complications.",
            "urgency_label": case.urgency,
            "next_step": "Answer the 3 brief teach-back questions below to confirm your understanding, or request a call from our coordinator.",
            "care_team": "Dr. Ahmed Al-Mansouri - Clinic Alpha Primary Care (Abu Dhabi)"
        },
        "Hindi": {
            "title": f"चरण {step_num} / 7: परिणाम की पुष्टि और अगला चिकित्सकीय कदम",
            "summary": f"आपका HbA1c परिणाम {case.result.value}% है। आपके स्वास्थ्य की सुरक्षा के लिए निर्धारित चिकित्सकीय परामर्श आवश्यक है।",
            "urgency_label": "अति आवश्यक" if case.urgency == "CRITICAL" else "महत्वपूर्ण",
            "next_step": "कृपया नीचे दिए गए 3 प्रश्नों के उत्तर देकर अपनी समझ की पुष्टि करें, या कॉलबैक का अनुरोध करें।",
            "care_team": "डॉ. अहमद अल-मंसूरी - क्लिनिक अल्फा (अबू धाबी)"
        }
    }

    # Teach-back question bank
    teach_back_questions = [
        {
            "id": "q1",
            "question": {
                "Arabic": "ما هي الخطوة العلاجية التالية المطلوبة منك؟",
                "English": "What is your required next step for care?",
                "Hindi": "आपके लिए अगला आवश्यक कदम क्या है?"
            },
            "options": [
                {"id": "a", "text": {"Arabic": "حضور الموعد الطبي والفحص التأكيدي", "English": "Attend confirmatory lab test and clinical review", "Hindi": "पुष्टिकरण परीक्षण और डॉक्टर से परामर्श"}},
                {"id": "b", "text": {"Arabic": "تجاهل النتيجة والانتظار", "English": "Ignore the result and wait", "Hindi": "परिणाम को अनदेखा करें"}},
                {"id": "c", "text": {"Arabic": "إيقاف جميع الأدوية فوراً", "English": "Stop all medications immediately", "Hindi": "दवाएं बंद कर दें"}}
            ],
            "correct": "a"
        },
        {
            "id": "q2",
            "question": {
                "Arabic": "خلال أي مدة زمنية يجب اتخاذ الإجراء الطبي؟",
                "English": "By when should this follow-up occur?",
                "Hindi": "यह परामर्श कब तक होना चाहिए?"
            },
            "options": [
                {"id": "a", "text": {"Arabic": "خلال الإطار الزمني المحدد (24-48 ساعة للحالات الحرجة)", "English": "Within the specified timeframe (24-48h for critical)", "Hindi": "निर्धारित समय के भीतर (अति आवश्यक हेतु 24-48 घंटे)"}},
                {"id": "b", "text": {"Arabic": "بعد عام كامل", "English": "After one year", "Hindi": "एक साल बाद"}}
            ],
            "correct": "a"
        },
        {
            "id": "q3",
            "question": {
                "Arabic": "بمن تتصل إذا شعرت بتوعك أو أعراض مقلقة؟",
                "English": "Who do you contact if you feel unwell or develop symptoms?",
                "Hindi": "अस्वस्थ महसूस करने पर किससे संपर्क करें?"
            },
            "options": [
                {"id": "a", "text": {"Arabic": "منسق الرعاية أو الاتصال بالطوارئ 998", "English": "Care Coordinator or Emergency 998", "Hindi": "देखभाल समन्वयक या आपातकालीन 998"}},
                {"id": "b", "text": {"Arabic": "لا أحد", "English": "Nobody", "Hindi": "किसी से नहीं"}}
            ],
            "correct": "a"
        }
    ]

    return {
        "case_id": case.id,
        "patient_id": current_patient.patient_id,
        "patient_name": current_patient.name,
        "preferred_language": current_patient.preferred_language,
        "stage": case.stage,
        "step_num": step_num,
        "total_steps": 7,
        "urgency": case.urgency,
        "result": {
            "test_code": case.result.test_code if case.result else "HBA1C",
            "value": case.result.value if case.result else None,
            "unit": case.result.unit if case.result else "%"
        },
        "content": explanations.get(current_patient.preferred_language, explanations["English"]),
        "teach_back_questions": teach_back_questions,
        "acknowledged": any(e.event_type in ("PATIENT_ACKNOWLEDGED", "TEACH_BACK_PASSED") for e in case.events)
    }

@router.post("/patient/teach-back")
def submit_teach_back(
    payload: TeachBackAnswerRequest,
    current_patient: PatientIdentity = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.patient_id == current_patient.patient_id).order_by(Case.opened_at.desc()).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Evaluate answers: q1=a, q2=a, q3=a
    answers = payload.answers
    is_passed = (answers.get("q1") == "a" and answers.get("q2") == "a" and answers.get("q3") == "a")

    tb_record = TeachBack(
        case_id=case.id,
        language=payload.language,
        questions=["q1", "q2", "q3"],
        answers=answers,
        passed=is_passed,
        assisted_by=payload.assisted_by,
        ts=utc_now()
    )
    db.add(tb_record)

    if is_passed:
        # Acknowledged!
        event_type = "TEACH_BACK_PASSED"
        db.add(CaseEvent(
            case_id=case.id,
            actor_user_id=None,
            actor_role="PATIENT",
            event_type="PATIENT_ACKNOWLEDGED",
            channel="WEB",
            payload={"answers": answers, "passed": True},
            evidence_source="SELF_REPORT"
        ))
        
        # Mark evidence item
        ev = db.query(EvidenceItem).filter(
            EvidenceItem.case_id == case.id,
            EvidenceItem.item_code == "PATIENT_ACKNOWLEDGED"
        ).first()
        if ev:
            ev.status = "PROVIDED"
            ev.provided_at = utc_now()
            ev.source = "SELF_REPORT"

        # Advance sub_status
        case.sub_status = "ACKNOWLEDGED"

        append_audit_entry(
            db=db,
            actor=f"patient:{current_patient.patient_id}",
            role="PATIENT",
            action="TEACH_BACK_PASSED",
            object_id=case.id,
            detail="Patient passed 3-question teach-back confirmation."
        )
    else:
        # Needs Help -> Rule R-TB-FAIL fires
        db.add(CaseEvent(
            case_id=case.id,
            actor_user_id=None,
            actor_role="PATIENT",
            event_type="TEACH_BACK_NEEDS_HELP",
            channel="WEB",
            payload={"answers": answers, "passed": False},
            evidence_source="SELF_REPORT"
        ))
        
        # Create coordinator call task
        task = Task(
            case_id=case.id,
            kind="CALL",
            assigned_role="COORD",
            status="PENDING",
            created_by_rule="R-TB-FAIL",
            outcome="Teach-back needs assistance. Outreach required."
        )
        db.add(task)

        append_audit_entry(
            db=db,
            actor=f"patient:{current_patient.patient_id}",
            role="PATIENT",
            action="TEACH_BACK_NEEDS_HELP",
            object_id=case.id,
            detail="Patient experienced difficulty with teach-back. Outreach task queued."
        )

    db.commit()
    evaluate_case_rules(db, case.id)

    return {
        "passed": is_passed,
        "message": "Teach-back passed and acknowledgement recorded." if is_passed else "Thank you. Our care navigator will contact you directly to assist."
    }

@router.post("/patient/acknowledge")
def acknowledge_patient(
    payload: PatientAcknowledgeRequest,
    current_patient: PatientIdentity = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.patient_id == current_patient.patient_id).order_by(Case.opened_at.desc()).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    case.sub_status = "ACKNOWLEDGED"
    db.add(CaseEvent(
        case_id=case.id,
        actor_user_id=None,
        actor_role="PATIENT",
        event_type="PATIENT_ACKNOWLEDGED",
        channel="WEB",
        payload={"confirmed": True},
        evidence_source="SELF_REPORT"
    ))

    ev = db.query(EvidenceItem).filter(
        EvidenceItem.case_id == case.id,
        EvidenceItem.item_code == "PATIENT_ACKNOWLEDGED"
    ).first()
    if ev:
        ev.status = "PROVIDED"
        ev.provided_at = utc_now()
        ev.source = "SELF_REPORT"

    append_audit_entry(
        db=db,
        actor=f"patient:{current_patient.patient_id}",
        role="PATIENT",
        action="PATIENT_ACKNOWLEDGED",
        object_id=case.id,
        detail="Patient tapped direct acknowledgement confirmation."
    )
    db.commit()
    evaluate_case_rules(db, case.id)
    return {"status": "ACKNOWLEDGED", "case_id": case.id}

@router.post("/patient/request-call")
def request_coordinator_call(
    payload: PatientCallRequest,
    current_patient: PatientIdentity = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.patient_id == current_patient.patient_id).order_by(Case.opened_at.desc()).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    task = Task(
        case_id=case.id,
        kind="CALL",
        assigned_role="COORD",
        status="PENDING",
        created_by_rule="PATIENT_REQUEST",
        outcome=f"Patient requested phone assistance: {payload.note or 'Direct request from status page'}"
    )
    db.add(task)
    db.add(CaseEvent(
        case_id=case.id,
        actor_user_id=None,
        actor_role="PATIENT",
        event_type="CALL_REQUESTED",
        channel="WEB",
        payload={"phone": payload.phone or current_patient.phone, "note": payload.note},
        evidence_source="SELF_REPORT"
    ))
    db.commit()
    return {"status": "ok", "message": "Call request submitted. A care navigator will reach out to you."}
