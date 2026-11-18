ALTER TABLE renewal_cycles
  ADD COLUMN "blockedReason" TEXT,
  ADD COLUMN "autoRenew" BOOLEAN NOT NULL DEFAULT false,
  ADD CONSTRAINT renewal_cycle_blocker_check
    CHECK ("blockedReason" IS NULL OR state IN ('open', 'ready'));

CREATE INDEX "renewal_cycles_workspaceId_nextActionOn_id_idx"
  ON renewal_cycles ("workspaceId", "nextActionOn", id);

ALTER TABLE renewal_imports ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
