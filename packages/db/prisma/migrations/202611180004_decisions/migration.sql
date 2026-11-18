-- CreateEnum
CREATE TYPE "DecisionChoice" AS ENUM ('approve', 'cancel', 'question');

-- CreateTable
CREATE TABLE "decision_requests" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "contactId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "issuerId" TEXT NOT NULL,
    "issuerLabel" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "term" TEXT NOT NULL,
    "respondBy" DATE NOT NULL,
    "deadlineAt" TIMESTAMPTZ NOT NULL,
    "customerNote" TEXT,
    "supersededAt" TIMESTAMPTZ,
    "decidedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_links" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "digest" TEXT NOT NULL,
    "validFrom" TIMESTAMPTZ NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "revokedAt" TIMESTAMPTZ,

    CONSTRAINT "decision_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_challenges" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "digest" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "verifiedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_responses" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "choice" "DecisionChoice" NOT NULL,
    "question" TEXT,
    "cycleVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_deliveries" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "ciphertext" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAt" TIMESTAMPTZ NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "leaseUntil" TIMESTAMPTZ,
    "leaseToken" UUID,

    CONSTRAINT "decision_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_provider_events" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ,

    CONSTRAINT "mail_provider_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppressed_recipients" (
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppressed_recipients_pkey" PRIMARY KEY ("email")
);

-- CreateIndex
CREATE INDEX "decision_requests_workspaceId_contactId_idx" ON "decision_requests"("workspaceId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "decision_requests_workspaceId_id_key" ON "decision_requests"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "decision_requests_workspaceId_cycleId_revision_key" ON "decision_requests"("workspaceId", "cycleId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "decision_links_digest_key" ON "decision_links"("digest");

-- CreateIndex
CREATE INDEX "decision_links_workspaceId_requestId_idx" ON "decision_links"("workspaceId", "requestId");

-- CreateIndex
CREATE INDEX "decision_challenges_workspaceId_requestId_sessionId_created_idx" ON "decision_challenges"("workspaceId", "requestId", "sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "decision_responses_workspaceId_requestId_sessionId_key_key" ON "decision_responses"("workspaceId", "requestId", "sessionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "decision_deliveries_providerId_key" ON "decision_deliveries"("providerId");

-- CreateIndex
CREATE INDEX "decision_deliveries_status_runAt_idx" ON "decision_deliveries"("status", "runAt");

-- CreateIndex
CREATE INDEX "decision_deliveries_workspaceId_requestId_status_idx" ON "decision_deliveries"("workspaceId", "requestId", "status");

-- CreateIndex
CREATE INDEX "mail_provider_events_processedAt_createdAt_idx" ON "mail_provider_events"("processedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "decision_requests" ADD CONSTRAINT "decision_requests_workspaceId_cycleId_fkey" FOREIGN KEY ("workspaceId", "cycleId") REFERENCES "renewal_cycles"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_requests" ADD CONSTRAINT "decision_requests_workspaceId_contactId_fkey" FOREIGN KEY ("workspaceId", "contactId") REFERENCES "contacts"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_links" ADD CONSTRAINT "decision_links_workspaceId_requestId_fkey" FOREIGN KEY ("workspaceId", "requestId") REFERENCES "decision_requests"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_challenges" ADD CONSTRAINT "decision_challenges_workspaceId_requestId_fkey" FOREIGN KEY ("workspaceId", "requestId") REFERENCES "decision_requests"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_responses" ADD CONSTRAINT "decision_responses_workspaceId_requestId_fkey" FOREIGN KEY ("workspaceId", "requestId") REFERENCES "decision_requests"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_deliveries" ADD CONSTRAINT "decision_deliveries_workspaceId_requestId_fkey" FOREIGN KEY ("workspaceId", "requestId") REFERENCES "decision_requests"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE UNIQUE INDEX decision_current_revision
  ON decision_requests ("workspaceId", "cycleId") WHERE "supersededAt" IS NULL;
CREATE UNIQUE INDEX decision_one_final_response
  ON decision_responses ("workspaceId", "requestId") WHERE choice IN ('approve', 'cancel');
ALTER TABLE decision_responses ADD CONSTRAINT decision_question_check
  CHECK ((choice = 'question') = (question IS NOT NULL));
ALTER TABLE decision_requests ADD CONSTRAINT decision_amount_check CHECK ("amountMinor" >= 0 AND revision > 0);
ALTER TABLE decision_challenges ADD CONSTRAINT decision_attempts_check CHECK (attempts BETWEEN 0 AND 5);
ALTER TABLE decision_deliveries ADD CONSTRAINT decision_delivery_lease_check
  CHECK ((status = 'leased') = ("leaseUntil" IS NOT NULL AND "leaseToken" IS NOT NULL));

DO $$
DECLARE tab text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['decision_requests', 'decision_links', 'decision_challenges', 'decision_responses', 'decision_deliveries']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tab);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tab);
    EXECUTE format('CREATE POLICY tenant ON %I USING ("workspaceId" = public.current_workspace())
      WITH CHECK ("workspaceId" = public.current_workspace())', tab);
  END LOOP;
END
$$;

CREATE POLICY decision_link_lookup ON decision_links FOR SELECT USING (
  public.current_workspace() IS NULL AND digest = NULLIF(current_setting('renewrelay.decision_digest', true), '')
);
CREATE POLICY decision_delivery_worker ON decision_deliveries
  USING (current_user = 'renewrelay_worker') WITH CHECK (current_user = 'renewrelay_worker');
