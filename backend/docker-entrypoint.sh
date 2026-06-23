#!/bin/sh
set -e

echo "[entrypoint] Syncing Prisma schema to database..."
npx prisma db push --skip-generate

echo "[entrypoint] Seeding database..."
npx prisma db seed || echo "[entrypoint] Seed skipped/failed (continuing)."

echo "[entrypoint] Starting backend..."
exec "$@"
