# RenewRelay backend

The API covers staff identity, workspaces, invitations, clients, contacts and the internal renewal workflow. See [the backend plan](RenewRelay-Backend-Plan.md) for the release milestones.

## Run locally

Use Node.js 22.23.5 in the supported 22.x line, npm, and Docker Compose.

1. Run `npm ci` and `npm run db:generate`.
2. Copy `.env.example` to `.env`. Generate separate values for `BETTER_AUTH_SECRET` and `INVITE_ENCRYPTION_KEY` by running this command twice. Do not share or commit the values.

   ```sh
   node -p 'require("node:crypto").randomBytes(32).toString("base64url")'
   ```

3. Start the local database and mail sink, migrate the schema and grant the restricted runtime roles access.

   ```sh
   docker compose up -d --wait
   npm run db:deploy
   docker compose exec -T postgres psql -U renewrelay_migrator -d renewrelay -v ON_ERROR_STOP=1 -f - < packages/db/grant-runtime.sql
   ```

4. Run `npm run dev` and `npm run worker` in separate terminals. The API is at `http://localhost:3000` and local mail is at `http://localhost:8025`.

The environment example and Compose credentials are for local use. Database migrations run with a separate credential. Production runtime connections must use the app, auth and worker roles over verified TLS. Set `TRUSTED_CLIENT_IP_HEADER` only behind a proxy that overwrites the header and prevents untrusted clients from reaching the origin directly. Without a trusted IP the auth library uses one shared rate-limit bucket per endpoint.

## Try the API

1. Send JSON to `POST /api/auth/sign-up/email` with `name`, `email` and a `password` of at least 12 characters. For auth POST requests, send the exact configured `Origin`. Open the verification link from the mail sink. The default link may redirect to the empty frontend route after successful verification.
2. Send JSON to `POST /api/auth/sign-in/email` with `email` and `password`. Save the returned session cookie in your API client. Use it for all workspace operations. `GET /api/auth/get-session` returns the current identity.
3. Before creating a workspace, enroll through `POST /api/auth/two-factor/enable` with your password. Store the returned recovery codes securely and verify an authenticator code through `POST /api/auth/two-factor/verify-totp`. Retain its replacement session cookie. Subsequent sign-ins return `twoFactorRedirect`; complete TOTP or backup-code verification before using staff APIs. Owners/admins require MFA. See [the batch 4 API contract](docs/BATCH4_API.md).
4. Create a workspace with `POST /api/v1/workspaces` and `{"name":"My Agency","timezone":"Asia/Kolkata"}`. For each protected mutation send the exact configured `Origin`, an unused `Idempotency-Key` and the session cookie. Send JSON with `Content-Type: application/json` where the command takes a body.
5. Use the workspace ID to create a client with `{"name":"Example Client"}` and a nested contact with `{"name":"Billing Contact","email":"contact@example.test"}`.
6. To invite staff, post `{"email":"colleague@example.test","role":"member"}`. Sign in separately as that verified address and submit `{"token":"<code from email>"}` to `POST /api/v1/invites/accept`. The code goes in the body, where it stays out of request URLs and access logs. Invitations expire after 48 hours and reserve pilot seats while pending. Three active or reserved seats are allowed per workspace.

Use a new key per command intent. Reuse it for an exact retry after a timeout. Updates and archive actions accept the version returned by the latest read as `expectedVersion`. Ownership transfer also requires sign-in within the preceding ten minutes.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/health` | Check service and database connectivity |
| GET, POST | `/api/v1/workspaces` | List or create workspaces |
| GET | `/api/v1/workspaces/{wid}` | Retrieve workspace and your current role |
| GET | `/api/v1/workspaces/{wid}/members` | List active members as owner or admin |
| DELETE | `/api/v1/workspaces/{wid}/members/{userId}` | Remove a member immediately. Send `{"replacementUserId":"…"}` if they have open or draft renewals. |
| POST | `/api/v1/workspaces/{wid}/ownership/transfer` | Transfer to an active member using `userId` and `expectedVersion` |
| GET, POST | `/api/v1/workspaces/{wid}/invites` | List or issue invitations as owner or admin |
| DELETE | `/api/v1/workspaces/{wid}/invites/{id}` | Revoke a pending invitation, with an empty body |
| POST | `/api/v1/invites/accept` | Accept the invitation with a matching verified identity |
| GET, POST | `/api/v1/workspaces/{wid}/clients` | List or create clients |
| GET, PATCH | `/api/v1/workspaces/{wid}/clients/{id}` | Read or change a client's name |
| POST | `/api/v1/workspaces/{wid}/clients/{id}/archive` | Archive a client and its active contacts |
| GET, POST | `/api/v1/workspaces/{wid}/clients/{id}/contacts` | List or create contacts under a client |
| GET, PATCH | `/api/v1/workspaces/{wid}/clients/{id}/contacts/{cid}` | Read or change a contact's name and email |
| POST | `/api/v1/workspaces/{wid}/clients/{id}/contacts/{cid}/archive` | Archive a contact |

Paginated lists take `limit` and `after`, using `nextCursor` from the previous response. Staff can read archived clients and contacts, including their archive date. Better Auth also exposes `POST /api/auth/send-verification-email`, `/request-password-reset`, `/reset-password`, and `/sign-out`. Use the sent reset link or submit its token and `newPassword` from the API client. The reset request takes the account `email` and a same-origin `redirectTo` URL.

## Run a renewal through the API

The paths in this section are relative to `/api/v1/workspaces/{wid}`. Use an active client and operator from that workspace. Send the same cookie, Origin and idempotency headers as for other protected writes.

1. Call `POST /items` with the client and operator IDs, `service`, `provider`, `expiryOn`, `payer`, `currency` and `recurrence` (`once`, `monthly` or `yearly`). Optional fields include `noticeBy`, `respondBy`, `term`, `autoRenew`, `rebillable`, `supplierCostMinor` and `clientQuoteMinor`. Use ISO dates and integer minor units. For example, INR amounts of ₹8,000 and ₹10,000 are `800000` and `1000000`. Use null for an unknown quote. The response contains the item and its first cycle.
2. Find the cycle with `GET /cycles?bucket=overdue` or `GET /cycles?bucket=due_soon`. Due soon covers today and the following 29 workspace calendar days. By default, queue results prioritize overdue work, then sort by next action date and ID. Additional filters include `clientId`, `operatorId`, `provider`, `status`, `billingStatus`, `itemId`, `from` and `through`. Use `after` with the returned cursor for the next page.
3. Use `POST /cycles/{id}/ready` to waive client approval with a reason or `POST /cycles/{id}/record-offline` to record an instruction with `source`, `instructedOn` and `reason`. Both accept `action` (`renew` or `cancel`) and `expectedVersion`. Offline renewal approval requires a quote and a term.
4. After acting at the provider, call `POST /cycles/{id}/complete` with `outcome` (`renewed` or `cancelled`), `performedOn`, a `providerReference` or `note`, and `expectedVersion`. For recurring renewals, supply confirmed dates in `next` with `expiryOn` and optional `noticeBy` and `respondBy`. Read `suggestedNext` from the cycle detail. Auto-renew services still require confirmation of the provider outcome.
5. List `GET /cycles?billingStatus=to_invoice` for completed actions still to bill. `GET /cycles/billing-totals` groups outstanding quoted amounts by currency and reports missing quotes. `PATCH /cycles/{id}/billing` takes `status`, optional `invoiceReference` and `expectedVersion`.

| Method | Path | Additional renewal operations |
|---|---|---|
| GET, PATCH | `/items/{id}` | Read the item or change its operator or recurrence using `expectedVersion` |
| GET | `/items` | List unarchived items |
| POST | `/items/{id}/archive` | Archive an item. Supply `abandonReason` to abandon open work. |
| GET, PATCH | `/cycles/{id}` | Read a cycle or replace its open schedule and terms. Changing a provider notice deadline to a later date requires `providerAgreement`. |
| POST | `/cycles/{id}/activate` | Activate a draft with `expectedVersion` |
| PATCH | `/cycles/{id}/blocker` | Record or resolve a provider blocker with `blocked`, `reason` and `expectedVersion` |
| POST | `/cycles/{id}/withdraw`, `/cycles/{id}/correct` | Withdraw open work with `reason` or append a closed-cycle `correction`. Both take `expectedVersion`. |
| GET | `/cycles/{id}/history`, `/renewal-alerts` | Read cycle audit history or owner-only alerts for blockers and overdue activation |
| GET | `/imports/template` | Download the CSV header |
| POST | `/imports/preview` | Upload the CSV as the request body with `Content-Type: text/csv` |
| POST | `/imports/{id}/commit` | Submit the preview's `expectedVersion` and `confirmPossibleDuplicates` if needed |

Owners and admins can preview and commit imports. Use the exact header, UTF-8, up to 2 MiB and 2,000 data rows. For overdue rows choose `mode=draft` or `mode=activate` explicitly. Activation creates an owner alert in the API. Each workspace has ten unarchived pilot item slots, including drafts. Preview results expire after 24 hours. Commit rechecks references, duplicate warnings and capacity, and writes the whole batch in one transaction.

## Verify the backend

- `npm run typecheck` checks the application and worker types.
- `npm test` runs input contract, calendar, CSV and invitation credential unit tests.
- `npm run build` builds the API for production.
- `npm run test:e2e` runs Next.js, the worker and a temporary SMTP sink. Use a dedicated PostgreSQL database with migrations and runtime grants applied. The suite creates fixtures and checks workspace isolation, concurrent completion, import quotas and access changes through HTTP.

For the integration suite, load a test environment with valid secrets, the four test database URLs and `BETTER_AUTH_URL=http://127.0.0.1:3547`, `SMTP_URL=smtp://127.0.0.1:3548` and `WORKER_POLL_MS=100`. Set `RR_TEST_NEXT_MODE=start` to test the compiled build or leave it unset to test development mode.

## Code layout

- `apps/web/app/api` contains route handlers. Shared request validation and authentication are in `apps/web/server`.
- `packages/domain` owns permission and workflow rules. All tenant operations use the scoped transaction and writes record audit events.
- `packages/contracts` defines inputs. `packages/db` owns Prisma, versioned SQL migrations and role grants.
- `apps/worker` claims invitation mail jobs. `packages/integrations` contains the SMTP transport. Mail jobs are committed with the invitation, and the invitation code is encrypted until delivery. Ambiguous SMTP outcomes are recorded for review.

## Client decision API slice

Staff can issue a quoted request through `POST /cycles/{id}/requests` with
`contactId` and `expectedVersion`. It requires a current response date, known quote
and term. A new issue supersedes the previous revision. The local worker emails an
access code to the selected contact.

The public API takes the access code in the JSON body as `token`. Send the
configured Origin and an Idempotency-Key.

- `POST /api/v1/decisions/preview` returns the customer-facing terms and current version.
- `POST /api/v1/decisions/otp/start` sends a six-digit code to the original address.
- `POST /api/v1/decisions/respond` takes `token`, `code`, `expectedVersion` and
  `choice` of `approve`, `cancel` or `question`. Questions require `question` text.

Codes expire after ten minutes and allow five incorrect attempts. Code requests
are limited to one per minute and five per hour per request. A final response
moves the cycle into the operator queue. Exact response retries return the stored
receipt. Revised, archived or withdrawn requests become unavailable.

Staff can retrieve ordered, paginated client responses through
`GET /api/v1/workspaces/{wid}/cycles/{cycle}/responses?limit=25&after={cursor}`.
Each response includes its saved request revision, recipient, quote and any
recorded question resolution. Verification hashes and session credentials are
excluded. The endpoint uses the same active-membership and tenant boundary as
cycle detail, including for closed-cycle history.

Record a question resolution with
`POST /api/v1/workspaces/{wid}/cycles/{cycle}/responses/{response}/resolve`, using
`Idempotency-Key` and `{expectedVersion,note}`. This appends an attributed audit
note and increments the cycle version. Every outstanding question must have a
resolution before new terms can be issued. It does not send a reply to the client.

Changing a contact email or archiving the contact permanently supersedes their
current requests for open cycles. It revokes links, expires OTPs and sessions,
cancels queued deliveries and clears any applicable approval. The operator must
issue a new revision. Returning to the previous email cannot restore old access.
Closed outcomes and immutable response history remain available. An email already
accepted by a provider cannot be recalled, but its revoked link cannot authorize
a decision. The waiting-on-client bucket includes only open cycles with a current
issued, undecided request. Unsent and revoked requests are excluded.

Private email links now use `GET /d/{token}` to create a ten-minute encrypted,
HttpOnly decision session and redirect to `/d`. The CSRF value is in the URL
fragment. API clients can read it from the redirect Location, retain the decision
cookie and send it as `X-CSRF-Token` on session mutations.

- `POST /api/v1/decisions/session/otp/start` with `{}` sends a code.
- `POST /api/v1/decisions/session/otp/verify` with `{"code":"123456"}` verifies
  the original recipient for that session and revision.
- `POST /api/v1/decisions/session/respond` takes `expectedVersion`, `choice`
  and optional `question`. It uses the verified session. Exact retries return a
  receipt, and a completed session cannot authorize another instruction.
- `POST /api/v1/decisions/reissue` with an expired `token` queues a fresh link
  to the original address while the current response deadline remains open.
  Reissue is rate limited and idempotent.

The decision session endpoints require Origin, Idempotency-Key and X-CSRF-Token.
The original code-based API remains available for API callers. Every action checks
the current request, contact, revision and local deadline on the server.

## Reminders and delivery exceptions

The worker schedules client reminders seven and one day before the response date
at 09:00 in the cycle timezone. Internal reminders use 30, seven and one day before
the next action. The owner receives a daily overdue digest. Operators receive an
activity notification for questions and final instructions. Schedules skip elapsed
offsets and use unique send keys. Dispatch rechecks current state, recipient,
membership and suppression.

Set `RESEND_API_KEY` on the worker to use Resend for decision and reminder mail.
Set `RESEND_WEBHOOK_SECRET` on the API and configure the provider webhook at
`POST /api/v1/webhooks/mail`. The API verifies exact request bytes and persists
events before acknowledgement. Local SMTP remains the development transport.
Account verification and password reset currently use the configured SMTP server.

`GET /api/v1/workspaces/{wid}/deliveries` exposes delivery state and safe error
codes. `GET /cycles?bucket=delivery_failed` identifies current requests with
failed, uncertain, suppressed or delayed delivery. Bounces and complaints suppress
future workflow sends. Operators can correct the contact and issue a new request.
A signed late delivery event cannot clear a bounce suppression.

Resend retries reuse a frozen encrypted message and stable idempotency key, within
its 24-hour provider window. Uncertain outcomes outside that window remain for
reconciliation. Local SMTP acceptance after a crash is recorded as uncertain.
Set `OUTBOUND_MAIL_ENABLED=false` to disable worker sends during recovery.

## Export and recovery

Owner/admin `GET /api/v1/workspaces/{wid}/exports/renewals.csv` accepts cycle
filters plus `archived=include|exclude`. Archived history is included by default.
Exports are audited, bounded to 10,000 cycles and quote every CSV cell.
Formula-leading text gets a tab prefix for spreadsheet viewing. The export can
contain that protective tab when read programmatically.

`npm run test:restore` creates and verifies an isolated local restore using a
dedicated local migration URL. It preserves workflow history while revoking
restored credentials and quarantining pending outbound work.
See [the recovery procedure](docs/recovery.md) for the reconciliation steps.

Live domain authentication, provider acceptance and suppression behavior, edge
log redaction, spreadsheet-app checks and RDS point-in-time recovery are staging
release checks requiring the corresponding infrastructure and vendor setup.

## Platform subscriptions and workspace access

New workspaces start a 14-day trial with ten unarchived items and three seats.
Verified paid periods enable 100 items and five seats. Pending invitations reserve
seats. Reads and exports remain available after expiry. Operational writes,
invitations, client decisions and workflow sends share the same server-side policy.
Membership removal and invitation revocation remain available as safety actions.

The billing routes below are relative to `/api/v1/workspaces/{wid}` and require
the owner role. Mutations use Origin, Idempotency-Key and the session cookie.
Checkout, cancellation and deletion also require a sign-in within ten minutes.

| Method | Path | Behavior |
|---|---|---|
| GET | `/billing` | Effective access, usage, limits, paid-through date and provider state |
| POST | `/billing/checkout` | Body `{}`. Returns a hosted checkout URL or a processing state. |
| POST | `/billing/cancel` | Body `{}`. Requests cancellation at the paid term's end. |
| POST | `/billing/catch-up` | Body `{}`. Offers one owner overdue digest per paid period. |
| POST | `/workspace-deletion` | Confirm `confirmName` and `exportAcknowledged: true`. Stops workspace access and sends immediately. |
| POST | `/workspace-deletion/restore` | Body `{}`. The requesting owner can recover within 30 days. |

A checkout redirect grants no access. The Razorpay adapter fetches the configured
monthly INR plan, its subscription invoices and the corresponding payments.
Access requires a paid invoice, matching amount/currency, a captured payment,
an unrefunded payment and a valid billing period. Accepted periods are recorded
as billing evidence. Later failure events cannot remove an already confirmed
paid-through date.

Payment failure preserves the paid period, then allows seven days of grace.
Scheduled cancellation ends access at paid-through without grace. A verified new
paid period restores access. Reactivation revokes old credentials and regenerates
future reminder links. Past customer messages stay stopped.

Previously granted paid access is preserved if a refund is later issued. Refund
processing, accounting adjustments and merchant settlement reconciliation remain
finance operations. A refunded payment cannot grant a new entitlement period.
The tax-inclusive display, configured plan amount and financial record retention
need finance approval before a paid launch.

### Configure Razorpay

Set `RAZORPAY_BILLING_ENABLED=true`, the account's key ID and secret, the monthly
plan ID and `RAZORPAY_PLAN_AMOUNT_MINOR` on the API and worker. The proposed
₹1,499 price corresponds to `149900` paise. The adapter validates the provider plan
and uses a subscription quantity of one, with up to 120 monthly charges.
The configured amount must match the actual invoice total, including the chosen
tax treatment.

Configure `POST /api/v1/webhooks/billing` on Razorpay and set a separate
`RAZORPAY_WEBHOOK_SECRET` on the API. During secret rotation, the previous secret
can be supplied through `RAZORPAY_WEBHOOK_SECRET_PREVIOUS`. Test and live
environments must have separate keys, secrets and databases.

The endpoint verifies the raw-body HMAC and durably records the event identity.
The worker fetches current provider state before granting access, processes
duplicates safely, and reconciles subscriptions daily. A lost checkout response
stays in processing until its durable intent is found in provider notes.
The worker never blindly creates another subscription after ambiguous acceptance.
Cancellation retries and unresolved provider mappings remain durable.

Each cancellation has a persistent operation ID and explicit `at_term` or
`immediate` mode. Provider acknowledgements clear only that captured operation.
A newer deletion request keeps its immediate cancellation pending even when an
older at-term response arrives later. Recovery restores workspace data access
but does not reverse a provider cancellation already requested or in flight.
A lost response remains pending until a subsequent provider fetch or successful
retry resolves it. Purge still requires a confirmed terminal provider state.

Reconciliation returns an explicit applied, conflict or unavailable outcome.
Version conflicts request another attempt after five seconds, subject to worker
poll timing. Provider errors or missing checkout discovery use a five-minute
retry. Successful snapshots schedule the next daily check, with pending
cancellation work kept due sooner. A signed event is marked processed only after
its applicable snapshot is persisted. Unmapped events remain pending for review.
Retry updates are fenced by the captured row version so an older failed call
cannot postpone newer deletion or checkout work.

For migration 012, pause billing writers and workers and drain in-flight provider
calls before applying the migration. Regenerate Prisma and deploy the updated
web and worker code together before resuming billing. Older workers do not fence
cancellation acknowledgements and must not run alongside the new implementation.

The HTTP test suite uses a loopback provider fixture. Its
`RAZORPAY_TEST_API_URL` override is accepted only with test keys and a loopback
HTTP address. Production calls use the fixed Razorpay API origin.

### Deletion and retention

Deletion revokes links and pending invitations, cancels queued workflow mail and
requests provider cancellation. Recovery restores access according to the
remaining trial or paid period. Old credentials and mail backlogs stay revoked.

Set `WORKSPACE_PURGE_ENABLED=true` on the worker to enable operational data
purging after the 30-day recovery window. Purging waits for a terminal provider
subscription state, or for a workspace that never created a subscription.
Ambiguous checkout or cancellation state blocks purge until reconciliation.
The worker removes operational records in dependency order and preserves
billing payment evidence and a workspace billing tombstone separately.
Global staff identities remain available for their other workspaces.

The production retention period for financial records, provider settlement and
refund verification, monitored support/incident contacts, and cloud restore
verification are paid-launch requirements. Billing and automatic purge are
disabled in the environment example.

### Reminder dispatch and calendar boundaries

The worker drains bounded batches across invitations, client decisions and internal
notifications. Tenant/lane round-robin tickets and rotating tenant cursors give
smaller workspaces access while larger backlogs drain. Database leases and fenced
finalization remain authoritative across concurrent dispatchers. Backlog passes
continue after 100 ms; an empty queue uses WORKER_POLL_MS. The default batch admits
200 job attempts with four concurrent processors and a five-second admission
budget. In-flight provider calls finish before the pass returns.

Set WORKER_MAIL_BATCH_SIZE (3–2000), WORKER_MAIL_CONCURRENCY (1–16) and
WORKER_MAIL_RATE_PER_SECOND (default 2) for the actual environment. One persistent
limiter spaces sends across all three lanes within each worker. Account for every
replica and identity/other application traffic in the provider-account budget.
This limiter is process-local. It does not coordinate separate worker replicas.
Provider failures retain their existing retry/uncertain-delivery policies.

Internal scheduling pages through 100 workspaces and 100 active cycles at a time,
loads active recipients once per workspace, and inserts reminder rows in batches
with deduplication. The scheduler cursor continues on the next sweep. Dispatch
eligibility still checks current membership, lifecycle, entitlement and suppression.
Migration 013 adds partial tenant/due-job indexes for the three mail lanes.

Local calendar conversion uses the pinned Temporal polyfill. Repeated local times
use their earlier occurrence. Nonexistent reminder times move forward through the
clock gap. An inclusive response date ends at the first valid instant of the next
local date, including midnight transitions and skipped calendar days. Business
dates remain DATE fields and recorded instants remain UTC.

Run npm run test:dispatch-load with a fresh local renewrelay_audit_ database,
restricted app/worker roles and a separate migration connection. It seeds 100
workspaces with 100 items each, drains 10,000 due reminders through a healthy
in-process provider fixture, and measures authorized domain queue queries during
dispatch. It writes docs/audit/dispatch-load-2026-11-18.json unless
DISPATCH_LOAD_OUTPUT is provided. It sends no external messages. Re-running needs
a new database; retain historical evidence with a different output filename.

The benchmark uses a configured 100 sends/second and simulated provider latency.
The conservative default cannot hand off a simultaneous 10,000-message burst in
five minutes. Verify an approved provider quota and aggregate worker capacity for
the actual burst, then measure HTTP latency, provider acceptance, alerts and
failure recovery in staging before promising the proposed service target.

## Release candidate verification

Batch 5 adds `npm run check`, `npm run build:release`, compiled worker and
standalone web artifacts, production-dependency installation, startup/schema
checks, redacted CloudWatch-compatible telemetry and an AWS deployment template.
See [release and operations](docs/RELEASE_OPERATIONS.md), the
[machine-readable API inventory](docs/API_CONTRACT.json) and the
[current audit](docs/AUDIT_REPORT.md). This is local release preparation; actual
cloud/provider acceptance and frontend/browser verification remain pending.

GitHub Actions is intentionally removed. GitHub is used for source hosting; run
`npm run check` and the release/build/integration checks in
[release operations](docs/RELEASE_OPERATIONS.md) locally before promoting a release.
No paid CI service is required for this workflow.
