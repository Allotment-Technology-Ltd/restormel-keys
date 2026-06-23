#!/usr/bin/env bash
# /opt/buildops-backup/backup.sh
# Restic backup of build/ops box (.150).
# PRIMARY target: Hetzner Object Storage S3 (fsn1) — bucket restormel-restic-backups/restic-buildops
# FALLBACK target: Hetzner Storage Box BX11 — rclone:storagebox:restic-buildops (kept until BX11 is cancelled)
# Runs as root via cron at 02:00 daily (staggered from 03:00 Surreal job)
# DO NOT EDIT ON BOX — version-controlled in restormel-keys scripts/backup/
#
# Migration note (2026-06-23): backups now write to BOTH S3 (primary) and BX11 (fallback)
# so the cutover is non-destructive. Once a clean S3-only cycle is confirmed and BX11 is
# cancelled (human-gated), the BX11 block + rclone target can be removed and BACKUP_BX11=0.

set -euo pipefail

# ── Repo targets ────────────────────────────────────────────────────────────────
# S3 (primary). Credentials come from /root/.config/s3fsn1.env (mode 600):
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY  (Hetzner Object Storage fsn1 keys)
S3_ENV="/root/.config/s3fsn1.env"
S3_REPO="s3:https://fsn1.your-objectstorage.com/restormel-restic-backups/restic-buildops"
# BX11 (fallback) — toggle off after BX11 is cancelled.
BACKUP_BX11="${BACKUP_BX11:-1}"
BX11_REPO="rclone:storagebox:restic-buildops"

export RESTIC_PASSWORD_FILE="/root/.config/restic-password"
RCLONE_CONFIG="/root/.config/rclone/rclone.conf"
RCLONE_ARGS="serve restic --stdio --config $RCLONE_CONFIG"
TELEGRAM_ENV="/root/.config/telegram.env"
LOG="/var/log/buildops-backup.log"
DUMP_DIR="/tmp/buildops-dumps"
FORGEJO_DATA="/var/lib/docker/volumes/nrghbzywi1smlfrpnmdkmd7d_forgejo-data/_data"
COOLIFY_DATA="/data/coolify"
# Infisical config dir (master key: ENCRYPTION_KEY + AUTH_SECRET in .env) — RISK-010.
# The pg data dir and redis are excluded (DB captured via pg_dump below).
INFISICAL_CONFIG="/opt/infisical"

# Uptime Kuma push monitor slug (set after creation via API)
UPTIME_KUMA_PUSH_URL="${UPTIME_KUMA_PUSH_URL:-https://uptimekuma-txct20gto5hv75gktchd511m.77.42.125.150.sslip.io/api/push/db55d068bd754a7b85cb}"

exec >> "$LOG" 2>&1

echo ""
echo "======================================================="
echo "buildops-backup START: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "======================================================="

log() { echo "[$(date -u '+%H:%M:%S')] $*"; }

# Load S3 credentials for the primary (S3) target.
if [ -f "$S3_ENV" ]; then
  set -a; source "$S3_ENV"; set +a
fi

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

# Infisical (self-hosted secret manager) — RISK-010. DB holds the (encrypted) secrets;
# /opt/infisical/.env holds the ENCRYPTION_KEY/AUTH_SECRET needed to decrypt them.
INFISICAL_PG=$(docker ps --format '{{.Names}}' | grep '^infisical-infisical-db' | head -1)
if [ -n "$INFISICAL_PG" ]; then
  log "Dumping infisical (Infisical Postgres)..."
  docker exec "$INFISICAL_PG" pg_dump -U infisical -Fc infisical > "$DUMP_DIR/infisical.dump" \
    || fail "Infisical pg_dump failed"
  log "  infisical.dump: $(du -sh "$DUMP_DIR/infisical.dump" | cut -f1)"
else
  log "  WARN: Infisical Postgres container not found — skipping (non-fatal)"
fi

# Write checksums
sha256sum "$DUMP_DIR"/*.dump > "$DUMP_DIR/SHA256SUMS"
log "SHA256SUMS written"

# ── Backup helpers (per target) ─────────────────────────────────────────────────
# do_backup <repo> [extra restic args...]
do_backup() {
  local repo="$1"; shift
  restic -r "$repo" "$@" backup \
    --tag buildops \
    --tag "$(date -u '+%Y-%m-%d')" \
    "$DUMP_DIR" \
    "$FORGEJO_DATA" \
    "$COOLIFY_DATA" \
    "$INFISICAL_CONFIG" \
    --exclude="$COOLIFY_DATA/backups" \
    --exclude="$COOLIFY_DATA/source" \
    --exclude="$INFISICAL_CONFIG/pg" \
    --exclude="$INFISICAL_CONFIG/redis"
}
# do_forget <repo> [extra restic args...]  — retention identical to legacy policy.
do_forget() {
  local repo="$1"; shift
  restic -r "$repo" "$@" forget \
    --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
}

# ── Restic backup — S3 (primary) ─────────────────────────────────────────────────
log "Running restic backup -> S3 (primary)..."
do_backup "$S3_REPO" 2>&1 || fail "restic backup to S3 failed"
log "Running restic forget + prune on S3..."
do_forget "$S3_REPO" 2>&1 || fail "restic forget/prune on S3 failed"

# ── Restic backup — BX11 (fallback, kept until BX11 cancelled) ───────────────────
if [ "$BACKUP_BX11" = "1" ]; then
  log "Running restic backup -> BX11 (fallback)..."
  do_backup "$BX11_REPO" --option rclone.args="$RCLONE_ARGS" 2>&1 \
    || fail "restic backup to BX11 failed"
  log "Running restic forget + prune on BX11..."
  do_forget "$BX11_REPO" --option rclone.args="$RCLONE_ARGS" 2>&1 \
    || fail "restic forget/prune on BX11 failed"
else
  log "BX11 fallback disabled (BACKUP_BX11=0) — S3-only."
fi

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
  SNAP_COUNT=$(restic -r "$S3_REPO" snapshots --json 2>/dev/null | python3 -c "import json,sys; snaps=json.load(sys.stdin); print(len(snaps))" 2>/dev/null || echo "?")
  MSG="✅ buildops backup OK (.150) at $(date -u '+%Y-%m-%dT%H:%M:%SZ') — ${SNAP_COUNT} snapshot(s) in S3 repo (primary)"
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
