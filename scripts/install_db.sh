#!/usr/bin/env bash
# Uso: export PGURL=postgres://postgres:senha@localhost:5432/postgres
#      bash scripts/install_db.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DBNAME="${DBNAME:-sgdb}"
PGURL="${PGURL:-postgres://postgres@localhost:5432/postgres}"

psql "$PGURL" -v ON_ERROR_STOP=1 -c "SELECT 1 FROM pg_database WHERE datname = '$DBNAME'" | grep -q 1 || \
  psql "$PGURL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DBNAME"

APPURL="${APPURL:-postgres://postgres@localhost:5432/$DBNAME}"
for f in 01_schema.sql 02_functions.sql 03_triggers.sql 04_security.sql 05_seed.sql; do
  psql "$APPURL" -v ON_ERROR_STOP=1 -f "$ROOT/sql/$f"
done

psql "$PGURL" -v ON_ERROR_STOP=1 -c "GRANT CONNECT ON DATABASE $DBNAME TO sgdb_app"

echo "Concluído. Ajuste a senha do role sgdb_app em sql/04_security.sql e em DATABASE_URL."
