#!/usr/bin/env bash
# If DATABASE_URL is set, checks public.alembic_version matches EXPECTED_HEAD.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXP="$(tr -d '[:space:]' <"$ROOT/apps/gate-server/alembic/EXPECTED_HEAD")"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "verify-remote-alembic-version: DATABASE_URL not set; skip"
  exit 0
fi

ACT="$(psql "$DATABASE_URL" -tAc "select version_num from public.alembic_version limit 1" 2>/dev/null | tr -d '[:space:]')"
if [ -z "$ACT" ]; then
  echo "verify-remote-alembic-version: could not read public.alembic_version" >&2
  exit 1
fi
if [ "$ACT" != "$EXP" ]; then
  echo "verify-remote-alembic-version: mismatch — EXPECTED_HEAD=$EXP, database=$ACT" >&2
  exit 1
fi
echo "verify-remote-alembic-version: OK ($ACT)"
