import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.entities import Message, CaseEvent, PatientIdentity, Case

def utc_now():
    return datetime.now(timezone.utc)

TEMPLATES = {
    "T-CRIT-01": {
        "Arabic": "مرحباً {name}، نتائج فحص السكري (التراكمي {value}%) تتطلب متابعة طبية عاجلة خلال 24 ساعة. يرجى فتح الرابط لتأكيد الاستلام والاطلاع على الخطوات التالية: {link}",
        "English": "Hello {name}, your screening result (HbA1c {value}%) requires urgent clinical follow-up within 24 hours. Please open your secure link to confirm receipt and view your next steps: {link}",
        "Hindi": "नमस्ते {name}, आपका स्क्रीनिंग परिणाम (HbA1c {value}%) 24 घंटे के भीतर तत्काल चिकित्सकीय अनुवर्ती की आवश्यकता है। कृपया अपनी सुरक्षित लिंक खोलें: {link}"
    },
    "T-HIGH-01": {
        "Arabic": "مرحباً {name}، تظهر نتائج الفحص لديك ارتفاعاً في نسبة السكر التراكمي ({value}%). نوصي بإجراء فحص تأكيدي واستشارة الطبيب خلال 14 يوماً. الرابط: {link}",
        "English": "Hello {name}, your HbA1c screening result ({value}%) is elevated. A confirmatory test and clinical review are recommended within 14 days. View link: {link}",
        "Hindi": "नमस्ते {name}, आपका HbA1c परिणाम ({value}%) उच्च है। 14 दिनों के भीतर पुष्टिकरण परीक्षण और समीक्षा की सिफारिश की जाती है: {link}"
    },
    "T-ROUT-01": {
        "Arabic": "مرحباً {name}، تشير نتائج فحصك ({value}%) إلى مرحلة ما قبل السكري. يرجى مراجعة طبيب الأسرة خلال 30 يوماً لبدء برنامج تعزيز الصحة: {link}",
        "English": "Hello {name}, your HbA1c test ({value}%) indicates pre-diabetes. Please schedule routine follow-up within 30 days: {link}",
        "Hindi": "नमस्ते {name}, आपका परिणाम ({value}%) पूर्व-मधुमेह दर्शाता है। कृपया 30 दिनों के भीतर परामर्श लें: {link}"
    }
}

class ChannelAdapter:
    @staticmethod
    def send_message(
        db: Session,
        case: Case,
        channel: str = "WHATSAPP",
        language: str = "Arabic",
        template_id: Optional[str] = None,
        custom_body: Optional[str] = None
    ) -> Message:
        patient: PatientIdentity = case.patient
        
        # Check consent
        if channel == "WHATSAPP" and not patient.consent_whatsapp:
            channel = "SMS" if patient.consent_sms else "VOICE"
        elif channel == "SMS" and not patient.consent_sms:
            channel = "WHATSAPP" if patient.consent_whatsapp else "VOICE"

        if not template_id:
            if case.urgency == "CRITICAL":
                template_id = "T-CRIT-01"
            elif case.urgency == "HIGH":
                template_id = "T-HIGH-01"
            else:
                template_id = "T-ROUT-01"

        if custom_body:
            body = custom_body
        else:
            lang_dict = TEMPLATES.get(template_id, TEMPLATES["T-HIGH-01"])
            template_str = lang_dict.get(language, lang_dict.get("English", ""))
            link = f"http://localhost:3000/p/{case.id}?token=patient_demo_{case.patient_id}"
            val_str = str(case.result.value) if case.result else "N/A"
            body = template_str.format(name=patient.name, value=val_str, link=link)

        msg = Message(
            case_id=case.id,
            channel=channel,
            language=language,
            template_id=template_id,
            body=body,
            status="SENT",
            ts=utc_now()
        )
        db.add(msg)
        db.flush()

        # Log event on case timeline
        event = CaseEvent(
            case_id=case.id,
            actor_user_id=None,
            actor_role="SYSTEM",
            event_type="MESSAGE_SENT",
            channel=channel,
            payload={"message_id": msg.id, "channel": channel, "language": language, "template_id": template_id},
            evidence_source="SYSTEM"
        )
        db.add(event)
        db.commit()
        return msg

    @staticmethod
    def simulate_delivery(db: Session, message_id: int, status: str = "DELIVERED"):
        msg = db.query(Message).filter(Message.id == message_id).first()
        if msg:
            msg.status = status
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
