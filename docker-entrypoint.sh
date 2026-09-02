#!/bin/sh
# NeuralNexus container entrypoint.
#
# 1. Apply any pending Prisma/SQLite migrations (idempotent: a fresh
#    dev.db gets all tables; an existing one is a no-op).
# 2. Boot Next.js in listen mode.
#
# DATABASE_URL is set in the image (file:/data/dev.db). The /data dir is
# a volume mount in normal operation.
set -e

echo "[entrypoint] applying prisma migrations (DATABASE_URL=$DATABASE_URL)"
npx prisma migrate deploy --schema prisma/schema.prisma \
    || echo "[entrypoint] WARN: migrate deploy failed — continuing anyway"

exec node_modules/.bin/next start -H 0.0.0.0 -p 3000
