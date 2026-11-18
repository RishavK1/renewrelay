-- Run after migrations. Provision the three LOGIN roles separately.
-- Each connection string must authenticate as its corresponding role.
GRANT USAGE ON SCHEMA public TO renewrelay_app, renewrelay_auth, renewrelay_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  auth_users, auth_sessions, auth_accounts, auth_verifications, auth_rate_limits TO renewrelay_auth;
GRANT SELECT, INSERT, UPDATE ON workspaces, memberships, invitations, clients, contacts, mail_jobs TO renewrelay_app;
GRANT SELECT, INSERT ON audit_events, command_receipts TO renewrelay_app;
GRANT SELECT ON mail_jobs TO renewrelay_worker;
GRANT UPDATE (status, attempts, ciphertext, "runAt", "leaseUntil", "leaseToken") ON mail_jobs TO renewrelay_worker;
GRANT SELECT, INSERT, UPDATE ON renewal_items, renewal_cycles, renewal_imports TO renewrelay_app;
GRANT SELECT ("expiresAt", "committedAt"), DELETE ON renewal_imports TO renewrelay_worker;
GRANT SELECT, INSERT ON decision_responses TO renewrelay_app;
GRANT SELECT, INSERT, UPDATE ON decision_requests, decision_links, decision_challenges, decision_deliveries TO renewrelay_app;
GRANT INSERT ON mail_provider_events TO renewrelay_app;
GRANT SELECT, UPDATE ON mail_provider_events TO renewrelay_worker;
GRANT SELECT, INSERT ON suppressed_recipients TO renewrelay_worker;
GRANT SELECT ON decision_deliveries TO renewrelay_worker;
GRANT UPDATE (status, attempts, ciphertext, "runAt", "leaseUntil", "leaseToken", "providerId") ON decision_deliveries TO renewrelay_worker;
GRANT SELECT, INSERT, UPDATE ON decision_sessions, internal_notifications TO renewrelay_app;
GRANT SELECT, INSERT, UPDATE ON internal_notifications TO renewrelay_worker;
GRANT SELECT ON workspaces, memberships, renewal_cycles, renewal_items, clients, contacts, decision_requests, decision_links TO renewrelay_worker;
GRANT INSERT, UPDATE ON decision_links TO renewrelay_worker;
GRANT INSERT ON decision_deliveries TO renewrelay_worker;
GRANT SELECT ON suppressed_recipients TO renewrelay_app;
GRANT SELECT ON mail_provider_events TO renewrelay_app;
GRANT UPDATE ("firstAttemptAt", "lastError") ON decision_deliveries TO renewrelay_worker;
GRANT SELECT ("expiresAt"), DELETE ON decision_sessions TO renewrelay_worker;
GRANT UPDATE ("messageCiphertext") ON decision_deliveries TO renewrelay_worker;
GRANT SELECT, INSERT, UPDATE ON workspace_billing TO renewrelay_app, renewrelay_worker;
GRANT SELECT, INSERT ON billing_payments TO renewrelay_app, renewrelay_worker;
GRANT INSERT ON billing_events TO renewrelay_app;
GRANT SELECT, UPDATE ON billing_events TO renewrelay_worker;
GRANT INSERT ON audit_events TO renewrelay_worker;
GRANT UPDATE (name, timezone, version, "updatedAt") ON workspaces TO renewrelay_worker;
GRANT UPDATE ("revokedAt") ON invitations TO renewrelay_worker;
GRANT DELETE ON decision_responses, decision_challenges, decision_deliveries, decision_links,
  decision_requests, internal_notifications, mail_jobs, renewal_cycles, renewal_items, contacts,
  clients, invitations, memberships, renewal_imports, audit_events, command_receipts,
  notification_workspaces TO renewrelay_worker;
GRANT SELECT ("linkDigest"), UPDATE ("expiresAt") ON decision_sessions TO renewrelay_worker;
GRANT SELECT ON audit_events, decision_responses, decision_challenges, renewal_imports, command_receipts TO renewrelay_worker;
GRANT SELECT ON invitations TO renewrelay_worker;

GRANT UPDATE ("expiresAt") ON decision_deliveries TO renewrelay_worker;

GRANT SELECT, INSERT, UPDATE, DELETE ON auth_two_factors TO renewrelay_auth;
GRANT SELECT, INSERT, UPDATE ON api_rate_limits TO renewrelay_app;
GRANT SELECT, DELETE ON api_rate_limits TO renewrelay_worker;
REVOKE UPDATE ON decision_requests FROM renewrelay_app;
GRANT UPDATE ("supersededAt", "decidedAt") ON decision_requests TO renewrelay_app;
GRANT SELECT (id) ON decision_sessions, renewal_imports TO renewrelay_worker;
GRANT SELECT, INSERT ON auth_action_receipts TO renewrelay_auth;
GRANT SELECT, INSERT ON auth_security_events TO renewrelay_auth;
