import json
from datetime import datetime, timezone
from typing import Optional, Any
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from app.db.session import Base

def utc_now():
    return datetime.now(timezone.utc)

class Facility(Base):
    __tablename__ = "facilities"

    code = Column(String(50), primary_key=True, index=True) # e.g. "CLA"
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False) # SCREENING, PRIMARY, SPECIALIST, LAB
    integration_mode = Column(String(50), default="MANUAL") # FHIR, PORTAL, MANUAL

    users = relationship("User", back_populates="facility")
    results = relationship("ScreeningResult", back_populates="facility")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False) # PM, SCR, COORD, GP, SPEC, CHW, ADMIN, AUDITOR, PATIENT
    facility_code = Column(String(50), ForeignKey("facilities.code"), nullable=True)
    password_hash = Column(String(255), nullable=False)
    otp_required = Column(Boolean, default=True)
    active = Column(Boolean, default=True)
    failed_logins = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)

    facility = relationship("Facility", back_populates="users")


class PatientIdentity(Base):
    __tablename__ = "patient_identity"

    patient_id = Column(String(50), primary_key=True, index=True) # "PT-0042"
    name = Column(String(255), nullable=False)
    dob = Column(String(20), nullable=False) # "YYYY-MM-DD"
    phone = Column(String(50), nullable=False)
    preferred_language = Column(String(20), default="Arabic") # Arabic, English, Hindi, Other
    preferred_channel = Column(String(20), default="WHATSAPP") # WHATSAPP, SMS, VOICE
    consent_sms = Column(Boolean, default=True)
    consent_whatsapp = Column(Boolean, default=True)
    consent_voice = Column(Boolean, default=True)
    has_smartphone = Column(Boolean, default=True)

    results = relationship("ScreeningResult", back_populates="patient")
    cases = relationship("Case", back_populates="patient")


class ScreeningResult(Base):
    __tablename__ = "screening_results"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(String(50), ForeignKey("patient_identity.patient_id"), nullable=False)
    facility_code = Column(String(50), ForeignKey("facilities.code"), nullable=False)
    test_code = Column(String(50), default="HBA1C")
    value = Column(Float, nullable=False)
    unit = Column(String(20), default="%")
    collected_at = Column(DateTime, default=utc_now)
    issued_at = Column(DateTime, default=utc_now)
    source = Column(String(100), default="Lab Analyzer")
    raw_payload = Column(JSON, default=dict)

    patient = relationship("PatientIdentity", back_populates="results")
    facility = relationship("Facility", back_populates="results")
    cases = relationship("Case", back_populates="result")


class Pathway(Base):
    __tablename__ = "pathways"

    code = Column(String(50), primary_key=True, index=True) # "DIAB-HBA1C"
    name = Column(String(255), nullable=False)
    protocol_json = Column(JSON, default=dict)
    closure_checklist_json = Column(JSON, default=list)
    sla_json = Column(JSON, default=dict)
    version = Column(String(50), default="1.0")
    approved_by = Column(String(255), nullable=True)
    approved_at = Column(DateTime, default=utc_now)

    cases = relationship("Case", back_populates="pathway")


class Case(Base):
    __tablename__ = "cases"

    id = Column(String(50), primary_key=True, index=True) # "CASE-1007"
    result_id = Column(Integer, ForeignKey("screening_results.id"), nullable=False)
    patient_id = Column(String(50), ForeignKey("patient_identity.patient_id"), nullable=False)
    pathway_code = Column(String(50), ForeignKey("pathways.code"), nullable=False)
    
    urgency = Column(String(50), nullable=False) # CRITICAL, HIGH, ROUTINE
    stage = Column(String(50), nullable=False, default="RESULT_RECEIVED")
    # 9 stages:
    # 1. RESULT_RECEIVED
    # 2. OWNER_ASSIGNED
    # 3. PATIENT_NOTIFIED
    # 4. CLINICAL_REVIEW
    # 5. REFERRAL_SENT
    # 6. RECEIVER_RESPONSE
    # 7. APPOINTMENT_SERVICE
    # 8. OUTCOME_RETURNED
    # 9. CLOSURE_REVIEW
    
    sub_status = Column(String(50), default="PENDING")
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    owner_role = Column(String(50), nullable=True)
    backup_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    escrow_holder_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    due_at = Column(DateTime, nullable=True)
    opened_at = Column(DateTime, default=utc_now)
    closed_at = Column(DateTime, nullable=True)
    disposition = Column(String(100), nullable=True) # CLINICALLY_RESOLVED, TRANSFERRED_CONFIRMED, DECLINED_AFTER_INFORMED_DISCUSSION, UNABLE_TO_CONTACT_AFTER_PROTOCOL, OTHER_AUTHORISED
    disposition_reason = Column(Text, nullable=True)
    closure_seal = Column(String(100), nullable=True) # SHA-256 seal
    
    archived = Column(Boolean, default=False)
    archived_reason = Column(String(255), nullable=True)

    result = relationship("ScreeningResult", back_populates="cases")
    patient = relationship("PatientIdentity", back_populates="cases")
    pathway = relationship("Pathway", back_populates="cases")
    
    events = relationship("CaseEvent", back_populates="case", cascade="all, delete-orphan")
    evidence = relationship("EvidenceItem", back_populates="case", cascade="all, delete-orphan")
    signoffs = relationship("Signoff", back_populates="case", cascade="all, delete-orphan")
    referrals = relationship("Referral", back_populates="case", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="case", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="case", cascade="all, delete-orphan")
    teach_backs = relationship("TeachBack", back_populates="case", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="case", cascade="all, delete-orphan")
    barriers = relationship("Barrier", back_populates="case", cascade="all, delete-orphan")
    consults = relationship("Consult", back_populates="case", cascade="all, delete-orphan")
    rule_firings = relationship("RuleFiring", back_populates="case", cascade="all, delete-orphan")
    risk_score = relationship("RiskScore", back_populates="case", uselist=False, cascade="all, delete-orphan")


class CaseEvent(Base):
    __tablename__ = "case_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    case_id = Column(String(50), ForeignKey("cases.id"), nullable=False, index=True)
    ts = Column(DateTime, default=utc_now, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    actor_role = Column(String(50), nullable=False)
    event_type = Column(String(100), nullable=False)
    channel = Column(String(50), default="IN_APP")
    payload = Column(JSON, default=dict)
    evidence_source = Column(String(50), default="SYSTEM") # PROVIDER_VERIFIED, SELF_REPORT, SYSTEM
    rule_id = Column(String(50), nullable=True)

    case = relationship("Case", back_populates="events")


class EvidenceItem(Base):
    __tablename__ = "evidence_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    case_id = Column(String(50), ForeignKey("cases.id"), nullable=False, index=True)
    item_code = Column(String(100), nullable=False)
    status = Column(String(50), default="MISSING") # MISSING, PROVIDED, WAIVED
    provided_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    provided_at = Column(DateTime, nullable=True)
    document_ref = Column(String(255), nullable=True)
    source = Column(String(50), default="PROVIDER_VERIFIED") # PROVIDER_VERIFIED, SELF_REPORT, SYSTEM

    case = relationship("Case", back_populates="evidence")


class Signoff(Base):
    __tablename__ = "signoffs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    case_id = Column(String(50), ForeignKey("cases.id"), nullable=False, index=True)
    role = Column(String(50), nullable=False) # RECEIVER, REFERRER
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ts = Column(DateTime, default=utc_now)
    statement = Column(Text, nullable=False)

    case = relationship("Case", back_populates="signoffs")


class Referral(Base):
    __tablename__ = "referrals"

    id = Column(String(50), primary_key=True, index=True) # "REF-031"
    case_id = Column(String(50), ForeignKey("cases.id"), nullable=False, index=True)
    from_facility = Column(String(50), ForeignKey("facilities.code"), nullable=False)
    to_facility = Column(String(50), ForeignKey("facilities.code"), nullable=False)
    from_user = Column(Integer, ForeignKey("users.id"), nullable=False)
    to_user = Column(Integer, ForeignKey("users.id"), nullable=True)
    reason = Column(Text, nullable=False)
    urgency = Column(String(50), default="ROUTINE")
    required_docs = Column(JSON, default=list)
    status = Column(String(50), default="SENT") # SENT, ACCEPTED, REJECTED, NEEDS_INFO, NO_RESPONSE, COMPLETED
    reject_reason = Column(Text, nullable=True)
    receipt_token = Column(String(100), unique=True, index=True, nullable=False)
    sent_at = Column(DateTime, default=utc_now)
    responded_at = Column(DateTime, nullable=True)

    case = relationship("Case", back_populates="referrals")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    case_id = Column(String(50), ForeignKey("cases.id"), nullable=False, index=True)
    facility_code = Column(String(50), ForeignKey("facilities.code"), nullable=False)
    slot_at = Column(DateTime, nullable=False)
    status = Column(String(50), default="BOOKED") # BOOKED, ATTENDED, CANCELLED, NO_SHOW, COMPLETED

    case = relationship("Case", back_populates="appointments")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    case_id = Column(String(50), ForeignKey("cases.id"), nullable=False, index=True)
    channel = Column(String(50), nullable=False) # SMS, WHATSAPP, VOICE, IN_APP, PRINT
    language = Column(String(20), default="Arabic")
    template_id = Column(String(100), nullable=False)
    body = Column(Text, nullable=False)
    status = Column(String(50), default="SENT") # SENT, DELIVERED, OPENED, FAILED
    ts = Column(DateTime, default=utc_now)

    case = relationship("Case", back_populates="messages")


class TeachBack(Base):
    __tablename__ = "teach_back"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    case_id = Column(String(50), ForeignKey("cases.id"), nullable=False, index=True)
    language = Column(String(20), default="Arabic")
    questions = Column(JSON, default=list)
    answers = Column(JSON, default=dict)
    passed = Column(Boolean, default=False)
    assisted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    ts = Column(DateTime, default=utc_now)

    case = relationship("Case", back_populates="teach_backs")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    case_id = Column(String(50), ForeignKey("cases.id"), nullable=False, index=True)
    kind = Column(String(50), nullable=False) # CALL, RESCHEDULE, DOCS, REVIEW, ESCALATION
    assigned_role = Column(String(50), nullable=False) # COORD, GP, SPEC, PM
    assigned_user = Column(Integer, ForeignKey("users.id"), nullable=True)
    due_at = Column(DateTime, nullable=True)
    status = Column(String(50), default="PENDING") # PENDING, IN_PROGRESS, COMPLETED, CANCELLED
    created_by_rule = Column(String(50), nullable=True)
    outcome = Column(Text, nullable=True)

    case = relationship("Case", back_populates="tasks")


class Barrier(Base):
    __tablename__ = "barriers"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    case_id = Column(String(50), ForeignKey("cases.id"), nullable=False, index=True)
    code = Column(String(50), nullable=False) # UNREACHABLE, LANGUAGE, TRANSPORT, AFFORDABILITY, NO_SLOT, PATIENT_PREFERENCE, CRITERIA_MISMATCH, MISSING_DOCUMENTS, CLINICAL_ESCALATION, UNKNOWN
    note = Column(Text, nullable=True)
    response_code = Column(String(100), nullable=True)
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    ts = Column(DateTime, default=utc_now)
    resolved = Column(Boolean, default=False)

    case = relationship("Case", back_populates="barriers")


class Consult(Base):
    __tablename__ = "consults"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    case_id = Column(String(50), ForeignKey("cases.id"), nullable=False, index=True)
    from_user = Column(Integer, ForeignKey("users.id"), nullable=False)
    to_specialty = Column(String(100), nullable=False) # e.g. Endocrinology
    to_user = Column(Integer, ForeignKey("users.id"), nullable=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=True)
    status = Column(String(50), default="OPEN") # OPEN, ANSWERED, CONVERTED_TO_REFERRAL
    asked_at = Column(DateTime, default=utc_now)
    answered_at = Column(DateTime, nullable=True)

    case = relationship("Case", back_populates="consults")


class Rule(Base):
    __tablename__ = "rules"

    id = Column(String(50), primary_key=True, index=True) # "R-ACK-24H"
    name = Column(String(255), nullable=False)
    json = Column(JSON, default=dict)
    active = Column(Boolean, default=True)
    version = Column(String(50), default="1.0")
    approved_by = Column(String(255), nullable=True)

    firings = relationship("RuleFiring", back_populates="rule")


class RuleFiring(Base):
    __tablename__ = "rule_firings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    rule_id = Column(String(50), ForeignKey("rules.id"), nullable=False)
    case_id = Column(String(50), ForeignKey("cases.id"), nullable=False, index=True)
    ts = Column(DateTime, default=utc_now)
    reason = Column(Text, nullable=False)
    action = Column(String(255), nullable=False)
    overridden_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    override_reason = Column(Text, nullable=True)

    case = relationship("Case", back_populates="rule_firings")
    rule = relationship("Rule", back_populates="firings")


class RiskScore(Base):
    __tablename__ = "risk_scores"

    case_id = Column(String(50), ForeignKey("cases.id"), primary_key=True, index=True)
    ts = Column(DateTime, default=utc_now)
    probability = Column(Float, nullable=False)
    top3_reasons = Column(JSON, default=list)
    model_version = Column(String(50), default="demo_v1")

    case = relationship("Case", back_populates="risk_score")


class AuditLog(Base):
    """
    Append-only tamper-evident audit trail.
    Each entry is SHA-256 hash-chained to the previous one.
    """
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ts = Column(DateTime, default=utc_now, index=True)
    actor = Column(String(255), nullable=False) # user email or system
    role = Column(String(50), nullable=False)
    action = Column(String(100), nullable=False) # VIEW, CREATE, TRANSITION, ASSIGN, ESCALATE, SIGN, CLOSE
    object = Column(String(100), nullable=False) # e.g. "CASE-1007", "REF-031"
    detail = Column(Text, nullable=True)
    prev_hash = Column(String(100), nullable=False)
    hash = Column(String(100), nullable=False, index=True)
