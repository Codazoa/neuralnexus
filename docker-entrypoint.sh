#!/bin/sh
# NeuralNexus container entrypoint.
#
# 1. Apply any pending Prisma/SQLite migrations (idempotent).
#    If the database predates the local-private-key auth scheme (it
#    contains the removed Session/Account tables), migrate deploy cannot
#    apply the new schema in place: the old file is preserved as a
#    sibling (.legacy-<ts>) and a fresh database is started. Data from
#    the old scheme is not meaningful to the new one, but nothing is
#    deleted.
# 2. Boot Next.js.

set -e
cd /app

run_migrate() {
  npx prisma migrate deploy
}

run_migrate || {
  echo "migration failed — checking for a pre-auth-scheme database..."
  node -e '
    const fs = require("fs");
    const path = "/data/dev.db";
    if (!fs.existsSync(path)) process.exit(0);
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    fs.renameSync(path, path + ".legacy-" + ts);
    console.log("preserved legacy database at /data/dev.db.legacy-" + ts + ", starting fresh");
  '
  echo "retrying migration on fresh database..."
  npx prisma migrate deploy
}

exec npx next start -p "${PORT:-3000}" -H 0.0.0.0
