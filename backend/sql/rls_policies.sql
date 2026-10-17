-- HealthPulse AI CareLoop: PostgreSQL Row-Level Security (RLS) Policies
-- Department of Health - Abu Dhabi · ADHICS Data Segregation Guidelines

-- 1. Enable RLS on Clinical Tables
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE consults ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_items ENABLE ROW LEVEL SECURITY;

-- 2. Define Application Connection Role
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'careloop_app') THEN
        CREATE ROLE careloop_app WITH LOGIN;
    END IF;
END
$$;

-- Grant permissions to careloop_app
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO careloop_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO careloop_app;
-- Explicitly revoke UPDATE/DELETE on audit_log from careloop_app
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM careloop_app;

-- 3. RLS Policies for cases table
-- Sessions set session variables: app.role, app.user_id, app.facility

CREATE POLICY case_programme_access ON cases
FOR ALL
TO careloop_app
USING (
    current_setting('app.role', true) IN ('PM', 'COORD')
    OR (current_setting('app.role', true) IN ('GP', 'SCR') AND facility_code = current_setting('app.facility', true))
    OR (current_setting('app.role', true) = 'SPEC' AND (owner_user_id = current_setting('app.user_id', true)::int OR id IN (
        SELECT case_id FROM referrals WHERE to_facility = current_setting('app.facility', true)
    )))
    OR (current_setting('app.role', true) = 'CHW' AND owner_user_id = current_setting('app.user_id', true)::int)
    OR (current_setting('app.role', true) = 'PATIENT' AND patient_id = current_setting('app.patient_id', true))
);

-- Admin has zero access to clinical cases table
CREATE POLICY admin_no_clinical_access ON cases
FOR ALL
TO careloop_app
USING (
    current_setting('app.role', true) != 'ADMIN'
);

-- Auditor has read access to audit_log only
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY auditor_read_audit ON audit_log
FOR SELECT
TO careloop_app
USING (
    current_setting('app.role', true) IN ('AUDITOR', 'PM', 'ADMIN')
);
