ALTER TABLE workspace_billing
  ADD COLUMN "cancellationId" UUID,
  ADD COLUMN "cancellationMode" TEXT;

-- Preserve outstanding cancellation work across the upgrade.
UPDATE workspace_billing SET
  "cancellationId" = gen_random_uuid(),
  "cancellationMode" = CASE WHEN "deletionRequestedAt" IS NULL THEN 'at_term' ELSE 'immediate' END
WHERE "cancelRequestedAt" IS NOT NULL;

ALTER TABLE workspace_billing ADD CONSTRAINT cancellation_operation_check CHECK (
  (("cancellationId" IS NULL AND "cancellationMode" IS NULL)
    OR ("cancellationId" IS NOT NULL AND "cancellationMode" IS NOT NULL AND "cancellationMode" IN ('at_term', 'immediate')))
  AND ("cancelRequestedAt" IS NULL OR ("cancellationId" IS NOT NULL AND "cancellationMode" IS NOT NULL))
);
