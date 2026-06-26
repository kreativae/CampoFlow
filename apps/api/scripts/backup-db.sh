#!/usr/bin/env bash
# Dumps the CampoFlow Postgres database to apps/api/backups/, then deletes dumps
# older than RETENTION_DAYS. Intended to be run on a schedule (cron/launchd — see
# scripts/README.md). Off-site storage (S3/R2) is a documented future step that
# requires cloud credentials not available in this environment; this script only
# covers local rotation, which is what's under our control here.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$API_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [ -f "$API_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$API_DIR/.env"
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL nao definido (verifique apps/api/.env)" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DUMP_FILE="$BACKUP_DIR/campoflow-$TIMESTAMP.sql.gz"

# pg_dump doesn't understand Prisma's "?schema=" query param, so strip it before use.
PG_DUMP_URL="${DATABASE_URL%%\?*}"

echo "Gerando backup em $DUMP_FILE..."
pg_dump "$PG_DUMP_URL" | gzip > "$DUMP_FILE"
echo "Backup concluido: $(du -h "$DUMP_FILE" | cut -f1)"

echo "Removendo backups com mais de $RETENTION_DAYS dia(s)..."
find "$BACKUP_DIR" -name 'campoflow-*.sql.gz' -mtime "+$RETENTION_DAYS" -print -delete

echo "Backups atuais:"
ls -lh "$BACKUP_DIR"
