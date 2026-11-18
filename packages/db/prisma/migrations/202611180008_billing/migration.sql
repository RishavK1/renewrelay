-- CreateTable
CREATE TABLE "workspace_billing" (
    "workspaceId" UUID NOT NULL,
    "trialEndsAt" TIMESTAMPTZ NOT NULL,
    "paidThrough" TIMESTAMPTZ,
    "paymentFailed" BOOLEAN NOT NULL DEFAULT false,
    "cancelAtTerm" BOOLEAN NOT NULL DEFAULT false,
    "providerId" TEXT,
    "providerStatus" TEXT,
    "checkoutIntent" UUID,
    "checkoutKey" TEXT,
    "checkoutState" TEXT NOT NULL DEFAULT 'none',
    "checkoutUrl" TEXT,
    "cancelRequestedAt" TIMESTAMPTZ,
    "lastCheckedAt" TIMESTAMPTZ,
    "reconcileAfter" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletionRequestedAt" TIMESTAMPTZ,
    "purgeAfter" TIMESTAMPTZ,
    "purgedAt" TIMESTAMPTZ,
    "recoveryOwnerId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "workspace_billing_pkey" PRIMARY KEY ("workspaceId")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorCode" TEXT,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_payments" (
    "id" TEXT NOT NULL,
    "workspaceId" UUID NOT NULL,
    "providerId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "periodStart" TIMESTAMPTZ NOT NULL,
    "periodEnd" TIMESTAMPTZ NOT NULL,
    "verifiedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_billing_providerId_key" ON "workspace_billing"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_billing_checkoutIntent_key" ON "workspace_billing"("checkoutIntent");

-- CreateIndex
CREATE INDEX "workspace_billing_reconcileAfter_idx" ON "workspace_billing"("reconcileAfter");

-- CreateIndex
CREATE INDEX "billing_events_processedAt_runAt_idx" ON "billing_events"("processedAt", "runAt");

-- CreateIndex
CREATE INDEX "billing_payments_workspaceId_periodEnd_idx" ON "billing_payments"("workspaceId", "periodEnd");

-- AddForeignKey
ALTER TABLE "workspace_billing" ADD CONSTRAINT "workspace_billing_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Existing pilot workspaces receive the remainder of a 14-day trial from creation.
INSERT INTO workspace_billing ("workspaceId", "trialEndsAt")
 SELECT id, "createdAt" + interval '14 days' FROM workspaces;
ALTER TABLE workspace_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_billing FORCE ROW LEVEL SECURITY;
CREATE POLICY billing_tenant ON workspace_billing
 USING ("workspaceId" = public.current_workspace()) WITH CHECK ("workspaceId" = public.current_workspace());
CREATE POLICY billing_dispatch ON workspace_billing FOR SELECT
 USING (current_user = 'renewrelay_worker');
ALTER TABLE billing_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_payments FORCE ROW LEVEL SECURITY;
CREATE POLICY payment_tenant ON billing_payments
 USING ("workspaceId" = public.current_workspace()) WITH CHECK ("workspaceId" = public.current_workspace());
ALTER TABLE workspace_billing ADD CONSTRAINT checkout_state_check
 CHECK ("checkoutState" IN ('none','creating','ready','uncertain','terminal'));
ALTER TABLE billing_payments ADD CONSTRAINT paid_period_check
 CHECK ("periodEnd" > "periodStart" AND "amountMinor" > 0 AND currency = 'INR');
