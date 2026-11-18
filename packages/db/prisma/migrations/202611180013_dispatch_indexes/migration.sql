CREATE INDEX decision_delivery_pending_tenant ON decision_deliveries ("workspaceId", "runAt", id) WHERE status = 'pending';
CREATE INDEX internal_notification_pending_tenant ON internal_notifications ("workspaceId", "runAt", id) WHERE status = 'pending';
CREATE INDEX mail_job_pending_tenant ON mail_jobs ("workspaceId", "runAt", id) WHERE status = 'pending';
