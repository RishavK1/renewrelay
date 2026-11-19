# RenewRelay

Client renewal management for agencies: track service dates, collect client decisions
and record provider follow-through and invoicing separately.

## Project structure

- `apps/web` — application UI, authentication and backend API.
- `apps/marketing` — marketing site and development-only product UI previews.
- `apps/worker` — scheduled notifications, delivery and background processing.
- `packages` — shared UI, contracts, domain logic, database and integrations.
- `infra` — local services and deployment configuration.
- `tests` — unit, UI-contract and integration checks.

## Local setup

Requires Node.js 22.23.5, npm and Docker Compose.

1. Install dependencies and generate the database client:

   ```sh
   npm ci
   npm run db:generate
   ```

2. Copy `.env.example` to `.env`. Generate independent values for
   `BETTER_AUTH_SECRET` and `INVITE_ENCRYPTION_KEY` by running the command below
   twice. Keep `.env` private and untracked.

   ```sh
   node -p 'require("node:crypto").randomBytes(32).toString("base64url")'
   ```

3. Start PostgreSQL and the local email inbox, then apply migrations and grants:

   ```sh
   docker compose up -d --wait
   npm run db:deploy
   docker compose exec -T postgres psql -U renewrelay_migrator -d renewrelay -v ON_ERROR_STOP=1 -f - < packages/db/grant-runtime.sql
   ```

4. Run `npm run dev`. Open the exact origin configured in `BETTER_AUTH_URL`
   (default `http://localhost:3000`). Local captured emails appear at
   `http://localhost:8025`; they are not sent to real inboxes.

If port 5432 is occupied, set `RENEWRELAY_POSTGRES_PORT` in `.env` and update all
local database URLs to the same port. Use a separate terminal for `npm run worker`
when testing background workflows. Authentication emails do not require the worker.

## Frontend and authentication

Run `npm run dev:marketing` for the marketing site at `http://127.0.0.1:3001`.
Product previews on that origin are development-only and use simulated data.

The application origin supports signup, email verification, login, authenticator
setup, MFA/recovery-code sign-in and sign-out. Authenticator enrollment requires a
recent login. Save recovery codes before leaving their page; they are not kept in
browser storage. Password-reset UI and workspace/dashboard API wiring are still in
progress. Preview screens do not imply that their backend connections are complete.

## Checks and builds

```sh
npm run check
npm run build
npm run build:marketing
RR_TEST_PG_CONTAINER=renewrelay-postgres-1 npm run test:auth
```

The focused auth suite requires a completed application build and local database
configuration. It creates an isolated synthetic database and starts its own app/SMTP
fixtures on ports 3547/3548. Use the actual Compose container name, or omit
`RR_TEST_PG_CONTAINER` if PostgreSQL client tools are installed locally.

`npm run build:release` assembles the standalone web and worker release. Database
migrations use a separate principal; deployed runtime connections use restricted
roles and verified TLS. Local checks do not establish deployment readiness.

The generated API inventory is [api-contract.json](packages/contracts/api-contract.json).
Use `npm run contracts:check` to verify it and `npm run contracts:generate` after
reviewing endpoint changes. License notices are in
[THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt) and alongside bundled assets.
