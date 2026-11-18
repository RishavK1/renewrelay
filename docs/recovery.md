# RenewRelay recovery

The local drill is `npm run test:restore` with a dedicated local
`MIGRATION_DATABASE_URL`. It creates an isolated database, restores a dump,
checks cycle/response/audit counts, revokes restored sessions and links, and
quarantines pending sends. The restored database remains available for inspection.

For a production recovery, the release owner performs these steps.

1. Set `OUTBOUND_MAIL_ENABLED=false` and stop application ingress and workers. Restore
   RDS into an isolated network with runtime access withheld.
2. Confirm migrations, constraints, role grants, encryption keys and audit/history
   counts. Reapply deletion and revocation records captured after the restore point.
3. Quarantine pending/leased mail jobs. Expire restored staff and public sessions
   and revoke restored public links. Preserve decisions and quoted terms.
4. Compare provider message history and webhook IDs against uncertain deliveries.
   Resend deduplication expires after 24 hours. Do not retry uncertain acceptance
   outside that window. Retain an internal delivery exception for review.
5. Refresh suppression records from provider events. Reconcile platform payments
   once billing is enabled. Record approvals for any corrected state.
6. Verify tenant access and the staff-to-client workflow in the isolated restore.
   Reissue current links through an authorized command. Regenerate future
   schedules and avoid a backlog of customer messages.
7. Resume ingress and workers only after the release owner records the checks.
   Measure the actual recovery time and data-loss window.

The local dump drill measures logical restoration. RDS point-in-time recovery,
production IAM/networking, live mail reconciliation and the proposed recovery
targets require staging infrastructure and provider credentials.

The [release runbook](RELEASE_OPERATIONS.md) defines migration/image compatibility,
startup readiness, isolated migration credentials, operational alarms and incident
responsibilities. Migration 016 adds indexes; roll back to the compatible prior
image without dropping those indexes. Never automate a destructive schema rollback.
When the local database runs in Docker, set RR_TEST_PG_CONTAINER to its isolated
renewrelay-* container name to use matching-version PostgreSQL tools for the drill.
