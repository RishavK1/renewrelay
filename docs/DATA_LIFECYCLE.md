# RenewRelay data purpose and lifecycle inventory

This is the engineering inventory, not legal approval or a statutory retention
schedule. Product/privacy/finance owners must approve jurisdiction, purpose and
retention. No new financial-record, audit-history or shared-membership expiry is
enabled by batch 4.

| Data | Purpose and access | Current lifecycle | Remaining decision/verification |
|---|---|---|---|
| Global user/profile and provider-account metadata | Verified staff identity, own account export; auth role only | Explicit account deletion when no retained membership remains | Business basis, shared identity policy and backup/vendor erasure |
| Auth passwords, MFA secret/backup verifiers | Authentication and recovery; never business/public export | Strong versioned hash, encrypted plugin factors, auth-user cascade | Production cost/secret rotation and manual recovery policy |
| Sessions and identity verification records | Authentication, recent-auth/MFA proof and token replay prevention | Expiry/revocation/reset; identity deletion removes linked records | Verify expiry cleanup/backup handling and approved metadata retention |
| Identity security events and receipts | Attributed security history and safe retries; own account only | Append-only runtime access, cascades with identity deletion | Approve event/receipt retention and incident access |
| Memberships, invitations and client contacts | Tenant authorization, named recipient and contact routing | Archive/removal retains history; workspace purge removes operational rows | Approved history/subject scope; inactive membership prevents shared identity deletion |
| Items, cycles, quote snapshots and responses | Decisions, provider execution and business history | Immutable decisions, closed-history retention and 30-day recoverable workspace deletion | Customer contract, approved operational retention and complete vendor processing inventory |
| Audit/correction notes | Attribution and append-only explanations | Runtime insert/read, guarded operational purge only | Approve retention, support access and complete incident/event coverage |
| Mail jobs and provider event metadata | Durable sends, suppression and reconciliation | Canceled/sent/expired decision credentials cleared; frozen internal payload expires; provider metadata separately retained | Provider retention, bounce/suppression deletion and account-wide limits |
| OTP/session/link material | Request-scoped access and abuse protection | Expiry, permanent revision revocation, attempt limits; digests instead of raw links | Backup/recovery reconciliation and approved challenge metadata retention |
| Import preview rows | Temporary validation and atomic commit | 24-hour expiry; commit clears normalized preview rows | Verify operational cleanup/backup expiry on staging |
| API rate counters | Shared abuse budgets | HMAC-derived keys; expire with window and bounded worker cleanup | Actual ingress IP trust and operational monitoring |
| SaaS billing/payment evidence and tombstone | Entitlement, reconciliation, cancellation and required financial history | Separate from operational purge; no new automatic financial deletion | Finance/legal retention, taxes, refunds, settlement and provider deletion scope |
| Backups and external systems | Recovery and provider execution evidence | Defined by deployment/vendor configuration, unverified locally | Approve backup expiry, PITR, processing locations, DPAs, restore revocation/deletion ledgers and erasure evidence |

The current vendors/adapters are PostgreSQL, local/hosted SMTP or Resend for mail,
Razorpay for the SaaS subscription, and the proposed cloud/edge/monitoring services
when deployed. Identity data is managed through Better Auth in our DB. No runtime
AI, replay/analytics SDK, attachment storage or external service-provider renewal
execution is part of the present V1. Reassess the inventory if that changes.

GET /api/v1/workspaces/{wid}/data-lifecycle exposes the current workspace's
engineering lifecycle status to its recently authenticated owner. It reports
policy dependencies and does not manufacture an approval. Workspace deletion still
requires the existing confirmation, stops sends/revokes access, preserves a 30-day
recovery period and waits for a confirmed terminal subscription before purge.

Account deletion has a different scope. It requires current password, recent MFA,
email confirmation and no retained memberships. The auth row is locked while that
condition is checked, and FK constraints prevent a concurrent new membership from
being silently orphaned. Auth children cascade, while identity verification rows
that identify the user are removed. Workspace/financial history and vendor/backup
erasure require their own approved lifecycle. No endpoint claims that deleting one
DB identity erases every externally retained copy.

Workspace exports are bounded and owner-authorized. Own account metadata, sessions
and security events have separate authenticated endpoints. Credentials and other
users' private identity records are excluded. Operational idempotency/verifier
internals are not presented as customer business records. Qualified privacy review
must determine whether additional subject-request handling is required.
