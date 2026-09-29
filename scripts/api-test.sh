#!/usr/bin/env bash
# Spins up a throwaway database, applies db/, starts the API on a spare port,
# runs the end-to-end checks against it, then tears everything down.
#
#   ./scripts/api-test.sh
#   DATABASE_URL=postgres://postgres:secret@localhost:5432/uzoni ./scripts/api-test.sh
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] && set -a && . ./.env && set +a
BASE_URL="${DATABASE_URL:-postgres://postgres@localhost:5432/uzoni}"
TEST_DB="uzoni_test_$$"
TEST_PORT="${TEST_PORT:-5199}"

# Swap the database name in the URL, keeping any ?query= intact.
strip_query="${BASE_URL%%\?*}"
query=""
[ "$strip_query" != "$BASE_URL" ] && query="?${BASE_URL#*\?}"
ADMIN_URL="${strip_query%/*}/postgres${query}"
TEST_URL="${strip_query%/*}/${TEST_DB}${query}"

cleanup() {
  [ -n "${SERVER_PID:-}" ] && kill "$SERVER_PID" 2>/dev/null || true
  sleep 0.3
  psql "$ADMIN_URL" -q -c "drop database if exists ${TEST_DB};" >/dev/null 2>&1 || true
}
trap cleanup EXIT

psql "$ADMIN_URL" -q -c "create database ${TEST_DB};"
DATABASE_URL="$TEST_URL" node server/migrate.js

DATABASE_URL="$TEST_URL" PORT="$TEST_PORT" node server/index.js > /dev/null 2>&1 &
SERVER_PID=$!

# Wait for the port rather than guessing at a sleep length.
for _ in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:${TEST_PORT}/api/health" > /dev/null; then break; fi
  sleep 0.25
done

BASE="http://127.0.0.1:${TEST_PORT}" node scripts/api.test.mjs
