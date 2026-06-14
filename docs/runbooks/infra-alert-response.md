# Infra Alert Response Runbook

Scaffold mapping each planned alert to likely causes and first remedial actions. Pairs with skill `restormel-infra-alert-response`.

Related: [docs/infra/security-monitoring-roadmap.md](../infra/security-monitoring-roadmap.md) · [docs/security/vulnerability-management.md](../security/vulnerability-management.md)

> **TODO (fill once monitoring stack is live):** Replace every `[TODO: threshold]`, `[TODO: link]`, and `[TODO: channel]` placeholder below. These require Beszel, Uptime-Kuma, and PostHog to be live and configured (Phase 1 items 4–6 in the roadmap checklist).

---

## Alert inventory

| Alert | Source | Status |
|-------|--------|--------|
| Host RAM critical | Beszel | Configured after Phase 1 item 5 |
| Host swap high | Beszel | Configured after Phase 1 item 5 |
| Host disk critical | Beszel | Configured after Phase 1 item 5 |
| 5xx spike | PostHog | Configured after Phase 1 item 4 |
| Auth-failure spike | PostHog | Configured after Phase 1 item 4 |
| DB-compute/egress runaway | PostHog | Configured after Phase 1 item 4 |
| Ingest error rate | PostHog | Configured after Phase 1 item 4 |
| Endpoint down | Uptime-Kuma | Configured after Phase 1 item 6 |
| External dead-man's-switch | healthchecks.io / UptimeRobot | Configured after Phase 1 item 6 |
| SSH brute-force ban spike | fail2ban | Configured after Phase 1 item 6 |

All alerts fire through Telegram `[TODO: channel]`. The alert body includes a Remediation block with the first action, context (e.g. top processes for a RAM alert), and a link to this runbook.

---

## Host RAM critical

**Threshold:** `[TODO: e.g. > 90% for 3 min]` on either box.
**Source:** Beszel agent on the affected box → Beszel hub on `surreal-box` → Telegram.

**Likely causes:**
- A Coolify build triggered on the prod box while the dashboard was under load (two concurrent builds have OOM'd the box before).
- SurrealDB HNSW index growth on `surreal-box`.
- A memory leak in a long-running dashboard or worker container.
- The prod box has 7.6 GB RAM + 4 GB swap; `surreal-box` has 8 GB + 2 GB swap. Either box can reach critical RAM under sustained load.

**First actions:**
1. Open Beszel hub (`[TODO: Beszel URL on surreal-box]`) → identify the top memory consumers on the affected box.
2. If a Coolify build is in progress: pause or cancel it in Coolify (`[TODO: Coolify URL]`).
3. If a container is leaking: restart it in Coolify → Applications → `[app name]` → Restart.
4. If swap is also exhausted: SSH to the box and check `free -h`, `dmesg | grep -i oom`. An OOM kill may have already happened; check `journalctl -u docker` for killed containers.
5. If SurrealDB is the cause on `surreal-box`: check whether a large HNSW index rebuild is running; pause Sophia if applicable.
6. Do NOT run `docker build` or `docker pull` manually on the prod box while RAM is critical — this risks a second OOM.

**Escalate to owner if:** the box is unresponsive, SSH fails, or the OOM repeats after container restart.

---

## Host swap high

**Threshold:** `[TODO: e.g. > 75% swap used for 10 min]`.
**Source:** Beszel → Telegram.

**Likely causes:**
- Sustained high memory use is paging into swap. A warning that RAM critical is approaching.
- The prod box ran without swap until 2026-06-13; swap-heavy behaviour means the RAM budget is being exceeded.

**First actions:**
1. Treat as pre-cursor to RAM critical. Follow the RAM critical runbook above.
2. Identify the process pushing into swap (`smem -r` or `ps aux --sort=-%mem | head -10`).
3. Check Coolify for queued or in-progress builds.

---

## Host disk critical

**Threshold:** `[TODO: e.g. > 85% disk used]`. The `/opt/maintenance/disk-guard.sh` cron backstops at 80% by pruning Docker build cache; a Beszel disk alert at ~75% is an earlier warning.
**Source:** Beszel → Telegram.

**Likely causes:**
- Coolify has accumulated image layers and build cache. A burst of builds (e.g. multiple PR deploys in quick succession) can exhaust disk within minutes.
- `surreal-box`: restic backup archives from `surreal-backup` cron growing over time.
- Forgejo Postgres WAL accumulation on `surreal-box` (same disk).

**First actions:**
1. SSH to the affected box and check: `df -h` (which mount is full), `du -sh /var/lib/docker/*` (image/container/build cache).
2. If Docker cache: `docker system df` to see the breakdown; `docker builder prune -f` frees build cache immediately without touching running containers.
3. If images: `docker image prune -af --filter until=24h` removes images not used in the last 24 h.
4. Check `/var/log/disk-guard.log` — if the cron ran, note what it freed and when.
5. On `surreal-box`: check `/var/backups/surreal/` size; if restic archives are the cause, prune old snapshots with `restic forget --keep-last [TODO: n] --prune`.
6. If Forgejo is the cause: `du -sh /opt/forgejo/data/` and consult the Forgejo admin panel for repo git-gc or large repos.
7. After freeing space, check whether the disk-guard cron is running: `systemctl status cron` and `cat /etc/cron.d/disk-guard`.

**Escalate to owner if:** disk is ≥ 95% and Docker prune has not freed enough — this is the class of outage that crashed Forgejo's Postgres during the P3 migration.

---

## 5xx spike

**Threshold:** `[TODO: e.g. > 10 5xx responses in 1 min, sustained 3 min]`.
**Source:** PostHog insight tracking HTTP response codes → PostHog alert → Telegram.

**Likely causes:**
- An unhandled exception in a SvelteKit server route (the `handleError` hook will capture these in PostHog Error Tracking after Phase 1 item 4).
- A database connection failure (Postgres on the prod box unreachable or connection pool exhausted).
- A bad deploy pushed a broken container; Coolify health check failed but traffic is still routing.
- Traefik misconfiguration after a deploy (container port mismatch).

**First actions:**
1. Open PostHog Error Tracking (`[TODO: PostHog link]`) → filter last 15 min → identify the error class.
2. Check Coolify (`[TODO: Coolify URL]`) → Applications → dashboard → Logs for the last deploy.
3. If a bad deploy: roll back in Coolify → Deployments → select the previous successful deployment → Redeploy.
4. If a DB connection error: check that Postgres is running on the prod box (`systemctl status postgresql` or `docker ps` if containerised); check the `DATABASE_URL` env in Coolify.
5. Check `docker ps` on the prod box for any recently restarted containers.

---

## Auth-failure spike

**Threshold:** `[TODO: e.g. > 20 auth failures in 5 min]`.
**Source:** PostHog security event (`auth_failure`) → PostHog alert → Telegram.

**Likely causes:**
- Credential stuffing or brute-force attack against the dashboard login endpoint.
- A broken OAuth callback after a configuration change (e.g. Better Auth redirect URL mismatch).
- A misconfigured integration or webhook making repeated unauthenticated calls.

**First actions:**
1. Open PostHog (`[TODO: PostHog link]`) → Events → filter `event = auth_failure` → check IP distribution.
2. If a single or small range of IPs: check fail2ban (`fail2ban-client status sshd`); consider blocking the IP range at Traefik via a Coolify middleware label — `[TODO: middleware label pattern]`.
3. If it looks like OAuth breakage (same user ID, not mass IPs): check PostHog for the specific error message; check the Better Auth config in Coolify env.
4. If the rate-limit middleware is in place (Phase 1 item 6): confirm it is active at `[TODO: Traefik dashboard or middleware label]`.
5. If credential stuffing is confirmed: rotate application secrets if any were exposed; consider temporarily enabling CAPTCHA or email-based rate-limit on the auth endpoint.

---

## DB compute / egress runaway

**Threshold:** `[TODO: e.g. > [N] GB egress from the prod box in 1 h, or Postgres connections > [M]]`.
**Source:** PostHog security event (`db_egress_high`) or Beszel network metric → Telegram.

**Background:** the Neon egress outage (pre-migration) that took prod down had no alarm. This alert is the primary defence against the same class of failure on the self-hosted Postgres.

**Likely causes:**
- An unintentional full-table scan in a new query (missing index).
- A loop in a background job making repeated DB calls.
- An analytics or reporting query that was accidentally executed against production.
- Unusual traffic spike driving more queries than expected.

**First actions:**
1. SSH to the prod box → `psql` → `SELECT pid, query, state, query_start FROM pg_stat_activity ORDER BY query_start LIMIT 20;` to see running queries.
2. Kill any clearly runaway query: `SELECT pg_terminate_backend([pid]);`.
3. Check PostHog for the event source (which endpoint or job is generating the load).
4. If a background worker is in a loop: restart the worker container in Coolify.
5. Check `docker stats` on the prod box for network egress per container.
6. If the source is an analytics query that should not be running against production: stop it immediately; route future analytics to a replica or export.

---

## Ingest error rate

**Threshold:** `[TODO: e.g. > 5% error rate on ingest endpoints over 5 min]`.
**Source:** PostHog insight tracking ingest endpoint error rate → PostHog alert → Telegram.

**Likely causes:**
- A schema migration that changed the ingest API contract without a coordinated consumer update.
- A broken external integration sending malformed payloads.
- A rate limit or quota being hit on a downstream provider.

**First actions:**
1. Open PostHog Error Tracking → filter for ingest-related errors.
2. Check `audit_events` table for recent admin actions that might have changed the ingest config.
3. Inspect the payload shape of failing requests in PostHog or Traefik logs.
4. If a specific integration is the source: check that integration's PostHog events and, if necessary, disable it temporarily via Coolify env (`DISABLE_[INTEGRATION]_INGEST=1` if such a flag exists).

---

## Endpoint down

**Threshold:** endpoint fails 2 consecutive probes (Uptime-Kuma default).
**Monitored endpoints:** `restormel.dev`, `/keys/v1/catalog`, `surreal.restormel.dev`, Forgejo (`git.allotmentology.tech`).
**Source:** Uptime-Kuma on `surreal-box` → Telegram.

**Likely causes:**
- The dashboard container has crashed or been stopped (check Coolify).
- Traefik is not routing to the container (port mismatch, health check failure).
- The prod box itself is down (network or host issue).
- Forgejo is down (Postgres crash, disk full, or `surreal-box` itself is unavailable).

**First actions:**
1. Check Coolify (`[TODO: Coolify URL]`) → is the target application running?
2. SSH to the relevant box → `docker ps` → is the container up? `docker logs [container]` for recent errors.
3. Check `df -h` on the box — disk full is a common cause of Forgejo Postgres crashes.
4. If the prod box is completely unreachable: check Hetzner Cloud console (`[TODO: Hetzner console URL]`) for the server status.
5. If Traefik is the issue: `docker logs traefik` on the prod box.

---

## External dead-man's-switch

**Source:** `[TODO: healthchecks.io / UptimeRobot free tier]` → Telegram (or email fallback).

This alert fires when the internal Uptime-Kuma probe on `surreal-box` has stopped sending its heartbeat. It indicates that `surreal-box` itself (the monitoring host) is down, or that both boxes have lost outbound connectivity.

**First actions:**
1. Check Hetzner Cloud console for `surreal-box` (`77.42.124.167`) status.
2. If `surreal-box` is down: attempt to restart via Hetzner Cloud console → Power → Reset.
3. If the prod box is also unreachable: this is a full outage. Hetzner Cloud console is the only management path.
4. After recovery: check disk (`df -h`) and container status on both boxes before bringing services back up.

---

## SSH brute-force ban spike

**Threshold:** `[TODO: e.g. > 5 fail2ban bans in 10 min on either box]`.
**Source:** fail2ban log parsing → `[TODO: alert mechanism — a cron-driven script, PostHog event, or direct Telegram bot call]`.

**Likely causes:**
- Automated SSH brute-force scan targeting both boxes.
- A legitimate user has forgotten their key and is triggering password-auth failures (password auth should be disabled).

**First actions:**
1. SSH to the affected box → `fail2ban-client status sshd` → view the list of banned IPs.
2. Check `/var/log/auth.log` for the username being attempted.
3. If it's a known automated scan (targeting `root`, `admin`, etc.): no action needed; fail2ban is working.
4. If the source IP is unexpectedly familiar (e.g. a team member's IP): check with them before banning further.
5. Confirm SSH password auth is disabled: `grep PasswordAuthentication /etc/ssh/sshd_config` should return `no`.
6. If bans are not sticking or the attacker is rotating IPs: consider Hetzner Cloud firewall rules at the network layer.

---

## Alert template (actionable-alert format)

All alerts should include this structure in the notification body. Configure this in each alert tool's template.

```
[ALERT] <Alert name> — <box or service>

What: <metric or event, e.g. "RAM at 94%, swap at 60%">
Box: <prod box 77.42.125.150 | surreal-box 77.42.124.167>
Time: <timestamp>

Top processes (auto-captured):
  <process 1>
  <process 2>
  <process 3>

First action: <single concrete step from this runbook>
Runbook: docs/runbooks/infra-alert-response.md#<section-anchor>
```

Alerts that include only a bare metric (no remediation block, no runbook link) are configuration failures — update the alert template.
