---
name: restormel-backup
description: >-
  ⚠️ SUPERSEDED 2026-06-26 — the BX11 Storage Box + .150 box this skill describes are DECOMMISSIONED.
  Backups are now on Hetzner Object Storage S3 (fsn1) under the crown-jewels DR programme (REC-PLAN-021).
  For any current backup/DR task — run/check a backup, run the restore/jewels-proof drill, the cold-start
  DR drill, add a jewel to scope — use the `restormel-dr-recovery` skill + `scripts/dr/coldstart/`. This
  file is retained for historical context (the old two-box restic→BX11 topology, dead-man's-switch design).
---

# Restormel backup / DR skill

> ## ⚠️ SUPERSEDED 2026-06-26 — read this first
> **BX11 Storage Box (AST-012) and the .150 box (AST-010) are DECOMMISSIONED** (governance PR #339;
> memory `bx11-150-decommission`). Every restic→BX11 cron below is dead/removed. The estate runs on a
> 3-node K3s cluster and **all backups now target Hetzner Object Storage S3 (fsn1, AST-019)** under the
> crown-jewels DR programme **REC-PLAN-021**:
> - **DBs (Forgejo/Infisical/app/platform/plotbudget):** CNPG **Barman** → `restormel-cnpg-backups-fsn1-ol/pg-*`
> - **SurrealDB + Forgejo repos:** restic → `restormel-restic-backups` (fsn1)
> - **etcd (cluster state):** native K3s `--etcd-s3` → `restormel-etcd-snapshots-fsn1/k3s`
> - **registry mirror + age escrow:** fsn1 S3
>
> **Use instead:** the **`restormel-dr-recovery`** skill + **`scripts/dr/coldstart/`** — the weekly
> per-jewel proof (`jewels-proof-local.sh`, REC-EVID-005) and the full cold-start drill
> (`dr-coldstart-drill.sh`). Recovery proven from fsn1 S3 alone (REC-EVID-005/006). Everything below the
> line is **historical** (the retired BX11/two-box model); do not action it against live infra.
>
> ---

Encrypted, EU-sovereign restic backups to **Hetzner Storage Box BX11** — same box, two repos.
Authoritative scripts are version-controlled in `scripts/backup/` in this repo.

---

## Topology

| Box | IP | Role | Restic repo on BX11 | Cron | Installed |
|-----|-----|------|---------------------|------|-----------|
| `.167` | `77.42.124.167` | Prod runtime (dashboard, worker, Postgres, Ory Hydra) | `rclone:storagebox:restic-surreal` | `0 3 * * *` root | 2026-06-13 |
| `.150` | `77.42.125.150` | Build/ops (Forgejo, Coolify, SurrealDB, Infisical) | `rclone:storagebox:restic-buildops` | `0 2 * * *` root | 2026-06-17 |

> **Note (2026-06-18):** SurrealDB migrated from `.167` → `.150` in Phase 2 (AST-010/AST-014 in
> asset-inventory.yaml). The `restic-surreal` repo on BX11 retains its name for historical
> continuity but now covers Box A (.167) prod-runtime data (Postgres dumps etc.), NOT SurrealDB.
> SurrealDB data on `.150` is covered by `restic-buildops`. <!-- VERIFY post-Phase-2: confirm
> whether the restic-surreal cron on .167 has been updated to cover current .167 services (Postgres,
> Hydra) rather than SurrealDB (which moved to .150). -->

Both share the **same rclone `storagebox` remote** and the **same restic passphrase file** (`/root/.config/restic-password`).

---

## What is backed up (.150 / buildops)

| Source | Method | Notes |
|--------|--------|-------|
| `restormel_ops` (app Postgres) | `pg_dump -Fc` via `docker exec` | container prefix `whwl0abdb3hn0jfi837s13u2` |
| `forgejo` (Forgejo Postgres) | `pg_dump -Fc` via `docker exec` | container prefix `postgresql-nrghbzywi1smlfrpnmdkmd7d` |
| `coolify` (Coolify Postgres) | `pg_dump -Fc` via `docker exec` | container `coolify-db` |
| Forgejo data volume | filesystem | `/var/lib/docker/volumes/nrghbzywi1smlfrpnmdkmd7d_forgejo-data/_data` |
| Coolify config | filesystem | `/data/coolify` (excludes `backups/`, `source/`) |

Dumps land in `/tmp/buildops-dumps/` before the restic backup, then are cleaned up.

---

## Retention policy

```
--keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
```

7 daily + 4 weekly + 6 monthly = up to ~6 months of history; BX11 handles EU data sovereignty.

---

## Dead-man's switch

Two layers:
1. **Uptime Kuma push monitor** — monitor ID 5, type `push`, interval 86400 s. If no ping arrives
   within the window, Uptime Kuma raises an alert. The backup script pings on success:
   `https://uptimekuma-txct20gto5hv75gktchd511m.77.42.125.150.sslip.io/api/push/<token>`
2. **Telegram alert on failure** — the script sources `/root/.config/telegram.env` and sends a
   message to `TELEGRAM_CHAT_ID` via `TELEGRAM_BOT_TOKEN` on any `fail()` call. A success
   notification is also sent after each clean run.

---

## Key file paths on .150

| Path | Purpose |
|------|---------|
| `/opt/buildops-backup/backup.sh` | Main backup script (runs as root) |
| `/opt/buildops-backup/restore-drill.sh` | Phase 8 restore drill |
| `/etc/cron.d/buildops-backup` | Cron entry (02:00 daily) |
| `/var/log/buildops-backup.log` | Backup log (append-only) |
| `/var/log/buildops-restore-drill.log` | Restore drill log |
| `/root/.config/rclone/rclone.conf` | rclone config (mode 600) |
| `/root/.config/restic-password` | Restic passphrase file (mode 600) |
| `/root/.config/telegram.env` | Telegram bot credentials (mode 600) |

---

## How to add a new service to .150 backup scope

1. Discover the container name dynamically: `docker ps --format '{{.Names}}' | grep <prefix>`
2. In `backup.sh`: add a `CONTAINER=$(docker ps ...)` discovery block + `pg_dump` step feeding into `$DUMP_DIR/newservice.dump`
3. No change to the `restic backup` invocation needed — it already backs up all of `$DUMP_DIR`
4. Update `restore-drill.sh` if the new service should be drilled
5. Commit to `scripts/backup/`, push to `origin` (Forgejo), open PR

---

## How to bootstrap a new box (e.g. add .XXX)

1. Install restic + rclone on the new box (same versions as .150)
2. Machine-to-machine pipe of rclone.conf + restic-password from an existing box:
   ```bash
   ssh -i <existing-key> root@<existing-box> 'cat /root/.config/rclone/rclone.conf' | \
     ssh -i <new-key> deploy@<new-box> 'sudo tee /root/.config/rclone/rclone.conf >/dev/null && sudo chmod 600 /root/.config/rclone/rclone.conf'
   ```
   Never pipe to a variable or print to terminal — always `tee ... >/dev/null`.
3. `restic init --repo rclone:storagebox:restic-<newbox>` (new unique repo path per box)
4. Write `backup.sh` + cron under `/opt/<newbox>-backup/`; add scripts to `scripts/backup/`
5. Create Uptime Kuma push monitor (type=push, interval=86400, user_id=1) in kuma.db via Python
6. Run first backup + `restic check`; run restore drill

---

## Running the restore drill (Phase 8 procedure)

```bash
ssh -i ~/.ssh/id_hetzner_allotment deploy@77.42.125.150 'sudo /opt/buildops-backup/restore-drill.sh'
sudo tail -60 /var/log/buildops-restore-drill.log
```

Expected output ends with:
```
RESULT: PASS — 60 tables, NNNN rows verified
```

The drill: fetches latest snapshot from BX11, restores `app.dump` locally, creates a scratch
Postgres database, runs `pg_restore`, counts rows per table, prints totals, then drops the scratch DB.

---

## Checking backup health

```bash
# On .150
sudo RESTIC_REPOSITORY=rclone:storagebox:restic-buildops \
     RESTIC_PASSWORD_FILE=/root/.config/restic-password \
  restic snapshots --option rclone.args="serve restic --stdio --config /root/.config/rclone/rclone.conf"

sudo RESTIC_REPOSITORY=rclone:storagebox:restic-buildops \
     RESTIC_PASSWORD_FILE=/root/.config/restic-password \
  restic check --option rclone.args="serve restic --stdio --config /root/.config/rclone/rclone.conf"
```

---

## Rotating the restic passphrase

**High-risk operation — do both boxes in the same session:**
1. `restic key add` with new passphrase on each repo
2. `restic key remove` the old key ID on each repo
3. Overwrite `/root/.config/restic-password` on both .150 and .167 (machine-to-machine pipe only)
4. Verify `restic check` on both repos passes
5. File an ISMS change record (use `restormel-isms-records` skill)

---

## Missed backup alert response

Use `restormel-infra-alert-response` for the incident record, then:
1. Check `/var/log/buildops-backup.log` on .150 for the last run
2. Check cron is running: `sudo systemctl status cron`
3. Re-run manually: `sudo /opt/buildops-backup/backup.sh`
4. If rclone/BX11 unreachable: check `rclone lsd storagebox: --config /root/.config/rclone/rclone.conf`
