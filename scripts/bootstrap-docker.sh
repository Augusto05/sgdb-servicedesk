#!/usr/bin/env bash
# Aplica todos os SQL no Postgres do docker-compose (execute na raiz do projeto)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "A subir o container PostgreSQL..."
docker compose up -d db
echo "A aguardar o Postgres ficar pronto..."
for i in $(seq 1 40); do
  if docker compose exec -T db pg_isready -U postgres -d sgdb >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

for f in 01_schema.sql 02_functions.sql 03_triggers.sql 04_security.sql 05_seed.sql; do
  echo "A executar sql/$f ..."
  docker compose exec -T db psql -U postgres -d sgdb -v ON_ERROR_STOP=1 < "$ROOT/sql/$f"
done

docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "GRANT CONNECT ON DATABASE sgdb TO sgdb_app" || true

echo ""
echo "Pronto. No .env use:"
echo "  DATABASE_URL=postgres://sgdb_app:troque_esta_senha_em_producao@127.0.0.1:5432/sgdb"
echo "Depois: npm install && npm start"
