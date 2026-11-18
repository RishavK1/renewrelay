CREATE TABLE auth_action_receipts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "actorId" TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
 scope TEXT NOT NULL, key TEXT NOT NULL, digest TEXT NOT NULL, result JSONB NOT NULL,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE("actorId",scope,key)
);
ALTER TABLE auth_action_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_action_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY identity_receipt_actor ON auth_action_receipts
 USING ("actorId" = public.current_actor()) WITH CHECK ("actorId" = public.current_actor());
GRANT SELECT, INSERT ON auth_action_receipts TO renewrelay_auth;
REVOKE SELECT, INSERT ON command_receipts FROM renewrelay_auth;
CREATE TABLE auth_security_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "userId" TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
 event TEXT NOT NULL, details JSONB NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auth_security_events_user_time ON auth_security_events("userId","createdAt",id);
ALTER TABLE auth_security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_security_events FORCE ROW LEVEL SECURITY;
CREATE POLICY security_event_actor ON auth_security_events
 USING ("userId" = public.current_actor()) WITH CHECK ("userId" = public.current_actor());
GRANT SELECT, INSERT ON auth_security_events TO renewrelay_auth;
ALTER TABLE decision_requests ADD CONSTRAINT request_issuer_tenant_fk FOREIGN KEY ("workspaceId","issuerId") REFERENCES memberships("workspaceId","userId") ON DELETE RESTRICT;
ALTER TABLE invitations ADD CONSTRAINT invitation_issuer_tenant_fk FOREIGN KEY ("workspaceId","issuedBy") REFERENCES memberships("workspaceId","userId") ON DELETE RESTRICT;
CREATE FUNCTION check_decision_contact_client() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM renewal_cycles cycle JOIN renewal_items item
  ON item.id = cycle."itemId" AND item."workspaceId" = cycle."workspaceId"
  JOIN contacts contact ON contact.id = NEW."contactId" AND contact."workspaceId" = NEW."workspaceId"
  WHERE cycle.id = NEW."cycleId" AND cycle."workspaceId" = NEW."workspaceId" AND contact."clientId" = item."clientId")
 THEN RAISE EXCEPTION 'Decision recipient must belong to the renewal client' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER decision_contact_client BEFORE INSERT ON decision_requests FOR EACH ROW EXECUTE FUNCTION check_decision_contact_client();
