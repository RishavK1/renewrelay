-- CreateEnum
CREATE TYPE "Recurrence" AS ENUM ('once', 'monthly', 'yearly');

-- CreateEnum
CREATE TYPE "RenewalPayer" AS ENUM ('agency', 'client');

-- CreateEnum
CREATE TYPE "RenewalState" AS ENUM ('draft', 'open', 'ready', 'renewed', 'cancelled', 'withdrawn');

-- CreateEnum
CREATE TYPE "RenewalAction" AS ENUM ('renew', 'cancel');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('not_applicable', 'to_invoice', 'invoiced');

-- CreateTable
CREATE TABLE "renewal_items" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "operatorId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "recurrence" "Recurrence" NOT NULL,
    "anchorOn" DATE NOT NULL,
    "archivedAt" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "renewal_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renewal_cycles" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "operatorId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "service" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "state" "RenewalState" NOT NULL,
    "intendedAction" "RenewalAction",
    "expiryOn" DATE NOT NULL,
    "noticeBy" DATE,
    "respondBy" DATE,
    "nextActionOn" DATE NOT NULL,
    "timezone" TEXT NOT NULL,
    "payer" "RenewalPayer" NOT NULL,
    "rebillable" BOOLEAN NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "supplierCostMinor" INTEGER,
    "clientQuoteMinor" INTEGER,
    "term" TEXT,
    "performedOn" DATE,
    "providerReference" TEXT,
    "outcomeNote" TEXT,
    "billingStatus" "InvoiceStatus" NOT NULL DEFAULT 'not_applicable',
    "invoiceReference" TEXT,
    "closedAt" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "renewal_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renewal_imports" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "actorId" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "rows" JSONB,
    "result" JSONB,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "committedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "renewal_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "renewal_items_workspaceId_clientId_archivedAt_idx" ON "renewal_items"("workspaceId", "clientId", "archivedAt");

-- CreateIndex
CREATE INDEX "renewal_items_workspaceId_operatorId_idx" ON "renewal_items"("workspaceId", "operatorId");

-- CreateIndex
CREATE UNIQUE INDEX "renewal_items_workspaceId_id_key" ON "renewal_items"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "renewal_cycles_workspaceId_state_nextActionOn_id_idx" ON "renewal_cycles"("workspaceId", "state", "nextActionOn", "id");

-- CreateIndex
CREATE INDEX "renewal_cycles_workspaceId_operatorId_nextActionOn_id_idx" ON "renewal_cycles"("workspaceId", "operatorId", "nextActionOn", "id");

-- CreateIndex
CREATE INDEX "renewal_cycles_workspaceId_billingStatus_idx" ON "renewal_cycles"("workspaceId", "billingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "renewal_cycles_workspaceId_id_key" ON "renewal_cycles"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "renewal_cycles_workspaceId_itemId_sequence_key" ON "renewal_cycles"("workspaceId", "itemId", "sequence");

-- CreateIndex
CREATE INDEX "renewal_imports_expiresAt_idx" ON "renewal_imports"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "renewal_imports_workspaceId_id_key" ON "renewal_imports"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "renewal_imports_workspaceId_actorId_digest_key" ON "renewal_imports"("workspaceId", "actorId", "digest");

-- AddForeignKey
ALTER TABLE "renewal_items" ADD CONSTRAINT "renewal_items_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_items" ADD CONSTRAINT "renewal_items_workspaceId_clientId_fkey" FOREIGN KEY ("workspaceId", "clientId") REFERENCES "clients"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_items" ADD CONSTRAINT "renewal_items_workspaceId_operatorId_fkey" FOREIGN KEY ("workspaceId", "operatorId") REFERENCES "memberships"("workspaceId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_cycles" ADD CONSTRAINT "renewal_cycles_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_cycles" ADD CONSTRAINT "renewal_cycles_workspaceId_itemId_fkey" FOREIGN KEY ("workspaceId", "itemId") REFERENCES "renewal_items"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_cycles" ADD CONSTRAINT "renewal_cycles_workspaceId_operatorId_fkey" FOREIGN KEY ("workspaceId", "operatorId") REFERENCES "memberships"("workspaceId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_imports" ADD CONSTRAINT "renewal_imports_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE UNIQUE INDEX renewal_cycles_one_open_per_item
  ON renewal_cycles ("workspaceId", "itemId") WHERE "closedAt" IS NULL;

ALTER TABLE renewal_cycles
  ADD CONSTRAINT renewal_cycle_sequence_check CHECK (sequence > 0),
  ADD CONSTRAINT renewal_cycle_closed_check
    CHECK (("closedAt" IS NULL) = (state IN ('draft', 'open', 'ready'))),
  ADD CONSTRAINT renewal_cycle_dates_check CHECK (
    ("noticeBy" IS NULL OR "noticeBy" <= "expiryOn")
    AND ("respondBy" IS NULL OR "respondBy" <= LEAST("noticeBy", "expiryOn"))
    AND "nextActionOn" <= "expiryOn"
  ),
  ADD CONSTRAINT renewal_cycle_amounts_check
    CHECK ("supplierCostMinor" >= 0 AND "clientQuoteMinor" >= 0),
  ADD CONSTRAINT renewal_cycle_rebillable_check CHECK (NOT rebillable OR payer = 'agency'),
  ADD CONSTRAINT renewal_cycle_billing_check CHECK (
    ("billingStatus" = 'not_applicable' OR (state IN ('renewed', 'cancelled') AND payer = 'agency' AND rebillable))
    AND ("invoiceReference" IS NULL OR "billingStatus" = 'invoiced')
  );

ALTER TABLE renewal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewal_items FORCE ROW LEVEL SECURITY;
ALTER TABLE renewal_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewal_cycles FORCE ROW LEVEL SECURITY;
ALTER TABLE renewal_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewal_imports FORCE ROW LEVEL SECURITY;

CREATE POLICY renewal_item_tenant ON renewal_items
  USING ("workspaceId" = public.current_workspace())
  WITH CHECK ("workspaceId" = public.current_workspace());

CREATE POLICY renewal_cycle_tenant ON renewal_cycles
  USING ("workspaceId" = public.current_workspace())
  WITH CHECK ("workspaceId" = public.current_workspace());

CREATE POLICY renewal_import_actor ON renewal_imports
  USING ("workspaceId" = public.current_workspace() AND "actorId" = public.current_actor())
  WITH CHECK ("workspaceId" = public.current_workspace() AND "actorId" = public.current_actor());

CREATE POLICY renewal_import_cleanup ON renewal_imports FOR SELECT
  USING (current_user = 'renewrelay_worker' AND "committedAt" IS NULL AND "expiresAt" <= now());
CREATE POLICY renewal_import_delete ON renewal_imports FOR DELETE
  USING (current_user = 'renewrelay_worker' AND "committedAt" IS NULL AND "expiresAt" <= now());
