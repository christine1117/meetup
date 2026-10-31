#!/bin/sh
# Database tests: the migrations and supabase/tests/*.sql on a throwaway
# PostgreSQL in Docker (nothing touches the real database). Needs Docker.
set -e
cd "$(dirname "$0")/.."
name=halfsugar-db-test
docker rm -f "$name" >/dev/null 2>&1 || true
docker run -d --name "$name" -e POSTGRES_PASSWORD=test postgres:16 -c wal_level=logical >/dev/null
trap 'docker rm -f "$name" >/dev/null 2>&1' EXIT
# The image restarts once after creating the database: wait until it answers twice
for i in $(seq 1 60); do
  if docker exec "$name" psql -U postgres -c 'select 1' >/dev/null 2>&1; then sleep 2
    docker exec "$name" psql -U postgres -c 'select 1' >/dev/null 2>&1 && break
  fi
  sleep 1
done
run() { docker exec -i -e PGOPTIONS='-c client_min_messages=warning' "$name" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres; }
cat supabase/tests/stub.sql supabase/migrations/*.sql | run
for f in supabase/tests/*_test.sql; do run < "$f"; done
