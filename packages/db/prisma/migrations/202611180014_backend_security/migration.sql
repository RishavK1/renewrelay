ALTER TABLE auth_users ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE auth_sessions ADD COLUMN "mfaVerifiedAt" TIMESTAMP(3);
CREATE TABLE auth_two_factors (
 id TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
 secret TEXT NOT NULL, "backupCodes" TEXT NOT NULL, verified BOOLEAN NOT NULL DEFAULT true,
 "failedVerificationCount" INTEGER NOT NULL DEFAULT 0, "lockedUntil" TIMESTAMP(3)
);
CREATE INDEX auth_two_factors_userId_idx ON auth_two_factors ("userId");
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_two_factors TO renewrelay_auth;
CREATE TABLE api_rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL CHECK(count > 0), "expiresAt" TIMESTAMPTZ NOT NULL);
CREATE INDEX api_rate_limits_expiresAt_idx ON api_rate_limits ("expiresAt");
GRANT SELECT, INSERT, UPDATE ON api_rate_limits TO renewrelay_app;
GRANT SELECT, DELETE ON api_rate_limits TO renewrelay_worker;
ALTER TABLE decision_requests ADD COLUMN "expiryOn" DATE, ADD COLUMN "noticeBy" DATE;
-- Legacy snapshots remain null rather than inventing dates from mutable present-day cycles.
CREATE FUNCTION protect_decision_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_user IN ('renewrelay_app','renewrelay_worker') AND (
   (to_jsonb(OLD) - 'supersededAt' - 'decidedAt') IS DISTINCT FROM (to_jsonb(NEW) - 'supersededAt' - 'decidedAt')
   OR (OLD."supersededAt" IS NOT NULL AND NEW."supersededAt" IS DISTINCT FROM OLD."supersededAt")
   OR (OLD."decidedAt" IS NOT NULL AND NEW."decidedAt" IS DISTINCT FROM OLD."decidedAt")
 ) THEN RAISE EXCEPTION 'Decision snapshots and completed transitions are immutable' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_decision_snapshot BEFORE UPDATE ON decision_requests FOR EACH ROW EXECUTE FUNCTION protect_decision_snapshot();
ALTER TABLE internal_notifications ADD COLUMN "messageCiphertext" TEXT, ADD COLUMN "firstAttemptAt" TIMESTAMPTZ, ADD COLUMN "lastError" TEXT;
ALTER TABLE internal_notifications ADD CONSTRAINT internal_cycle_tenant_fk FOREIGN KEY ("workspaceId","cycleId") REFERENCES renewal_cycles("workspaceId",id) ON DELETE RESTRICT;
ALTER TABLE internal_notifications ADD CONSTRAINT internal_recipient_tenant_fk FOREIGN KEY ("workspaceId","recipientId") REFERENCES memberships("workspaceId","userId") ON DELETE RESTRICT;
ALTER TABLE decision_sessions ADD CONSTRAINT decision_session_link_fk FOREIGN KEY ("linkDigest") REFERENCES decision_links(digest) ON DELETE RESTRICT;
