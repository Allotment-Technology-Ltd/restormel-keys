---
id: REC-PLAN-015
title: "Infrastructure Split Migration — Consolidated Break-Glass Rollback Runbook"
class: planning
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-17
last-reviewed: 2026-06-17
review-interval: P3M
approved-by: founder
approved-on: 2026-06-17
retention: P6Y-after-superseded
related: [REC-PLAN-012, REC-GOV-002, REC-GOV-006]
---

# Infrastructure Split Migration — Consolidated Break-Glass Rollback Runbook

**REC-PLAN-015** — companion to [REC-PLAN-012](infra-split-migration-plan.md).

> **BREAK-GLASS. READ THIS BEFORE TOUCHING ANYTHING.**
> Work sequentially. Stabilise the service first, then diagnose.
> All times in UTC. Log every action taken to the migration log (`planning/migration-log.md`).

---

## Resource quick reference

| Resource | Public IP | Private IP | Purpose |
|---|---|---|---|
| Box A — prod runtime | `77.42.124.167` | `10.10.1.3` | dashboard, worker, app Postgres, Ory Hydra |
| Box B — build/ops | `77.42.125.150` | `10.10.1.2` | Forgejo, CI runner, Coolify, monitoring, SurrealDB |
| BX11 Storage Box | `u613941.your-storagebox.de` | — | Backups (restic) |
| Private network | `restormel-internal` | `10.10.0.0/16` | Inter-box traffic |
| Coolify app UUID | `mxq1lnsehg7sdfzn0a8tnkxo` | — | dashboard Coolify resource |
| Coolify worker UUID | `ppvmqm1hbnu09kjgttdl5og4` | — | worker Coolify resource |

**SSH access:**

```bash
# Box B (build/ops) — direct
ssh deploy@77.42.125.150

# Box A (prod runtime) — via Box B jump or private network (once private net configured)
ssh -J deploy@77.42.125.150 deploy@77.42.124.167
# or, if on Box B already:
ssh deploy@10.10.1.3
```

**Restic repo locations (BX11):**

| Repo name | Path on BX11 | Cron schedule | Encrypted |
|---|---|---|---|
| `restic-surreal` | `/restic-surreal` on `u613941.your-storagebox.de` | Box A → BX11 daily 03:00 | Yes |
| `restic-buildops` | `/restic-buildops` on `u613941.your-storagebox.de` | Box B → BX11 daily 02:00 | Yes |

---

## Global abort — single-box fallback

Use this section when the migration must be stopped entirely and service restored to
the original single-box state. Run through these steps top-to-bottom.

### GA-1 — Immediate service triage

```bash
# Is the dashboard responding?
curl -s -o /dev/null -w "%{http_code}" https://restormel.dev/keys/dashboard/

# Check Coolify resource health (from Box B):
# Coolify UI → Resources → app UUID mxq1lnsehg7sdfzn0a8tnkxo → logs
```

### GA-2 — Revert DNS (Vercel DNS panel)

Revert all DNS changes made during the migration, in reverse order of when they
were made. Typical rollback targets:

| Record | Rollback value |
|---|---|
| `surreal.restormel.dev` | Point back to `77.42.124.167` (original SurrealDB location) |
| `auth.restormel.dev` | Remove CNAME / A record added for Hydra |
| Dashboard host record | Point back to `77.42.125.150` (original Coolify box) |

Set TTL to 60 seconds before making changes; restore to 300 after propagation confirmed.

### GA-3 — Revert dashboard `DATABASE_URL` and Surreal connection

Via Coolify UI on Box B (`.150`):

1. Open Resource `mxq1lnsehg7sdfzn0a8tnkxo` → Environment Variables.
2. Set `DATABASE_URL` back to the Box B / Neon value captured in pre-flight (Phase 0).
3. Set `SURREAL_URL` / `SURREAL_ENDPOINT` back to `wss://surreal.restormel.dev` or
   the original `.167` direct address — whichever was used before migration.
4. Redeploy from Coolify (use latest known-good image tag, not `latest` from a
   potentially broken build).

### GA-4 — Keep old containers warm

> Do NOT stop or remove the original containers on Box B until the dashboard is
> confirmed live and stable post-rollback.

Check that the Coolify-managed containers on Box B are still running:

```bash
# On Box B:
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

If the original Coolify-managed deployment on Box B has been stopped, restart via
Coolify UI → Resource → Start, or:

```bash
# Emergency: restart last known good container by name
docker start <container-name>
```

### GA-5 — Verify single-box state is stable

1. Dashboard accessible at the public URL.
2. `/keys/dashboard/sources` loads and can save a BYO-Surreal endpoint.
3. Worker appears in Coolify as running.
4. Writes to the database succeed (create a test API key and confirm it appears).
5. Check monitoring alerts cleared on Box B.

### GA-6 — Post-abort actions

- Update `planning/migration-log.md` with timestamp + what failed.
- File an incident record from `evidence/templates/incident.md` (REC-TPL-004):
  `evidence/incidents/<date>-infra-migration-abort.md`.
- Update RISK-009 in `governance/risk-register.yaml` treatment_status.

---

## Per-phase rollback actions

### Phase 0 — Pre-flight & safety net

**Rollback action:** None required — Phase 0 is read-only (backups + measurements).

**If a backup to BX11 fails:**

```bash
# Verify BX11 is reachable (from Box B):
ssh -p 23 u613941@u613941.your-storagebox.de "df -h"

# Re-run the restic backup manually:
restic -r sftp:u613941@u613941.your-storagebox.de:/restic-buildops backup /var/lib/forgejo /var/lib/coolify

# Confirm snapshot landed:
restic -r sftp:u613941@u613941.your-storagebox.de:/restic-buildops snapshots
```

Do not proceed to Phase 1 without confirmed BX11 backups.

---

### Phase 1 — Private network + swap

**Rollback action:** detach the private network from both servers (non-destructive —
no data at risk).

1. Hetzner console: Networks → `restormel-internal` → Detach server `.167`, then `.150`.
2. Or via Hetzner API:
   ```bash
   # Detach network interface (replace SERVER_ID and NETWORK_ID):
   curl -X POST "https://api.hetzner.cloud/v1/servers/<SERVER_ID>/actions/detach_from_network" \
     -H "Authorization: Bearer $HETZNER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"network":<NETWORK_ID>}'
   ```
3. Verify boxes still reachable over their public IPs.
4. Remove swap if desired (non-urgent — swap on disk is harmless to leave):
   ```bash
   # On each box:
   swapoff /swapfile && rm /swapfile
   # Remove from /etc/fstab
   ```

**Swap does not need to be rolled back** — it is an operational safety measure with
no correctness impact.

---

### Phase 2 — Migrate SurrealDB `.167 → .150`

**Trigger:** SurrealDB on `.150` not functioning; dashboard's BYO-graph reads failing;
`wss://` connectivity broken.

**Rollback action:** repoint DNS back to `.167`; the original SurrealDB on `.167`
remains **untouched and running** until cutover is confirmed.

1. Vercel DNS: revert `surreal.restormel.dev` A/CNAME back to `77.42.124.167`.
   Set TTL 60 s before change; restore after propagation.
2. Verify original SurrealDB on `.167` is still running:
   ```bash
   # On Box A:
   docker ps | grep surreal
   # or:
   systemctl status surreald 2>/dev/null || docker ps | grep surreal
   ```
3. If the original SurrealDB container was accidentally stopped:
   ```bash
   docker start <surreal-container-name>
   # Confirm:
   docker logs <surreal-container-name> --tail 20
   ```
4. Update dashboard env `SURREAL_URL` to the original `.167` address if it was
   changed prematurely (Coolify UI → Resource `mxq1lnsehg7sdfzn0a8tnkxo` → Env).
5. Confirm BYO-graph queries succeed: test via the dashboard Sources page.

**Data safety:** the Phase 2 import onto `.150` is non-destructive to `.167`.
`.167`'s SurrealDB data is the authoritative source until Phase 2 is verified.
Only delete the `.167` copy after Phase 7 confirms the `.150` copy is the sole live instance.

---

### Phase 3 — Prepare `.167` as prod box + Coolify destination

**Trigger:** `.167` misconfiguration; Coolify cannot reach `.167`; harden/UFW locked
out SSH.

**Rollback action:** remove `.167` from Coolify destinations. No production data is
on `.167` yet.

1. Coolify UI on Box B → Settings → Servers → Remove `.167` (or set inactive).
2. If UFW locked out SSH on `.167`:
   - Use Hetzner console in-browser shell (rescue mode / VNC console).
   - `ufw allow 22 && ufw reload` to re-open, then fix firewall rules before
     re-applying UFW.
3. If fail2ban banned the deploy key:
   ```bash
   fail2ban-client status sshd
   fail2ban-client set sshd unbanip <your-IP>
   ```
4. No data loss risk — `.167` is empty prod box at this stage.

---

### Phase 4 — App Postgres on `.167`

**Trigger:** Postgres on `.167` not starting; migration 069 failed; backup not landing
on BX11; row counts mismatch.

**Rollback action:** keep Neon / existing Box B Postgres as authoritative; drop the
`.167` Postgres databases.

1. Do NOT change `DATABASE_URL` in Coolify — it still points to the old authoritative DB.
2. On Box A (`.167`), tear down the Postgres container if it is in a broken state:
   ```bash
   docker stop <postgres-container> && docker rm <postgres-container>
   # Or via Coolify UI → Resource → Stop/Delete
   ```
3. Drop databases if they were partially created (connect via psql from Box B over
   private net or port-forward):
   ```bash
   psql -h 10.10.1.3 -U postgres -c "DROP DATABASE IF EXISTS app;"
   psql -h 10.10.1.3 -U postgres -c "DROP DATABASE IF EXISTS hydra;"
   ```
4. Investigate failure:
   - Check logs: `docker logs <postgres-container> --tail 50`
   - Confirm migration 069 status: connect to DB and check `drizzle/__drizzle_migrations` table.
   - Confirm BX11 backup: `restic -r sftp:u613941@u613941.your-storagebox.de:/restic-surreal snapshots`
5. Neon / old Postgres remains authoritative. No user impact.

---

### Phase 5 — Cut dashboard + worker over to `.167`

**Trigger:** dashboard not loading after DNS repoint; 500/503 from new deployment;
database writes failing; worker unhealthy.

**Rollback action:** revert DNS and `DATABASE_URL` back to Box B / old deployment.

1. **Immediately:** Vercel DNS → revert dashboard host record back to `77.42.125.150`.
   Set TTL 60 s first if possible; if already propagated, set to 60 s, make change, wait.
2. Coolify (Box B) → Resource `mxq1lnsehg7sdfzn0a8tnkxo` → Env → revert `DATABASE_URL`
   to the pre-cutover value (Box B Postgres or Neon).
3. Coolify → Resource → Redeploy (use the last green image tag — check the deployment
   history for the tag before the Phase 5 deploy).
4. **Worker:** Coolify → Resource `ppvmqm1hbnu09kjgttdl5og4` → same env revert + redeploy.
5. Confirm the old deployment is serving traffic:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" https://restormel.dev/keys/dashboard/
   # Expect 200
   ```
6. **Keep the new containers on `.167` running but idle** — do not destroy them.
   They may be useful for debugging. Use Coolify to `Stop` (not Delete).
7. Diagnose:
   - Check Coolify build/deploy logs for `.167` deployment.
   - Check `docker logs` on Box A for the dashboard container.
   - Confirm `DATABASE_URL` is reachable: `psql <DATABASE_URL> -c "SELECT 1"` from Box A.
   - Check `127.0.0.1` healthcheck gotcha: Coolify's built-in healthcheck pings
     `127.0.0.1:<port>` — ensure the app binds to `0.0.0.0`, not `localhost`.

---

### Phase 6 — Hydra on `.167`

**Trigger:** Hydra not healthy; JWKS endpoint not reachable; `verifyAccessToken` fails.

**Rollback action:** remove Hydra containers from `.167`. The verifying-proxy
`RESTORMEL_VERIFYING_PROXY_REMOTE` flag is **OFF** — no dependents at this stage.

1. Coolify → Stop/Delete the Hydra resource on `.167`.
2. On Box A:
   ```bash
   docker stop hydra && docker rm hydra
   # Drop Hydra DB if partially created:
   psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS hydra;"
   ```
3. Confirm `RESTORMEL_VERIFYING_PROXY_REMOTE` env is `false`/unset in the dashboard
   resource — Hydra removal has no user impact while this flag is OFF.
4. Remove `auth.restormel.dev` DNS record from Vercel DNS if it was created.
5. Log what went wrong. Common causes:
   - `DSN` misconfigured in Hydra config.
   - JWKS issuer URL mismatch (must be the public `auth.restormel.dev` URL, not internal).
   - TLS cert not yet issued (Coolify proxy needs HTTP-01 / DNS-01 ACME pass to complete).

---

### Phase 7 — Finalise `.150` as build/ops

**Trigger:** CI pipeline broken; deploy-to-`.167` broken; Forgejo unreachable.

**Rollback action:** keep the old dashboard/worker/app-DB containers on `.150` until the
`.167`-based deployment is proven. Do not delete them at this phase.

1. If the Forgejo runner is broken, check runner status:
   ```bash
   # On Box B:
   docker ps | grep runner
   docker logs <runner-container> --tail 30
   ```
2. If the deploy workflow (`deploy-dashboard.yml`) is broken (wrong private-net address):
   - Revert the workflow file changes via a PR on Forgejo main.
   - The old `10.0.1.1` bridge deployment path can be temporarily reinstated as a
     fallback while the private-net route is debugged.
3. Do not drop public SSH on either box until private SSH over the private network
   is fully verified and the jump-host path (`-J deploy@77.42.125.150`) is tested end-to-end.
4. Old containers on `.150` are the rollback target for app serving — start them if
   needed (see GA-4 above).

---

### Phase 8 — Resilience verification

**No rollback action** — Phase 8 is read-only verification and a restore drill.

**If the restore drill fails:**

1. Check restic repo integrity:
   ```bash
   restic -r sftp:u613941@u613941.your-storagebox.de:/restic-surreal check
   restic -r sftp:u613941@u613941.your-storagebox.de:/restic-buildops check
   ```
2. List available snapshots:
   ```bash
   restic -r sftp:u613941@u613941.your-storagebox.de:/restic-surreal snapshots
   ```
3. Restore a snapshot to a scratch directory:
   ```bash
   restic -r sftp:u613941@u613941.your-storagebox.de:/restic-surreal restore latest \
     --target /tmp/restore-drill-surreal/
   ```
4. If restore fails, do NOT proceed to claim Phase 8 complete — open an issue on
   Forgejo to investigate BX11 repo integrity.
5. Monitoring verification: confirm Coolify's built-in monitoring and any external
   dead-man's-switch is watching `.167`, not just `.150`.

---

## Restic backup operations reference

### Manual backup (break-glass)

```bash
# SurrealDB backup from Box A to BX11 (normally runs 03:00 via cron):
restic -r sftp:u613941@u613941.your-storagebox.de:/restic-surreal \
  backup /var/lib/surrealdb   # adjust path to actual SurrealDB data dir

# Build/ops backup from Box B to BX11 (normally runs 02:00 via cron):
restic -r sftp:u613941@u613941.your-storagebox.de:/restic-buildops \
  backup /var/lib/forgejo /var/lib/coolify /var/lib/postgres
```

### Restore from BX11

```bash
# List snapshots:
restic -r sftp:u613941@u613941.your-storagebox.de:/restic-surreal snapshots

# Restore latest to scratch dir:
restic -r sftp:u613941@u613941.your-storagebox.de:/restic-surreal \
  restore latest --target /tmp/restore/

# Restore specific snapshot:
restic -r sftp:u613941@u613941.your-storagebox.de:/restic-surreal \
  restore <SNAPSHOT-ID> --target /tmp/restore/
```

### Retention policy (both repos)

- keep-daily: 7
- keep-weekly: 4
- keep-monthly: 6

Prune is run automatically by the cron job after each backup. To run manually:

```bash
restic -r sftp:u613941@u613941.your-storagebox.de:/restic-surreal forget \
  --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
```

---

## Gaps and owner actions

| Gap | Priority | Recommended action |
|---|---|---|
| No BCP/DR policy document exists | Medium | Create `governance/bcp-dr-policy.md` (ISO A.5.29/A.5.30 obligation). RTO < 4h is stated in risk-register but no formal policy anchors it. |
| Restore drill not yet executed | High | Complete as part of Phase 8; document result in `evidence/incidents/` or `evidence/ledger.jsonl`. |
| No external dead-man's-switch confirmed | Medium | Confirm monitoring watches `.167` after Phase 7 migration; document in Phase 8 checklist. |
| `restic-buildops` repo creation in progress | High | Confirm BX11 `restic-buildops` repo is initialised and first backup verified before Phase 0 is declared complete. |
| Hydra JWKS/issuer config | Medium | Validate before Phase 6 proceeds; keep `RESTORMEL_VERIFYING_PROXY_REMOTE=false` until confirmed (see REC-PLAN-011). |
