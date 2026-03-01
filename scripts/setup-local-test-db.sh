#!/usr/bin/env bash
set -euo pipefail

PG_BIN_DIR="/opt/homebrew/opt/postgresql@16/bin"
DB_URL_DEFAULT="postgresql://$USER@127.0.0.1:5432/humanecare_test"
DB_URL="${DATABASE_URL:-$DB_URL_DEFAULT}"

if ! command -v "$PG_BIN_DIR/psql" >/dev/null 2>&1; then
  echo "postgresql@16 is not installed. Install with: brew install postgresql@16" >&2
  exit 1
fi

echo "Starting postgres service (postgresql@16)..."
brew services start postgresql@16 >/dev/null

echo "Waiting for postgres on 127.0.0.1:5432..."
for _ in {1..30}; do
  if "$PG_BIN_DIR/pg_isready" -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

"$PG_BIN_DIR/pg_isready" -h 127.0.0.1 -p 5432 >/dev/null

echo "Recreating database humanecare_test..."
"$PG_BIN_DIR/dropdb" --if-exists -h 127.0.0.1 -p 5432 humanecare_test
"$PG_BIN_DIR/createdb" -h 127.0.0.1 -p 5432 humanecare_test

echo "Applying SQL migrations to $DB_URL ..."
for f in backend/prisma/migrations/*/migration.sql; do
  echo "  -> $f"
  "$PG_BIN_DIR/psql" "$DB_URL" -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done

echo "Done."
echo "DATABASE_URL=$DB_URL"
