# Restic backups — BX11 → Hetzner Object Storage (S3, fsn1) migration

Encrypted, EU-sovereign restic backups. Same restic passphrase
(`/root/.config/restic-password`) across all boxes and repos.

## Repos (3)

| Repo | Box | Script | BX11 (fallback) | S3 (primary) |
|------|-----|--------|-----------------|--------------|
| `restic-buildops` | `.150` | `buildops-backup.sh` (02:00) | `rclone:storagebox:restic-buildops` | `restormel-restic-backups/restic-buildops` |
| `restic-app` | `.167` | `app-postgres-backup.sh` (02:15) | `rclone:storagebox:restic-app` | `restormel-restic-backups/restic-app` |
| `restic-surreal` | `.167` | `/opt/surreal/backup.sh` (03:00) | `rclone:storagebox:restic-surreal` | `restormel-restic-backups/restic-surreal` |

S3 endpoint: `https://fsn1.your-objectstorage.com`, bucket `restormel-restic-backups`.
S3 credentials live on each box in `/root/.config/s3fsn1.env` (mode 600):
`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (Hetzner Object Storage fsn1 keys,
sourced from Infisical `HETZNER_S3_FSN1_*`). Secrets never live in this repo.

## Migration state (2026-06-23)

- All BX11 history copied to S3 via `restic copy` (history preserved, `restic check` clean):
  buildops 8 snaps, app 7 snaps, surreal 6 snaps.
- Going-forward scripts here **dual-write**: S3 primary + BX11 fallback
  (`BACKUP_BX11=1`). BX11 stays fully intact and working until cancelled.
- `restic-surreal` is **frozen**: the SurrealDB container no longer runs on `.167`
  (Surreal migrated to K3s/CNPG), so `/opt/surreal/backup.sh` has produced no new
  snapshots since 2026-06-17. The 6 historical snapshots are preserved on both BX11
  and S3. Decide separately whether to retire this repo or repoint it at the K3s
  Surreal source — it is **not** an active backup today.

## Cutover (human-gated)

1. Deploy these scripts to the boxes (`/opt/buildops-backup/backup.sh`,
   `/opt/app-postgres-backup/backup.sh`) and ensure `/root/.config/s3fsn1.env` exists
   on each box (mode 600).
2. Confirm a clean **S3** backup cycle (cron runs OK to S3, `restic check` passes,
   restore drill PASS against S3 — `RESTIC_DRILL_TARGET=s3`).
3. Only then: set `BACKUP_BX11=0` (or remove the BX11 block), confirm a clean S3-only
   cycle, and **cancel BX11**.

## Restore drill

```bash
# Buildops, S3 target (default):
ssh -i ~/.ssh/id_hetzner_allotment deploy@77.42.125.150 'sudo /opt/buildops-backup/restore-drill.sh'
# Buildops, BX11 target:
ssh -i ~/.ssh/id_hetzner_allotment deploy@77.42.125.150 'sudo RESTIC_DRILL_TARGET=bx11 /opt/buildops-backup/restore-drill.sh'
```
