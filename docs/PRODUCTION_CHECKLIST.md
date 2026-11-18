# RenewRelay production checklist

**Audit date 18 November 2026 · API-only implementation · Production signoff pending**

This register adapts every checkpoint from the user's Master Production Readiness
Checklist. Original IDs 001–150 are preserved. The product source of truth is the
Renewal Platform Team Spec and its accepted backend plan. The source checklist's
embedded agent prompt and PG-management priorities are reference material. This
audit follows the user's request for the complete review and reusable skill.

The [audit report](AUDIT_REPORT.md) contains prioritized findings and the evidence index.
A PASS is limited to the stated local/source scope. Planned frontend work remains
pending. NOT APPLICABLE requires a current product reason. No runtime AI,
attachment storage, tier switching or provider renewal automation exists in V1.

Checkboxes are checked only for PASS. Severity describes the consequence if the
applicable control fails. Complexity S means a focused change, M a multi-file
change with regression work, and L substantial implementation or external work.
These are scope estimates, not delivery promises.

| Status | Controls |
|---|---|
| PASS | 51 |
| FAIL | 0 |
| PARTIALLY IMPLEMENTED | 58 |
| NOT APPLICABLE | 18 |
| NEEDS MANUAL VERIFICATION | 23 |


The remaining delivery plan is [one remaining backend batch](BACKEND_COMPLETION_PLAN.md).
Frontend work and external approvals are identified separately there.

## Release gates

- [x] Resolve RR-01, RR-02 and RR-03 with synthetic and HTTP regressions.
- [x] Resolve RR-05 and RR-06 with billing operation generations and conflict regressions.
- [x] Resolve RR-04 dispatch design and verify conditional local pilot capacity.
- [x] Resolve RR-07 with Temporal calendar boundaries and regression coverage.
- [x] Implement and synthetically verify batch 4 endpoint budgets, staff MFA and mail safeguards.
- [x] Implement batch 5 release artifacts, local telemetry fixtures, contracts and deployment definitions.
- [ ] Verify actual centralized ingestion, alarm delivery and managed rollout/recovery on staging.
- [x] Review password cost, deliver authorized exports and enforce snapshot immutability.
- [ ] Approve financial/audit/shared-identity retention and verify vendor/backup deletion.
- [ ] Verify PostgreSQL 18, cloud deployment, provider quota, HTTP load and alerting on staging.
- [ ] Complete frontend, browser accessibility and privacy/billing disclosures before public launch.
- [ ] Obtain business/legal approvals for taxes, refund access, retention and public terms.

## All 150 controls


### 1. Privacy and data protection

| Control | Status | Severity | Evidence | Assessment and impact | Next action | Complexity |
|---|---|---|---|---|---|---|
| 001. Link privacy policy from footer and registration. | [ ] NEEDS MANUAL VERIFICATION | Low | docs/audit/verification-2026-11-18.json (E00 inventory) | Registration and footer UI are pending. | Add approved privacy links with the frontend. | S |
| 002. Inventory all personal data and processing purposes. | [ ] PARTIALLY IMPLEMENTED | High | docs/DATA_LIFECYCLE.md | Data categories, purposes, access, technical cleanup and remaining policy owners are inventoried. Actual vendor regions and approved retention remain external. | Approve vendor agreements, regions, legal bases and retention owners. | M |
| 003. Establish an appropriate legal basis for each purpose. | [ ] NEEDS MANUAL VERIFICATION | High | /Users/rishav/Downloads/Renewal-Platform-Team-Spec.md:15 | Legal basis and controller/processor roles have not been approved. | Obtain qualified review for actual customers and jurisdictions. | M |
| 004. Minimize personal data collection. | [ ] PARTIALLY IMPLEMENTED | Medium | docs/DATA_LIFECYCLE.md | Exports exclude credentials and private verifiers; temporary payloads and counters have bounded cleanup. Necessity and retention of IP/user-agent and event metadata still need policy approval. | Approve field necessity and deployed data minimization. | M |
| 005. Allow withdrawal of consent where applicable. | [ ] NEEDS MANUAL VERIFICATION | Medium | docs/audit/verification-2026-11-18.json (E00 inventory) | Consent-dependent processing and withdrawal flows require a business/legal decision. | Define applicable consent use and withdrawal before adding tracking or marketing. | M |
| 006. Provide personal data export. | [x] PASS | High | docs/audit/verification-batch4-2026-11-18.json | Own-account export and 17 owner-authorized workspace datasets pass pagination, private-field, role and tenant tests locally. Sessions and identity events use separate own-user endpoints. | Retest on schema changes; legal subject-access fulfillment and external-system scope require qualified review. | M |
| 007. Implement account deletion across systems, subject to lawful retention. | [ ] PARTIALLY IMPLEMENTED | High | docs/audit/verification-batch4-2026-11-18.json | Explicit eligible identity deletion cascades auth records and blocks retained memberships. Workspace purge/restore tests pass; vendor and backup erasure are separate. | Approve and verify cross-system deletion and retained-identity policy. | L |
| 008. Define retention and automatic deletion, including backup expiry. | [ ] PARTIALLY IMPLEMENTED | High | docs/DATA_LIFECYCLE.md | Existing 30-day workspace purge and bounded operational cleanup remain implemented. Financial, shared-identity, audit, vendor and backup retention periods are not approved. | Approve periods and verify expiry in actual storage systems. | L |
| 009. Review age restrictions, parental consent and children's tracking restrictions. | [ ] NEEDS MANUAL VERIFICATION | Medium | /Users/rishav/Downloads/Renewal-Platform-Team-Spec.md:15 | The target is business teams, without an approved age or minor-contact policy. | Review audience and applicable age handling. | S |
| 010. Review applicable GDPR, UK GDPR, India DPDP, COPPA and US state laws. | [ ] NEEDS MANUAL VERIFICATION | High | /Users/rishav/Downloads/Renewal-Platform-Team-Spec.md:15 | Legal applicability depends on actual regions, customers and processing. | Qualified counsel must document the applicable obligations and dates. | M |

### 2. Cookies and third-party services

| Control | Status | Severity | Evidence | Assessment and impact | Next action | Complexity |
|---|---|---|---|---|---|---|
| 011. Implement consent management where required. | [ ] NEEDS MANUAL VERIFICATION | Medium | docs/audit/verification-2026-11-18.json (E00 inventory) | Essential sessions exist and future tracking has no consent design. | Decide which consent controls apply before frontend integrations. | M |
| 012. Block non-essential tracking before consent where required. | [ ] NEEDS MANUAL VERIFICATION | Medium | docs/audit/verification-2026-11-18.json (E00 inventory) | No analytics or session-replay SDK is currently configured in application source. | Verify deployed scripts and gate any future non-essential tracking. | M |
| 013. Make Accept and Reject equally accessible. | [ ] NEEDS MANUAL VERIFICATION | Low | docs/audit/verification-2026-11-18.json (E00 inventory) | A consent UI has not been built. | Verify equal accept/reject access if consent is required. | S |
| 014. Allow users to change preferences from the footer. | [ ] NEEDS MANUAL VERIFICATION | Low | docs/audit/verification-2026-11-18.json (E00 inventory) | Preference management is frontend work. | Add preference access when the consent design is approved. | S |
| 015. Self-host fonts where practical. | [ ] NOT APPLICABLE | Low | docs/audit/verification-2026-11-18.json (E00 inventory) | The API-only build serves no product fonts. | Reassess when frontend typography is implemented. | S |
| 016. Disable session replay by default and mask sensitive inputs. | [ ] PARTIALLY IMPLEMENTED | Medium | apps/web/next.config.ts:4 | Sensitive route logs are reduced and no replay SDK is configured, but edge and monitoring masking are unverified. | Verify deployed tracking, payload masking and log capture. | M |
| 017. Inventory external domains, scripts, embeds, SDKs and data transfers; gate embeds and chat tools appropriately. | [ ] PARTIALLY IMPLEMENTED | High | docs/DATA_LIFECYCLE.md | Source adapters and data transfer purposes are inventoried; no analytics or embeds are configured. Actual vendor regions/contracts and deployed transfers remain unverified. | Complete deployed transfer inventory and vendor agreements. | M |

### 3. Authentication and account security

| Control | Status | Severity | Evidence | Assessment and impact | Next action | Complexity |
|---|---|---|---|---|---|---|
| 018. Use established authentication libraries. | [x] PASS | Low | apps/web/server/runtime.ts:34 | Better Auth is configured and real HTTP sign-up, verification and recovery scenarios pass. | Retest identity controls on dependency changes. | S |
| 019. Hash locally managed passwords with Argon2id or bcrypt. | [x] PASS | High | packages/domain/passwords.ts; docs/audit/password-cost-batch4-2026-11-18.json | Adapted to a supported scrypt alternative: versioned N=32768,r=8,p=3 with legacy verification and compare-and-set migration. Compatibility and local cost benchmark pass. | Tune capacity on deployment hardware; retain compatibility on future changes. | M |
| 020. Implement email verification. | [x] PASS | Medium | apps/web/server/runtime.ts:34 | Verified email is required for sign-in and protected staff APIs, tested over HTTP. | Add recovery and changed-address regressions when those flows change. | S |
| 021. Use expiring, single-use password reset tokens. | [x] PASS | High | docs/audit/verification-batch4-2026-11-18.json | HTTP reset tests reject expired and consumed tokens, accept a valid reset and revoke prior database sessions. | Retain regression coverage on identity-library changes. | S |
| 022. Rotate refresh tokens where applicable. | [ ] NOT APPLICABLE | Low | apps/web/server/runtime.ts:34 | V1 uses database sessions and email/password, with no OAuth refresh-token flow. | Reassess if OAuth or long-lived API credentials are added. | S |
| 023. Configure Secure, HttpOnly and appropriate SameSite cookies. | [ ] PARTIALLY IMPLEMENTED | High | apps/web/server/decision-session.ts:33 | Secure cookies are configured for HTTPS; local tests verify HttpOnly and SameSite. | Verify Secure flags, host scoping and proxy behavior on HTTPS staging. | S |
| 024. Prevent account enumeration. | [ ] PARTIALLY IMPLEMENTED | High | docs/audit/verification-batch4-2026-11-18.json | Known/unknown reset responses and generic duplicate signup pass; a 250 ms response envelope is tested. Systematic deployed timing analysis remains pending. | Compare timing distributions under representative staging concurrency. | M |
| 025. Implement brute-force protection. | [ ] PARTIALLY IMPLEMENTED | High | apps/web/server/runtime.ts:34 | Shared DB auth limits and OTP limits exist; IP trust and all relevant paths need validation. | Test distributed rate limits and trusted proxy headers on staging. | M |
| 026. Support MFA, particularly for administrators. | [x] PASS | High | docs/audit/verification-batch4-2026-11-18.json | TOTP enrollment/challenge, single-use recovery, backup rotation and owner/admin MFA enforcement pass over HTTP. Old unverified sessions are denied. | Build the MFA UI and verify HTTPS/proxy behavior before public launch. | M |
| 027. Allow session revocation. | [x] PASS | Medium | docs/audit/verification-batch4-2026-11-18.json | Own-session inventory and idempotent single/all revocation pass, including foreign-session denial and stale-cookie rejection. Tokens are not exported. | Build the session-management UI; retain ownership and replay regressions. | M |

### 4. Authorization and access control

| Control | Status | Severity | Evidence | Assessment and impact | Next action | Complexity |
|---|---|---|---|---|---|---|
| 028. Implement role-based access control. | [x] PASS | High | packages/domain/context.ts:30 | Owner/admin/member capabilities are checked through the shared workspace boundary. | Extend role fixtures whenever new commands are added. | S |
| 029. Validate permissions server-side. | [x] PASS | High | packages/domain/context.ts:30 | Staff reads and writes resolve the DB-backed session and active membership on the server. | Review every new entry point and internal caller. | S |
| 030. Protect administrative routes. | [x] PASS | High | packages/domain/billing/service.ts:26 | Owner-only billing and deletion routes use server authorization and recent authentication. | Add role-negative tests when expanding administrative operations. | S |
| 031. Prevent IDOR and broken object-level authorization. | [ ] PARTIALLY IMPLEMENTED | High | packages/domain/context.ts:30 | Two-tenant, nested-contact and RR-01 revocation regressions pass locally. | Broaden the route-by-role authorization matrix and verify staging boundaries. | M |
| 032. Prevent privilege escalation. | [x] PASS | High | packages/contracts/renewals.ts:54 | Strict business DTOs reject role/tenant overposting, including tested owner-role invite rejection. | Keep role and workspace selection outside mutable request fields. | S |
| 033. Validate resource ownership. | [ ] PARTIALLY IMPLEMENTED | High | docs/audit/verification-batch4-2026-11-18.json | Core tenant constraints now extend to internal cycle/recipient and request/invitation issuers; a request trigger checks the cycle contact client. Negative restricted-role tests pass. | Keep association coverage under review as schema and jobs evolve. | M |
| 034. Apply least privilege. | [ ] PARTIALLY IMPLEMENTED | High | docs/audit/verification-batch5-2026-11-18.json | Restricted app/auth/worker grants, immutable snapshots and own-actor identity RLS remain enforced. New readiness and operations queries use restricted roles. Deployment credential provisioning and worker maintenance duties need staging acceptance. | Verify deployed roles, secret scope, TLS and operational access. | M |
| 035. Test authorization with multiple accounts. | [x] PASS | High | tests/foundation.e2e.mjs:87 and E03 | Multiple users, workspaces and removed-member cases pass in the current HTTP suite. | Add tests for newly discovered adverse transitions. | S |

### 5. API and backend security

| Control | Status | Severity | Evidence | Assessment and impact | Next action | Complexity |
|---|---|---|---|---|---|---|
| 036. Validate request inputs with Zod or equivalent. | [x] PASS | Medium | packages/contracts/renewals.ts:54 | Strict Zod DTOs validate business routes; library auth routes have separate validation. | Maintain schema and API drift checks. | S |
| 037. Prevent SQL and NoSQL injection. | [x] PASS | High | packages/db/database.ts:7 | Reviewed code uses Prisma models and bound SQL without unsafe raw-query calls. | Retain parameterization and fixed sort/filter mappings. | S |
| 038. Prevent XSS. | [ ] PARTIALLY IMPLEMENTED | High | apps/web/next.config.ts:4 | Responses are JSON/plain text and CSP is restrictive; final UI rendering is pending. | Test client notes and question text as untrusted content in the frontend. | M |
| 039. Implement CSRF protection where applicable. | [x] PASS | High | apps/web/server/http.ts:105 | Origin checks and session CSRF checks are tested through HTTP. | Retest every cookie-authenticated mutation and allowed origin change. | S |
| 040. Configure strict CORS policies. | [ ] PARTIALLY IMPLEMENTED | Medium | apps/web/server/http.ts:105 | Same-origin behavior is configured without credentialed wildcard CORS. | Verify deployed preflight behavior and proxy-added headers. | S |
| 041. Implement endpoint-specific rate limits. | [x] PASS | High | docs/audit/verification-batch4-2026-11-18.json | Atomic shared IP, actor and tenant budgets cover staff/public/auth and expensive import/export paths; decision, OTP and reissue budgets add resource protection. Concurrent counters and spoofed-header handling pass. | Verify trusted proxy overwrite and origin restriction on staging; tune budgets using metrics. | M |
| 042. Prevent SSRF. | [x] PASS | High | packages/integrations/razorpay.ts:24 | Provider origins are fixed; loopback override requires test keys and there is no user-URL fetch feature. | Keep future provider URLs and redirects on explicit allowlists. | S |
| 043. Restrict request body sizes. | [x] PASS | Medium | apps/web/server/http.ts:105 | JSON, CSV and webhook bodies are bounded, including streamed body reads. | Keep size and malformed UTF-8 boundary regressions. | S |
| 044. Prevent mass assignment. | [x] PASS | High | packages/contracts/renewals.ts:54 | Strict DTOs and explicit domain writes prevent arbitrary business-field assignment. | Review added fields and auth-library hooks. | S |
| 045. Standardize errors without exposing internal details. | [x] PASS | Medium | docs/audit/verification-batch5-2026-11-18.json | Business errors use safe envelopes and correlated request IDs. A generated endpoint inventory documents request schemas, role expectations and intentional auth/webhook/private-link protocol exceptions; uncaught route failures are safely mapped. | Regenerate and review contract drift whenever routes, validators or domain rules change. | S |

### 6. Database security and integrity

| Control | Status | Severity | Evidence | Assessment and impact | Next action | Complexity |
|---|---|---|---|---|---|---|
| 046. Enable Supabase RLS or equivalent access controls. | [x] PASS | High | packages/db/prisma/migrations/202611180001_foundation/migration.sql:279 | Core tenant tables use ENABLE/FORCE RLS, verified with non-owner DB roles. | Review policy changes and pool-context cleanup with each migration. | M |
| 047. Prevent unauthorized direct database access. | [ ] NEEDS MANUAL VERIFICATION | High | packages/db/grant-runtime.sql:3 | Runtime grants are inspectable, but production network and credential isolation are unprovisioned. | Verify private RDS ingress, TLS and runtime credentials on staging. | M |
| 048. Use foreign key constraints where supported. | [ ] PARTIALLY IMPLEMENTED | High | docs/audit/verification-batch4-2026-11-18.json | Ancillary tenant references and decision-session link FK are added alongside core constraints; migration upgrade and negative SQL pass. | Continue schema-wide association review during release/spec audit. | M |
| 049. Add appropriate unique constraints. | [x] PASS | High | packages/db/prisma/migrations and E04 | Single-open-cycle, membership, final-response and logical-send uniqueness are defined. | Test concurrent new paths that depend on these invariants. | S |
| 050. Use transactions for critical operations. | [ ] PARTIALLY IMPLEMENTED | High | docs/audit/verification-billing-2026-11-18.json | Core transactions and fenced external acknowledgements pass locally after RR-05 remediation. | Extend concurrency review to future external effects and verify deployment behavior. | M |
| 051. Index frequently queried columns. | [ ] PARTIALLY IMPLEMENTED | Medium | docs/audit/verification-batch5-2026-11-18.json | Queue, relationship and migration-016 operational indexes exist. Local 10,000-item dispatch and domain-query timings pass; exhaustive filter plans and deployed load are unverified. | Inspect deployed plans and memory/pool behavior at representative HTTP load. | M |
| 052. Prevent duplicate records and race conditions. | [ ] PARTIALLY IMPLEMENTED | High | docs/audit/verification-billing-2026-11-18.json | Completion/import concurrency and RR-05/RR-06 regressions pass locally. | Retain these interleavings and broaden concurrency coverage as commands change. | M |
| 053. Implement connection pooling where appropriate. | [x] PASS | Medium | packages/db/database.ts:7 | Bounded pools, acquisition timeout and transaction timeout are explicitly configured. | Size total replica pools against the deployed DB capacity. | S |
| 054. Version-control database migrations. | [x] PASS | High | docs/audit/verification-batch5-2026-11-18.json | Sixteen ordered migrations and grants are recorded in local version history. Fresh PostgreSQL 18 and previous-schema upgrade checks pass. | Keep migrations immutable after release and verify remote CI/branch controls. | S |
| 055. Configure automated backups and test restoration. | [ ] PARTIALLY IMPLEMENTED | High | docs/audit/verification-batch5-2026-11-18.json | PostgreSQL 18 logical restore preserves records and quarantines side effects. RDS backup retention, encryption and failure notifications are defined, but managed PITR and restore are unverified. | Approve retention and measure actual backup/PITR recovery in staging. | L |

### 7. Multi-tenant SaaS architecture

| Control | Status | Severity | Evidence | Assessment and impact | Next action | Complexity |
|---|---|---|---|---|---|---|
| 056. Enforce tenant-level data isolation. | [x] PASS | High | packages/domain/context.ts:30 | Tenant predicates, composite keys and RLS support tested workspace isolation. | Repeat with every new business table and async path. | M |
| 057. Derive tenant context from verified authentication and membership. | [x] PASS | High | apps/web/server/http.ts:105 | Staff tenant context follows a verified session and active membership; public scope follows a token digest. | Preserve narrow bootstrap lookup paths. | S |
| 058. Prevent cross-organization data access, including caches and exports. | [ ] PARTIALLY IMPLEMENTED | High | packages/domain/renewals/export.ts:19 | Two-tenant export/record tests pass and private responses are no-store; CDN behavior is unverified. | Test all exports and caches through the deployed edge. | M |
| 059. Implement organization-specific roles. | [x] PASS | Medium | packages/domain/workspaces.ts:145 | Membership roles are stored per workspace, with owner-only transfer and billing. | Keep global identity separate from tenant permissions. | S |
| 060. Secure team invitations. | [x] PASS | High | docs/audit/verification-batch4-2026-11-18.json | Verified-address acceptance, expiry, quota and replay pass. Dispatch now checks pending/current invitation state, suppression, expiry and operational entitlement before sending. | Verify deployed email settings; an already accepted in-flight message cannot be recalled. | M |
| 061. Enforce subscription limits server-side. | [x] PASS | High | packages/domain/billing/policy.ts:9 | Trial/paid limits and read-only policy are server-side; current HTTP billing scenarios pass. | Retest downgrade, pending invites and concurrent quota changes. | M |
| 062. Maintain tenant-specific audit logs. | [ ] PARTIALLY IMPLEMENTED | Medium | docs/audit/verification-batch4-2026-11-18.json | Timezone, resend, correction, export and identity security events supplement existing attributed audit records. Complete event coverage and legal retention still need review. | Review coverage at release and approve audit retention. | M |
| 063. Secure organization deletion and ownership transfer. | [ ] PARTIALLY IMPLEMENTED | High | docs/audit/verification-dispatch-2026-11-18.json | Cancellation/deletion races now pass locally. Cross-system deletion and recovery still require staging evidence. | Verify provider cancellation, vendor deletion and restored-data recovery on staging. | M |

### 8. Secrets and environment variables

| Control | Status | Severity | Evidence | Assessment and impact | Next action | Complexity |
|---|---|---|---|---|---|---|
| 064. Remove hardcoded secrets. | [x] PASS | High | verification-2026-11-18.json (E07) | A targeted scan found no credential patterns in first-party application source; local fixture passwords are explicit test values. | Repeat a dedicated secret scan before committing and deploying. | S |
| 065. Exclude secret-bearing environment files from Git. | [x] PASS | High | .gitignore:1 | Secret-bearing environment files are excluded and an example file is provided. | Verify future generated artifacts and deployment contexts. | S |
| 066. Scan Git history for exposed secrets without printing values. | [x] PASS | High | docs/audit/verification-batch5-2026-11-18.json | Targeted current-source and available local Git-history scans run without printing matched values. No pre-existing repository history exists to reconstruct. | Repeat on the full connected remote history and treat pattern scanning as one control, not exhaustive detection. | S |
| 067. Never expose privileged keys through NEXT_PUBLIC_ variables. | [x] PASS | High | verification-2026-11-18.json (E07) | No first-party NEXT_PUBLIC privileged-key configuration was found. | Review the eventual client bundle and env additions. | S |
| 068. Separate development and production credentials. | [ ] PARTIALLY IMPLEMENTED | High | .env.example:1 | Tests use local synthetic credentials and a loopback billing fixture; real environment separation is unverified. | Provision isolated staging/production accounts, databases and secrets. | M |
| 069. Rotate compromised credentials with approval. | [ ] NOT APPLICABLE | High | verification-2026-11-18.json (E07) | This audit identified no exposed live credential requiring rotation. | Use the incident process if exposure is subsequently confirmed. | M |
| 070. Validate required environment variables at startup. | [x] PASS | Medium | docs/audit/verification-batch5-2026-11-18.json | Compiled web launcher rejects invalid configuration and missing schema before starting the server. Worker validates before its loop. Role URLs, deployed verified TLS, secrets and production flags are checked. | Verify actual CA/hostname/proxy settings and managed secret rotation on staging. | M |

### 9. Payments and subscriptions

| Control | Status | Severity | Evidence | Assessment and impact | Next action | Complexity |
|---|---|---|---|---|---|---|
| 071. Clearly display pricing, taxes and billing periods. | [ ] NEEDS MANUAL VERIFICATION | High | README.md:209 | The ₹1,499 plan is a documented proposal; checkout tax and pricing disclosures lack UI/legal approval. | Approve the final plan, tax treatment and visible billing period. | M |
| 072. Disclose automatic renewal and provide easy online cancellation. | [ ] PARTIALLY IMPLEMENTED | High | packages/domain/billing/service.ts:26 | At-term cancellation API exists; renewal disclosure and easy online UI are pending. | Build the disclosure/cancel UI and prove merchant cancellation. | M |
| 073. Use trusted payment providers; avoid storing card details. | [x] PASS | High | packages/integrations/razorpay.ts:24 | Only hosted subscription checkout is returned; local card storage is absent. | Verify the live hosted flow and vendor account ownership. | S |
| 074. Verify payment webhook signatures. | [x] PASS | High | apps/web/app/api/v1/webhooks/billing/route.ts:15 | Raw-body billing signatures and duplicate IDs are tested with synthetic signed events. | Verify live endpoint secrets and rotation in staging. | S |
| 075. Implement idempotent payment processing. | [ ] PARTIALLY IMPLEMENTED | High | docs/audit/verification-billing-2026-11-18.json | Duplicate events, lost checkout responses and cancellation/reconciliation races pass locally. | Verify real provider replay and cancellation behavior in merchant staging. | M |
| 076. Never trust frontend payment success responses. | [x] PASS | High | tests/billing-scenarios.mjs:1 | Browser success fields cannot grant access; captured payment and invoice evidence are fetched server-side. | Retest provider versions and plan configuration. | S |
| 077. Handle failed payments, retries and expiry. | [ ] PARTIALLY IMPLEMENTED | High | docs/audit/verification-billing-2026-11-18.json | Trial, paid-through, grace and prompt conflict retry pass locally after RR-06. | Verify real provider failures, retry alerts and recovery in staging. | M |
| 078. Handle upgrades, downgrades and proration. | [ ] NOT APPLICABLE | Low | /Users/rishav/Downloads/Renewal-Platform-Team-Spec.md:15 | V1 has one Team plan and no plan switching or proration feature. | Reassess before introducing another price tier. | M |
| 079. Enforce paid features server-side. | [x] PASS | High | packages/domain/billing/policy.ts:9 | Operational writes, public decisions and workflow sends consult the effective entitlement policy. | Keep safety operations explicit and test new entry points. | M |
| 080. Implement refunds, invoices and reconciliation. | [ ] PARTIALLY IMPLEMENTED | High | packages/integrations/razorpay.ts:24 | Verified invoices/payments and local reconciliation exist; refunds, taxes and live settlement remain manual. | Approve refund-access policy and verify real invoice, refund and settlement records. | L |

### 10. File uploads and storage

| Control | Status | Severity | Evidence | Assessment and impact | Next action | Complexity |
|---|---|---|---|---|---|---|
| 081. Validate file extensions, MIME types and actual content. | [x] PASS | Medium | packages/domain/renewals/imports.ts:18 | CSV is accepted as UTF-8 text/csv and actual rows/dates are parsed against the template. | Reassess file sniffing if other upload types are added. | S |
| 082. Restrict file sizes. | [x] PASS | Medium | packages/domain/renewals/imports.ts:18 | CSV byte and row limits are enforced and parser record sizes are bounded. | Retest exact limits and malformed records. | S |
| 083. Scan dangerous uploads where appropriate. | [ ] NOT APPLICABLE | Low | /Users/rishav/Downloads/Renewal-Platform-Team-Spec.md:15 | V1 parses bounded CSV and does not execute or distribute uploaded binaries. | Add malware scanning if attachments or executable formats enter scope. | M |
| 084. Protect private user files. | [ ] PARTIALLY IMPLEMENTED | High | packages/domain/renewals/imports.ts:18 | Staged CSV is actor/tenant-scoped with 24-hour cleanup; file storage is deferred. | Verify deployed storage isolation if evidence attachments are added. | M |
| 085. Use expiring signed URLs. | [ ] NOT APPLICABLE | Low | /Users/rishav/Downloads/Renewal-Platform-Team-Spec.md:15 | V1 has no object-download or attachment signed-URL feature. | Reassess on private object storage introduction. | S |
| 086. Prevent path traversal and unsafe filenames. | [x] PASS | Medium | apps/web/server/http.ts:105 | CSV uploads are request bodies without client-controlled filesystem paths. | Preserve fixed export filenames and reject future unsafe storage keys. | S |
| 087. Remove orphaned files and deleted user assets. | [ ] PARTIALLY IMPLEMENTED | Medium | packages/domain/renewals/imports.ts:18 | Staging expiry and operational purge exist; external mail/provider retention is unverified. | Test vendor deletion/retention and future asset cleanup. | M |

### 11. AI and LLM security

| Control | Status | Severity | Evidence | Assessment and impact | Next action | Complexity |
|---|---|---|---|---|---|---|
| 088. Mitigate direct and indirect prompt injection. | [ ] NOT APPLICABLE | Low | /Users/rishav/Downloads/Renewal-Platform-Team-Spec.md:15 | RenewRelay has no runtime LLM, agent or prompt-processing feature. | Reassess if runtime AI is introduced. | S |
| 089. Prevent confidential information leakage in AI responses. | [ ] NOT APPLICABLE | High | /Users/rishav/Downloads/Renewal-Platform-Team-Spec.md:15 | The product sends no tenant data to a runtime LLM. | Keep AI-assisted coding fixtures synthetic and reassess runtime AI plans. | S |
| 090. Never store secrets in system prompts. | [ ] NOT APPLICABLE | High | /Users/rishav/Downloads/Renewal-Platform-Team-Spec.md:15 | The deployed product has no system-prompt store. | Continue keeping development secrets out of agent prompts and artifacts. | S |
| 091. Validate AI-generated structured outputs. | [ ] NOT APPLICABLE | Medium | /Users/rishav/Downloads/Renewal-Platform-Team-Spec.md:15 | There are no runtime model-generated structured outputs. | Continue reviewing AI-written code and add validation if runtime AI is added. | S |
| 092. Enforce tenant isolation in vector databases and RAG. | [ ] NOT APPLICABLE | High | /Users/rishav/Downloads/Renewal-Platform-Team-Spec.md:15 | V1 has no vector database or RAG retrieval. | Design tenant authorization before introducing retrieval. | L |
| 093. Configure token limits and AI usage quotas. | [ ] NOT APPLICABLE | Medium | /Users/rishav/Downloads/Renewal-Platform-Team-Spec.md:15 | No runtime AI tokens are billed or consumed. | Reassess when AI usage exists. | S |
| 094. Implement AI request timeouts and controlled retries. | [ ] NOT APPLICABLE | Medium | /Users/rishav/Downloads/Renewal-Platform-Team-Spec.md:15 | No runtime model-request path exists. | Apply provider timeouts and retry budgets if one is added. | S |
| 095. Restrict agent permissions and require approval for sensitive actions. | [ ] NOT APPLICABLE | High | /Users/rishav/Downloads/Renewal-Platform-Team-Spec.md:15 | No end-user runtime agent executes actions. | Use scoped development-agent authorization and reassess runtime tools separately. | M |
| 096. Execute AI-generated code in isolated sandboxes. | [ ] NOT APPLICABLE | High | /Users/rishav/Downloads/Renewal-Platform-Team-Spec.md:15 | The platform does not execute model-generated code. | Review generated application code and isolate test execution. | M |
| 097. Review provider retention settings and disclose AI processing and generated content where appropriate. | [ ] NOT APPLICABLE | High | /Users/rishav/Downloads/Renewal-Platform-Team-Spec.md:15 | Runtime AI provider retention/disclosure is outside current product scope. | Review vendors before sending customer data to a model. | M |

### 12. Performance optimization

| Control | Status | Severity | Evidence | Assessment and impact | Next action | Complexity |
|---|---|---|---|---|---|---|
| 098. Prevent N+1 database queries. | [x] PASS | Medium | docs/audit/verification-batch5-2026-11-18.json | Scheduler pages cycles and inserts notifications in batches. The repeated PostgreSQL 18 fake-provider sweep schedules 10,000 items locally without per-cycle membership queries. | Retest query plans and representative bursts after scheduling changes. | M |
| 099. Paginate large datasets. | [x] PASS | Medium | docs/audit/verification-batch4-2026-11-18.json | Account/export pages, timezone preview, billing sweeps and worker cleanup are bounded. Imports export one batch per page; workspace export has a 4 MiB response guard. Local pilot dispatch passes. | Verify memory and HTTP performance at deployed load; preserve page limits on new datasets. | M |
| 100. Cache frequently requested data securely. | [ ] PARTIALLY IMPLEMENTED | High | apps/web/next.config.ts:4 | Tenant responses bypass shared cache in source, while deployed CDN rules are unknown. | Keep public static caching separate and verify edge bypass. | M |
| 101. Optimize images and static assets. | [ ] NOT APPLICABLE | Low | docs/audit/verification-2026-11-18.json (E00 inventory) | There are no product image assets in the API-only build. | Measure and optimize assets when the UI is built. | S |
| 102. Reduce unnecessary frontend JavaScript. | [ ] NEEDS MANUAL VERIFICATION | Low | docs/audit/verification-2026-11-18.json (E00 inventory) | Frontend bundles do not yet exist. | Apply bundle budgets during frontend implementation. | M |
| 103. Implement lazy loading and code splitting. | [ ] NEEDS MANUAL VERIFICATION | Low | docs/audit/verification-2026-11-18.json (E00 inventory) | Lazy loading and code splitting are future frontend work. | Measure routes and split expensive client code where needed. | M |
| 104. Optimize Core Web Vitals. | [ ] NEEDS MANUAL VERIFICATION | Medium | docs/audit/verification-2026-11-18.json (E00 inventory) | No deployed frontend exists for Core Web Vitals measurement. | Measure actual user pages on staging. | M |
| 105. Move expensive operations to background jobs. | [ ] PARTIALLY IMPLEMENTED | Medium | apps/worker/main.ts:49 | Mail, billing and cleanup run in a worker; imports and exports remain synchronous bounded operations. | Measure request budgets before moving more work to jobs. | M |

### 13. Scalability and reliability

| Control | Status | Severity | Evidence | Assessment and impact | Next action | Complexity |
|---|---|---|---|---|---|---|
| 106. Implement background job queues where needed. | [x] PASS | High | apps/worker/main.ts:49 | Postgres jobs and independent worker entry point exist and are exercised locally. | Verify worker service deployment and queue alerts. | M |
| 107. Use exponential backoff for temporary failures. | [x] PASS | Medium | docs/audit/verification-batch4-2026-11-18.json | Internal notifications now retry definite transient rejections with durable jittered backoff and a frozen message/send key. Ambiguous acceptance is retried only within the deduplicating-provider window. | Verify actual provider classifications during staging outage acceptance. | M |
| 108. Prevent duplicate job execution. | [ ] PARTIALLY IMPLEMENTED | High | docs/audit/verification-batch4-2026-11-18.json | Lease fencing, stable keys and frozen payload replay pass. Missing/old replay metadata is quarantined. Local load accepts 10,000 reminders with zero duplicates. | Verify actual vendor deduplication, process crashes and multi-replica account limits on staging. | M |
| 109. Handle third-party outages gracefully. | [ ] PARTIALLY IMPLEMENTED | High | docs/audit/verification-batch4-2026-11-18.json | Resend has an explicit 10-second timeout; timeout and rejection classification fixtures pass. Billing sweeps are paged, with bounded retry. | Verify real vendor hangs, recovery and total polling budgets on staging. | M |
| 110. Implement health-check endpoints. | [x] PASS | Medium | docs/audit/verification-batch5-2026-11-18.json | Readiness exercises critical application schema markers and runtime grants with a safe 503. Startup failures and live readiness failure/recovery pass; worker has a bounded heartbeat check. | Verify ALB/container behavior and failure alarms on staging. | S |
| 111. Load-test critical workflows. | [ ] PARTIALLY IMPLEMENTED | High | docs/audit/verification-batch5-2026-11-18.json | 100 synthetic workspaces, 10,000 items and 10,000 reminders pass on local PostgreSQL 18. Queue measurements are domain timings and provider acceptance is fake. | Run actual HTTP/cloud/provider quota and concurrent-workload acceptance. | L |
| 112. Configure resource limits and infrastructure cost controls. | [ ] PARTIALLY IMPLEMENTED | High | infra/aws/backend.template.json | Task CPU/memory/counts, bounded pools, DB storage limits, budget notifications and private-network definitions are checked in and locally validated. Actual deployment/cost limits are not verified. | Approve sizing/retention/budget and verify cloud quotas and cost alerts. | M |

### 14. Frontend and user experience

| Control | Status | Severity | Evidence | Assessment and impact | Next action | Complexity |
|---|---|---|---|---|---|---|
| 113. Provide loading, error and empty states. | [ ] NEEDS MANUAL VERIFICATION | Medium | docs/audit/verification-2026-11-18.json (E00 inventory) | Loading, error and empty UI states are pending frontend work. | Implement them against the finalized API contract. | M |
| 114. Prevent duplicate form submissions. | [ ] PARTIALLY IMPLEMENTED | Medium | packages/domain/context.ts:30 | Backend idempotency protects many actions, but the eventual forms are unbuilt. | Prevent duplicate UI submissions and preserve retry keys. | S |
| 115. Handle expired sessions gracefully. | [ ] PARTIALLY IMPLEMENTED | Medium | apps/web/server/decision-session.ts:33 | APIs reject expired sessions safely; browser recovery UX is pending. | Build and test safe reauthentication and stale-link pages. | M |
| 116. Confirm destructive actions. | [ ] PARTIALLY IMPLEMENTED | High | packages/domain/billing/deletion.ts:6 | Owner name confirmation and recent auth exist in the deletion API. | Implement and accessibility-test the destructive-action UI. | M |
| 117. Ensure mobile and tablet responsiveness. | [ ] NEEDS MANUAL VERIFICATION | Medium | docs/audit/verification-2026-11-18.json (E00 inventory) | Responsive product screens are unbuilt. | Verify phone/tablet staff and private decision flows. | M |
| 118. Review keyboard navigation and WCAG accessibility. | [ ] NEEDS MANUAL VERIFICATION | Medium | docs/audit/verification-2026-11-18.json (E00 inventory) | Keyboard, screen-reader and WCAG checks need the product UI. | Review and test the actual frontend with appropriate assistive tools. | M |
| 119. Avoid unnecessary sensitive data in browser storage. | [ ] PARTIALLY IMPLEMENTED | High | apps/web/server/decision-session.ts:33 | Sensitive sessions use HttpOnly cookies and CSRF fragments; no browser-local-storage product code exists. | Verify storage, URL cleanup and third-party requests in the final UI. | M |

### 15. Emails and notifications

| Control | Status | Severity | Evidence | Assessment and impact | Next action | Complexity |
|---|---|---|---|---|---|---|
| 120. Separate transactional and marketing emails. | [x] PASS | Medium | docs/BATCH4_API.md; packages/integrations/transactional-mail.ts | V1 has transactional identity, invitation and renewal mail only; no marketing pipeline. Suppression and current-state eligibility are enforced for workspace notifications. | Reassess consent and unsubscribe policy before introducing marketing. | M |
| 121. Provide unsubscribe links and postal address where required; honor opt-outs within applicable deadlines. | [ ] NEEDS MANUAL VERIFICATION | Medium | /Users/rishav/Downloads/Renewal-Platform-Team-Spec.md:15 | Marketing is out of scope, but transactional reminder classification and opt-out rules need jurisdiction-specific review. | Approve notification policy and any required opt-out mechanism. | M |
| 122. Obtain marketing consent where required. | [ ] NOT APPLICABLE | Medium | /Users/rishav/Downloads/Renewal-Platform-Team-Spec.md:15 | V1 has no marketing sends or marketing-contact intake. | Obtain applicable consent before a marketing feature is introduced. | M |
| 123. Configure SPF, DKIM and DMARC. | [ ] NEEDS MANUAL VERIFICATION | High | README.md:209 | Sending-domain DNS and provider settings cannot be proven by source. | Verify SPF, DKIM, DMARC, tracking settings and bounce paths before external mail. | M |
| 124. Prevent notification spam and duplicate emails. | [ ] PARTIALLY IMPLEMENTED | High | docs/audit/verification-batch4-2026-11-18.json | Invitation suppression, frozen retries, recipient/request budgets, catch-up controls and zero-duplicate local load pass. Provider/account-wide limits and real delivery remain external. | Verify aggregate quota, replicas, bounced/suppressed recipients and recovery on staging. | M |

### 16. Logging and monitoring

| Control | Status | Severity | Evidence | Assessment and impact | Next action | Complexity |
|---|---|---|---|---|---|---|
| 125. Implement centralized error monitoring. | [ ] PARTIALLY IMPLEMENTED | High | docs/audit/verification-batch5-2026-11-18.json | Redacted structured errors, CloudWatch log collection, central error filter and SNS alarm path are implemented and locally tested. No actual cloud ingestion or alert receipt has been verified. | Deploy, trigger and acknowledge a central error with the assigned on-call owner. | M |
| 126. Redact passwords, tokens and personal data from logs. | [ ] PARTIALLY IMPLEMENTED | High | docs/audit/verification-batch5-2026-11-18.json | Application telemetry omits raw URLs, headers, bodies, SQL, messages/stacks and principals. Canary tests pass; static route templates avoid link-token labels. Platform/proxy/vendor logging remains unverified. | Inspect real edge, task, framework and vendor logs for sensitive fields. | M |
| 127. Audit critical administrative actions. | [ ] PARTIALLY IMPLEMENTED | Medium | docs/audit/verification-batch4-2026-11-18.json | Identity reset/recovery/backup rotation/session revocation and new timezone/resend/correction/export actions have safe audit events. Full administrative coverage and retention remain under review. | Complete release event inventory and approve retention. | M |
| 128. Monitor API errors, latency and database performance. | [ ] PARTIALLY IMPLEMENTED | High | docs/audit/verification-batch5-2026-11-18.json | Request errors/latency, aggregated DB query timing, queue/billing age and worker health metrics emit CloudWatch-compatible events. RDS alarms are defined; deployed extraction/dashboards remain unverified. | Verify actual metric extraction, latency distributions and DB performance. | M |
| 129. Alert on outages and abnormal usage. | [ ] PARTIALLY IMPLEMENTED | High | docs/audit/verification-batch5-2026-11-18.json | CloudFormation defines queue/billing age, uncertainty, heartbeat, API, RDS and availability alarms, database-event notifications and SNS. Local schema/threshold fixtures pass. | Trigger outages/backlogs/backup failures and verify notification acknowledgment in staging. | M |

### 17. Deployment and DevOps

| Control | Status | Severity | Evidence | Assessment and impact | Next action | Complexity |
|---|---|---|---|---|---|---|
| 130. Enforce HTTPS and appropriate security headers including CSP. | [ ] PARTIALLY IMPLEMENTED | High | apps/web/next.config.ts:4 | CSP/no-store/referrer protections are configured, while HTTPS termination and HSTS are unverified. | Verify TLS, HSTS and headers through the real ingress. | M |
| 131. Separate development, staging and production. | [ ] PARTIALLY IMPLEMENTED | High | docs/RELEASE_OPERATIONS.md | Local synthetic test gates and parameterized staging/production definitions exist with distinct secrets and private DB ingress. Actual environments remain unprovisioned. | Provision isolated accounts/resources and verify secret/region separation. | L |
| 132. Implement CI/CD with automated checks. | [ ] PARTIALLY IMPLEMENTED | High | .github/workflows/backend.yml | Local Git history and CI definitions cover quality/contracts, fresh/upgrade migrations, production artifacts, regression/restore checks, dependency scan and container builds. No remote run/branch protection is verified. | Connect the selected repository and inspect an actual protected pipeline run. | M |
| 133. Scan dependencies for known vulnerabilities. | [x] PASS | Medium | package-lock.json and E06 | The audit-time npm advisory check reported zero known vulnerabilities. | Repeat on lockfile changes and on the maintenance schedule. | S |
| 134. Disable public production debug tools. | [ ] PARTIALLY IMPLEMENTED | High | packages/integrations/razorpay.ts:24 | No public provider-fixture endpoint exists in the application, but deployed debug settings are unverified. | Verify production flags, logs, source maps and test-key prohibition. | M |
| 135. Maintain a production rollback strategy. | [ ] PARTIALLY IMPLEMENTED | High | docs/RELEASE_OPERATIONS.md | Immutable artifact promotion and schema-16 compatible image rollback are documented. Migration tooling and logical restore are locally tested; a managed rollout/rollback drill is not. | Rehearse compatible image rollback and managed recovery in staging. | L |

### 18. Testing and quality assurance

| Control | Status | Severity | Evidence | Assessment and impact | Next action | Complexity |
|---|---|---|---|---|---|---|
| 136. Unit-test critical business logic. | [ ] PARTIALLY IMPLEMENTED | High | docs/audit/verification-batch5-2026-11-18.json | Twenty-two unit tests and 43 HTTP scenarios cover critical rules and original regressions, plus telemetry redaction, readiness and alert definitions. Wider coverage remains an ongoing release activity. | Expand cases when new risks or failures justify them; keep runtime/provider distinctions explicit. | M |
| 137. Integration-test API endpoints. | [x] PASS | High | docs/audit/verification-batch5-2026-11-18.json | Forty-three HTTP scenarios pass with the compiled standalone web and worker artifacts, real local PostgreSQL 18, SMTP sink and loopback billing fake. | Retain source/version evidence and verify real provider/browser journeys separately. | M |
| 138. Test end-to-end user journeys with Playwright or equivalent. | [ ] PARTIALLY IMPLEMENTED | High | tests/foundation.e2e.mjs:87 and E03 | API journeys are tested; browser staff-to-client journeys await the frontend. | Add Playwright coverage when real pages exist. | M |
| 139. Test authentication, authorization and tenant isolation. | [ ] PARTIALLY IMPLEMENTED | High | docs/audit/verification-batch4-2026-11-18.json | MFA, recovery, legacy passwords, reset expiry/replay, session ownership, multi-tenant exports and restricted SQL add to prior credential-reversion coverage. | Complete endpoint/role matrix and verify deployed cookies, proxy and edge boundaries. | M |
| 140. Test payment failures, concurrency and edge cases. | [ ] PARTIALLY IMPLEMENTED | High | docs/audit/verification-batch5-2026-11-18.json | Seven original adverse findings pass in their own clean fixture database; billing races, failure/replay, calendar and version transitions remain covered. Real merchant/outage acceptance is pending. | Verify representative external-provider failures and resource pressure in staging. | M |
| 141. Run TypeScript, lint and production build checks. | [x] PASS | Medium | docs/audit/verification-batch5-2026-11-18.json | JavaScript ESLint, strict TypeScript plus unused/AST quality checks, unit tests, generated contract drift and production build pass. Development scripts are syntax/lint checked. | Keep these gates mandatory in the remote pipeline. | S |

### 19. Legal and business compliance

| Control | Status | Severity | Evidence | Assessment and impact | Next action | Complexity |
|---|---|---|---|---|---|---|
| 142. Publish accurate Terms of Service. | [ ] NEEDS MANUAL VERIFICATION | High | docs/audit/verification-2026-11-18.json (E00 inventory) | Terms are not published and feature claims need audit-based qualification. | Approve accurate terms before external launch. | M |
| 143. Publish applicable refund and cancellation policies. | [ ] NEEDS MANUAL VERIFICATION | High | README.md:209 | Refund and cancellation behavior is described internally without a public approved policy. | Approve terms and verify that merchant behavior matches them. | M |
| 144. Audit open-source dependency licenses. | [ ] PARTIALLY IMPLEMENTED | Medium | docs/audit/dependency-licenses-batch5-2026-11-18.json | Locked production/optional-peer license inventory and available notices are generated; 19 metadata/license cases require distribution review, including platform-specific packages. OS image obligations remain separate. | Resolve review cases and assemble target-platform notices with qualified review before distribution. | M |
| 145. Implement content reporting and copyright takedown workflows where applicable. | [ ] NEEDS MANUAL VERIFICATION | Medium | /Users/rishav/Downloads/Renewal-Platform-Team-Spec.md:15 | Private customer notes exist, with no defined abuse/support intake process. | Assess applicable takedown/reporting needs and define the monitored contact. | M |
| 146. Review registration, tax, data-processing agreements, applicable sale/sharing opt-outs and legal obligations with qualified professionals. | [ ] NEEDS MANUAL VERIFICATION | High | /Users/rishav/Downloads/Renewal-Platform-Team-Spec.md:15 | Registration, tax, DPAs and jurisdiction-specific obligations remain business/legal decisions. | Assign accountable finance/legal owners and record approvals. | L |

### 20. Disaster recovery and maintenance

| Control | Status | Severity | Evidence | Assessment and impact | Next action | Complexity |
|---|---|---|---|---|---|---|
| 147. Create incident and breach response plan with applicable regulator and user notification deadlines. | [ ] PARTIALLY IMPLEMENTED | High | docs/RELEASE_OPERATIONS.md | Incident/breach containment, evidence, reconciliation, recovery and notification-decision procedures are documented. Named contacts, legal deadlines and rehearsal are not approved. | Assign primary/backup owners, obtain applicable notification guidance and rehearse. | M |
| 148. Define RTO and RPO. | [ ] PARTIALLY IMPLEMENTED | High | RenewRelay-Backend-Plan.md:1 | RPO 15 minutes and RTO four hours are proposals; only a local logical restore is demonstrated. | Measure staging PITR and recovery before making promises. | L |
| 149. Document architecture, deployment and recovery. | [x] PASS | Medium | docs/RELEASE_OPERATIONS.md; docs/recovery.md | Architecture, private deployment definitions, migration/grant order, resource budgets, compatible rollback and recovery/reconciliation procedures are documented and locally reviewed. | Update after actual cloud acceptance and every material release. | M |
| 150. Establish recurring security, dependency and maintenance audits. | [ ] PARTIALLY IMPLEMENTED | Medium | docs/RELEASE_OPERATIONS.md | Daily, weekly pilot-restore, monthly dependency/permissions/cost and post-change audit cadence is documented with the reusable completion skill. Actual owners and execution history remain pending. | Assign owners and retain recurring execution records during pilot. | S |


## RenewRelay-specific completion checks

The original seven findings are preserved in docs/audit/synthetic-2026-11-18.json.
The latest rerun docs/audit/synthetic-dispatch-2026-11-18.json passes all seven.
The script exits 0. Current regression commands and source fingerprint are in
docs/audit/verification-dispatch-2026-11-18.json. Conditional local pilot timing is
in docs/audit/dispatch-load-2026-11-18.json. Historical evidence is retained.
Production signoff still requires the remaining security and external gates.

| Control | Required outcome | Current evidence |
|---|---|---|
| Credential revocation | Contact A → B → A never resurrects an earlier decision credential. | PASS locally, RR-01 follow-up in docs/audit/verification-workflow-2026-11-18.json |
| Client questions | Authorized operators retrieve the actual question and record its resolution. | PASS locally, RR-02 follow-up with staff resolution and pagination tests |
| Work queue responsibility | Unsent requests stay an agency action. Only an issued current request waits on the client. | PASS locally, RR-03 follow-up with unsent and revoked request tests |
| Dispatch capacity | Healthy reminders meet the proposed five-minute target at representative load. | PASS locally, 10,000-message benchmark at 100 configured sends/second. Real provider quota and staging timing pending. |
| Cancellation generations | An older at-term response never clears a newer deletion/immediate-cancel intent. | PASS locally, RR-05 billing follow-up with API/worker race coverage |
| Reconciliation conflicts | A rejected stale snapshot remains due for bounded immediate retry. | PASS locally, RR-06 billing follow-up with periodic and signed-event conflicts |
| Calendar transitions | Inclusive response dates work when the following local midnight is skipped. | PASS locally, skipped/repeated-time unit tests and Havana HTTP issuance |
| Workflow separation | Approval creates operator work, completion records provider outcome, invoicing remains independent. | PASS for current synthetic HTTP scenarios. |
| Core concurrency | One completion yields one successor, and competing imports remain within quota. | PASS for current synthetic HTTP scenarios. |
| Private visibility | Client decisions expose saved quote/term without supplier cost or adjacent records. | PASS for tested response shapes. |
| Recovery | Logical restore preserves history and quarantines external effects. | PASS locally. RDS PITR remains pending. |
| Billing verification | A redirect cannot grant access. Captured payment/invoice evidence controls entitlement. | PASS with the local provider fixture. Merchant acceptance remains pending. |

## Maintenance and ownership

Engineering owns API, tenant, database, job and regression controls. The release
owner owns staging, rollback, recovery, monitoring and alert evidence. Product and
finance own pricing, refund behavior and merchant verification. Qualified privacy
and legal owners determine applicable notices, contracts and retention periods.
These roles still need named individuals before a release.

Revisit affected controls after material code changes and the full register at
release milestones. Keep old audit evidence and close findings with a linked fix
and regression proof. A green pre-existing suite does not close a failing audit
counterexample. See AUDIT_REPORT.md for fix batches and current limitations.
