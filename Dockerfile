# Multi-stage build for NeuralNexus (Next.js 13 + Prisma 4 + SQLite)
#
# SQLite: the database is a single file on the host volume at /data/dev.db
# inside the container. The runner stage runs `prisma migrate deploy` on
# startup (idempotent — fresh file = all migrations get applied; existing
# file = no-op) before starting Next.
#
# Persistence: mount a named volume or bind-mount on /data.

FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
# Prisma 4's engine loader requires an OpenSSL version it can detect at
# build time; without libssl the query engine variant won't resolve.
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Build-time stubs: `next build` imports the NextAuth route and
# instantiates GithubProvider, which throws if the envs are undefined.
# Real values are injected at runtime via `docker run -e ...`.
ENV DATABASE_URL="file:/data/dev.db" \
    NEXTAUTH_SECRET="build-time-stub-secret-000000" \
    GITHUB_ID="build-time-stub-client-id" \
    GITHUB_SECRET="build-time-stub-client-secret"
# prisma's postinstall can be skipped by `npm ci`; generate the client
# explicitly so page-data collection can import it.
RUN npx prisma generate --schema prisma/schema.prisma
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
# Same libssl the build stage saw so the Prisma query engine loads.
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    DATABASE_URL="file:/data/dev.db"
# Data dir lives on a volume; migrate deploy will create the file and
# tables on first startup. The directory must exist in the image so the
# mount target can't be replaced by a file on some hosts.
RUN mkdir -p /data
COPY package.json ./
# Ship all node_modules — the generated Prisma client lives under
# node_modules/.prisma and @prisma/client depends on it at runtime.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js
# Regenerate the client against the schema so the runtime stage never
# depends on the builder stage's layout.
RUN npx prisma generate --schema prisma/schema.prisma \
    || echo "prisma generate failed at build — relying on the copied client"
# Entrypoint: apply any pending migrations (idempotent) then boot Next.
COPY ./docker-entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
