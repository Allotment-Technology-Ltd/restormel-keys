---
name: restormel-infra-alert-response
description: >-
  Restormel Keys infrastructure alert response: map an incoming alert (Beszel host RAM/swap/disk,
  PostHog 5xx spike or auth-failure spike or DB-egress runaway or ingest error rate, Uptime-Kuma
  endpoint down, external dead-man's-switch, fail2ban SSH ban spike) to its likely cause and the
  concrete first remedial action. Use immediately when an alert fires in the Telegram channel, when
  an on-call responder asks what to do for a specific alert, or when authoring or reviewing alert
  templates and runbook entries. Pairs with docs/runbooks/infra-alert-response.md.
---

# Infra alert response (Restormel Keys)

Full runbook with detailed steps: [docs/runbooks/infra-alert-response.md](../../../docs/runbooks/infra-alert-response.md)

Infrastructure overview:
- **Prod box** `77.42.125.150`: Coolify, Traefik, dashboard/worker/site containers. 7.6 GB RAM + 4 GB swap. Disk-guard cron backstops at 80%.
- **surreal-box** `77.42.124.167`: SurrealDB, Beszel hub, Uptime-Kuma, second Coolify server. 8 GB + 2 GB swap.
- **Monitoring control plane** on `surreal-box` watches the prod box; all alerts route to Telegram.
- **External dead-man's-switch** (healthchecks.io / UptimeRobot): fires if `surreal-box` itself goes silent.

---

## Quick response table

Use this to identify the alert class and pick the first action. Then read the detailed section below for the full remediation steps.

| Alert | Most likely cause | First action |
|-------|------------------|--------------|
| Host RAM critical | Concurrent Coolify builds, container memory leak | Open Beszel → identify top consumer → pause any in-progress build in Coolify |
| Host swap high | RAM budget exceeded, pages into swap | Pre-cursor to RAM critical — treat same as above, act before OOM |
| Host disk critical | Coolify image/build cache accumulation (most common), restic backup growth on surreal-box | `docker builder prune -f` on the affected box, check disk-guard log |
| 5xx spike | Unhandled exception in SvelteKit route, bad deploy, DB connection failure | PostHog Error Tracking → identify error class → check Coolify deploy log |
| Auth-failure spike | Credential stuffing / brute-force, broken OAuth callback | PostHog events → check IP distribution → confirm fail2ban is active |
| DB-compute/egress runaway | Full-table scan, background job loop, analytics query on prod | SSH → `psql` → `pg_stat_activity` → kill runaway query → trace source in PostHog |
| Ingest error rate | Schema change without consumer update, malformed payload, downstream quota | PostHog Error Tracking → check recent `audit_events` → inspect payload shape |
| Endpoint down | Container crashed, Traefik misroute, box down, Forgejo Postgres crash | Coolify → check app status → `docker ps` on box → `df -h` (disk full is common) |
| External dead-man's-switch | `surreal-box` is down or offline | Hetzner Cloud console → check surreal-box status → reset if needed |
| SSH ban spike | Automated brute-force scan, password-auth misconfigured | `fail2ban-client status sshd` → check `/var/log/auth.log` → verify `PasswordAuthentication no` |

---

## RAM critical

**Check first:** `free -h` on the box; Beszel hub for the process list; Coolify for in-progress builds.

The prod box (7.6 GB + 4 GB swap) can be pushed into swap by a concurrent Coolify build during dashboard load. Two parallel builds have OOM'd the box in the past. Do not trigger any additional builds while RAM is critical.

**Steps:**
1. If a Coolify build is running: pause or cancel it in Coolify → Deployments.
2. If a container is leaking: Coolify → Applications → restart the container.
3. If swap is also exhausted (`free -h` shows swap ≈ 0): SSH to the box, check `dmesg | grep -i oom` and `journalctl -u docker` for OOM kills.
4. If SurrealDB is the cause on `surreal-box`: check whether a large HNSW index rebuild is running; pause Sophia if applicable.
5. Escalate to owner if: box is unresponsive, SSH fails, or the OOM repeats after container restart.

---

## Disk critical

**Background:** Coolify accumulates image layers and build cache; its native cleanup runs once daily — far too coarse for a burst of builds. The disk-guard cron (`/opt/maintenance/disk-guard.sh`) backstops at 80% by pruning Docker cache. A Beszel disk alert at ~75% is the early warning. During the P3 migration, the prod box hit 100% disk, Forgejo's Postgres panicked, and the owner lost Forgejo access. Treat disk critical as high urgency.

**Steps:**
1. SSH to the box → `df -h` (which mount is full) → `du -sh /var/lib/docker/*`.
2. `docker builder prune -f` — frees build cache immediately without touching running containers.
3. `docker image prune -af --filter until=24h` — removes images not used in the last 24 h.
4. Check `/var/log/disk-guard.log` — if the cron ran, note what it freed.
5. On `surreal-box`: check `/var/backups/surreal/` for restic archive growth; prune old snapshots if needed.
6. Escalate to owner if disk is ≥ 95% and Docker prune has not freed enough.

After recovery: confirm the disk-guard cron is running (`systemctl status cron`, `cat /etc/cron.d/disk-guard`) and verify Coolify's docker-cleanup is set to hourly at ~65% threshold (Coolify UI → server settings).

---

## 5xx spike

**Steps:**
1. PostHog Error Tracking → filter last 15 min → identify the error class and stack trace.
2. Coolify → Applications → dashboard → Logs for the last deploy. If a bad deploy caused this: roll back in Coolify → Deployments → select the previous successful deployment → Redeploy.
3. If a DB connection error: check Postgres is running on the prod box (`systemctl status postgresql` or `docker ps`); check `DATABASE_URL` env in Coolify.
4. Check `docker ps` for recently restarted containers.

---

## Auth-failure spike

**Steps:**
1. PostHog → Events → filter `event = auth_failure` → check IP distribution. Many IPs = credential stuffing; one or few IPs = brute-force or integration misconfiguration.
2. Check fail2ban: SSH to prod box → `fail2ban-client status sshd`. If the attacking IP is not already banned, add a temporary Traefik middleware block.
3. If the pattern looks like a broken OAuth callback (same user ID, no mass IP spread): check Better Auth config in Coolify env for misconfigured redirect URL.
4. If credential stuffing is confirmed: rotate application secrets if any were exposed.

---

## DB-compute / egress runaway

**Background:** the Neon egress outage (pre-migration) had no alarm and took prod down. This alert class is treated as high-urgency even at early thresholds.

**Steps:**
1. SSH to prod box → `psql -U [app_user] -d [db_name]` → `SELECT pid, query, state, query_start FROM pg_stat_activity ORDER BY query_start LIMIT 20;`
2. Kill any clearly runaway query: `SELECT pg_terminate_backend([pid]);`
3. Check PostHog for the event source (which endpoint or background job is generating the load).
4. If a worker is in a loop: restart the worker container in Coolify.
5. Check `docker stats` on the prod box for per-container network egress.

---

## Endpoint down

**Steps:**
1. Coolify → Applications → check target app status. If the container is stopped or in error: check the deploy log.
2. SSH to the relevant box → `docker ps` → `docker logs [container]` for recent errors.
3. `df -h` on the box — disk full is a common root cause for Forgejo crashes.
4. If the prod box is completely unreachable: Hetzner Cloud console → check server status.
5. If Traefik is routing incorrectly: `docker logs traefik` on the prod box.

---

## External dead-man's-switch

This fires when `surreal-box` (the monitoring host) has stopped sending its heartbeat. Both boxes may be down.

**Steps:**
1. Hetzner Cloud console → `surreal-box` (`77.42.124.167`) → power status.
2. If down: Power → Reset via Hetzner console.
3. If prod box is also unreachable: check it in Hetzner console in the same session.
4. After recovery: `df -h` and `docker ps` on both boxes before bringing services up.

---

## Alert authoring checklist

When creating or editing an alert in Beszel, PostHog, or Uptime-Kuma, verify the alert body includes:

- [ ] The metric value that triggered (not just "alert fired")
- [ ] Which box (`prod 77.42.125.150` or `surreal-box 77.42.124.167`)
- [ ] Top 3 processes or top error class (auto-captured where supported)
- [ ] Single concrete first action
- [ ] Link to `docs/runbooks/infra-alert-response.md#<section>`

Alerts with a bare metric and no remediation context are configuration failures — the monitoring stack must be actionable from the first notification.

---

## Closing step — file the incident record

**After remediation, file the incident record — invoke the `restormel-isms-governance` skill.** Every
remediated incident/outage/alert gets a Tier-3 incident record (REC-TPL-004 → `evidence/incidents/`)
while the facts are fresh. This is mandatory, not optional — a handled incident with no record filed is
an ISMS failure. The `restormel-isms-governance` skill has the template, directory, frontmatter, and PR
filing process.

---

## Related

- `restormel-isms-governance` skill — file the incident record after remediation (mandatory closing step).
- [docs/runbooks/infra-alert-response.md](../../../docs/runbooks/infra-alert-response.md) — full runbook with all thresholds and TODO placeholders for live configuration
- [docs/infra/security-monitoring-roadmap.md](../../../docs/infra/security-monitoring-roadmap.md) — Workstreams B2–B6 detail and phased rollout
- `restormel-vuln-triage` skill — if the alert is triggered by a scanner finding rather than a host metric
