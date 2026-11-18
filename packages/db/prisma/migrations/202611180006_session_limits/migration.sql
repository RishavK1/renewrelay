ALTER TABLE decision_sessions ADD COLUMN "linkDigest" TEXT;
CREATE INDEX "decision_sessions_linkDigest_createdAt_idx" ON decision_sessions ("linkDigest", "createdAt");
CREATE POLICY session_exchange ON decision_sessions FOR SELECT
 USING ("linkDigest" = NULLIF(current_setting('renewrelay.decision_digest', true), ''));
CREATE POLICY session_cleanup_read ON decision_sessions FOR SELECT
 USING (current_user = 'renewrelay_worker' AND "expiresAt" <= now());
CREATE POLICY session_cleanup_delete ON decision_sessions FOR DELETE
 USING (current_user = 'renewrelay_worker' AND "expiresAt" <= now());
