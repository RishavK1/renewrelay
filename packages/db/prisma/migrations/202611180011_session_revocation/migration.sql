-- Allow tenant-bound revocation without exposing unrelated decision sessions.
CREATE POLICY session_tenant_read ON decision_sessions FOR SELECT
 USING (EXISTS (
   SELECT 1 FROM decision_links link
   WHERE link.digest = decision_sessions."linkDigest" AND link."workspaceId" = public.current_workspace()
 ));
CREATE POLICY session_tenant_revoke ON decision_sessions FOR UPDATE
 USING (EXISTS (
   SELECT 1 FROM decision_links link
   WHERE link.digest = decision_sessions."linkDigest" AND link."workspaceId" = public.current_workspace()
 ))
 WITH CHECK (EXISTS (
   SELECT 1 FROM decision_links link
   WHERE link.digest = decision_sessions."linkDigest" AND link."workspaceId" = public.current_workspace()
 ));
