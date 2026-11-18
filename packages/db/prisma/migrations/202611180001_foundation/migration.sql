-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'admin', 'member');

-- CreateTable
CREATE TABLE "auth_users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_rate_limits" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "workspaceId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMPTZ,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("workspaceId","userId")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "tokenDigest" TEXT NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "acceptedAt" TIMESTAMPTZ,
    "revokedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "archivedAt" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "archivedAt" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "actorId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "requestId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "command_receipts" (
    "actorId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "command_receipts_pkey" PRIMARY KEY ("actorId","scope","key")
);

-- CreateTable
CREATE TABLE "mail_jobs" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "inviteId" UUID NOT NULL,
    "recipient" TEXT NOT NULL,
    "ciphertext" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "leaseUntil" TIMESTAMPTZ,
    "leaseToken" UUID,

    CONSTRAINT "mail_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_email_key" ON "auth_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_key" ON "auth_sessions"("token");

-- CreateIndex
CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions"("userId");

-- CreateIndex
CREATE INDEX "auth_accounts_userId_idx" ON "auth_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_accounts_providerId_accountId_key" ON "auth_accounts"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "auth_rate_limits_key_key" ON "auth_rate_limits"("key");

-- CreateIndex
CREATE INDEX "memberships_userId_removedAt_idx" ON "memberships"("userId", "removedAt");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tokenDigest_key" ON "invitations"("tokenDigest");

-- CreateIndex
CREATE INDEX "invitations_workspaceId_email_expiresAt_idx" ON "invitations"("workspaceId", "email", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_workspaceId_id_key" ON "invitations"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_workspaceId_id_key" ON "clients"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "contacts_workspaceId_clientId_id_idx" ON "contacts"("workspaceId", "clientId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_workspaceId_id_key" ON "contacts"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "audit_events_workspaceId_entityId_createdAt_idx" ON "audit_events"("workspaceId", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "mail_jobs_status_runAt_idx" ON "mail_jobs"("status", "runAt");

-- CreateIndex
CREATE UNIQUE INDEX "mail_jobs_workspaceId_inviteId_key" ON "mail_jobs"("workspaceId", "inviteId");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_workspaceId_clientId_fkey" FOREIGN KEY ("workspaceId", "clientId") REFERENCES "clients"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_jobs" ADD CONSTRAINT "mail_jobs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_jobs" ADD CONSTRAINT "mail_jobs_workspaceId_inviteId_fkey" FOREIGN KEY ("workspaceId", "inviteId") REFERENCES "invitations"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Database invariants that Prisma's schema cannot express.
CREATE UNIQUE INDEX memberships_one_active_owner
  ON memberships ("workspaceId") WHERE role = 'owner' AND "removedAt" IS NULL;
ALTER TABLE invitations ADD CONSTRAINT invitation_role_check CHECK (role <> 'owner');
ALTER TABLE invitations ADD CONSTRAINT invitation_closed_check
  CHECK ("acceptedAt" IS NULL OR "revokedAt" IS NULL);
ALTER TABLE mail_jobs ADD CONSTRAINT mail_job_status_check
  CHECK (status IN ('pending', 'leased', 'sent', 'canceled', 'expired', 'failed', 'uncertain'));
ALTER TABLE mail_jobs ADD CONSTRAINT mail_job_lease_check
  CHECK ((status = 'leased') = ("leaseToken" IS NOT NULL AND "leaseUntil" IS NOT NULL));

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE mail_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_jobs FORCE ROW LEVEL SECURITY;

CREATE FUNCTION public.current_workspace() RETURNS uuid
LANGUAGE sql STABLE SET search_path TO pg_catalog AS $$
  SELECT NULLIF(current_setting('renewrelay.workspace_id', true), '')::uuid
$$;

CREATE FUNCTION public.current_actor() RETURNS text
LANGUAGE sql STABLE SET search_path TO pg_catalog AS $$
  SELECT NULLIF(current_setting('renewrelay.actor_id', true), '')
$$;

CREATE POLICY workspace_tenant ON workspaces
  USING (id = public.current_workspace())
  WITH CHECK (id = public.current_workspace());

CREATE POLICY workspace_list_own ON workspaces FOR SELECT
  USING (public.current_workspace() IS NULL AND EXISTS (
    SELECT 1 FROM memberships
    WHERE "workspaceId" = workspaces.id AND "userId" = public.current_actor()
      AND "removedAt" IS NULL
  ));

CREATE POLICY membership_tenant ON memberships
  USING ("workspaceId" = public.current_workspace())
  WITH CHECK ("workspaceId" = public.current_workspace());

CREATE POLICY membership_bootstrap ON memberships FOR SELECT
  USING (public.current_workspace() IS NULL AND "userId" = public.current_actor());

CREATE POLICY invitation_tenant ON invitations
  USING ("workspaceId" = public.current_workspace())
  WITH CHECK ("workspaceId" = public.current_workspace());

CREATE POLICY invitation_lookup ON invitations FOR SELECT
  USING (public.current_workspace() IS NULL
    AND "tokenDigest" = NULLIF(current_setting('renewrelay.invite_digest', true), ''));

CREATE POLICY client_tenant ON clients
  USING ("workspaceId" = public.current_workspace())
  WITH CHECK ("workspaceId" = public.current_workspace());

CREATE POLICY contact_tenant ON contacts
  USING ("workspaceId" = public.current_workspace())
  WITH CHECK ("workspaceId" = public.current_workspace());

CREATE POLICY audit_tenant ON audit_events
  USING ("workspaceId" = public.current_workspace())
  WITH CHECK ("workspaceId" = public.current_workspace() AND "actorId" = public.current_actor());

CREATE POLICY receipt_actor ON command_receipts
  USING ("actorId" = public.current_actor())
  WITH CHECK ("actorId" = public.current_actor());

CREATE POLICY mail_tenant ON mail_jobs
  USING ("workspaceId" = public.current_workspace())
  WITH CHECK ("workspaceId" = public.current_workspace());

-- The worker has cross-workspace access limited to this queue.
CREATE POLICY mail_dispatch ON mail_jobs
  USING (current_user = 'renewrelay_worker')
  WITH CHECK (current_user = 'renewrelay_worker');

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
