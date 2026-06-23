#!/usr/bin/env bash
# /opt/app-postgres-backup/backup.sh  (runs on .167)
# Restic backup of the app Postgres (restormel_ops) hosted on the .167 box.
# PRIMARY target: Hetzner Object Storage S3 (fsn1) — restormel-restic-backups/restic-app
# FALLBACK target: Hetzner Storage Box BX11 — rclone:storagebox:restic-app (kept until BX11 cancelled)
# Runs as root via cron at 02:15 daily.
# DO NOT EDIT ON BOX — version-controlled in restormel-keys scripts/backup/
#
# Migration note (2026-06-23): this repo (restic-app) was previously BX11-only and was NOT
# version-controlled. It is now in VCS and dual-writes to S3 (primary) + BX11 (fallback).
# Source row count verified via restore drill from S3: 64 tables / 4546 rows (2026-06-23).
set -euo pipefail

# ── Repo targets ────────────────────────────────────────────────────────────────
S3_ENV="/root/.config/s3fsn1.env"   # AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (mode 600)
S3_REPO="s3:https://fsn1.your-objectstorage.com/restormel-restic-backups/restic-app"
BACKUP_BX11="${BACKUP_BX11:-1}"
BX11_REPO="rclone:storagebox:restic-app"

export RESTIC_PASSWORD_FILE="/root/.config/restic-password"
RCLONE_CONFIG="/root/.config/rclone/rclone.conf"
RCLONE_ARGS="serve restic --stdio --config $RCLONE_CONFIG"

D=/opt/app-postgres-backup/dumps
PG_CONTAINER="app-postgres-app-postgres-1"
TS=$(date +%Y%m%d-%H%M%S)

mkdir -p "$D"

# Load S3 credentials for the primary target.
[ -f "$S3_ENV" ] && { set -a; source "$S3_ENV"; set +a; }

# ── Dump restormel_ops ──────────────────────────────────────────────────────────
docker exec "$PG_CONTAINER" pg_dump -U restormel -d restormel_ops -Fc > "$D/restormel_ops-$TS.dump"
# Keep last 5 local dumps.
ls -1t "$D"/restormel_ops-*.dump | tail -n +6 | xargs -r rm -f

# ── Backup helpers (per target) ─────────────────────────────────────────────────
do_backup() { local repo="$1"; shift; restic -r "$repo" "$@" backup "$D" /opt/app-postgres/.env /opt/app-postgres/docker-compose.yml; }
do_forget() { local repo="$1"; shift; restic -r "$repo" "$@" forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune; }

# ── S3 (primary) ─────────────────────────────────────────────────────────────────
do_backup "$S3_REPO"
do_forget "$S3_REPO"

# ── BX11 (fallback) ──────────────────────────────────────────────────────────────
if [ "$BACKUP_BX11" = "1" ]; then
  do_backup "$BX11_REPO" --option rclone.args="$RCLONE_ARGS"
  do_forget "$BX11_REPO" --option rclone.args="$RCLONE_ARGS"
fi
