# Multi-stage build for NeuralNexus (Next.js 13 + Prisma 4)
# Serves on 0.0.0.0:3000

FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
# Prisma 4's engine loader requires an OpenSSL version it can detect;
# without libssl it defaults to the wrong engine variant at build time.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Build-time stubs: `next build` imports the NextAuth route and instantiates
# GithubProvider, which throws if the envs are undefined at build time.
# Real values are injected at runtime via `docker run -e ...` (see workflow).
ENV DATABASE_URL="postgresql://stub:***@localhost:5432/stub" \
    NEXTAUTH_SECRET="build-time-stub-secret-000000" \
    GITHUB_ID="build-time-stub-client-id" \
    GITHUB_SECRET="build-time-stub-client-secret"
# prisma's postinstall is skipped by `npm ci` in some setups — generate
# the client explicitly so page-data collection can import it.
RUN npx prisma generate --schema prisma/schema.prisma
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
# Runner needs the same OpenSSL the build stage detected, or the
# generated Prisma query engine won't load at runtime.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
COPY package.json ./
# Ship ALL of node_modules — the generated Prisma client lives in
# node_modules/.prisma and @prisma/client depends on it at runtime.
COPY --from=builder /app/node_modules ./node_modules
COPY prisma ./prisma
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js
# Regenerate the Prisma client against the schema so the runtime
# stage never depends on the builder stage's layout.
RUN npx prisma generate --schema prisma/schema.prisma 2>/dev/null || true
EXPOSE 3000
CMD ["sh", "-c", "node_modules/.bin/next start -H 0.0.0.0 -p 3000"]
