# Multi-stage build for NeuralNexus (Next.js 13 + Prisma 4)
# Serves on 0.0.0.0:3000

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# prisma generate needs a schema; DATABASE_URL is only resolved at runtime
ENV DATABASE_URL="postgresql://stub:***@localhost:5432/stub"
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
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
