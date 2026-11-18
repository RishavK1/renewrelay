# RenewRelay backend audit

**18 November 2026 · Synthetic/local review · Production approval pending**

All seven original reproducible findings now pass within local synthetic scope.
The workflow, billing, dispatch/calendar and consolidated batch 4 changes are recorded below.
Production signoff still requires unresolved security, operational, provider and
business/legal gates. Passing the seven counterexamples does not establish
complete spec compliance.

The initial audit changed no application behavior. Subsequent authorized batches
changed application code and added migrations 011–015 with regression coverage.
Original observations and evidence remain below as historical records.

## GitHub Actions removal follow-up

**18 November 2026 · Owner-requested local verification workflow**

GitHub Actions was removed after GitHub blocked hosted jobs due to an account
billing lock. The earlier CI attempts remain recorded below as history. The owner
does not need to resolve that billing lock to continue development or release
verification locally. The repository keeps all quality, contract, build, migration,
HTTP, audit, recovery and container check commands. Release operators must execute
and retain their results; automatic remote enforcement remains absent.

Control 132 stays PARTIALLY IMPLEMENTED. Existing control totals and previous test
evidence are unchanged. This focused change removes CI configuration and updates
operational documentation; it does not modify application runtime behavior.
See [removal evidence](audit/actions-removal-2026-11-18.json) and
[local release procedure](RELEASE_OPERATIONS.md).

## Consolidated batch 5 completion

**18 November 2026 · Release preparation verified locally · Staging approval pending**

See the [source/check manifest](audit/verification-batch5-2026-11-18.json),
[release runbook](RELEASE_OPERATIONS.md), [API inventory](API_CONTRACT.json) and
[current register](PRODUCTION_CHECKLIST.md). Earlier dated observations below
remain historical; this section supplies the current disposition.

| Area | Delivered and locally verified | Remaining acceptance |
|---|---|---|
| RR-12 release foundation | Node 22.23.5, standalone web plus compiled worker/launcher, locked production dependency overlay, isolated migration/grant image, non-root read-only runtime; no tsx runtime dependency. Lint/strict TS/AST checks and generated request-schema inventory cover 62 method/path entries with source drift checks. | Execute selected remote pipeline, protected branches, target-platform image scan and full license distribution review. |
| Startup and compatibility | Configuration, runtime roles and schema/grants checked before startup; missing/invalid configuration exits nonzero. Readiness failure/recovery tested. Sequential queries replace concurrent use of transaction connections. Migration 016 adds operational indexes. | Measure deployed migration window, pools, TLS and compatible rollout/rollback. |
| RR-13 telemetry implementation | Redacted request/error events and correlation IDs; CloudWatch EMF API/DB/worker metrics; bounded queue/billing age reads; heartbeat; AWS log/SNS/alarm definitions validated with cfn-lint and fixtures. | Real ingestion, extraction, permissions, subscriptions, alert acknowledgment and managed outages remain batch 6. |
| Infrastructure and recovery | Parameterized private Fargate/RDS 18/TLS/Secrets Manager/ALB deployment, side effects off, tasks initially stopped, single-worker rate budget, cost alerts and isolated migration task. Runbook covers promotion/rollback, incident handling and recurring maintenance. | Provision approved network/accounts/region/retention; verify provider quota, PITR, RPO/RTO and operational owners. |
| Repository/supply chain | Local history initialized; targeted current/history scan passes without exposing values. Locked license inventory and notices generated. npm advisory scan reports zero known advisories at review time. | Remote CI execution and branch protections are separately recorded. 19 license metadata/distribution cases, target OS notices and image advisory review remain explicit gates. |
| Spec/control review | All 150 controls revisited; R1–R11 and commercial rules retain regression coverage. All seven original adverse counterexamples pass in a dedicated clean database. | Broader route/role, deployed/browser, vendor and legal acceptance are not inferred from local tests. |

**Verification:** 22 unit tests, 43 HTTP scenarios (44 including the parent),
quality/type checks, production build, all 16 migrations on PostgreSQL 18.7,
15-to-16 upgrade preserving a business record, logical restore preserving 46 cycles,
11 responses and 328 audit events with revoked credentials/outbound quarantine,
startup negatives, and non-root read-only container smoke tests pass. Runtime
containers use Node 22.23.5. No live provider keys, external sends or charges were used.

The repeated [local load evidence](audit/dispatch-load-batch5-2026-11-18.json)
records 100 workspaces, 10,000 items and 10,000 accepted fake-provider reminders,
zero duplicate acceptances, reminder p99 117,841 ms and domain queue-read p95
25 ms. Scheduler sweep took 2,144 ms. These timings exclude actual HTTP/network,
cloud workloads and provider quota. Queue age metrics are measured independently
from this healthy-provider benchmark.

Packaging tests found and corrected the CommonJS/ESM generated-server boundary,
a Linux standalone external-module alias problem (release builds use Webpack),
production-install deletion of traced aliases, startup failure not exiting promptly,
and the migration engine OpenSSL mismatch. The final artifact regressions pass;
these findings are retained as evidence of why testing the artifact matters.
Optional Prisma/TypeScript peers may remain installed by npm; production entry
points execute compiled code and do not need a development runner.

The register is now **51 PASS, 0 FAIL, 58 PARTIALLY IMPLEMENTED, 23 NEEDS MANUAL
VERIFICATION, 18 NOT APPLICABLE**. Monitoring controls moved from FAIL to PARTIALLY
IMPLEMENTED because source/local fixtures now exist; they are not marked deployed.
RR-12/13 local implementation is delivered. RR-14 policy/vendor/backup retention
and release, frontend, finance/legal and operational acceptance remain open.

Node was updated after checking the current security release.
[Node 22.23.5 release](https://nodejs.org/en/blog/release/v22.23.5/).
TLS configuration respects the different node-postgres/libpq and Prisma migration
engine options; actual RDS hostname/CA validation remains staging work.
[Prisma PostgreSQL TLS options](https://docs.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql).

**GitHub follow-up:** Implementation was pushed to
[RishavK1/renewrelay](https://github.com/RishavK1/renewrelay), main, commit
13a0002354346cc75aae68bb1661e06a693985d1. The
[remote run](https://github.com/RishavK1/renewrelay/actions/runs/44300192208)
and manual retry were blocked before any step executed. GitHub's annotation is:
“The job was not started because your account is locked due to a billing issue.”
The account owner must resolve that lock and rerun CI. This is external-runner
admission failure, not a remote test pass or an observed test-code failure.

**Next:** batch 6 staging/provider acceptance; frontend remains separate. This is
not an unconditional production or legal-compliance signoff.

## Consolidated batch 4 completion

**18 November 2026 · Local implementation complete · External release gates open**

The [current verification manifest](audit/verification-batch4-2026-11-18.json)
records source hashes, commands and the scope of the evidence. The
[API contract](BATCH4_API.md) documents authentication, limits, workflow payloads,
exports and rollout ordering. The [data lifecycle inventory](DATA_LIFECYCLE.md)
separates implemented cleanup from policy decisions that have not been approved.

| Finding / scope | Current implementation and evidence | Remaining boundary |
|---|---|---|
| RR-08 locally resolved | Atomic PostgreSQL IP/actor/tenant budgets; additional import/export, OTP, request, response and recipient limits. Concurrent limits, expiry, authorization and spoofed-forwarding tests pass. | Actual proxy header overwrite, direct-origin restriction, edge limits and production tuning need staging proof. |
| RR-09 locally resolved | Better Auth TOTP and backup recovery; server-owned verified-session marker; owner/admin enforcement; stale-session denial; own-session inventory/revoke and identity security events. HTTP tests include backup replay, backup rotation and foreign-session isolation. | Frontend enrollment/recovery screens and actual HTTPS/cookie/proxy acceptance remain pending. |
| RR-10 locally resolved | Current invitation/suppression eligibility before send; explicit Resend timeout; frozen internal payload and stable send key; definite transient retry; missing/old/ambiguous replay metadata quarantined. Unit and HTTP fixtures cover rejection, timeout, revoked/suppressed invites and recovery. | Real vendor acceptance/deduplication, outage and account quota verification are batch 6. An in-flight accepted message cannot be recalled. |
| RR-11 locally resolved | Versioned scrypt N=32768,r=8,p=3; compatible legacy verification and compare-and-set sign-in migration. Reset expiry/replay and generic response fixtures pass. | Local cost is not deployment capacity evidence; timing distributions under load still need review. |
| RR-15 locally resolved | Migration 014 trigger plus restricted column grants protect decision snapshots; migration 015 adds private own-actor identity receipts/events and ancillary relationship constraints. Restricted-role forbidden writes and cross-record negatives pass. | Continue privilege/association review on future schema changes. This is defense in depth, not a claim of a demonstrated injection exploit. |
| RR-14 implementation delivered, policy gate open | Own-account export plus 17 paged workspace datasets, owner/recent-auth checks, credential exclusion, retained-membership deletion guard, eligible identity deletion and lifecycle status. | Financial/audit/shared-identity retention, vendor agreements/deletion, backup expiry and legal subject-access scope need accountable approval and actual-system evidence. No new statutory period was invented. |
| Workflow contracts delivered | Timezone preview/confirmation fences versions and reschedules eligible open work; staff resend revokes old credentials without replacing terms; explicit successor correction checks both versions; detail includes allowed actions/history; saved public dates are exposed. | Frontend/browser acceptance and expanded release/spec review remain in later workstreams. |
| RR-12/13 still open | Shared configuration validation and written API contracts improve the baseline. | Batch 5 still needs release artifacts, eager startup validation, lint/machine contracts, CI evidence, telemetry/alerts and deployment/recovery definitions. Actual cloud acceptance is batch 6. |

Current checks pass: typecheck, production build, **17 unit tests and 41 HTTP
scenarios** (42 runner tests including the parent). A fresh restricted-role database
applied all 15 migrations. The [13-to-15 upgrade](audit/migration-batch4-2026-11-18.json)
preserved 39 cycles, 9 responses and 252 audit events. The final logical restore
preserved 46 cycles, 11 responses and 328 audit events, revoked credentials and
required outbound reconciliation. All [seven original counterexamples](audit/synthetic-batch4-2026-11-18.json)
pass again. The harness's applicationModified=false means the harness itself did
not rewrite source; this authorized implementation changed application code.

The repeated [local dispatch benchmark](audit/dispatch-load-batch4-2026-11-18.json)
accepted 10,000 reminders across 100 workspaces with zero duplicate acceptances.
Reminder p99 was 117,964 ms; scheduler sweep 1,183 ms; authorized domain queue-read
p95 8 ms. These are local fake-provider/domain measurements, excluding HTTP/network
and actual vendor quota. No real credentials, email, charges or cloud resources were
used. Dependency audit reported zero known advisories at this review time; that
alone does not prove application security.

The [password benchmark](audit/password-cost-batch4-2026-11-18.json) measured five
hash-plus-verification samples of 219–224 ms on local arm64 Node 22. The selected
scrypt profile is an OWASP-listed alternative; it does not justify a production
concurrency guarantee. [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
MFA uses the installed Better Auth plugin and its challenge/recovery flows.
[Better Auth two-factor documentation](https://better-auth.com/docs/plugins/2fa).

The current register has **45 PASS, 3 FAIL, 58 PARTIALLY IMPLEMENTED, 26 NEEDS
MANUAL VERIFICATION and 18 NOT APPLICABLE** entries. The three FAIL controls are
centralized error monitoring, metrics and alerts. Partial/manual entries still
block an unconditional production signoff. The HTTP run also emits a pg driver
concurrent-query deprecation warning; review compatibility in batch 5. The intentional
invitation-failure fixture logs only a safe job ID and attempt.

**Rollout:** drain old web/worker processes, apply migrations 014–015 and updated
grants, then start updated artifacts. Existing owner/admin users must enroll and
verify MFA before workspace access. Legacy snapshot dates remain null because
mutable current cycle dates cannot prove historical values. Legacy hashes migrate
only after a successful password sign-in. Backups, vendor erasure and financial
retention are not silently changed by this rollout.

At that checkpoint the next delivery was batch 5; the current completion is above. Batch 6
covers real staging/providers/launch conditions. Frontend remains separate.

## Dispatch and calendar remediation follow-up

**18 November 2026 · RR-04 and RR-07 resolved within conditional local verification**

Current [verification evidence](audit/verification-dispatch-2026-11-18.json) records
the source fingerprint and checks. The [audit rerun](audit/synthetic-dispatch-2026-11-18.json)
passes all seven original controls and exits 0. Separate
[pilot-load evidence](audit/dispatch-load-2026-11-18.json) records measured capacity.

| Finding | Corrective implementation | Evidence |
|---|---|---|
| RR-04 | apps/worker/dispatch.ts gives tenants and mail lanes round-robin admission, bounded concurrency, a shared process-local send limiter and short continuation while due work remains. Existing lease/retry/frozen-payload rules are retained. Worker maintenance remains independent of new job admission. | HTTP integration scenarios exercise simultaneous dispatchers, bounded batches, fairness, future reminders, scheduler replay and abort-before-send. The 100-workspace load run verifies healthy local capacity and duplicate-free acceptance. |
| RR-07 | packages/domain/renewal-dates.ts uses pinned Temporal conversion with explicit gap/overlap policy. Inclusive dates end at the next local day's first valid instant. | Unit regressions cover Havana, Sao Paulo, Lord Howe, New York and Apia, plus a sweep of runtime IANA zones. A Havana HTTP workflow issues a request successfully and rejects expired access. |

Internal scheduling loads active recipients once per workspace, reads 100-cycle
pages and inserts deduplicated jobs in bulk. Workspace sweeps page by 100 tenants.
Migration 013 adds partial tenant/run-time indexes to each mail lane. This removes
the reviewed per-cycle membership lookup and individual reminder upserts.

Local load results used 100 workspaces, 10,000 items and a simultaneous burst of
10,000 due reminders, evenly divided between client and internal reminders. An
in-process provider simulated 10 ms acceptance, with the worker limited to
100 starts/second and four concurrent processors. All 10,000 reminders were
accepted once. Reminder p99 was 118,116 ms and the final acceptance was at
119,306 ms. The scheduler sweep took 1,085 ms. Adding that sweep and a conservative
30-second idle-poll allowance remains below five minutes. During dispatch,
1,134 authorized domain queue-query samples had p95 7 ms. Those query timings
exclude HTTP/network overhead and are not a measured API latency guarantee.

The production build, typecheck, 14 unit tests and 33 HTTP scenarios pass. The
runner reports 34 tests including the integration parent. Fresh-schema deployment
applied thirteen migrations. Local restore preserved 39 cycles, 9 responses and
252 audit records while revoking credentials and quarantining external effects.
Dependency audit reported zero known vulnerabilities at this review time.

The five-second dispatch budget stops new admission, rather than aborting an
in-flight side effect. Existing vendor timeouts and uncertain-send handling still
apply. RR-10 was still open at this earlier checkpoint; the batch 4 follow-up above
records its local remediation. Actual provider outage acceptance remains open. The send limiter is shared across lanes within one process only.
Replicas, identity mail and other applications must fit the aggregate account
budget. Default two sends/second is deliberately conservative and cannot meet a
five-minute 10,000-message burst. The measured higher rate needs actual provider
approval and staging verification. No live email or cloud load test was performed.

Current Resend documentation describes a default 10-request/second team limit,
shared across API keys and adjustable by request. Verify the actual account limit
before choosing deployment settings. [Resend API limits](https://resend.com/docs/api-reference/introduction).
Calendar gap/overlap handling follows Temporal's documented compatible policy,
and start-of-day handling finds a valid boundary even when midnight is skipped.
[Temporal timezone semantics](https://github.com/tc39/proposal-temporal/blob/main/docs/timezone.md),
[Temporal polyfill](https://github.com/js-temporal/temporal-polyfill).

At this earlier checkpoint the next scope was security hardening, beginning with endpoint abuse limits and
administrator MFA, followed by the remaining mail, deployment and data-lifecycle
controls. The original audit evidence stays available for comparison.

## Billing remediation follow-up

**18 November 2026 · RR-05 and RR-06 resolved in synthetic verification**

Current [billing verification](audit/verification-billing-2026-11-18.json) records
commands, restricted-role environment and the source fingerprint. The
[audit rerun](audit/synthetic-billing-2026-11-18.json) now passes five original
findings. RR-04 dispatch capacity and RR-07 calendar handling still fail.

| Finding | Corrective implementation | Regression evidence |
|---|---|---|
| RR-05 | packages/domain/billing/cancellation.ts dispatches a persistent cancellation ID and explicit mode outside the DB transaction. Acknowledgement matches operation ID, mode, subscription and checkout intent. Deletion creates a new immediate operation. API and worker share the dispatcher. | tests/billing-audit-scenarios.mjs exercises HTTP at-term cancellation racing deletion, the worker interleaving, repeated deletion after recovery, duplicate commands, provider failure, lost response and terminal-state confirmation before purge. |
| RR-06 | applySnapshot/reconcile return applied, conflict or unavailable. Conflict schedules a short retry. Worker acknowledges events only after an applied snapshot and no longer overwrites retry with a daily deadline. Failure scheduling matches the captured version. | Periodic and duplicate signed-event conflicts preserve unpaid state until a fresh snapshot applies. Tests cover subsequent paid activation, mapping changes, wrong-workspace snapshots, exceptions racing deletion, unmapped old events and bounded provider-failure retry. |

Migration 012 adds cancellationId/cancellationMode and backfills outstanding work.
The [upgrade check](audit/billing-migration-2026-11-18.json) applied migrations
001–011, seeded existing pending rows, then applied 012. Both modes backfilled,
idle work stayed idle and three invalid operation shapes were rejected. Fresh
schema deployment also passed all twelve migrations.

Verification passed typecheck, production build, 11 unit tests, 31 HTTP scenarios
and local restore. The runner reports 32 tests including the integration parent.
The eight new integration scenarios use the real API and loopback provider adapter
alongside restricted-role worker/domain checks. Restore preserved 24 cycles,
9 responses and 197 audit records, revoked credentials and quarantined sends.
The full audit script intentionally exits 1 for the two remaining failures.

Version conflicts retry after five seconds subject to worker polling. Provider
failures and absent discovery use five minutes. Newer writes fence failed older
calls from postponing their work. Recovery restores data access but preserves
requested cancellation, including an immediate call already in flight. A lost
response remains pending. A subsequent confirmed terminal snapshot resolves it
without another cancel request. Real provider replay behavior and merchant
acceptance still require staging. Synthetic exceptions and socket loss were
exercised, without measuring the adapter's ten-second abort deadline.

Razorpay distinguishes immediate and end-of-cycle cancellation, and cancelled
subscriptions cannot be reactivated. These semantics informed the explicit mode
and recovery policy. [Razorpay cancellation documentation](https://razorpay.com/docs/api/payments/subscriptions/cancel-subscription).

This was the state before the dispatch/calendar follow-up above. Other security,
lifecycle-contract and external release gates remain.

## Workflow remediation follow-up

**18 November 2026 · RR-01, RR-02 and RR-03 resolved in synthetic verification**

Current [verification evidence](audit/verification-workflow-2026-11-18.json) records
the changed-source fingerprint and commands. The audit rerun is in
[synthetic workflow observations](audit/synthetic-workflow-2026-11-18.json).

| Finding | Corrective implementation | Regression evidence |
|---|---|---|
| RR-01 | packages/domain/decisions/revocation.ts centralizes permanent revocation. Contact email changes/archive expire links, OTP and scoped sessions, cancel pending mail and reset applicable approval in the workspace transaction. Closed outcomes remain intact. Migration 011 adds tenant-scoped session revocation policies. | tests/workflow-audit-scenarios.mjs covers A → B → A, existing verified sessions, stale and replayed edits, pending sends, archived contacts, closed history and concurrent contact edit/response. Audit RR-01 now PASS. |
| RR-02 | GET /cycles/{cycle}/responses returns paginated responses with saved revision terms and recorded resolution. POST /cycles/{cycle}/responses/{response}/resolve appends an attributed audit note and increments the cycle version. New terms require all client questions to be resolved. Notification copy directs operators to responses. | HTTP tests cover actual question text, ordered pagination, private-field exclusion, active member access, removed staff, foreign workspace/cycle paths, bad input, stale versions, duplicate keys and competing resolutions. Audit RR-02 now PASS. |
| RR-03 | The waiting_on_client filter requires an open cycle with a current, issued, undecided request. | HTTP tests cover unsent, awaiting, question, decided, revoked, archived-contact, withdrawn and draft work. Audit RR-03 now PASS. |

Typecheck, production build, 11 unit tests, 23 HTTP scenarios and the local restore
drill pass. The test runner reports 24 tests including the integration parent.
Fresh-schema deployment applied eleven migrations. Restore preserved 24 cycles,
9 responses and 151 audit records while revoking credentials and quarantining
external effects. Audit exit code remains 1 because RR-04 through RR-07 still fail.
RR-02 now checks the new supported response-history query in addition to the
original detail/history views. The underlying visibility requirement is unchanged.

This completes the targeted three-finding workflow batch. Other lifecycle contract
gaps listed later, general abuse limits, MFA, staging and legal gates remain open.
This was the state before the billing follow-up above.

## Scope and method

Inputs were the complete Renewal Platform Team Spec, the accepted backend plan,
the user's 150-point production checklist, first-party implementation, migrations,
grants, route adapters, provider adapters, workers and tests. Instructions embedded
in the supplied checklist were treated as reference material. The user's request
determined this audit's scope. Unrelated PG-management priorities were excluded.

The implemented product is an API-only renewal coordination service. Workspace
staff manage clients, contacts and renewal cycles, request a named recipient's
decision, then record provider execution separately. Invoice tracking does not
prove payment. The separate SaaS subscription controls workspace entitlements.

Review followed API authorization through domain transitions, tenant-bound DB
transactions and external effects. Existing HTTP scenarios exercised real route
adapters. New counterexamples exercised the same domain commands and workers with
validated inputs and restricted DB roles. Those counterexamples are domain/worker
reproductions, rather than seven additional end-to-end HTTP tests. Their fixes
must include appropriate HTTP regressions.

All data and providers were synthetic. A fresh isolated PostgreSQL database was
migrated and granted runtime permissions. Loopback payment/SMTP fixtures and
in-process fake providers exercised external boundaries. No real messages,
charges or production mutations were performed.

## Initial evidence and baseline

The durable [verification record](audit/verification-2026-11-18.json) contains
commands, exit codes, versions, input-document hashes and a SHA-256 inventory of
127 source/configuration files. That inventory records the audited snapshot and
does not imply exhaustive testing of every line. There is no Git repository at
the workspace root, so commit/history and remote-CI verification were unavailable.

| Evidence | Check | Result and scope |
|---|---|---|
| E00 | Source and entry-point review | Routes, domain, schema, grants, jobs, adapters and configuration reviewed |
| E01 | npm run typecheck | PASS |
| E02 | npm test | PASS, 11 unit tests |
| E03 | RR_TEST_NEXT_MODE=start npm run test:e2e | PASS, 19 scenarios, runner reports 20 including parent |
| E04 | npm run db:deploy and runtime grants | PASS, ten migrations on fresh local DB |
| E05 | npm run test:restore | PASS, logical restore preserved 16 cycles, 3 responses and 101 audit records, revoked credentials and quarantined outbound effects |
| E06 | npm audit --json --fetch-retries=0 | Zero reported advisories at audit time |
| E07 | Targeted first-party credential-pattern scan | No matched live-credential patterns, no history scan |
| E08 | node --import tsx scripts/audit-synthetic.mjs | FAIL, seven required controls reproduced below |
| E09 | npm run build | PASS |
| E10 | skill-creator quick_validate.py | PASS, reusable skill structure validated |

The [synthetic observations](audit/synthetic-2026-11-18.json) contain the failing
results. The initial 150-control register had 34 PASS,
7 FAIL, 65 PARTIALLY IMPLEMENTED, 18 NOT APPLICABLE and 26 NEEDS MANUAL
VERIFICATION entries. The pre-batch-4 [register](PRODUCTION_CHECKLIST.md) had 35 PASS,
5 FAIL, 66 PARTIALLY IMPLEMENTED, 18 NOT APPLICABLE and 26 NEEDS MANUAL
VERIFICATION entries. These classifications are not a readiness score.
The original seven FAIL rows and seven product reproductions were different sets.

Source inventory manifest SHA-256
4016d49d1cb1d65df037f72f48661416165f4f5a522058d03c0aa2d68fc96479.

## Confirmed product findings

Engineering owns RR-01 through RR-07. Priority P1 blocks backend signoff.
Complexity S is a focused change, M spans modules and regression scenarios, and L
requires substantial implementation or environment work. Named owners remain to
be assigned. All seven product findings are locally resolved by the follow-ups above. RR-04 remains conditional on provider throughput and staging acceptance. The
descriptions below retain the original evidence. RR-08–RR-15 have the current
dispositions recorded in the consolidated batch 4 table; unresolved release,
policy and deployed-environment gates remain open.

### RR-01 · High · P1 · Superseded decision credentials can revive

**Evidence** packages/domain/clients.ts:134 and
packages/domain/decisions/service.ts:76, E08 RR-01.

Changing a contact email from A to B makes the earlier link unavailable. Changing
it back to A allows the same earlier link to complete OTP and approve. The
resolver checks current email equality, while contact editing does not permanently
revoke the old revision's credentials. This contradicts recipient-change revocation.
It is a stale-authorization defect. The reproduction does not show an OTP bypass
or cross-tenant access.

**Fix and acceptance · M** Atomically invalidate affected requests, access links,
OTP challenges, sessions and pending deliveries when the recipient changes.
Require a new applicable revision. Test A → B → A, an existing verified session,
queued sends and concurrent response. Every superseded credential stays invalid.

### RR-02 · High · P1 · Operators cannot retrieve client questions

**Evidence** packages/domain/renewals/queries.ts:97,
packages/domain/decisions/service.ts:130 and apps/worker/internal-mail.ts:73,
E08 RR-02.

A question is stored in DecisionResponse, but staff cycle detail and history omit
its text and there is no staff response-history endpoint. The operator notification
directs staff to history without making the question available there. The audit
stored one question and could retrieve none through those staff views.

**Fix and acceptance · M** Add authorized, ordered request/response history with
question text and attribution. Provide a recorded resolution note before revised
terms are reissued. Verify staff retrieval through HTTP, role and tenant isolation,
pagination and safe rendering. Client-visible output must preserve private fields.

### RR-03 · High · P1 · Unsent work appears to be waiting on the client

**Evidence** packages/domain/renewals/queries.ts:30, E08 RR-03.

The waiting_on_client bucket tests open state and a response date. A freshly
created item with zero issued requests is returned in that bucket. Staff can
mistake an agency action for a client delay. The existing tests encode this
behavior rather than the specification's responsibility distinction.

**Fix and acceptance · M** Derive waiting status from a current issued request or
introduce an explicit awaiting state. Cover unsent, draft, awaiting, question,
superseded, decided, withdrawn and archived cycles through the queue API. Return
consistent allowed actions and deadlines for every state.

### RR-04 · High · P1 · Dispatch design cannot meet the proposed target

**Evidence** apps/worker/main.ts:62, apps/worker/decision-mail.ts:21 and
apps/worker/internal-mail.ts:43, E08 RR-04.

Thirteen due jobs were seeded and one decision-mail processor call sent one job.
The default worker calls each mail processor once and then sleeps 30 seconds.
Even with zero overhead, the thirteenth decision job starts no earlier than
360 seconds in this default configuration. That conflicts with the proposed 99%
within five minutes target for a batch of this size. This is an observed dispatch
limit plus a source-derived bound. No pilot-scale timing benchmark was run.

**Fix and acceptance · M** Add bounded batch draining, safe concurrency and fair
tenant scheduling. Preserve job leases, retry safety and provider limits. Measure
queue age and drain time under the specified 100-workspace × 100-item pilot load,
including provider delay, duplicate claims and failures. Review scheduler-wide
scans and per-member queries/upserts with query plans.

### RR-05 · High · P1 · Older cancellation clears a newer deletion intent

**Evidence** packages/domain/billing/service.ts:143,
packages/domain/billing/deletion.ts and apps/worker/billing.ts:39, E08 RR-05.

The fake provider pauses an at-term cancellation while a real deletion command
records a newer immediate-cancellation intent. The older acknowledgement then
clears cancelRequestedAt using only workspace/provider identity. The workspace is
marked for deletion, but its newer pending cancellation is lost. Only the at-term
provider call occurred. External operation completion must not acknowledge a
different, newer operation.

**Fix and acceptance · M** Persist cancellation mode and an operation generation.
Acknowledge with a compare-and-set against that generation and provider identity.
Preserve newer immediate intent and retry it. Gate purge on confirmed terminal
provider state. Test both interleavings, provider timeouts, duplicate responses and
workspace recovery while a cancellation is in flight.

### RR-06 · High · P1 · Reconciliation conflicts defer retry by a day

**Evidence** packages/domain/billing/service.ts:75 and :131,
apps/worker/billing.ts:22 and :55, E08 RR-06.

A provider response races with a billing-row version change. Snapshot application
rejects stale state and schedules immediate reconciliation. The caller still
returns success and the worker overwrites that deadline with 24 hours. In the
reproduction, the verified paid period was not applied and retry was delayed by
24 hours. This can delay entitlement activation. Event completion uses the same
success contract and needs equivalent conflict coverage.

**Fix and acceptance · M** Return explicit applied, conflict and unavailable
outcomes. Keep conflict retries due and do not acknowledge events as processed
before applicable state is persisted. Use bounded retry/backoff without losing
newer work. Test periodic and webhook-triggered paths, concurrent checkout,
deletion and out-of-order provider responses.

### RR-07 · Medium · P1 · A valid inclusive date can be rejected

**Evidence** packages/domain/renewal-dates.ts:62 and :82, E08 RR-07.

The inclusive response date 2027-03-13 in America/Havana throws because the
following local midnight does not exist at the clock transition. The helper
requires an exact midnight. The product accepts IANA timezones and inclusive
business dates, so this is a supported-input failure.

**Fix and acceptance · M** Define nonexistent/ambiguous time handling and resolve
the first valid instant after the inclusive local date. Test this Havana case,
other skipped/repeated boundaries, normal DST changes, month anchors and leap
years. Preserve business DATE values and UTC event instants.

## Historical source gaps and unverified risks

The following table preserves the pre-batch-4 observations. Current disposition is
recorded in the batch 4 table above; RR-12/13 and RR-14 policy gates remain open.
These were source/configuration findings or unresolved verification, rather than
additional reproduced external exploits. Engineering owns implementation work.
The release owner owns deployment evidence and product/legal owners approve
business policy.

| ID / priority | Evidence and gap | Required next action / complexity |
|---|---|---|
| RR-08 High, P1 | apps/web/server/http.ts:105 has no general shared endpoint-specific limits for staff commands, exports or invalid decision-token lookups. Library auth and OTP limits cover narrower paths. | Add actor/tenant/IP budgets, expensive-operation caps, trusted-proxy rules and distributed-limit tests. Verify any edge controls separately. M |
| RR-09 High, P1 | apps/web/server/runtime.ts:34 and the auth route allowlist do not implement staff MFA. | Add owner/admin MFA enrollment, recovery and enforcement with an explicit recent-auth policy. M |
| RR-10 Medium, P1 | apps/worker/mail-jobs.ts:58 does not check global suppression/current invitation state before an invite send. apps/worker/internal-mail.ts:88 classifies every send error as uncertain. Resend call-site timeout policy is not explicit. | Apply consistent suppression/revocation and classify known retryable versus uncertain delivery. Verify SDK timeout behavior and test permanent/transient failures without duplicate unsafe sends. M |
| RR-11 Medium, P1 review | node_modules/@better-auth/utils/dist/password.node.mjs:3 uses scrypt N=16384,r=16,p=1. No cost benchmark or migration policy is documented. | Review the installed library's work factor against current guidance and target hardware. If changing it, retain compatible verification and migrate hashes safely. M |
| RR-12 Medium, P1 | package.json has no lint command. MJS scenario scripts are outside TypeScript checking. No machine-readable route contract is present. CI configuration exists, but no remote execution evidence is available. Worker runs using tsx, a development dependency, without a production image definition. | Configure proportionate lint/checking, document contracts and verify the actual worker artifact, install mode, startup, migration ordering and CI on the selected deployment. M |
| RR-13 High, release gate | No checked-in centralized error/metric/alert integration or deployable cloud configuration demonstrates the operational targets. Health checks query connectivity rather than application schema readiness. | Verify private DB networking, TLS, proxy trust, schema readiness, queue/billing alerts, rollback and PITR in staging. External configuration may exist, but was not inspected. L |
| RR-14 High, release gate | packages/domain/renewals/export.ts:19 exports renewal rows, not a complete personal/workspace dataset. Purge and retained identities/financial records have separate lifecycles without approved cross-system retention. | Define complete export, vendor deletion and backup/financial retention. Assign qualified privacy/legal review for actual jurisdictions and shared identities. L |
| RR-15 Medium, P1 review | packages/db/grant-runtime.sql:13 permits UPDATE across decision_requests, including snapshot fields. No public editing endpoint was found. | Restrict immutable columns or enforce snapshot immutability at DB level and test with the runtime role. This is defense in depth, not proof of SQL injection. M |

Better Auth documents its default use of scrypt and custom hash hooks. Scrypt is
an established alternative, so the original checklist's Argon2id/bcrypt wording
does not itself demonstrate an insecure algorithm. The installed cost profile
needed a supported decision and benchmark at that checkpoint; the versioned profile
and benchmark are now recorded above.
No password-cracking benchmark was performed.
[Better Auth password documentation](https://better-auth.com/docs/authentication/email-password),
[OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

Tenant tests must continue using restricted runtime roles because PostgreSQL table
owners normally bypass row security. Passing application membership checks alone
does not prove the database boundary.
[PostgreSQL row-security documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

## Product-spec traceability

The table describes present evidence, rather than declaring any requirement
exhaustively complete. Use the full checklist for individual security controls.

| Requirement | Implemented evidence | Open work / acceptance |
|---|---|---|
| R1 Workspace, verified invitations and membership | HTTP creation, invitation and two-tenant scenarios | Dispatch eligibility and MFA pass locally in batch 4; production cookie/proxy verification remains |
| R2 Renewal fields, quote/cost separation | Strict contracts and item/cycle commands, unit/HTTP money fixtures | Expand negative field combinations and public/private projection matrix |
| R3 Explicit inclusive dates and deadlines | Date helpers, Temporal boundaries and Havana HTTP issuance | RR-07 and batch 4 date/timezone contracts pass locally; deployed calendar acceptance remains |
| R4 Queue groups, filters and action ordering | Scoped cursor queries and HTTP list scenarios | RR-03 locally resolved, local domain timing measured; deployed HTTP timing pending |
| R5 Named contact decision and private pricing | Snapshot, OTP/session and public decision scenarios | RR-01/02 locally resolved, browser rendering and wider projection coverage pending |
| R6 Decision distinct from execution | Ready/offline/complete commands tested through HTTP | Broaden concurrent decision, revise and provider-completion interleavings |
| R7 Confirmed successor and closed history | One-successor concurrent completion scenarios | Batch 4 explicit dependent-next-cycle confirmation passes; wider concurrency review continues |
| R8 Invoice status distinct from payment | Billing flags and per-currency totals | Product/UI disclosure and broader report/permission coverage |
| R9 Atomic bounded CSV import/export | Preview, quota race, replay and formula-prefix tests | Paged full-data export passes in batch 4; deployed memory/time and privacy policy acceptance remain |
| R10 Audit attribution and immutable quotes | Audit writes and offline attribution scenarios | RR-02 notes and RR-15 restricted DB immutability pass locally; retention policy remains |
| R11 Archive, revoked access and reassignment | Archive/removal/reassignment scenarios | Expand all pending-job and revoked-credential interleavings |
| Commercial rules | Trial/paid limits, captured-period entitlement, cancellation and purge fixtures | RR-05/06 locally resolved, merchant acceptance and price/tax/refund approval pending |
| Operational targets | Build, migrations, local pilot-capacity benchmark and logical restore pass | Provider quota, staging HTTP/load/alerts/PITR/rollback and measured RTO/RPO pending |

The previously identified timezone-preview, staff-resend and dependent-date
correction contracts are implemented and tested in batch 4. See BATCH4_API.md for
payloads, version/replay semantics and the documented legacy-snapshot boundary.
Question resolution remains implemented and retrievable through the staff API.
Machine-readable route inventory and final contract/spec review remain batch 5.

## Remediation sequence and release gates

Batch 4 is complete locally. [Two consolidated backend batches remain](BACKEND_COMPLETION_PLAN.md): batch 5 prepares and verifies the release candidate, and batch 6 verifies staging/providers/launch conditions. Frontend is a separate workstream. The table below records the earlier grouping and completed fixes.

| Batch | Concrete work | Exit evidence |
|---|---|---|
| 1, workflow correctness | RR-01/02/03 and question resolution, locally resolved | PASS, targeted command and HTTP regressions. Other lifecycle contracts remain a separate release gate. |
| 2, financial concurrency | RR-05/06 locally resolved, persistent operation IDs and explicit reconciliation outcomes | PASS locally, both race orderings, duplicate events, transport failures and recovery preserve the newest intent |
| 3, reliable scheduling | RR-04/07 locally resolved, bounded fair dispatch and Temporal calendar policy | PASS locally, targeted regressions and representative fake-provider load. Staging/provider gates pending. |
| 4, security and maintainability | RR-08/09/10/11/12/15 and affected checklist rows | Abuse/MFA/mail regressions, reviewed hashing policy, restricted DB tests, lint/contracts and verified deploy artifact |
| 5, staging and business approval | RR-13/14, provider acceptance, frontend and external obligations | Named owners approve recorded staging, financial, privacy, accessibility and recovery evidence |

Retest affected controls after each batch and run the full baseline at a milestone.
Do not close an audit finding solely because the original suite remains green.
Link the fix, regression evidence and source fingerprint while retaining this
historical observation. The next delivery scope is consolidated batch 5; batch 4
completion and residual policy/deployment gates are recorded above.

## Reproduction and limits

The audit script is scripts/audit-synthetic.mjs. Run it with Node's tsx import,
after generating Prisma, applying all migrations and granting runtime permissions.
Provide MIGRATION_DATABASE_URL, DATABASE_URL and WORKER_DATABASE_URL through a
local ignored environment file. All three must point to the same isolated local
database named with a renewrelay_audit_ prefix. Use migration, app and worker roles
respectively. Never substitute production connection strings.

Use separate freshly prepared databases for the HTTP baseline and audit script.
Run the audit script once per fresh database. It creates durable fixtures and due
jobs, so baseline jobs or an earlier audit run can alter dispatch observations. Optional AUDIT_OUTPUT_PATH writes observations to a
new evidence file. Exit code 1 means required controls failed, rather than a
successful production signoff. Do not overwrite the dated historical evidence
when implementing fixes. Temporary raw logs are supplemental and are not required
to interpret the committed JSON records.

Tests used Node 22.20.0, npm 10.9.3 and PostgreSQL 16.11. The intended PostgreSQL
18 deployment remains untested. No live Resend or Razorpay account acceptance,
cloud deployment/load acceptance, browser/accessibility journey, full secret
history scan, license/legal approval or staging PITR/rollback was completed.
Dependency advisory results are time-bound and do not prove application security.
The local logical restore does not establish the proposed 15-minute RPO or
four-hour RTO. No Critical vulnerability was confirmed within this review's scope.

## Recurring review skill

The installed skill is /Users/rishav/.codex/skills/saas-production-audit/SKILL.md.
Invoke it as $saas-production-audit. Root AGENTS.md asks future material completion
reviews to use it when available, update affected controls and revisit the whole
register for release milestones. Its reference catalog preserves all 150 original
IDs and includes product applicability rules.

The skill passed the skill-creator structural validator. Manual review covered
this product's audit, a focused change, future frontend work, products without
runtime AI, secret handling and failing counterexamples despite a passing
baseline. No independent-agent behavioral evaluation was performed. Review
instructions assist future work, but do not constitute an automated release gate.
