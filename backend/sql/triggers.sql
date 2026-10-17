-- HealthPulse AI CareLoop: Tamper-Evident Trigger on audit_log
-- Raises an error on any UPDATE, DELETE or TRUNCATE to enforce append-only immutability.

CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Tamper-Evident Security Violation: UPDATE, DELETE or TRUNCATE operations are strictly forbidden on audit_log table (ADHICS Compliance).';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;

CREATE TRIGGER trg_audit_log_immutable
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_modification();

-- Also guard against truncate where supported
CREATE OR REPLACE FUNCTION prevent_audit_log_truncate()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Tamper-Evident Security Violation: TRUNCATE is strictly forbidden on audit_log table.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_no_truncate ON audit_log;

CREATE TRIGGER trg_audit_log_no_truncate
BEFORE TRUNCATE ON audit_log
EXECUTE FUNCTION prevent_audit_log_truncate();
