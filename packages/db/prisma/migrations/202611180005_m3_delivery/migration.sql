-- AlterTable
ALTER TABLE "decision_challenges" ADD COLUMN     "accessDigest" TEXT;

-- AlterTable
ALTER TABLE "decision_deliveries" ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "firstAttemptAt" TIMESTAMPTZ,
ADD COLUMN     "lastError" TEXT;

-- AlterTable
ALTER TABLE "mail_provider_events" ADD COLUMN     "providerEmailId" TEXT;

-- CreateTable
CREATE TABLE "decision_sessions" (
    "id" UUID NOT NULL,
    "digest" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "csrfDigest" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_notifications" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "cycleId" UUID,
    "recipientId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "runAt" TIMESTAMPTZ NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" UUID,
    "leaseUntil" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "decision_sessions_digest_key" ON "decision_sessions"("digest");

-- CreateIndex
CREATE INDEX "decision_sessions_expiresAt_idx" ON "decision_sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "internal_notifications_dedupeKey_key" ON "internal_notifications"("dedupeKey");

-- CreateIndex
CREATE INDEX "internal_notifications_status_runAt_idx" ON "internal_notifications"("status", "runAt");

-- CreateIndex
CREATE UNIQUE INDEX "decision_deliveries_dedupeKey_key" ON "decision_deliveries"("dedupeKey");


ALTER TABLE decision_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY session_scope ON decision_sessions
 USING (digest = NULLIF(current_setting('renewrelay.session_digest', true), ''))
 WITH CHECK (digest = NULLIF(current_setting('renewrelay.session_digest', true), ''));

ALTER TABLE internal_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY internal_tenant ON internal_notifications
 USING ("workspaceId" = public.current_workspace())
 WITH CHECK ("workspaceId" = public.current_workspace());
CREATE POLICY internal_dispatch ON internal_notifications
 USING (current_user = 'renewrelay_worker') WITH CHECK (current_user = 'renewrelay_worker');

-- Dispatch holds workspace identifiers only, without customer data.
CREATE TABLE notification_workspaces (id uuid PRIMARY KEY REFERENCES workspaces(id));
INSERT INTO notification_workspaces SELECT id FROM workspaces;
ALTER TABLE notification_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_workspaces FORCE ROW LEVEL SECURITY;
CREATE POLICY dispatch_insert ON notification_workspaces FOR INSERT
 WITH CHECK (id = public.current_workspace());
CREATE POLICY dispatch_read ON notification_workspaces FOR SELECT
 USING (current_user = 'renewrelay_worker');
GRANT SELECT ON notification_workspaces TO renewrelay_worker;
GRANT INSERT ON notification_workspaces TO renewrelay_app;

ALTER TABLE internal_notifications ADD CONSTRAINT internal_lease_check
 CHECK ((status = 'leased') = ("leaseToken" IS NOT NULL AND "leaseUntil" IS NOT NULL));
