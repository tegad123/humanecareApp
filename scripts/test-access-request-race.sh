#!/usr/bin/env bash
set -euo pipefail

PG_BIN_DIR="/opt/homebrew/opt/postgresql@16/bin"
DB_URL_DEFAULT="postgresql://$USER@127.0.0.1:5432/humanecare_test"
DB_URL="${DATABASE_URL:-$DB_URL_DEFAULT}"

if ! command -v "$PG_BIN_DIR/psql" >/dev/null 2>&1; then
  echo "postgresql@16 is not installed. Install with: brew install postgresql@16" >&2
  exit 1
fi

"$PG_BIN_DIR/psql" "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
TRUNCATE TABLE users, organizations, access_requests RESTART IDENTITY CASCADE;
INSERT INTO access_requests (id, agency_name, requester_name, work_email, status, approval_token, created_at, updated_at)
VALUES ('req1','Agency One','Requester','req@example.com','pending','tok1',NOW(),NOW());
SQL

cat > /tmp/tx_a.sql <<'SQL'
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO organizations (id, name, created_at, updated_at) VALUES ('org_a', 'Org A', NOW(), NOW());
INSERT INTO users (id, organization_id, clerk_user_id, email, role, created_at, updated_at)
VALUES ('user_a','org_a','pending_a','a@example.com','admin',NOW(),NOW());
SELECT pg_sleep(1);
WITH upd AS (
  UPDATE access_requests
  SET status='approved', approval_token=NULL, reviewed_at=NOW(), updated_at=NOW()
  WHERE id='req1' AND status='pending' AND approval_token='tok1'
  RETURNING 1
)
SELECT CASE WHEN count(*) = 1 THEN 'true' ELSE 'false' END AS should_commit FROM upd \gset
\if :should_commit
  COMMIT;
\else
  ROLLBACK;
\endif
SQL

cat > /tmp/tx_b.sql <<'SQL'
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO organizations (id, name, created_at, updated_at) VALUES ('org_b', 'Org B', NOW(), NOW());
INSERT INTO users (id, organization_id, clerk_user_id, email, role, created_at, updated_at)
VALUES ('user_b','org_b','pending_b','b@example.com','admin',NOW(),NOW());
WITH upd AS (
  UPDATE access_requests
  SET status='approved', approval_token=NULL, reviewed_at=NOW(), updated_at=NOW()
  WHERE id='req1' AND status='pending' AND approval_token='tok1'
  RETURNING 1
)
SELECT CASE WHEN count(*) = 1 THEN 'true' ELSE 'false' END AS should_commit FROM upd \gset
\if :should_commit
  COMMIT;
\else
  ROLLBACK;
\endif
SQL

"$PG_BIN_DIR/psql" "$DB_URL" -f /tmp/tx_a.sql >/tmp/tx_a.out 2>&1 &
PID_A=$!
"$PG_BIN_DIR/psql" "$DB_URL" -f /tmp/tx_b.sql >/tmp/tx_b.out 2>&1 &
PID_B=$!
wait "$PID_A"
wait "$PID_B"

echo "--- tx_a.out ---"
cat /tmp/tx_a.out
echo "--- tx_b.out ---"
cat /tmp/tx_b.out

echo "--- final counts ---"
ORG_COUNT=$("$PG_BIN_DIR/psql" "$DB_URL" -tAc "SELECT count(*) FROM organizations;")
USER_COUNT=$("$PG_BIN_DIR/psql" "$DB_URL" -tAc "SELECT count(*) FROM users;")
REQ_STATE=$("$PG_BIN_DIR/psql" "$DB_URL" -tAc "SELECT status || '|' || (approval_token IS NULL)::text FROM access_requests WHERE id='req1';")

echo "organizations=$ORG_COUNT"
echo "users=$USER_COUNT"
echo "request=$REQ_STATE"

if [[ "$ORG_COUNT" == "1" && "$USER_COUNT" == "1" && "$REQ_STATE" == "approved|true" ]]; then
  echo "PASS: token can only be consumed once."
  exit 0
fi

echo "FAIL: expected 1 org, 1 user, approved request with consumed token." >&2
exit 1

