---
id: REC-INC-027
title: "Planned node3 drain for cx33→cx43 rescale — ~3min Huly blip + CNPG failovers (rescale aborted on capacity, no data loss)"
class: evidence
owner: founder
status: closed
classification: internal
control-tier: 3
created: 2026-06-29
last-reviewed: 2026-06-29
review-interval: P12M
approved-by: founder
approved-on: 2026-06-29
retention: P6Y
related: [REC-INC-024]
---

# Planned node3 drain for cx33→cx43 rescale — brief Huly blip, rescale aborted

- **Detected:** 2026-06-29 ~22:23 Europe/London — **planned maintenance action** (not an alert). **Reported by:** operator (agent-assisted, during the RES-119 integration-login session). **Severity:** low.

- **What happened:** To free capacity for an integration dashboard rebuild (and pursue node uniformity), k8s node `restormel-node3` (Hetzner **cx33**, hel1-dc2) was cordoned and drained to attempt an in-place **cx33→cx43** rescale. Everything on node3 relocated cleanly because storage is **Hetzner network volumes (`hcloud-volumes`), not local-path** — volumes detached and re-attached on other hel1 nodes. The only real outage window was **Huly** (~3 min): its **single-replica** CockroachDB pod's volume had to migrate node3→node2. CNPG primaries for **pg-platform** and **pg-plotbudget** performed graceful operator switchovers node3→node2 (seconds-level write blips).

- **Impact:**
  - **Huly** (internal PM/tracker) unavailable ~3 min while its cockroach volume migrated. Recovered on node2.
  - **pg-platform** (integration env DB + allotmentology portal DB) and **pg-plotbudget** (PlotBudget): brief (seconds) write-failover blips during graceful primary switchover to node2.
  - **pg-restormel** (prod Restormel) and **pg-infisical** (secret store): only **replicas** lived on node3 → **no service impact** (primaries on node2/master1 throughout).
  - **No customer-facing Restormel prod outage. No data loss.**

- **Response (timeline):** Cordoned node3 → CNPG auto-set `targetPrimary` to the node2 replicas on cordon and completed switchover (pg-platform/pg-plotbudget primaries → node2) → drained node3 (`--ignore-daemonsets --delete-emptydir-data`). All CNPG clusters returned to **2/2 HA**; Huly cockroach + app pods recovered on node2. **Rescale ABORTED:** Hetzner **cx43 out of stock in all 6 datacenters** (create + migrate both unavailable, confirmed via the Cloud API). node3 **uncordoned** back into service as **cx33**. The RES-119 integration-login fix was shipped independently by building the dashboard image on the temporarily-empty node3 (it had more free RAM than the packed node2 that had OOM'd the build), then a gitops image bump (verified live).

- **Root cause:** Region-wide cx43 unavailability at Hetzner blocked the in-place rescale **after** node3 had already been drained, so the maintenance produced a blip with no upgrade payoff. The single contributing weakness is that **Huly's CockroachDB runs as a single instance (no replica)** — the one workload on the cluster without HA, so any node-maintenance touching its volume yields a few minutes of Huly downtime.

- **Follow-ups:**
  - cx43-restock watcher running (hel1, 30-min cadence) → rescale node3 cx33→cx43 (reversible, CPU+RAM-only) when stock returns — see deferred infra task.
  - Consider **HA for Huly CockroachDB** (single-instance = single point of ~minutes downtime on any node maintenance) — backlog.
  - node3 remains the heterogeneous **cx33 (8 GB)** node — same root context as the lean-cluster overcommit tuning ([[REC-INC-024]]).
  - **Closed:** 2026-06-29.
