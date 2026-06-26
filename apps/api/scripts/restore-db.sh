#!/usr/bin/env bash
# Restores a CampoFlow Postgres dump created by backup-db.sh. Destructive: drops and
# recreates the schema before restoring. Always confirm before running against a
# database with real data.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(dirname "$SCRIPT_DIR")"

if [ -f "$API_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$API_DIR/.env"
  set +a
fi

DUMP_FILE="${1:-}"
if [ -z "$DUMP_FILE" ] || [ ! -f "$DUMP_FILE" ]; then
  echo "Uso: $0 <caminho-do-arquivo.sql.gz>" >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL nao definido (verifique apps/api/.env)" >&2
  exit 1
fi

read -r -p "Isso vai SOBRESCREVER o banco apontado por DATABASE_URL. Continuar? [s/N] " CONFIRM
if [[ "$CONFIRM" != "s" && "$CONFIRM" != "S" ]]; then
  echo "Cancelado."
  exit 0
fi

# psql doesn't understand Prisma's "?schema=" query param, so strip it before use.
PSQL_URL="${DATABASE_URL%%\?*}"

echo "Restaurando $DUMP_FILE..."
gunzip -c "$DUMP_FILE" | psql "$PSQL_URL"
echo "Restauracao concluida."
