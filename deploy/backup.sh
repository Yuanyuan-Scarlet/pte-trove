#!/usr/bin/env bash
set -euo pipefail

DATA_ROOT="${APP_DATA_DIR:-/var/lib/prep-trove}"
DATABASE="${DATABASE_PATH:-$DATA_ROOT/db/prep-trove.sqlite3}"
BACKUP_ROOT="/var/backups/prep-trove"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TMP_DATABASE="$BACKUP_ROOT/.database-$STAMP.sqlite3.tmp"
FINAL_DATABASE="$BACKUP_ROOT/database-$STAMP.sqlite3"

mkdir -p "$BACKUP_ROOT"
sqlite3 "$DATABASE" ".backup '$TMP_DATABASE'"
mv "$TMP_DATABASE" "$FINAL_DATABASE"
find "$BACKUP_ROOT" -maxdepth 1 -type f -name 'database-*.sqlite3' -mtime +14 -delete

printf 'backup=%s\n' "$FINAL_DATABASE"
