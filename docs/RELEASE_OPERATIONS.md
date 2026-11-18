# RenewRelay release and operations

Batch 5 supplies local release artifacts and reviewed deployment definitions.
Actual AWS deployment, alert delivery, provider acceptance and business approval
remain batch 6. Do not enable public traffic or side effects from this document
alone. The frontend and browser acceptance are separate.

## Build and verify

Use Node 22.23.5, the committed npm lock, and PostgreSQL 18 for release checks.

1. `npm ci && npm run db:generate`
2. `npm run check` — JavaScript ESLint; strict TypeScript/unused-symbol and AST
   quality checks; unit tests; API contract drift; targeted credential scan.
3. `npm run licenses` and `npm audit --audit-level=moderate`. Review license
   exceptions in docs/audit/dependency-licenses-batch5-2026-11-18.json.
4. `npm run build:release` generates standalone/compiled artifacts and overlays
   a separate locked production install. Never run npm ci inside release: it
   deletes Next-generated traced aliases. Use npm run release:install for an overlay.
5. With a private synthetic local environment loaded, apply migrations and grants.
   Run `RR_TEST_NEXT_MODE=release npm run test:e2e`, `npm run test:migrations`,
   `npm run test:restore` and `npm run test:audit`. Audit and load commands create
   separate databases so terminal delivery fixtures cannot contaminate dispatch checks.
6. `docker build --target runtime -t renewrelay:review .` and
   `docker build --target migration -t renewrelay-migration:review .`.
7. Validate `infra/aws/backend.template.json` with cfn-lint 1.60.1. Image
   vulnerability scanning and target-platform license/distribution review remain
   release obligations. Record local command results and the exact Git commit.

GitHub Actions is intentionally removed at the owner's request. GitHub hosts source
code only; pushes do not run repository-hosted checks. Use the local commands
above before release, including `npm run test:containers` with the reviewed image
tags. Keep the verification evidence with each release. Automated remote enforcement
and unattended deployment are not implemented or required to unblock local work.
These checks do not require purchasing GitHub Actions or another CI service.
Cloud provisioning remains a separate approval/cost decision.

Production uses the supported Webpack build path: local Linux container testing
caught an unresolved external-module alias in the Turbopack standalone output.
The runtime image has only production npm dependencies, a compiled ESM worker,
Next standalone server, RDS CA certificates and notices. Web's generated CommonJS
server has its own package boundary. It runs as UID/GID 10001. The migration image
contains deliberately separate tooling and master-role access; never attach its
credentials to web or worker. The base image is digest-pinned. npm production
install disables lifecycle scripts because Prisma is generated in the build stage.

Commands: `node dist/web.mjs`, `node dist/worker.mjs`, and (migration target)
`node scripts/migrate.mjs`. Runtime does not execute tsx, TypeScript or Prisma CLI. npm may retain TypeScript
and Prisma as optional peers of the production auth/client packages even with
dev/peer omission; the license inventory includes that graph. Startup tests prove
execution uses the compiled artifacts, with tsx and ESLint absent.
The compiled web launcher exits nonzero on preflight failure before importing
the framework server. Web startup validates configuration, critical schema markers and app/auth table
access before accepting traffic. Worker validates configuration/schema before its
loop. `/api/v1/health` repeats schema/grant readiness and returns only ok/unavailable.
It is not an exhaustive database integrity check. Worker health checks require a
heartbeat newer than 120 seconds; operation errors have a separate alarm.

## Infrastructure and rollout

The CloudFormation template uses an existing VPC with public ALB subnets and
private task/database subnets. Private subnets need approved NAT or appropriate
endpoints for ECR, logs, Secrets Manager and external mail/billing. Budget alerts
are notifications, not cost caps. Review the proposed DB class, Multi-AZ, storage,
log/backup retention, region and account limits before provisioning.

Resources include HTTPS ALB, Fargate web/worker tasks, TLS-required private encrypted
PostgreSQL 18, scoped execution roles, CloudWatch logs/metrics/alarms, SNS, budget
alerts and database-event notifications. Application IAM role has no AWS access;
execution roles read only their referenced secrets. Customer-managed KMS keys
require separately scoped kms:Decrypt permissions if selected.

1. Prepare ECR runtime/migration images and record immutable digests. Set the
   CpuArchitecture parameter to match both images (ARM64 default). Local arm64
   verification does not prove x86_64 startup; the Ubuntu CI build is x86_64.
2. Prepare public DNS and an ACM certificate. Configure the trusted Cloudflare proxy
   to overwrite CF-Connecting-IP, preserve cookies, bypass caching for private/API
   paths and avoid sensitive URL/access-log capture. Supply a maintained trusted
   proxy prefix list. The ALB accepts 443 only from that list; tasks accept ingress
   only from ALB. Validate actual proxy behavior and direct-origin denial in staging.
3. Create the stack with ApplicationEnabled=false. No application services start.
   RDS generates a master migration secret. Run the migration task once in the
   private task security group; it applies migrations and reviewed grants. On an
   existing deployment, drain old web/workers before migration 016 as well: its
   indexes use ordinary CREATE INDEX and can block writes. Large datasets need a
   measured maintenance window or a separately reviewed concurrent-index rollout.
4. Provision random, distinct app/auth/worker DB passwords through a secure operator
   session as the migration principal. Grant no owner/superuser/BYPASSRLS access.
   Use grant-runtime.sql. The template does not invent or expose those passwords.
   The migration launcher maps verified TLS to the engine-specific
   sslmode=require, sslaccept=strict and bundled sslcert options; psql retains
   verify-full with PGSSLROOTCERT. Never pass runtime pg URL options unchanged
   to a different migration TLS parser.
5. Populate separate web/worker JSON secrets with the keys listed in template
   parameter descriptions. Database URLs must identify the matching runtime role
   and set sslmode=verify-full. NODE_EXTRA_CA_CERTS trusts the included RDS bundle;
   never use rejectUnauthorized=false. Validate the real hostname/CA chain.
6. Set immutable image digests and ApplicationEnabled=true. Sends, billing and purge
   default off. Run batch 6 acceptance, including HTTPS identity/MFA and cookies,
   before enabling the corresponding provider configuration. Identity SMTP calls
   are separate from the worker outbound flag: use a staging mail sink until ready.
7. Promote the same tested image digest. Web may scale within its configured count.
   Keep one worker: its send limiter is process-local, and identity mail/other apps
   also consume provider quota. Worker deployment stops the old worker before the
   replacement to avoid overlapping rate budgets. Review maintenance alarm noise.
8. Confirm readiness, task health, schema/grants and alert subscriptions. Only then
   record release-owner approval for traffic and individually gated side effects.

Web pools allow 8 app + 4 auth connections per replica; worker uses concurrency+2
(default 6). Four web replicas plus one worker therefore budget 54 connections,
plus migration/admin and monitoring reserve. Readiness and in-flight work share
those pools. Review actual RDS max_connections and load before raising counts.
No global replica mail-rate coordination is claimed.

## Telemetry and alerts

Application logs are JSON with a fixed operation/route template, status, duration
and generated request ID. Error logging deliberately omits exception messages,
stacks, raw URLs, query strings, bodies, headers, cookies, SQL and principal data.
Public-link/reset-token segments never enter route labels. X-Request-Id correlates
responses and logs. Framework/platform access logs require their own masking review.
The Next error hook emits a safe event; route errors return a safe JSON response.

CloudWatch Embedded Metric Format writes to stdout, collected by the task awslogs
log driver. No telemetry HTTP endpoint exposes operational data. Dimensions are
only service and environment; user/workspace/request IDs never become dimensions.
Per-request metrics record request count, 5xx count and latency. Database latency
is the average query duration in each 30-second process sample, not a per-query
p95. Worker publishes heartbeat, oldest actionable queue age, pending billing-event
age, uncertain-job and failed-job counts across all three mail lanes. Counts cap scans at
10,001 per lane; a cap means investigate rather than infer an exact total.

Alarms include API 5xx, API p95 latency, worker errors, queue age >=300s for two
checks, billing backlog >=900s, uncertain deliveries, missing heartbeat, unhealthy
ALB targets, RDS CPU/connections/free storage, central error events and database
failure/storage notifications. SNS subscriptions and on-call acknowledgment must
be verified by the release owner. Missing non-heartbeat application metrics are
not automatically outages; heartbeat and ALB alarms cover basic availability.

Local tests inspect emitted/redacted events, readiness failure/recovery, restricted
worker queries and alarm thresholds. They do not prove CloudWatch extraction,
notification delivery, actual AWS permissions or an on-call response.

## Rollback and recovery

Keep previous image digest, migration list/checksums, granted-role snapshot and
release evidence. Migration 016 only adds indexes; batch-4 artifacts can run with
that schema. Rolling back the image does not require dropping those indexes.
Do not automatically reverse migrations, restore an old DB over current data or
retry uncertain sends. A future incompatible migration needs its own expand/switch/
contract plan and tested rollback boundary.

On failed rollout: stop side effects, retain failed-task logs, return web/worker to
the compatible previous digest and verify schema/readiness and tenant access.
Keep billing inbox events pending until reconciliation succeeds. If restoration
is necessary, follow recovery.md in an isolated environment, reconcile deletion
and revocation ledgers and vendor histories, then authorize resumed traffic.
RPO <=15 minutes and RTO <=4 hours remain proposed targets requiring measured
managed PITR and restore evidence. Local logical restore does not prove them.

## Incident response and maintenance

Assign release owner, primary/backup on-call, security/privacy contact and finance
contact before launch; no person or support address is fabricated here.

For an incident: acknowledge the alarm, assign a lead, record UTC times/scope,
contain ingress or the affected side effects, preserve restricted logs/evidence,
assess affected tenants and revoked credentials, implement/review a fix, restore
and reconcile, verify tenant isolation and document customer impact. Credential
rotation and external notifications require incident-owner authorization. Privacy
counsel determines applicable regulator/user notification deadlines and content;
no universal legal deadline is assumed. Rehearse this process on staging.

Daily: check queue/billing age, uncertain sends, worker/backup health and failed
payments. Weekly during pilot: restore rehearsal, suppression/reconciliation and
access review. Monthly: dependency/image advisories, license inventory, secrets/
permissions, capacity/cost budgets and policy ownership. After material changes:
apply saas-production-audit, regenerate contracts, run affected regressions and
update source fingerprints. After incidents: record corrective actions and retest.

## Primary implementation references

- [Next standalone output](https://nextjs.org/docs/pages/api-reference/config/next-config-js/output)
- [Next startup instrumentation](https://nextjs.org/docs/pages/api-reference/file-conventions/instrumentation)
- [CloudWatch EMF](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format_Specification.html)
- [ECS execution roles](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html)
- [Cloudflare request headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/)

- [Prisma PostgreSQL TLS options](https://docs.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql)

- [Node 22.23.5 security release](https://nodejs.org/en/blog/release/v22.23.5/)
