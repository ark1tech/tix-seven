#!/usr/bin/env bash
# Verifies local Alembic revision id matches apps/gate-server/alembic/EXPECTED_HEAD.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXP="$(tr -d '[:space:]' <"$ROOT/apps/gate-server/alembic/EXPECTED_HEAD")"

if command -v alembic >/dev/null 2>&1; then
  ACT="$(cd "$ROOT/apps/gate-server" && alembic heads 2>/dev/null | awk '{print $1}' | head -1)"
  if [ -z "$ACT" ]; then
    echo "verify-alembic-head: could not read alembic heads" >&2
    exit 1
  fi
  if [ "$ACT" != "$EXP" ]; then
    echo "verify-alembic-head: mismatch — EXPECTED_HEAD=$EXP, alembic heads=$ACT" >&2
    exit 1
  fi
  echo "verify-alembic-head: OK ($EXP)"
else
  echo "verify-alembic-head: alembic not on PATH; ensure EXPECTED_HEAD ($EXP) matches the latest revision in apps/gate-server/alembic/versions/"
fi
