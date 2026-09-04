# Multi-stage build for NeuralNexus (Next.js + Prisma + SQLite)
#
# Stage 1 (deps): installs node_modules from the lockfile.
# Stage 2 (builder): prisma generate + next build. The built app is the
#   only artifact carried forward (plus package files and prisma schema).
# Stage 3 (runner): clean `npm ci` (no stale deps from the builder's
#   tree — next-auth was removed and must not linger), prisma generate
#   again so the client matches the runtime schema, and an entrypoint
#   that applies pending migrations (idempotent) before `next start`.
#
# Persistence: mount a named volume or bind-mount on /data. The sqlite
# file lives there; the entrypoint preserves a pre-auth-scheme db as
# .legacy-<ts> and starts fresh rather than letting migrate fail.

FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
RUN npx prisma generate --schema prisma/schema.prisma
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    DATABASE_URL="file:/data/dev.db"
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
# Ship package metadata first so the runner can resolve deps cleanly.
COPY package.json package-lock.json ./
# Clean install in the runner so the runtime tree exactly matches the
# (updated) lockfile. `npm ci` is fast here because node_modules from
# this same image layer is already cached by Docker.
RUN npm ci --no-audit --no-fund
# Bring in the built app + schema.
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js
# Generate the client against the shipped schema.
RUN npx prisma generate --schema prisma/schema.prisma
# Entrypoint applies migrations (idempotent) and starts next.
RUN mkdir -p /data
COPY ./docker-entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
