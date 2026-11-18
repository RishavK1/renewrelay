CREATE POLICY import_purge ON renewal_imports FOR DELETE
 USING (current_user = 'renewrelay_worker' AND "workspaceId" = public.current_workspace()
 AND EXISTS (SELECT 1 FROM workspace_billing b WHERE b."workspaceId" = renewal_imports."workspaceId"
   AND b."purgeAfter" <= now() AND b."deletionRequestedAt" IS NOT NULL));
CREATE POLICY receipt_purge ON command_receipts FOR DELETE
 USING (current_user = 'renewrelay_worker'
 AND (scope::jsonb->>1 = public.current_workspace()::text OR result->>'id' = public.current_workspace()::text)
 AND EXISTS (SELECT 1 FROM workspace_billing b WHERE b."workspaceId" = public.current_workspace()
   AND b."purgeAfter" <= now() AND b."deletionRequestedAt" IS NOT NULL));
CREATE POLICY dispatch_purge ON notification_workspaces FOR DELETE
 USING (current_user = 'renewrelay_worker' AND id = public.current_workspace());
CREATE POLICY session_purge ON decision_sessions FOR DELETE
 USING (current_user = 'renewrelay_worker' AND "linkDigest" IN (
   SELECT digest FROM decision_links WHERE "workspaceId" = public.current_workspace()
 ) AND EXISTS (SELECT 1 FROM workspace_billing b WHERE b."workspaceId" = public.current_workspace()
   AND b."purgeAfter" <= now() AND b."deletionRequestedAt" IS NOT NULL));
CREATE POLICY import_purge_read ON renewal_imports FOR SELECT
 USING (current_user = 'renewrelay_worker' AND "workspaceId" = public.current_workspace()
 AND EXISTS (SELECT 1 FROM workspace_billing b WHERE b."workspaceId" = renewal_imports."workspaceId"
   AND b."purgeAfter" <= now() AND b."deletionRequestedAt" IS NOT NULL));
CREATE POLICY receipt_purge_read ON command_receipts FOR SELECT
 USING (current_user = 'renewrelay_worker'
 AND (scope::jsonb->>1 = public.current_workspace()::text OR result->>'id' = public.current_workspace()::text)
 AND EXISTS (SELECT 1 FROM workspace_billing b WHERE b."workspaceId" = public.current_workspace()
   AND b."purgeAfter" <= now() AND b."deletionRequestedAt" IS NOT NULL));
