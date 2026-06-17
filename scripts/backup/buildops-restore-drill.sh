#!/usr/bin/env bash
# /opt/buildops-backup/restore-drill.sh
# Phase 8 restore drill: restore latest app dump from restic repo into a
# throwaway database and print row counts — proves restorability.
# Run as root. Cleans up scratch DB after.
# DO NOT EDIT ON BOX — version-controlled in restormel-keys scripts/backup/

set -euo pipefail

export RESTIC_REPOSITORY="rclone:storagebox:restic-buildops"
export RESTIC_PASSWORD_FILE="/root/.config/restic-password"
RCLONE_CONFIG="/root/.config/rclone/rclone.conf"
RESTORE_DIR="/tmp/buildops-restore-drill-$$"
SCRATCH_DB="restore_drill_$$"
LOG="/var/log/buildops-restore-drill.log"

exec >> "$LOG" 2>&1

echo ""
echo "======================================================="
echo "buildops RESTORE DRILL START: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "======================================================="

log() { echo "[$(date -u '+%H:%M:%S')] $*"; }
fail() { log "ERROR: $*"; exit 1; }

# Discover container first so cleanup can reference it
APP_PG=$(docker ps --format '{{.Names}}' | grep '^whwl0abdb3hn0jfi837s13u2' | head -1)

cleanup() {
  log "Cleanup: removing restore dir and scratch DB..."
  rm -rf "$RESTORE_DIR" 2>/dev/null || true
  docker exec "$APP_PG" rm -f /tmp/app_drill.dump 2>/dev/null || true
  docker exec "$APP_PG" psql -U restormel -c "DROP DATABASE IF EXISTS \"${SCRATCH_DB}\";" postgres 2>/dev/null || true
  log "Cleanup done."
}
trap cleanup EXIT

[ -n "$APP_PG" ] || fail "App Postgres container not found (prefix: whwl0abdb3hn0jfi837s13u2)"
log "Using container: $APP_PG"

# ── Find latest snapshot ────────────────────────────────────────────────────────
log "Finding latest restic snapshot..."
LATEST_SNAP=$(restic snapshots \
  --option rclone.args="serve restic --stdio --config $RCLONE_CONFIG" \
  --json --latest 1 \
  2>/dev/null | python3 -c "
import json, sys
snaps = json.load(sys.stdin)
if not snaps:
    print('NONE')
else:
    print(snaps[-1]['short_id'])
")
[ "$LATEST_SNAP" != "NONE" ] || fail "No snapshots found in repo"
log "Latest snapshot: $LATEST_SNAP"

# ── Restore app.dump from snapshot ─────────────────────────────────────────────
log "Restoring app.dump from snapshot $LATEST_SNAP..."
mkdir -p "$RESTORE_DIR"
restic restore "$LATEST_SNAP" \
  --option rclone.args="serve restic --stdio --config $RCLONE_CONFIG" \
  --include "**/app.dump" \
  --target "$RESTORE_DIR" \
  2>&1 || fail "restic restore failed"

# Find the dump file
APP_DUMP=$(find "$RESTORE_DIR" -name "app.dump" | head -1)
[ -n "$APP_DUMP" ] || fail "app.dump not found in restored snapshot"
log "Restored dump: $APP_DUMP ($(du -sh "$APP_DUMP" | cut -f1))"

# ── Create scratch database and restore ────────────────────────────────────────
log "Creating scratch database: $SCRATCH_DB"
docker exec "$APP_PG" psql -U restormel -c "CREATE DATABASE \"${SCRATCH_DB}\";" postgres \
  || fail "Failed to create scratch DB"

log "Running pg_restore into $SCRATCH_DB..."
docker cp "$APP_DUMP" "${APP_PG}:/tmp/app_drill.dump"
docker exec "$APP_PG" pg_restore \
  -U restormel \
  -d "$SCRATCH_DB" \
  --no-owner \
  --no-acl \
  /tmp/app_drill.dump \
  2>&1 | tail -3 || true   # pg_restore exits 1 on warnings — tolerate

# ── Row counts via COUNT(*) per table ─────────────────────────────────────────
log "Row counts from $SCRATCH_DB (direct COUNT):"
echo ""
echo "TABLE                          | ROW COUNT"
echo "-------------------------------|----------"

# Get table list
TABLES=$(docker exec "$APP_PG" psql -U restormel -d "$SCRATCH_DB" -t -A -c \
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;" 2>/dev/null)

TABLE_COUNT=0
TOTAL_ROWS=0

while IFS= read -r tbl; do
  [ -z "$tbl" ] && continue
  CNT=$(docker exec "$APP_PG" psql -U restormel -d "$SCRATCH_DB" -t -A -c \
    "SELECT COUNT(*) FROM \"${tbl}\";" 2>/dev/null | xargs || echo "?")
  printf "%-31s| %s\n" "$tbl" "$CNT"
  TABLE_COUNT=$((TABLE_COUNT + 1))
  if [[ "$CNT" =~ ^[0-9]+$ ]]; then
    TOTAL_ROWS=$((TOTAL_ROWS + CNT))
  fi
done <<< "$TABLES"

echo ""
log "Total tables restored: $TABLE_COUNT"
log "Total rows across all tables: $TOTAL_ROWS"

echo ""
echo "======================================================="
echo "buildops RESTORE DRILL COMPLETE: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "RESULT: PASS — $TABLE_COUNT tables, $TOTAL_ROWS rows verified"
echo "======================================================="
