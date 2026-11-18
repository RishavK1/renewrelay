-- Cross-tenant maintenance has its own bounded indexed access paths.
CREATE INDEX mail_jobs_operational_due ON mail_jobs ("runAt") WHERE status IN ('pending','leased');
CREATE INDEX decision_deliveries_operational_due ON decision_deliveries ("runAt") WHERE status IN ('pending','leased');
CREATE INDEX internal_notifications_operational_due ON internal_notifications ("runAt") WHERE status IN ('pending','leased');
CREATE INDEX billing_events_operational_pending ON billing_events ("createdAt") WHERE "processedAt" IS NULL;
CREATE INDEX mail_jobs_uncertain ON mail_jobs (id) WHERE status IN ('uncertain','failed');
CREATE INDEX decision_deliveries_uncertain ON decision_deliveries (id) WHERE status IN ('uncertain','failed');
CREATE INDEX internal_notifications_uncertain ON internal_notifications (id) WHERE status IN ('uncertain','failed');
