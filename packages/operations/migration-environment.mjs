// Prisma's migration engine and node-postgres/libpq have different TLS URL options.
export function migrationEnvironment(input) {
  const local = input.RENEWRELAY_ENV === "local";
  const url = input.MIGRATION_DATABASE_URL ? new URL(input.MIGRATION_DATABASE_URL) : new URL("postgresql://localhost/renewrelay");
  if (!input.MIGRATION_DATABASE_URL) {
    if (!input.PGHOST || !input.PGPASSWORD) throw new Error("Migration database credentials are required");
    url.hostname = input.PGHOST; url.port = input.PGPORT ?? "5432";
    url.username = input.PGUSER ?? "renewrelay_migrator"; url.password = input.PGPASSWORD;
    url.pathname = "/" + (input.PGDATABASE ?? "renewrelay");
    url.searchParams.set("sslmode", local ? "disable" : "verify-full");
  }
  if (decodeURIComponent(url.username) !== "renewrelay_migrator") throw new Error("Use the migration role only");
  if (!local && url.searchParams.get("sslmode") !== "verify-full") throw new Error("Migration requires verified database TLS");
  const prisma = new URL(url);
  if (!local) {
    prisma.searchParams.set("sslmode", "require");
    prisma.searchParams.set("sslaccept", "strict");
    prisma.searchParams.set("sslcert", "/app/certs/rds-global-bundle.pem");
    prisma.searchParams.delete("sslrootcert");
  }
  return { ...input, MIGRATION_DATABASE_URL: prisma.toString(), PGHOST: url.hostname, PGPORT: url.port || "5432",
    PGDATABASE: url.pathname.slice(1), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: local ? "disable" : "verify-full", ...(!local ? { PGSSLROOTCERT: "/app/certs/rds-global-bundle.pem", NODE_EXTRA_CA_CERTS: "/app/certs/rds-global-bundle.pem" } : {}) };
}
