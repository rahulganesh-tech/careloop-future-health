from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

# Auth Schemas
class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    stage: str # "otp" or "full"
    token: str
    user: Dict[str, Any]

class OTPVerifyRequest(BaseModel):
    email: str
    otp_code: str

class PatientLinkRequest(BaseModel):
    dob: str # YYYY-MM-DD

class UserOut(BaseModel):
    id: int
    email: str
    name: str
    role: str
    facility_code: Optional[str] = None
    active: bool

# Case Schemas
class CaseAssignRequest(BaseModel):
    owner_user_id: int
    owner_role: str
    backup_user_id: Optional[int] = None
    due_at: Optional[datetime] = None

class CaseReviewRequest(BaseModel):
    rationale: str
    next_step: str # e.g. "CONFIRMATORY_TEST", "REFERRAL", "LIFESTYLE_PROGRAM"
    confirmatory_test_needed: bool = False

class NotificationRequest(BaseModel):
    channel: str = "WHATSAPP" # WHATSAPP, SMS, VOICE, PRINT
    language: str = "Arabic"

class TeachBackAnswerRequest(BaseModel):
    language: str = "Arabic"
    answers: Dict[str, Any]
    assisted_by: Optional[int] = None

class PatientAcknowledgeRequest(BaseModel):
    confirmed: bool = True

class PatientCallRequest(BaseModel):
    phone: Optional[str] = None
    preferred_time: Optional[str] = None
    note: Optional[str] = None

# Referral & Receipt Schemas
class ReferralCreateRequest(BaseModel):
    to_facility: str
    to_user: Optional[int] = None
    reason: str
    urgency: str = "ROUTINE"
    required_docs: List[str] = Field(default_factory=list)

class ReferralActionRequest(BaseModel):
    status: str # ACCEPTED, REJECTED, NEEDS_INFO
    reject_reason: Optional[str] = None

class ReceiptRespondRequest(BaseModel):
    status: str # ACCEPTED, REJECTED, NEEDS_INFO
    responder_name: str
    reason: Optional[str] = None
    appointment_slot: Optional[str] = None

# Appointment & Outcome Schemas
class AppointmentCreateRequest(BaseModel):
    facility_code: str
    slot_at: datetime

class AppointmentUpdateRequest(BaseModel):
    status: str # BOOKED, ATTENDED, CANCELLED, NO_SHOW, COMPLETED

class OutcomeReturnRequest(BaseModel):
    report_text: str
    plan_text: str
    evidence_items: List[Dict[str, Any]] = Field(default_factory=list)
    confirm_as_receiver: bool = True

# Closure Schemas
class SignoffRequest(BaseModel):
    role: str # RECEIVER or REFERRER
    statement: str

class CaseCloseRequest(BaseModel):
    disposition: str # CLINICALLY_RESOLVED, TRANSFERRED_CONFIRMED, DECLINED_AFTER_INFORMED_DISCUSSION, UNABLE_TO_CONTACT_AFTER_PROTOCOL, OTHER_AUTHORISED
    reason: str

# Coordination & Tasks
class TaskCreateRequest(BaseModel):
    kind: str # CALL, RESCHEDULE, DOCS, REVIEW, ESCALATION
    assigned_role: str
    assigned_user: Optional[int] = None
    due_at: Optional[datetime] = None

class TaskCompleteRequest(BaseModel):
    outcome: str

class BarrierRecordRequest(BaseModel):
    code: str # UNREACHABLE, LANGUAGE, TRANSPORT, AFFORDABILITY, NO_SLOT, PATIENT_PREFERENCE, CRITERIA_MISMATCH, MISSING_DOCUMENTS, CLINICAL_ESCALATION, UNKNOWN
    note: Optional[str] = None
    response_code: Optional[str] = None

class ConsultCreateRequest(BaseModel):
    to_specialty: str
    question: str
    to_user: Optional[int] = None

class ConsultAnswerRequest(BaseModel):
    answer: str

class RuleOverrideRequest(BaseModel):
    override_reason: str

# Result Import
class ResultImportRow(BaseModel):
    patient_id: str
    name: str
    dob: str
    phone: str
    test_code: str = "HBA1C"
    value: float
    unit: str = "%"
    preferred_language: str = "Arabic"
    has_smartphone: bool = True
