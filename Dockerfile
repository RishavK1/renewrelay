# Build once; run web and worker with distinct commands and scoped credentials.
FROM node:22.23.5-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run db:generate && npm run build:release
RUN mkdir -p /app/release/certs && node -e "fetch('https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem').then(r=>{if(!r.ok)throw Error('CA download failed');return r.text()}).then(t=>require('node:fs').writeFileSync('/app/release/certs/rds-global-bundle.pem',t))"
RUN cp /app/THIRD_PARTY_NOTICES.txt /app/release/THIRD_PARTY_NOTICES.txt

FROM node:22.23.5-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee AS migration
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/release/certs ./certs
COPY scripts/migrate.mjs ./scripts/migrate.mjs
COPY packages/operations/migration-environment.mjs ./packages/operations/migration-environment.mjs
USER node
CMD ["node", "scripts/migrate.mjs"]

FROM node:22.23.5-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN groupadd --gid 10001 renewrelay && useradd --uid 10001 --gid 10001 --no-create-home renewrelay
COPY --from=builder --chown=10001:10001 /app/release ./
USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 CMD ["node", "dist/healthcheck.mjs", "web"]
CMD ["node", "dist/web.mjs"]
