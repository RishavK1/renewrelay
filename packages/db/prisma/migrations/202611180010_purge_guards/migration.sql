-- Mail-worker credentials cannot delete live customer records even if a worker
-- bug supplies an unrelated tenant ID. Maintenance credentials remain separate.
CREATE FUNCTION public.guard_retention_delete() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE tenant uuid;
BEGIN
  IF current_user <> 'renewrelay_worker' THEN RETURN OLD; END IF;
  tenant := COALESCE((to_jsonb(OLD)->>'workspaceId')::uuid, public.current_workspace());
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_billing b
    WHERE b."workspaceId" = tenant AND b."deletionRequestedAt" IS NOT NULL
      AND b."purgeAfter" <= now() AND b."purgedAt" IS NULL
      AND (b."checkoutIntent" IS NULL OR
        (b."providerId" IS NOT NULL AND b."providerStatus" IN ('cancelled','completed','expired')))
  ) THEN
    RAISE EXCEPTION 'Operational retention window or provider cancellation is incomplete' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END
$$;
DO $$
DECLARE tab text;
BEGIN
  FOREACH tab IN ARRAY ARRAY[
    'decision_responses','decision_challenges','decision_deliveries','decision_links','decision_requests',
    'internal_notifications','mail_jobs','renewal_cycles','renewal_items','contacts','clients',
    'invitations','memberships','audit_events','command_receipts','notification_workspaces'
  ] LOOP
    EXECUTE format('CREATE TRIGGER retention_delete_guard BEFORE DELETE ON %I
      FOR EACH ROW EXECUTE FUNCTION public.guard_retention_delete()', tab);
  END LOOP;
END
$$;
