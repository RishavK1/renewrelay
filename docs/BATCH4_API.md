# Batch 4 API and security contract

All workspace paths below inherit /api/v1/workspaces/{wid}. Identity-management
paths inherit /api/v1/account. Staff requests require a verified database session.
Mutations use the configured Origin, Idempotency-Key and strict JSON payloads.
Relevant writes require expectedVersion. Responses use the existing data/error
wrapper and no-store caching. 429 responses include Retry-After.

## Identity and MFA

Use Better Auth's /api/auth paths for signup, verification, password sign-in and
recovery. The additional allowlisted POST endpoints are /two-factor/enable,
/two-factor/verify-totp, /two-factor/verify-backup-code,
/two-factor/generate-backup-codes and /two-factor/get-totp-uri.

Enable with {password}. The response contains totpURI and backupCodes for the
user to store securely. Verify {code} with the existing cookie and retain the
replacement session cookie. Future password sign-in returns twoFactorRedirect
and a challenge cookie. Submit an authenticator or backup code with that cookie
and retain the resulting session. Backup codes are single-use. Trusted-device,
email-OTP MFA and disabling endpoints are not exposed in V1. Changing security
settings requires a fresh session and the library's password verification.

Owner/admin workspace access and workspace creation require a server-recorded
MFA-verified session. A user who has enabled MFA cannot use an older unverified
session for staff APIs. Ordinary members may enroll voluntarily. There is no
client-supplied MFA override. Internal test principals declare their synthetic
verification explicitly; transport actors always come from the auth adapter.

| Method/path | Input and behavior |
|---|---|
| GET /sessions | limit up to 100 and opaque after cursor. Returns own session IDs, times, MFA marker, stored IP/user-agent metadata. Tokens are excluded. |
| POST /sessions/revoke | {sessionId} or {all:true}. Requires recent auth and MFA; only own sessions are affected. Exact retries retain the receipt while current authorization exists. Revoking the current session requires sign-in again. |
| GET /security-events | Own paginated MFA/recovery, backup rotation, reset and revocation events. No secrets or request bodies are recorded. |
| GET /export | Own profile/account-provider metadata and paginated membership summaries. Links identify separate session/security-event datasets. |
| GET /deletion-preview | Eligibility and retained membership count. Includes removed memberships still required by workspace retention. |
| POST /deletion | {confirmEmail,password,confirm:true}, recent auth and MFA. Deletes an eligible database identity and its auth children. Any retained membership blocks deletion. This does not claim vendor/backup erasure. |

New passwords use versioned scrypt N=32768,r=8,p=3,64-byte output. Existing
Better Auth scrypt hashes remain verifiable and migrate by compare-and-set after
successful password sign-in. Password resets use the new format. Local benchmark
evidence is separate from production concurrency sizing. Signup/sign-in/reset
request responses have a 250 ms minimum processing envelope to reduce simple
fast-path enumeration. This is not a claim that all timing side channels are
eliminated under deployed load.

## Shared abuse budgets

Counters are atomic PostgreSQL rows with HMAC-derived keys and fixed windows.
They work across API replicas that share the DB and secret. Only a configured,
valid IP header is used. Other forwarding headers are ignored. Unknown IPs share
a conservative bucket. The actual proxy must overwrite that header and block
untrusted direct-origin access. These deployment properties require staging proof.

| Scope | Default budget |
|---|---|
| Auth boundary per IP | 60/minute, with additional Better Auth per-path protection |
| Public decision boundary per IP | 120/minute |
| Other staff boundary per IP/family | 3000/minute |
| Staff reads per actor / tenant | 1500 / 3000 per minute |
| Staff writes per actor / tenant | 600 / 1200 per minute |
| Import or export family per actor / tenant | 60 / 120 per minute |
| OTP per recipient | 10/hour, plus existing request/attempt limits |
| Issue per cycle | 10/hour |
| Manual resend per request | 3/hour |
| Client link issuance per recipient | 120/hour across staff issue/resend and public reissue |
| Responses per decision request | 30/hour, excluding exact response replays |
| Account deletion attempts per actor | 5/10 minutes |

Unauthenticated callers do not consume an arbitrary tenant's aggregate budget.
Workspace membership is checked before that budget is charged. Body limits and
strict DTOs remain in force. Signed webhook endpoints retain their bounded,
verified, durable-inbox protocol; coarse webhook/DDoS controls are an edge gate.

## Workflow completion

| Method/path | Input and behavior |
|---|---|
| POST /timezone/preview | {timezone}. Owner-only. Returns current workspace version, previewToken and affected cycles, including approval invalidation. No business dates are changed. |
| POST /timezone | {timezone,expectedVersion,previewToken,confirm:true}. Owner, recent auth. Rejects stale previews. Updates open/draft cycle timezone, revokes current decisions/approval and reschedules future internal reminders atomically. Closed history stays intact. Skips elapsed reminder slots and requires new client terms after invalidation. At most 1000 open cycles per operation. |
| POST /cycles/{cycle}/requests/{request}/resend | {expectedVersion}. Staff. Current actionable undecided request only. Rotates all old links, OTP and sessions; retains immutable terms/revision; increments the cycle version. Queues a new link and restores eligible future reminder slots. Suppression and deadline checks apply. |
| POST /cycles/{cycle}/correct | Existing {expectedVersion,correction}, optionally successor:{id,expectedVersion,dates,confirm:true,providerAgreement?}. Explicitly updates only the immediate open successor without outstanding terms. Extending/removing provider notice needs the agreement. Closed outcome/decision history is preserved; both corrections are attributed. |
| GET /cycles/{cycle} | Adds state/entitlement-aware allowedActions and a bounded ordered history page. The existing history endpoint provides subsequent pages. Commands still check current state and supplied arguments. |

New decision snapshots include expiryOn and noticeBy. Public preview includes the
current valid cycle timezone and those saved dates. History includes the original
UTC deadlineAt. Legacy date snapshots remain null rather than borrowing dates
from mutable present-day cycles. SQL grants/triggers prevent runtime snapshot
editing or reversal of completed supersession/decision timestamps.

## Workspace data export

GET /exports/data accepts dataset, limit (1–100), after and asOf. Only an owner
with recent authentication can use it. It remains available in read/export-only
mode. Fetch every page and retain the returned asOf for that collection.

Datasets are workspace, members, invitations, clients, contacts, items, cycles,
requests, responses, audit, billing, payments, deliveries, notifications, imports,
invitationDeliveries and mailEvents. Exports contain authorized business records
and metadata, including question text and future queued deliveries. They exclude
passwords, MFA secrets/codes, bearer digests/tokens, encrypted messages, OTP
verifiers and response/session credential material.

Most collections use an insertion cutoff; delivery metadata uses its request or
invitation cutoff because old queue rows have no independent creation timestamp.
Billing is the current projection. Pagination does not promise a frozen DB-wide
snapshot of concurrently updated records. Each export page is consistent within
its transaction. Import previews are limited to one batch per page and responses
to 4 MiB. Legal DSAR scope, external vendors and backup records require the policy
review described in the data-lifecycle inventory.

## Mail and configuration

Invitation dispatch rechecks pending/unrevoked invitation, matching recipient,
expiry, entitlement and suppression. Essential identity mail has a separate
purpose; operational suppression does not silently prevent account recovery.
Internal reminders freeze encrypted payloads and use stable send IDs. Known
transient rejection retries with jitter/backoff. Ambiguous acceptance retries only
with provider deduplication, a persisted payload and a known first attempt within
23 hours. SMTP ambiguity and missing/old replay metadata become uncertain for
reconciliation. Resend uses a fixed API origin and explicit ten-second abort.

Shared environment validation rejects wrong runtime DB roles, unsafe origin/SMTP
schemes, provider debug output and incomplete enabled billing. Set
RENEWRELAY_ENV=production for HTTPS/trusted-proxy and live-billing checks. Actual
DB TLS, network isolation and origin/header trust are external verification gates.

Auth's library response format, /d exchange/redirect/plain-text errors, health,
CSV content and 204/400/503 provider acknowledgements are intentional protocol
exceptions to the business JSON envelope. Invalid new DTO/cursor input is rejected
before it becomes a DB query. Full machine-readable route inventory remains batch 5.

## Upgrade and verification

Apply migrations 014–015 and reapply grant-runtime.sql before starting updated
services. Stop old web/worker instances and drain provider calls; do not mix old
auth enforcement or mail-replay behavior with the new version. Regenerate Prisma.
Existing administrators must enroll and verify MFA before workspace access.
Financial/audit retention and shared membership deletion are not newly automated.

Tests cover the identity, workflow, export, SQL and mail boundaries with synthetic
users, restricted DB roles and local provider fixtures. Real provider acceptance,
legal retention and cloud readiness remain outside this local delivery.
