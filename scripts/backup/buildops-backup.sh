#!/usr/bin/env bash
# /opt/buildops-backup/backup.sh
# Restic backup of build/ops box (.150) to Hetzner Storage Box BX11
# Mirrors the pattern from .167 (restic-surreal repo), new repo: restic-buildops
# Runs as root via cron at 02:00 daily (staggered from 03:00 Surreal job)
# DO NOT EDIT ON BOX — version-controlled in restormel-keys scripts/backup/

set -euo pipefail

export RESTIC_REPOSITORY="rclone:storagebox:restic-buildops"
export RESTIC_PASSWORD_FILE="/root/.config/restic-password"
RCLONE_CONFIG="/root/.config/rclone/rclone.conf"
TELEGRAM_ENV="/root/.config/telegram.env"
LOG="/var/log/buildops-backup.log"
DUMP_DIR="/tmp/buildops-dumps"
FORGEJO_DATA="/var/lib/docker/volumes/nrghbzywi1smlfrpnmdkmd7d_forgejo-data/_data"
COOLIFY_DATA="/data/coolify"

# Uptime Kuma push monitor slug (set after creation via API)
UPTIME_KUMA_PUSH_URL="${UPTIME_KUMA_PUSH_URL:-https://uptimekuma-txct20gto5hv75gktchd511m.77.42.125.150.sslip.io/api/push/db55d068bd754a7b85cb}"

exec >> "$LOG" 2>&1

echo ""
echo "======================================================="
echo "buildops-backup START: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "======================================================="

log() { echo "[$(date -u '+%H:%M:%S')] $*"; }
fail() {
  log "ERROR: $*"
  # Telegram alert on failure
  if [ -f "$TELEGRAM_ENV" ]; then
    source "$TELEGRAM_ENV"
    MSG="BACKUP FAILED on buildops (.150) at $(date -u '+%Y-%m-%dT%H:%M:%SZ'): $*"
    curl -s -o /dev/null -X POST \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "text=${MSG}" \
      -d "parse_mode=HTML" || true
  fi
  exit 1
}

# ── Discover containers dynamically ────────────────────────────────────────────
log "Discovering containers..."

# App Postgres — prefix whwl0abdb3hn0jfi837s13u2
APP_PG=$(docker ps --format '{{.Names}}' | grep '^whwl0abdb3hn0jfi837s13u2' | head -1)
[ -n "$APP_PG" ] || fail "App Postgres container not found (prefix: whwl0abdb3hn0jfi837s13u2)"

# Forgejo Postgres — prefix postgresql-nrghbzywi1smlfrpnmdkmd7d
FORGEJO_PG=$(docker ps --format '{{.Names}}' | grep '^postgresql-nrghbzywi1smlfrpnmdkmd7d' | head -1)
[ -n "$FORGEJO_PG" ] || fail "Forgejo Postgres container not found (prefix: postgresql-nrghbzywi1smlfrpnmdkmd7d)"

# Coolify DB
COOLIFY_PG="coolify-db"
docker ps --format '{{.Names}}' | grep -q "^coolify-db$" || fail "coolify-db container not found"

log "App PG:     $APP_PG"
log "Forgejo PG: $FORGEJO_PG"
log "Coolify PG: $COOLIFY_PG"

# ── Dump databases ──────────────────────────────────────────────────────────────
log "Creating dump directory: $DUMP_DIR"
rm -rf "$DUMP_DIR"
mkdir -p "$DUMP_DIR"

log "Dumping restormel_ops (App Postgres)..."
APP_PG_USER=$(docker inspect "$APP_PG" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^POSTGRES_USER=' | cut -d= -f2)
docker exec "$APP_PG" pg_dump -U "$APP_PG_USER" -Fc restormel_ops > "$DUMP_DIR/app.dump" \
  || fail "App pg_dump failed"
log "  app.dump: $(du -sh "$DUMP_DIR/app.dump" | cut -f1)"

log "Dumping forgejo (Forgejo Postgres)..."
FORGEJO_PG_USER=$(docker inspect "$FORGEJO_PG" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^POSTGRES_USER=' | cut -d= -f2)
docker exec "$FORGEJO_PG" pg_dump -U "$FORGEJO_PG_USER" -Fc forgejo > "$DUMP_DIR/forgejo.dump" \
  || fail "Forgejo pg_dump failed"
log "  forgejo.dump: $(du -sh "$DUMP_DIR/forgejo.dump" | cut -f1)"

log "Dumping coolify (Coolify Postgres)..."
docker exec "$COOLIFY_PG" pg_dump -U coolify -Fc coolify > "$DUMP_DIR/coolify.dump" \
  || fail "Coolify pg_dump failed"
log "  coolify.dump: $(du -sh "$DUMP_DIR/coolify.dump" | cut -f1)"

# Write checksums
sha256sum "$DUMP_DIR"/*.dump > "$DUMP_DIR/SHA256SUMS"
log "SHA256SUMS written"

# ── Restic backup ───────────────────────────────────────────────────────────────
log "Running restic backup..."
restic backup \
  --option rclone.args="serve restic --stdio --config $RCLONE_CONFIG" \
  --tag buildops \
  --tag "$(date -u '+%Y-%m-%d')" \
  "$DUMP_DIR" \
  "$FORGEJO_DATA" \
  "$COOLIFY_DATA" \
  --exclude="$COOLIFY_DATA/backups" \
  --exclude="$COOLIFY_DATA/source" \
  2>&1 || fail "restic backup failed"

# ── Retention / prune ──────────────────────────────────────────────────────────
log "Running restic forget + prune..."
restic forget \
  --option rclone.args="serve restic --stdio --config $RCLONE_CONFIG" \
  --keep-daily 7 \
  --keep-weekly 4 \
  --keep-monthly 6 \
  --prune \
  2>&1 || fail "restic forget/prune failed"

# ── Dead-man's-switch ──────────────────────────────────────────────────────────
log "Pinging dead-man's-switch..."

# Uptime Kuma push (if configured)
if [ -n "$UPTIME_KUMA_PUSH_URL" ]; then
  curl -s -o /dev/null "${UPTIME_KUMA_PUSH_URL}?status=up&msg=OK&ping=" \
    && log "  Uptime Kuma: pinged OK" \
    || log "  WARN: Uptime Kuma ping failed (non-fatal)"
fi

# Telegram success notification
if [ -f "$TELEGRAM_ENV" ]; then
  source "$TELEGRAM_ENV"
  SNAP_COUNT=$(restic snapshots --option rclone.args="serve restic --stdio --config $RCLONE_CONFIG" --json 2>/dev/null | python3 -c "import json,sys; snaps=json.load(sys.stdin); print(len(snaps))" 2>/dev/null || echo "?")
  MSG="✅ buildops backup OK (.150) at $(date -u '+%Y-%m-%dT%H:%M:%SZ') — ${SNAP_COUNT} snapshot(s) in repo"
  curl -s -o /dev/null -X POST \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT_ID}" \
    -d "text=${MSG}" || true
  log "  Telegram: success notification sent"
fi

# ── Cleanup ─────────────────────────────────────────────────────────────────────
log "Cleaning up dump dir..."
rm -rf "$DUMP_DIR"

log "======================================================="
log "buildops-backup COMPLETE: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
log "======================================================="
