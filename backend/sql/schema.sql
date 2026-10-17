-- HealthPulse AI CareLoop: PostgreSQL 16 Database Schema
-- Department of Health - Abu Dhabi · Future Health Challenge 2026

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Facilities
CREATE TABLE IF NOT EXISTS facilities (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- SCREENING, PRIMARY, SPECIALIST, LAB
    integration_mode VARCHAR(50) DEFAULT 'MANUAL' -- FHIR, PORTAL, MANUAL
);

-- 2. Users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- PM, SCR, COORD, GP, SPEC, CHW, ADMIN, AUDITOR, PATIENT
    facility_code VARCHAR(50) REFERENCES facilities(code) ON DELETE SET NULL,
    password_hash VARCHAR(255) NOT NULL,
    otp_required BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    failed_logins INT DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE
);

-- 3. Patient Identity (Segregated from clinical cases)
CREATE TABLE IF NOT EXISTS patient_identity (
    patient_id VARCHAR(50) PRIMARY KEY, -- 'PT-0042'
    name VARCHAR(255) NOT NULL,
    dob VARCHAR(20) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    preferred_language VARCHAR(20) DEFAULT 'Arabic',
    preferred_channel VARCHAR(20) DEFAULT 'WHATSAPP',
    consent_sms BOOLEAN DEFAULT TRUE,
    consent_whatsapp BOOLEAN DEFAULT TRUE,
    consent_voice BOOLEAN DEFAULT TRUE,
    has_smartphone BOOLEAN DEFAULT TRUE
);

-- 4. Screening Results
CREATE TABLE IF NOT EXISTS screening_results (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(50) REFERENCES patient_identity(patient_id) ON DELETE CASCADE,
    facility_code VARCHAR(50) REFERENCES facilities(code) ON DELETE CASCADE,
    test_code VARCHAR(50) DEFAULT 'HBA1C',
    value DOUBLE PRECISION NOT NULL,
    unit VARCHAR(20) DEFAULT '%',
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(100) DEFAULT 'Lab Analyzer',
    raw_payload JSONB DEFAULT '{}'::jsonb
);

-- 5. Pathways
CREATE TABLE IF NOT EXISTS pathways (
    code VARCHAR(50) PRIMARY KEY, -- 'DIAB-HBA1C'
    name VARCHAR(255) NOT NULL,
    protocol_json JSONB DEFAULT '{}'::jsonb,
    closure_checklist_json JSONB DEFAULT '[]'::jsonb,
    sla_json JSONB DEFAULT '{}'::jsonb,
    version VARCHAR(50) DEFAULT '1.0',
    approved_by VARCHAR(255),
    approved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Cases (9-Stage Lifecycle)
CREATE TABLE IF NOT EXISTS cases (
    id VARCHAR(50) PRIMARY KEY, -- 'CASE-1007'
    result_id INT REFERENCES screening_results(id) ON DELETE CASCADE,
    patient_id VARCHAR(50) REFERENCES patient_identity(patient_id) ON DELETE CASCADE,
    pathway_code VARCHAR(50) REFERENCES pathways(code) ON DELETE CASCADE,
    urgency VARCHAR(50) NOT NULL, -- CRITICAL, HIGH, ROUTINE
    stage VARCHAR(50) NOT NULL DEFAULT 'RESULT_RECEIVED',
    sub_status VARCHAR(50) DEFAULT 'PENDING',
    owner_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    owner_role VARCHAR(50),
    backup_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    escrow_holder_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    due_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE,
    disposition VARCHAR(100),
    disposition_reason TEXT,
    closure_seal VARCHAR(100),
    archived BOOLEAN DEFAULT FALSE,
    archived_reason VARCHAR(255)
);

-- 7. Case Events Timeline
CREATE TABLE IF NOT EXISTS case_events (
    id SERIAL PRIMARY KEY,
    case_id VARCHAR(50) REFERENCES cases(id) ON DELETE CASCADE,
    ts TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actor_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    actor_role VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    channel VARCHAR(50) DEFAULT 'IN_APP',
    payload JSONB DEFAULT '{}'::jsonb,
    evidence_source VARCHAR(50) DEFAULT 'SYSTEM',
    rule_id VARCHAR(50)
);

-- 8. Evidence Items
CREATE TABLE IF NOT EXISTS evidence_items (
    id SERIAL PRIMARY KEY,
    case_id VARCHAR(50) REFERENCES cases(id) ON DELETE CASCADE,
    item_code VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'MISSING', -- MISSING, PROVIDED, WAIVED
    provided_by INT REFERENCES users(id) ON DELETE SET NULL,
    provided_at TIMESTAMP WITH TIME ZONE,
    document_ref VARCHAR(255),
    source VARCHAR(50) DEFAULT 'PROVIDER_VERIFIED'
);

-- 9. Dual Clinician Signoffs
CREATE TABLE IF NOT EXISTS signoffs (
    id SERIAL PRIMARY KEY,
    case_id VARCHAR(50) REFERENCES cases(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- RECEIVER, REFERRER
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    ts TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    statement TEXT NOT NULL
);

-- 10. Referrals & Escrow
CREATE TABLE IF NOT EXISTS referrals (
    id VARCHAR(50) PRIMARY KEY, -- 'REF-031'
    case_id VARCHAR(50) REFERENCES cases(id) ON DELETE CASCADE,
    from_facility VARCHAR(50) REFERENCES facilities(code) ON DELETE CASCADE,
    to_facility VARCHAR(50) REFERENCES facilities(code) ON DELETE CASCADE,
    from_user INT REFERENCES users(id) ON DELETE CASCADE,
    to_user INT REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    urgency VARCHAR(50) DEFAULT 'ROUTINE',
    required_docs JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) DEFAULT 'SENT', -- SENT, ACCEPTED, REJECTED, NEEDS_INFO, NO_RESPONSE, COMPLETED
    reject_reason TEXT,
    receipt_token VARCHAR(100) UNIQUE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP WITH TIME ZONE
);

-- 11. Appointments
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    case_id VARCHAR(50) REFERENCES cases(id) ON DELETE CASCADE,
    facility_code VARCHAR(50) REFERENCES facilities(code) ON DELETE CASCADE,
    slot_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'BOOKED' -- BOOKED, ATTENDED, CANCELLED, NO_SHOW, COMPLETED
);

-- 12. Messages
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    case_id VARCHAR(50) REFERENCES cases(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL, -- SMS, WHATSAPP, VOICE, IN_APP, PRINT
    language VARCHAR(20) DEFAULT 'Arabic',
    template_id VARCHAR(100) NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'SENT', -- SENT, DELIVERED, OPENED, FAILED
    ts TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Teach-Back Confirmations
CREATE TABLE IF NOT EXISTS teach_back (
    id SERIAL PRIMARY KEY,
    case_id VARCHAR(50) REFERENCES cases(id) ON DELETE CASCADE,
    language VARCHAR(20) DEFAULT 'Arabic',
    questions JSONB DEFAULT '[]'::jsonb,
    answers JSONB DEFAULT '{}'::jsonb,
    passed BOOLEAN DEFAULT FALSE,
    assisted_by INT REFERENCES users(id) ON DELETE SET NULL,
    ts TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    case_id VARCHAR(50) REFERENCES cases(id) ON DELETE CASCADE,
    kind VARCHAR(50) NOT NULL, -- CALL, RESCHEDULE, DOCS, REVIEW, ESCALATION
    assigned_role VARCHAR(50) NOT NULL,
    assigned_user INT REFERENCES users(id) ON DELETE SET NULL,
    due_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'PENDING',
    created_by_rule VARCHAR(50),
    outcome TEXT
);

-- 15. Care Barriers
CREATE TABLE IF NOT EXISTS barriers (
    id SERIAL PRIMARY KEY,
    case_id VARCHAR(50) REFERENCES cases(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    note TEXT,
    response_code VARCHAR(100),
    recorded_by INT REFERENCES users(id) ON DELETE SET NULL,
    ts TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE
);

-- 16. Clinician Micro-Consults
CREATE TABLE IF NOT EXISTS consults (
    id SERIAL PRIMARY KEY,
    case_id VARCHAR(50) REFERENCES cases(id) ON DELETE CASCADE,
    from_user INT REFERENCES users(id) ON DELETE CASCADE,
    to_specialty VARCHAR(100) NOT NULL,
    to_user INT REFERENCES users(id) ON DELETE SET NULL,
    question TEXT NOT NULL,
    answer TEXT,
    status VARCHAR(50) DEFAULT 'OPEN',
    asked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    answered_at TIMESTAMP WITH TIME ZONE
);

-- 17. Rules
CREATE TABLE IF NOT EXISTS rules (
    id VARCHAR(50) PRIMARY KEY, -- 'R-ACK-24H'
    name VARCHAR(255) NOT NULL,
    json JSONB DEFAULT '{}'::jsonb,
    active BOOLEAN DEFAULT TRUE,
    version VARCHAR(50) DEFAULT '1.0',
    approved_by VARCHAR(255)
);

-- 18. Rule Firings
CREATE TABLE IF NOT EXISTS rule_firings (
    id SERIAL PRIMARY KEY,
    rule_id VARCHAR(50) REFERENCES rules(id) ON DELETE CASCADE,
    case_id VARCHAR(50) REFERENCES cases(id) ON DELETE CASCADE,
    ts TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason TEXT NOT NULL,
    action VARCHAR(255) NOT NULL,
    overridden_by INT REFERENCES users(id) ON DELETE SET NULL,
    override_reason TEXT
);

-- 19. Risk Scores (Optional ML)
CREATE TABLE IF NOT EXISTS risk_scores (
    case_id VARCHAR(50) PRIMARY KEY REFERENCES cases(id) ON DELETE CASCADE,
    ts TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    probability DOUBLE PRECISION NOT NULL,
    top3_reasons JSONB DEFAULT '[]'::jsonb,
    model_version VARCHAR(50) DEFAULT 'demo_v1'
);

-- 20. Tamper-Evident Append-Only Audit Trail
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    ts TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actor VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    object VARCHAR(100) NOT NULL,
    detail TEXT,
    prev_hash VARCHAR(100) NOT NULL,
    hash VARCHAR(100) NOT NULL
);

-- 21. Recovery Simulator Run
CREATE TABLE IF NOT EXISTS simulation_run (
    id SERIAL PRIMARY KEY,
    run_token VARCHAR(100) UNIQUE NOT NULL,
    case_id VARCHAR(50) REFERENCES cases(id) ON DELETE CASCADE,
    scenario_template VARCHAR(100),
    created_by INT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    assumptions_version VARCHAR(50) DEFAULT 'v1.2-2026',
    baseline_metrics JSONB DEFAULT '{}'::jsonb
);

-- 22. Simulation Option
CREATE TABLE IF NOT EXISTS simulation_option (
    id SERIAL PRIMARY KEY,
    run_id INT REFERENCES simulation_run(id) ON DELETE CASCADE,
    option_code VARCHAR(50) NOT NULL,
    option_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    staff_minutes INT DEFAULT 15,
    assumptions JSONB DEFAULT '[]'::jsonb,
    projected_completion_rate DOUBLE PRECISION NOT NULL,
    projected_unresolved_cases INT DEFAULT 0,
    projected_overdue_tasks INT DEFAULT 0,
    projected_coordinator_minutes INT DEFAULT 0
);

-- 23. Simulation Result
CREATE TABLE IF NOT EXISTS simulation_result (
    id SERIAL PRIMARY KEY,
    run_id INT REFERENCES simulation_run(id) ON DELETE CASCADE,
    recommended_option_code VARCHAR(50) NOT NULL,
    delta_completion DOUBLE PRECISION NOT NULL,
    delta_workload_minutes INT NOT NULL,
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 24. Simulation Review & Approval
CREATE TABLE IF NOT EXISTS simulation_review (
    id SERIAL PRIMARY KEY,
    run_id INT REFERENCES simulation_run(id) ON DELETE CASCADE,
    reviewed_by INT REFERENCES users(id) ON DELETE CASCADE,
    approved BOOLEAN DEFAULT FALSE,
    approved_option_code VARCHAR(50),
    review_notes TEXT,
    applied_at TIMESTAMP WITH TIME ZONE,
    task_id INT REFERENCES tasks(id) ON DELETE SET NULL
);

-- 25. Outcome Comparison (Forecast vs Observed)
CREATE TABLE IF NOT EXISTS outcome_comparison (
    id SERIAL PRIMARY KEY,
    case_id VARCHAR(50) REFERENCES cases(id) ON DELETE CASCADE,
    run_id INT REFERENCES simulation_run(id) ON DELETE CASCADE,
    forecast_completion_prob DOUBLE PRECISION NOT NULL,
    observed_outcome VARCHAR(50),
    observed_at TIMESTAMP WITH TIME ZONE,
    variance DOUBLE PRECISION
);

