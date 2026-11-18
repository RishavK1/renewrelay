# RenewRelay remaining delivery plan

**18 November 2026 · One backend batch remaining**

This plan replaces the earlier suggestion to deliver individual security fixes in
small batches. Completed batches 1–5 remain complete within their recorded local
scope. The remaining delivery batch is 6. This is a work organization plan,
not a time estimate or a production-readiness certificate.

Batch 5 release preparation is complete locally. Batch 6 covers actual staging,
provider and launch acceptance. Frontend implementation remains separate. Public
launch requires frontend/browser acceptance and business approvals.

## Current position

- All seven original counterexamples RR-01–RR-07 pass locally. Do not reopen their
  original fix work without new evidence. Retain and extend their regression tests.
- Batch 5 passes quality/type checks, 22 unit tests, 43 HTTP scenarios against
  compiled production artifacts, 16 fresh migrations, previous-schema upgrade,
  startup negative tests and logical restore on local PostgreSQL 18.7.
- Node 22.23.5 digest-pinned runtime and migration containers build and pass local
  non-root/read-only-filesystem smoke checks. No development runner is required.
- The current register has 51 PASS, 0 FAIL, 58 PARTIALLY IMPLEMENTED, 23 NEEDS
  MANUAL VERIFICATION and 18 NOT APPLICABLE entries. These are scoped evidence
  classifications, not a percentage of launch readiness.
- The repeated 100-workspace/10,000-item fake-provider run accepts all 10,000
  reminders without duplicates. Actual HTTP/cloud/provider quota remains unverified.
- RR-12 local artifacts/quality/contracts are delivered; remote CI and target-cloud
  acceptance remain verification gates. RR-13 telemetry/deployment definitions are
  delivered; actual ingestion, alarm delivery and operations are batch 6.
- RR-14 cross-system retention/deletion decisions remain open. Frontend/browser,
  business/legal, license distribution review and named operational owners remain.
- [Release operations](RELEASE_OPERATIONS.md), [API inventory](API_CONTRACT.json),
  [batch 5 evidence](audit/verification-batch5-2026-11-18.json).

Evidence is in [the audit report](AUDIT_REPORT.md) and the
[control register](PRODUCTION_CHECKLIST.md).

## Consolidated backend delivery batches

| Batch | Combined scope | Deliverable | Dependencies |
|---|---|---|---|
| 4. Complete locally | Identity/security, remaining workflow contracts, mail correctness, DB integrity, export and data lifecycle implementation | A coherent API suitable for frontend integration, with negative/concurrency tests and documented policy decisions | Mostly synthetic. Retention and refund decisions require accountable owners before irreversible behavior is enabled. |
| 5. Complete locally | Build artifacts, configuration, CI/lint/contracts, telemetry, deployment definitions, recovery runbooks and full local/spec review | A reproducible backend release candidate and a staged verification checklist | Local work can proceed. Remote CI and cloud integrations need the selected repository/accounts. |
| 6. Verify staging and launch conditions | Deployed security boundaries, provider acceptance, PostgreSQL 18, HTTP load, alerts, rollback/PITR and business/legal acceptance | Recorded backend staging results and a conditional launch decision | Needs real staging resources, vendor test credentials, sending domain and business decisions. Public approval also waits for frontend acceptance. |

Each batch can contain several focused changes and internal test cycles. Progress
continues within the agreed scope without a separate handoff after every small
fix. Findings discovered during verification are fixed in the batch where possible,
or explicitly recorded with a blocker and owner. No fixed number of new findings
can be guaranteed in advance.

## Batch 4 · Complete locally

Batch 4 implementation and synthetic verification are complete. The table below
retains the agreed scope; current results and limits are in the linked evidence.
Policy, vendor and deployed-environment gates remain open.

| Area | Delivered scope | Completion evidence |
|---|---|---|
| Endpoint abuse controls, RR-08 | Shared actor/tenant/IP limits for staff writes, auth/public actions, exports/imports, OTP/reissue and invalid-token lookups. Resource budgets and trusted proxy handling. Keep signed webhook processing safe under provider retries. | Multi-actor/tenant limits, concurrent counters, expired windows, spoofed headers, expensive requests and negative authorization tests. |
| Staff identity, RR-09/11 | Owner/admin MFA enrollment, challenge, recovery and enforcement. Session listing/revoke-all. Verify password-reset expiry/replay and enumeration behavior. Benchmark password work factor and document compatible migration if needed. | Real HTTP enrollment/recovery/revocation scenarios, stale/unverified sessions, role restrictions and password compatibility evidence. |
| Workflow/API completion | Workspace timezone change preview and explicit rescheduling. Staff resend for a current revision with old-credential invalidation. Closed-cycle correction with explicit confirmation of dependent next-cycle dates. Staff detail exposes allowed actions and ordered history. Review customer-visible expiry/provider-notice dates against saved terms. | Complete API walkthroughs for each contract, replay/stale-version tests, deadline exceptions, revision/history preservation and private/public field projections. |
| Mail policy, RR-10 | Check current invitation state and suppression before sending. Consistent eligibility across mail lanes, explicit vendor timeouts, retry definite transient rejection and quarantine uncertain acceptance. Preserve frozen payloads and send keys. | Revocation/expiry/suppression tests, hung/rejecting providers, worker crashes, lost acknowledgement, bounded retry and catch-up spam tests. |
| Database safety, RR-15 | Protect immutable decision snapshots using column grants or DB enforcement. Review ancillary tenant foreign keys, runtime/worker privileges and cross-record references. Bound remaining worker scans and request/export memory usage. | Negative SQL under real restricted roles, missing/foreign tenant references, immutable-field writes and contention/query-budget evidence. |
| Privacy/export, RR-14 implementation | Inventory data purposes/vendors and necessary fields. Authorized complete personal/workspace export, including contacts, responses and memberships. Separate shared identity, workspace, vendor, backup and financial retention lifecycles. Implement approved cleanup mechanics and recovery protections. | Export completeness/ownership, read/export-only access, isolation and deletion/restore tests. Proposed retention periods remain pending approval; no invented statutory periods or unapproved financial deletion. |
| API consistency | Strict DTOs, consistent errors with documented protocol exceptions, bounded cursors and safe retry/version semantics for new commands. Review role-by-endpoint coverage. | Contract examples and tests for invalid bodies, wrong role/tenant, missing authorization, idempotency and concurrency. |

Product policy questions should be collected together as concrete choices while
independent coding proceeds. Technical defaults can be proposed, but legal,
financial-retention and refund decisions cannot be silently treated as approved.

## Batch 5 · Complete locally

The following agreed scope is delivered within local verification. Remote CI,
cloud acceptance and owner/legal approvals remain recorded external gates.

| Area | Remaining work | Completion evidence |
|---|---|---|
| Build/runtime, RR-12 | Production web and worker artifacts, deliberate dependency installation, shared startup configuration validation, migration ordering and resource/pool budgets. | Clean install/build/start using the actual release artifact and production dependency mode. |
| Developer quality | Proportionate lint and checks for TypeScript and MJS fixtures. Machine-readable API inventory/OpenAPI or equivalent with drift checks. Maintain readable module boundaries and reuse. | Green local gates, complete endpoint inventory, updated documentation and no route/schema mismatch. |
| Repository/CI | Establish actual version history if absent, reproducible migration checks and automated regression gates. Current-source secret scanning, history scanning when history exists, dependency and license/notice inventory. | Local history and source checks; remote pipeline/branch rules are verified after the repository is connected. No new remote repository or publication is implied by this plan. |
| Observability, RR-13 implementation | Redacted structured logs, centralized-error integration, API/DB/worker latency and error metrics, queue age, uncertain/failed jobs, pending billing events, worker heartbeat and actionable alert definitions. Schema-aware readiness. | Local metric/error fixtures, redaction tests and alert-rule tests. Real alert delivery and ownership are verified in batch 6. |
| Deployable infrastructure | Definitions for the accepted cloud/edge architecture, private database connectivity, TLS/secret handling, isolated environments and production-only configuration. | Validated local definitions and documented setup. Provisioning, costs and deployment require the actual environment and relevant authorization. |
| Recovery and maintenance | Compatible release/schema rollback procedure, backup/PITR plan, restore reconciliation, incident/breach playbook, support contacts and recurring audit/patch/restore cadence. | Updated runbooks, local recovery rehearsal and named approval/evidence slots. Measured cloud recovery stays in batch 6. |
| Final local/spec audit | Revisit all R1–R11 and commercial rules, all 150 controls, new source changes and AI-generated code assumptions. Expand concurrency, quota/import, export, outage and authorization regressions. Preserve the original seven tests and dated evidence. | Full local baseline, repeatable synthetic API walkthrough, appropriately scoped performance checks and a clear register of external gates. |

Exit means a backend release candidate is ready for frontend integration and
staging acceptance. It does not mean a public production launch has been approved.

## Batch 6 · Verify staging and launch conditions

| Area | Actual verification required |
|---|---|
| Cloud/database/edge | Intended PostgreSQL 18, private ingress, TLS, least privilege, proxy trust, origin restriction, HTTPS cookies, CORS/security headers, cache bypass and redaction at the real CDN/proxy/monitoring boundaries. |
| Email | Sending-domain verification, SPF/DKIM/DMARC, sensitive-mail tracking settings, actual quota, provider acceptance, bounce/complaint handling, outage behavior and aggregate rate allocation across replicas and other traffic. |
| Subscription billing | Merchant/test-account eligibility, checkout, verified payment, replay/out-of-order events, cancellation/recovery, invoices and refund/access policy. Approved live payment, settlement, refund and cancellation checks before paid launch. |
| Performance/operations | HTTP queue p95, reminder handoff under representative bursts, imports/exports and concurrent workloads; real worker sizing and DB pools; error/queue/billing/backup alerts triggered and acknowledged. |
| Deployment/recovery | Remote CI and promotion, production artifact startup, compatible rollback, managed backup/PITR and restore reconciliation. Measure proposed RPO/RTO rather than promising the local drill proves them. |
| Privacy/business | Approve jurisdictions and legal applicability, data roles/vendor agreements, retained identities/financial records/backups, pricing/tax/currency, terms/privacy/refund/cancellation disclosures, age/consent policy where applicable, support and incident responsibilities. Complete technical license notices and qualified review where needed. |
| Release decision | Record accountable owners and residual risks. Match public claims to released behavior. Frontend/browser/accessibility acceptance is required before public launch. |

A fake provider cannot verify merchant approval, deliverability, settlement or
actual provider quota. Local infrastructure definitions cannot establish that the
deployed network and backup settings are correct. Collect required accounts and
business choices while batches 4–5 run to avoid delaying staging acceptance.

## Frontend workstream · Separate from the backend batches

After batch 5 establishes the backend contract and local evidence, build the staff
workspace, client/contact management, work queues, detail/history/questions,
imports/exports, billing/account/MFA/session screens and private decision flow.
Cover loading/error/empty states, safe retry keys, expired sessions/links,
destructive-action confirmation, responsive layouts, keyboard/accessibility,
untrusted text rendering, browser storage, consent/disclosures as applicable,
bundle budgets and measured page performance. Run real staff-to-client browser
journeys against the API.

Backend staging checks in batch 6 may run while this frontend is built. Final
public launch waits for both workstreams and required approvals. The number of
frontend design/implementation milestones is not estimated by this backend plan.

No V1 expansion is required for currently excluded runtime AI/RAG, attachment
storage, extra billing tiers/proration, or automated renewal at service providers.
Reassess their controls only if product scope changes.

## Historical pre-batch-4 open-control routing

The table below preserves routing of the 97 controls that were open before
batch 4. It is historical; the current register has 81 open controls. Completed
local batch 4 work no longer requires another implementation batch. Each
remaining original control retains its primary frontend, release or external
workstream; mixed controls may still require evidence in batches 5–6. Mixed implementation/staging/UI controls can need evidence from more
than one batch. Primary routing is not permission to mark the control complete
before its remaining verification is done. See the register for the precise
assessment and next action.

| ID | Primary workstream | Original control |
|---|---|---|
| 001 | Frontend | Link privacy policy from footer and registration. |
| 002 | 4 | Inventory all personal data and processing purposes. |
| 003 | 6 | Establish an appropriate legal basis for each purpose. |
| 004 | 4 | Minimize personal data collection. |
| 005 | Frontend | Allow withdrawal of consent where applicable. |
| 006 | 4 | Provide personal data export. |
| 007 | 6 | Implement account deletion across systems, subject to lawful retention. |
| 008 | 6 | Define retention and automatic deletion, including backup expiry. |
| 009 | 6 | Review age restrictions, parental consent and children's tracking restrictions. |
| 010 | 6 | Review applicable GDPR, UK GDPR, India DPDP, COPPA and US state laws. |
| 011 | Frontend | Implement consent management where required. |
| 012 | Frontend | Block non-essential tracking before consent where required. |
| 013 | Frontend | Make Accept and Reject equally accessible. |
| 014 | Frontend | Allow users to change preferences from the footer. |
| 016 | 5 | Disable session replay by default and mask sensitive inputs. |
| 017 | 4 | Inventory external domains, scripts, embeds, SDKs and data transfers; gate embeds and chat tools appropriately. |
| 019 | 4 | Hash locally managed passwords with Argon2id or bcrypt. |
| 021 | 4 | Use expiring, single-use password reset tokens. |
| 023 | 6 | Configure Secure, HttpOnly and appropriate SameSite cookies. |
| 024 | 4 | Prevent account enumeration. |
| 025 | 6 | Implement brute-force protection. |
| 026 | 4 | Support MFA, particularly for administrators. |
| 027 | 4 | Allow session revocation. |
| 031 | 4 | Prevent IDOR and broken object-level authorization. |
| 033 | 4 | Validate resource ownership. |
| 034 | 4 | Apply least privilege. |
| 038 | Frontend | Prevent XSS. |
| 040 | 6 | Configure strict CORS policies. |
| 041 | 4 | Implement endpoint-specific rate limits. |
| 045 | 4 | Standardize errors without exposing internal details. |
| 047 | 6 | Prevent unauthorized direct database access. |
| 048 | 4 | Use foreign key constraints where supported. |
| 050 | 4 | Use transactions for critical operations. |
| 051 | 5 | Index frequently queried columns. |
| 052 | 4 | Prevent duplicate records and race conditions. |
| 054 | 5 | Version-control database migrations. |
| 055 | 6 | Configure automated backups and test restoration. |
| 058 | 6 | Prevent cross-organization data access, including caches and exports. |
| 060 | 4 | Secure team invitations. |
| 062 | 4 | Maintain tenant-specific audit logs. |
| 063 | 6 | Secure organization deletion and ownership transfer. |
| 066 | 5 | Scan Git history for exposed secrets without printing values. |
| 068 | 6 | Separate development and production credentials. |
| 070 | 4 | Validate required environment variables at startup. |
| 071 | 6 | Clearly display pricing, taxes and billing periods. |
| 072 | 6 | Disclose automatic renewal and provide easy online cancellation. |
| 075 | 6 | Implement idempotent payment processing. |
| 077 | 6 | Handle failed payments, retries and expiry. |
| 080 | 6 | Implement refunds, invoices and reconciliation. |
| 084 | 6 | Protect private user files. |
| 087 | 6 | Remove orphaned files and deleted user assets. |
| 099 | 4 | Paginate large datasets. |
| 100 | 6 | Cache frequently requested data securely. |
| 102 | Frontend | Reduce unnecessary frontend JavaScript. |
| 103 | Frontend | Implement lazy loading and code splitting. |
| 104 | Frontend | Optimize Core Web Vitals. |
| 105 | 5 | Move expensive operations to background jobs. |
| 107 | 4 | Use exponential backoff for temporary failures. |
| 108 | 4 | Prevent duplicate job execution. |
| 109 | 4 | Handle third-party outages gracefully. |
| 111 | 6 | Load-test critical workflows. |
| 112 | 6 | Configure resource limits and infrastructure cost controls. |
| 113 | Frontend | Provide loading, error and empty states. |
| 114 | Frontend | Prevent duplicate form submissions. |
| 115 | Frontend | Handle expired sessions gracefully. |
| 116 | Frontend | Confirm destructive actions. |
| 117 | Frontend | Ensure mobile and tablet responsiveness. |
| 118 | Frontend | Review keyboard navigation and WCAG accessibility. |
| 119 | Frontend | Avoid unnecessary sensitive data in browser storage. |
| 120 | 4 | Separate transactional and marketing emails. |
| 121 | 6 | Provide unsubscribe links and postal address where required; honor opt-outs within applicable deadlines. |
| 123 | 6 | Configure SPF, DKIM and DMARC. |
| 124 | 4 | Prevent notification spam and duplicate emails. |
| 125 | 5 | Implement centralized error monitoring. |
| 126 | 5 | Redact passwords, tokens and personal data from logs. |
| 127 | 4 | Audit critical administrative actions. |
| 128 | 5 | Monitor API errors, latency and database performance. |
| 129 | 5 | Alert on outages and abnormal usage. |
| 130 | 6 | Enforce HTTPS and appropriate security headers including CSP. |
| 131 | 6 | Separate development, staging and production. |
| 132 | 5 | Implement CI/CD with automated checks. |
| 134 | 6 | Disable public production debug tools. |
| 135 | 6 | Maintain a production rollback strategy. |
| 136 | 5 | Unit-test critical business logic. |
| 138 | Frontend | Test end-to-end user journeys with Playwright or equivalent. |
| 139 | 4 | Test authentication, authorization and tenant isolation. |
| 140 | 5 | Test payment failures, concurrency and edge cases. |
| 141 | 5 | Run TypeScript, lint and production build checks. |
| 142 | 6 | Publish accurate Terms of Service. |
| 143 | 6 | Publish applicable refund and cancellation policies. |
| 144 | 5 | Audit open-source dependency licenses. |
| 145 | 6 | Implement content reporting and copyright takedown workflows where applicable. |
| 146 | 6 | Review registration, tax, data-processing agreements, applicable sale/sharing opt-outs and legal obligations with qualified professionals. |
| 147 | 5 | Create incident and breach response plan with applicable regulator and user notification deadlines. |
| 148 | 6 | Define RTO and RPO. |
| 149 | 5 | Document architecture, deployment and recovery. |
| 150 | 5 | Establish recurring security, dependency and maintenance audits. |
