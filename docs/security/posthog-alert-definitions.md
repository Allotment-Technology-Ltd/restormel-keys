---
title: PostHog Alert Definitions — Restormel Keys
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-14
last-reviewed: 2026-06-14
review-interval: P12M
---

# PostHog Alert Definitions — Restormel Keys

Four production alerts for the Restormel Keys dashboard PostHog project (EU Cloud).
These are **code-documented only** — the orchestrator creates the live alerts once the Telegram notification channel is wired (owner prerequisite: see `docs/governance/security-monitoring-roadmap.md`, Owner kickoff step 3).

No alert MCP calls are made here; this document is the source of truth for the queries, thresholds, and remediation text the orchestrator will use.

---

## Alert 1 — 5xx Spike

**Purpose:** Detect a sudden surge in server errors (unhandled exceptions, crashed routes, upstream connectivity failures).

### Insight query

Event: `server_error`  
Filter: `status >= 500` (property `status` is an integer on the event)  
Aggregation: Count of events  
Date range: Rolling 10-minute window  

Alternatively (if the property filter is not available in the basic count insight):

```sql
SELECT count()
FROM events
WHERE event = 'server_error'
  AND toInt32OrNull(JSONExtractString(properties, 'status')) >= 500
  AND timestamp >= now() - INTERVAL 10 MINUTE
```

### Threshold

- **Warning:** ≥ 10 `server_error` events with `status >= 500` in any rolling 10-minute window.
- **Critical:** ≥ 30 in 10 minutes (possible cascading failure or active attack).

### Delivery channel

Telegram (once wired); also email `adam.boon1984@googlemail.com`.

### Remediation text to embed in the alert

```
WHAT: Elevated 5xx error rate on restormel-keys dashboard.
CHECK FIRST:
  1. Coolify → restormel-keys dashboard container → Logs (look for unhandled throw / DB connection refused).
  2. If DB-related: check box-Postgres / Neon reachability from prod box.
  3. If memory-related: `free -h` on prod box — check swap consumption after 4 GB swapfile added.
  4. PostHog → Error Tracking → recent `server_error` events → route_id + error_name properties.
ROLLBACK: Coolify → redeploy last known-good image tag if a recent deploy coincides.
RUNBOOK: docs/runbooks/infra-alert-response.md § "5xx spike"
```

---

## Alert 2 — Auth Failure Spike

**Purpose:** Detect brute-force attempts, credential stuffing, or a broken auth integration. The `security_auth_failure` event is emitted by `src/lib/server/security-events.ts` (volume-bounded at 10 per 60s per actor bucket) so the alert threshold accounts for the sampling.

### Insight query

Event: `security_auth_failure`  
Filter: none (all reasons)  
Aggregation: Count of events  
Date range: Rolling 10-minute window  

```sql
SELECT count(), JSONExtractString(properties, 'reason') AS reason
FROM events
WHERE event = 'security_auth_failure'
  AND timestamp >= now() - INTERVAL 10 MINUTE
GROUP BY reason
```

### Threshold

- **Warning:** ≥ 20 `security_auth_failure` events in any rolling 10-minute window.
- **Critical:** ≥ 60 in 10 minutes (note: each bucket is capped at 10/60s, so 60 events implies at least 6 distinct actor buckets hitting limits simultaneously — strong brute-force signal).

### Delivery channel

Telegram + email.

### Remediation text to embed in the alert

```
WHAT: Elevated authentication failure rate on restormel-keys.
CHECK FIRST:
  1. PostHog → security_auth_failure events → group by `reason` property:
     - "invalid_key": credential stuffing / leaked key being retried.
     - "session_missing": possible auth integration outage or cookie config regression.
     - "verification_error": Neon Auth or internal auth service degraded.
  2. PostHog → distinct_id of top emitters (opaque bucket IDs) — correlate with request logs.
  3. If "invalid_key" dominant: check if a key was recently leaked (rotate via Coolify env update).
  4. If "session_missing" dominant: check Neon Auth endpoint health and NEON_AUTH_BASE_URL env.
ACTION: For active credential stuffing — Traefik rate-limit label on dashboard routes (B4 runbook).
RUNBOOK: docs/runbooks/infra-alert-response.md § "auth failure spike"
```

---

## Alert 3 — DB Compute / Egress Runaway

**Purpose:** Catch the class of outage that took prod down (Neon egress blow-up / box-Postgres OOM) before it kills the service. This alert is the "budget sentinel" the plan describes.

**Note:** With the migration to self-hosted box-Postgres, the Neon egress mechanism is retired for the primary DB. This alert should cover both the Neon egress scenario (if Neon branches are still used for PR previews) and the box-Postgres load scenario.

### Insight query A — High ingest error rate as DB proxy

`security_ingest_error` spikes often precede or coincide with DB saturation (failed jobs try the DB, fail, retry).

Event: `security_ingest_error`  
Filter: `error_class = "worker_crash"` OR `error_class = "upstream_error"`  
Aggregation: Count  
Date range: Rolling 10-minute window  

### Insight query B — Server errors on DB-adjacent routes

Event: `server_error`  
Filter: `route_id` contains `"connect"` OR `"graph"` OR `"ingest"`  
Aggregation: Count  
Date range: Rolling 10-minute window  

### Threshold

- **Warning:** ≥ 15 `security_ingest_error` (worker_crash or upstream_error class) in 10 minutes.
- **Critical:** ≥ 5 `server_error` on connect/graph/ingest routes in 5 minutes **AND** `security_ingest_error` count > 10 in the same window (correlated alert = likely DB issue).

### Delivery channel

Telegram + email. This alert class warrants immediate response.

### Remediation text to embed in the alert

```
WHAT: Possible DB compute / egress runaway — the Neon-outage failure class.
CHECK FIRST:
  1. Beszel → prod box RAM/swap graph — if swap is near 4 GB, box-Postgres may be OOM.
  2. `free -h` on prod box (SSH via Coolify terminal or Hetzner console).
  3. box-Postgres: `systemctl status postgresql` or check Coolify Postgres service health.
  4. If Neon is still in use for preview branches: Neon console → branch → compute hours / egress.
  5. PostHog → security_ingest_error events → job_type property identifies which pipeline is crashing.
STOP THE BLEEDING:
  - If OOM: `sysctl vm.swappiness` / free memory; kill the heaviest non-essential process.
  - If box-Postgres overloaded: Coolify → restart Postgres service; check active query count.
  - If Neon egress: Neon console → pause the branch compute immediately.
RUNBOOK: docs/runbooks/infra-alert-response.md § "DB compute runaway"
```

---

## Alert 4 — Ingest Error Rate

**Purpose:** Track Connect ingest pipeline health. A sustained ingest error rate indicates broken worker config, upstream provider failures, or storage exhaustion — each of which should be acted on before it cascades.

### Insight query

Event: `security_ingest_error`  
Filter: none (all error classes)  
Aggregation: Count + breakdown by `error_class`  
Date range: Rolling 30-minute window  

```sql
SELECT count(), JSONExtractString(properties, 'error_class') AS error_class,
       JSONExtractString(properties, 'job_type') AS job_type
FROM events
WHERE event = 'security_ingest_error'
  AND timestamp >= now() - INTERVAL 30 MINUTE
GROUP BY error_class, job_type
ORDER BY count() DESC
```

### Threshold

- **Warning:** ≥ 10 `security_ingest_error` events (any class) in any rolling 30-minute window.
- **Critical:** ≥ 5 events with `error_class = "worker_crash"` in 10 minutes (crash-looping worker).

### Delivery channel

Telegram + email.

### Remediation text to embed in the alert

```
WHAT: Connect ingest pipeline errors above baseline.
CHECK FIRST:
  1. PostHog → security_ingest_error → error_class breakdown:
     - "validation": schema mismatch or malformed input — check recent contract changes.
     - "worker_crash": check Coolify logs for the ingest-worker container.
     - "upstream_error": provider API returning 5xx — check provider status pages.
  2. PostHog → job_type property: identifies which ingest pipeline (connect_ingest, graph_import, etc.).
  3. Coolify → ingest-worker / dashboard container logs for unhandled errors.
  4. If disk-related: check prod box disk usage (`df -h`) — disk-guard cron logs at /var/log/disk-guard.log.
ACTION:
  - "worker_crash": Coolify → restart ingest-worker; check for recent deploy regressions.
  - "validation": review recent schema/contract changes; check migration status.
  - "upstream_error": implement temporary backoff or disable the affected provider integration.
RUNBOOK: docs/runbooks/infra-alert-response.md § "ingest error rate"
```

---

## Implementation notes for the orchestrator

When creating these alerts via the PostHog MCP (`alert-create`):

1. **Notification channel:** Wire to the Telegram bot token first (owner step 3). PostHog supports Slack webhook / email natively; Telegram requires a Slack-compatible webhook relay or the PostHog Zapier integration.
2. **Insight IDs:** Create the Insight first (`insight-create`), capture its `id`, then reference it in `alert-create`.
3. **Anomaly alerts:** For alerts 2 and 4, consider using PostHog's anomaly detection (rather than absolute thresholds) once sufficient baseline data exists (~2 weeks) — the `authoring-log-alerts` skill covers this.
4. **Test:** After creating, use `alert-simulate` to confirm Telegram delivery end-to-end.
5. **Volume bound:** The `security_auth_failure` and `security_rate_limit_hit` events are sampled in-process (see `src/lib/server/security-events.ts`). Alert thresholds already account for this sampling; do not set thresholds below the per-bucket cap (10/60s) or they will false-alarm on normal bursts.
