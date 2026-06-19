---
title: Operations Centre — Discovery & Delivery Plan
class: technical
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-19
last-reviewed: 2026-06-19
review-interval: P12M
---

# Operations Centre — Discovery & Delivery Plan

A self-hosted, EU-sovereign operations centre: **Grafana + Loki + Prometheus + Grafana Alloy**
(observability) plus **GlitchTip** (Sentry-SDK-compatible error tracking), with GlitchTip error
events forwarded into Loki for unified alerting in Grafana.

**Status: DISCOVERY + PLAN ONLY.** No config, code, or infrastructure has been changed. This document
is for founder review before any implementation. Discovery was performed read-only against the repo,
governance records, and the `restormel-infra-access` skill on 2026-06-19. **No SSH was performed** — so
all live resource figures (`free`/`df`/`docker stats`) are flagged as *to-be-captured* below.

Related: [security-monitoring-roadmap.md](security-monitoring-roadmap.md) ·
[suite-server-sizing.md](suite-server-sizing.md) ·
[../runbooks/infra-alert-response.md](../runbooks/infra-alert-response.md) ·
[../../governance/asset-inventory.yaml](../../governance/asset-inventory.yaml) ·
[../../scripts/backup/buildops-backup.sh](../../scripts/backup/buildops-backup.sh)

---

## 0. Discovery summary — three findings that reshape the brief

Before the structured plan, three audit findings materially change the brief's assumptions. Read these
first; they cascade into every section.

### Finding 1 — **Sentry is not in use. This is greenfield error tracking, not a migration.**

There is **no operational Sentry anywhere** in the estate:

- **Zero** `Sentry.init()`, `captureException()`, `captureMessage()`, `withSentry`, `handleErrorWithSentry`
  in `restormel-keys` or the sibling `allotment-technology-ltd` repo (the only hit is a launchpad *tile
  linking to sentry.io* as an external portal — not an SDK).
- **No direct `@sentry/*` dependency** in any `package.json`. The only `@sentry/*` packages present are
  **unused transitive deps** of `@supabase/postgres-meta` (`@sentry/node@9.47.1` et al.) — never imported.
- **No DSN** anywhere: no `SENTRY_DSN`, `PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, no `sentry.io` host
  reference in any `.env*`, no Sentry secret in `.forgejo/workflows/` or `.github/workflows/`.
- The decision was explicit and is recorded: `security-monitoring-roadmap.md` (B1) says the
  `handleError` hooks → PostHog *"**replaces the planned Sentry integration with PostHog, which is
  already in the stack.**"* The SoA (`governance/soa.md` A.5.7/A.5.25/A.8.15/A.8.16) still *names* Sentry,
  but as an **aspirational ISO-27001 control mapping** — never operationalised.

**Consequence:** the brief's Stage 1 ("GlitchTip deployment + DSN migration → unblocks Sentry shutdown")
and Stage 7 ("Sentry decommission") **have nothing to decommission**. There is no DSN to swap, no SDK to
re-point, no Sentry alert rules to recreate, no historical error data to migrate. The real decision is
narrower and is raised in §G: **GlitchTip vs Bugsink vs keeping PostHog Error Tracking** for what is, today,
PostHog's job.

### Finding 2 — **No Prometheus / Loki / Grafana / Alloy exists today. The documented plan is a deliberately lighter stack.**

The estate has **no time-series metrics backend and no log store**. The approved
`security-monitoring-roadmap.md` deliberately chose a **low-RAM** design for 8 GB boxes:

- **PostHog EU** (live since 2026-06-14, `apps/dashboard/src/hooks.server.ts:337`) — app errors + analytics.
- **Beszel** — lightweight Go agent+hub for host metrics (CPU/RAM/disk/swap), chosen *specifically* to
  avoid a Prometheus stack's footprint. Planned, not yet deployed.
- **Uptime-Kuma** — endpoint probes. Planned.
- **Telegram** — alert channel. **Operationally live** (proven by REC-INC-001: a real "[Restormel prod
  (catalog)] [down] 503" Telegram alert fired on 2026-06-16).
- **Loki** appears only as a **Phase-2 candidate** ("a small self-hosted Loki *or* PostHog Logs").

**Consequence — and this is additive, not a rip-out.** Mapping the brief against what we have/plan, only
**one** capability overlaps, and it is not yet built:

| Capability | Today / planned | Grafana stack | Verdict |
|---|---|---|---|
| **Logs** | *nothing* | Loki + Alloy | **Pure gain** — no overlap |
| **Metrics backend** | *nothing* | Prometheus | **Pure gain** (Forgejo/Traefik/Postgres/app) |
| **Uptime** | Uptime-Kuma (planned) | — | **Keep Kuma** — its built-in `/metrics` *feeds* Prometheus → Grafana |
| **App errors + analytics** | PostHog (live) | — | **Keep PostHog** — forward events to Loki for unified alerting |
| **Alert channel** | Telegram (live) | — | **Keep Telegram** — added as a Grafana contact point |
| **Host metrics** | **Beszel** (planned, *not built*) | Alloy unix-exporter → Prometheus | **Only overlap** |

The single overlap is **host metrics (Beszel vs Prometheus+node)**. Because Beszel **isn't deployed yet**
(so not building it ≠ removing it) and we are **adding Alloy anyway for logs** (one Alloy agent does host
metrics *and* log shipping for free), the clean move is: **don't build the now-redundant Beszel — let Alloy
feed host metrics into Prometheus.** Beszel also keeps metrics in its own SQLite/PocketBase store with no
Prometheus scrape, so it never integrated cleanly with Grafana anyway.

**Therefore this plan adopts an ADDITIVE / LAYERED design (not a pivot):** keep PostHog + Uptime-Kuma +
Telegram (+ fail2ban/Traefik); **add** Loki + Prometheus + Grafana + Alloy as the aggregation + alerting
pane; Uptime-Kuma's `/metrics` and (optionally) PostHog webhooks flow into it; **GlitchTip stays optional**
(PostHog already captures errors — add it only for dedicated Sentry-SDK engineering triage). Same result —
single Grafana pane + unified Telegram alerting, fully EU-sovereign — with no planned/live work discarded.
Only Beszel is "not built," and it was never built.

### Finding 3 — **The build box is the only server with real headroom. That decides hosting and avoids a 4th server.**

Verified 2026-06-19 topology (the `infra-alert-response` runbook still shows the *old, inverted* topology —
do not trust it):

| Box | Type / RAM (documented) | Role today | Headroom |
|---|---|---|---|
| **`.167`** (77.42.124.167 / 172.16.0.3) | CX33, 8 GB (+2 GB swap), ~80 GB | **LIVE prod** — dashboard (1536m) + worker (2048m) + app Postgres (+ Hydra planned) | RAM-tight; now isolated from CI |
| **`.150`** (77.42.125.150 / 172.16.0.2) | CX33, 8 GB (+4 GB swap), ~80 GB | Coolify + Traefik, Forgejo + its PG, restormel-PG, allotmentology-PG, **SurrealDB**, **Infisical** (+PG+Redis), staging+preview dashboards, monitoring control plane | **Most loaded; OOM'd once; disk-full crash history** |
| **`restormel-build` / `.166`** (204.168.216.166 / 172.16.0.4) | **CX43, 16 GB** | CI runner (`hetzner-build`) + Coolify build server; **idle most of the time**, builds spike ~2–4 GB | **By far the most headroom** |

All three are on the private mesh `172.16.0.0/16`, so a collector on the build box (`172.16.0.4`) can
scrape the prod (`.3`) and control (`.2`) boxes over private IPs. **Consequence:** the Operations Centre
should live on the **build box (.166)**, which also gives the right *failure-domain isolation* — monitoring
must not run on the box it is monitoring, and emphatically not on `.150` with its disk-pressure history.
This **avoids provisioning a 4th server**, meeting the stated preference.

---

## A. Infrastructure decision

**Host the entire Operations Centre (observability stack + GlitchTip) on the build box `.166`
(`restormel-build`, CX43, 16 GB).** No 4th server.

**Justification (documented figures; live `free`/`df` still to be captured — see §G/flag F-1):**

- **Headroom.** The build box is 16 GB and idle outside CI builds (which spike ~2–4 GB, infrequently).
  Estimated Ops Centre footprint at our scale (<10 services, low cardinality):
  - Grafana ≈ 150–250 MB · Prometheus ≈ 0.5–1 GB · Loki (single-binary, boltdb-shipper/filesystem) ≈
    0.3–0.7 GB · Alloy (central receiver) ≈ 0.1–0.2 GB → **observability ≈ 1.5–2.5 GB**.
  - GlitchTip (Django web + Celery worker + Celery beat + Postgres + Redis) ≈ **1.5–2 GB** (it is
    documented to run on a 2 GB VPS).
  - **Combined ≈ 3.5–4.5 GB.** Even colliding with a 4 GB CI build → ~8 GB, comfortably inside 16 GB.
- **Failure-domain isolation.** Monitoring on the build box keeps watching `.167`/`.150` when *they*
  degrade, and keeps the heaviest writer (Loki/Prometheus TSDB) **off `.150`**, whose 80%-disk auto-prune
  cron and prior 100%-disk Forgejo-Postgres crash make it the worst possible home for growing data dirs.
- **Network.** Build box has private IP `172.16.0.4` → can scrape node/Docker metrics and pull logs from
  `.150`/`.167` over the private mesh without opening public ports.
- **Already in Coolify.** Registered as `restormel-build-c-166` — deployable through the existing control plane.

**Accepted risks / mitigations:**

- *CI contention* — a heavy CI build on the same box could cause scrape gaps or slow GlitchTip ingest.
  At our build frequency this is acceptable; mitigate by keeping Prometheus scrape intervals modest (30–60 s)
  and, if needed, capping runner concurrency. Flag F-2.
- *Single-box monitoring* — if the build box itself dies, we lose the Ops Centre. Mitigate with an
  **external dead-man's-switch** (healthchecks.io / UptimeRobot free tier) that pages if the stack goes
  silent — this is already in the monitoring roadmap as the outermost pager.
- *Build-box disk size unknown* — CX43 is typically ~240 GB but is **not documented**; must confirm via
  approved `df -h` before siting Loki/Prometheus data. Flag F-1.

**When to revisit a dedicated 4th box:** only if (a) live `df`/`free` shows the build box lacks ~6 GB RAM /
~40 GB free disk headroom, (b) CI build cadence grows enough to starve scrapes, or (c) the founder wants
GlitchTip in a separate failure domain from observability. A new **CX22 (2 vCPU / 4 GB / 40 GB, ≈ €4–5/mo)**
would host GlitchTip alone; a **CX32 (4 vCPU / 8 GB / 80 GB, ≈ €8–9/mo)** would host the whole Ops Centre.
These are fallbacks, not the recommendation.

---

## B. Stack architecture

```
                          BUILD BOX .166 (172.16.0.4, CX43 16 GB)  ── "ops" role
                          ┌───────────────────────────────────────────────────┐
                          │  Grafana ──reads──► Prometheus (TSDB, metrics)      │
                          │     │                  ▲                            │
                          │     └──reads──► Loki (log chunks)                   │
                          │                        ▲          ▲                 │
                          │           Alloy (central): loki.source.api (HTTP)   │
                          │                        ▲          │  (GlitchTip     │
                          │                        │          │   webhook in)   │
                          │  GlitchTip: web + worker + beat + Postgres + Redis  │
                          │     └──webhook on new issue──────────┘              │
                          └───────▲──────────────────────▲────────────────────-┘
            private mesh 172.16.0.0/16 (scrape + remote_write + loki push)
                  │                                      │
   ┌──────────────┴───────────┐            ┌─────────────┴──────────────┐
   │  PROD .167 (172.16.0.3)  │            │  CONTROL .150 (172.16.0.2)  │
   │  Alloy agent:            │            │  Alloy agent:               │
   │   • node metrics ───────►│ remote_write to Prometheus              │
   │   • docker logs ────────►│ loki.write to Loki                      │
   │  dashboard + worker app  │            │  Coolify, Forgejo(/metrics),│
   │  logs (structured JSON)  │            │  SurrealDB, Infisical, PG   │
   └──────────────────────────┘            └─────────────────────────────┘
                  │                                      │
                  └────────► GlitchTip DSN (errors via @sentry SDK, if adopted)
```

**How it fits together:**

1. **Collection — Alloy everywhere (replaces Promtail + old Grafana Agent).** Run a lightweight **Alloy
   agent on each box** (`.167`, `.150`, and locally on `.166`). Each agent:
   - exposes/collects host metrics (Alloy's built-in `prometheus.exporter.unix`) and **`prometheus.remote_write`s**
     them to the central Prometheus on `.166` — this removes the need for a separate `node_exporter`;
   - tails **Docker container logs** (`loki.source.docker`) and **`loki.write`s** them to the central Loki
     with labels `{box, service, env}`.
2. **Metrics — Prometheus (central, on `.166`).** Scrape targets:
   - Alloy `remote_write` (host metrics for all three boxes);
   - **Forgejo `/metrics`** (built-in; must be enabled — see §E);
   - **Traefik** metrics (Coolify can expose Traefik's Prometheus endpoint);
   - Prometheus self + Grafana + Loki + GlitchTip internal metrics where available;
   - **Postgres** via `postgres_exporter` *for the self-hosted PGs on `.150`* (Forgejo PG, restormel PG).
     **Prod app DB is Neon (external) — Neon does not expose Prometheus metrics**; see §E gap.
3. **Logs — Loki (central, on `.166`).** Single-binary mode, filesystem/boltdb-shipper backend (sufficient
   at our scale). Receives: Docker logs via Alloy; **GlitchTip issue/alert webhooks** via the central Alloy's
   `loki.source.api` HTTP receiver (see §B.5); optionally PostHog webhooks (§E source 7).
4. **Dashboards + alerting — Grafana (on `.166`).** Single pane over Prometheus + Loki. Grafana unified
   alerting evaluates rules across **metrics (Prometheus)** and **logs (Loki/LogQL)** and routes to a
   **contact point** — reuse the existing **Telegram** channel (already live) so we don't fragment alerting.
   **Kept sources feed in additively:** **Uptime-Kuma** keeps doing endpoint probes and exposes its built-in
   **`/metrics`**, which Prometheus scrapes → uptime is visible and alertable in Grafana (no second uptime
   system needed); **PostHog** stays the analytics + app-error system and can **webhook selected events into
   Loki** for unified alerting (analytics itself stays in the PostHog UI). **Beszel is not built** — Alloy's
   unix exporter (step 1) provides host metrics to Prometheus, so there is no host-metrics duplication.
5. **GlitchTip → Loki pipeline (the brief's unified-alerting requirement).** GlitchTip supports outbound
   webhooks on new issues/alerts. Configure a GlitchTip webhook → **Alloy `loki.source.api`** HTTP receiver
   on `.166` → `loki.write` → Loki with labels `{source="glitchtip", env="prod", level="error"}`. Grafana
   then alerts on error spikes **alongside** infra metrics from one surface. (Errors also remain queryable
   natively in GlitchTip's own UI — the webhook is for *unified alerting*, not the primary error workflow.)

**SDK note (if GlitchTip is adopted):** because GlitchTip is Sentry-SDK-compatible, instrumenting the
SvelteKit app means adding `@sentry/sveltekit` with the **GlitchTip DSN** — there is no Sentry today, so
this is *new* instrumentation, done in a later (post-approval) task, not part of this plan.

---

## C. Backup & retention design

**Current mechanism (audited):** `restic` (encrypted) over `rclone serve restic --stdio` to the Hetzner
**BX11 Storage Box** (`u613941.your-storagebox.de`, 1 TB, Falkenstein EU). Driven by per-box root cron:

- `.150` → repo `restic-buildops`, **02:00 UTC daily** (`scripts/backup/buildops-backup.sh` →
  `/etc/cron.d/buildops-backup`). Scope: `pg_dump -Fc` of restormel/Forgejo/Coolify/Infisical Postgres +
  Forgejo data volume + Coolify config + Infisical config.
- `.167` → repo `restic-surreal`, **03:00 UTC daily**. Scope: SurrealDB data dir. *(Script not yet
  version-controlled — pre-existing gap, see below.)*
- Retention (both): `--keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune` (≈ 6 months), prune inline.
- Restic repos are **encrypted**; passphrase lives only on-box at `/root/.config/restic-password`.

**Established on-disk convention:** raw compose services live under **`/opt/<service>/`** (e.g.
`/opt/infisical`, `/opt/surreal`), DB durability via named Docker volumes; Coolify-managed services keep
data under `/var/lib/docker/volumes/<vol>/_data`.

**Extension for the Operations Centre** (all data on the **build box `.166`**):

| Data | On-disk path (proposed) | Hot retention (on disk) | Cold retention (BX11) | Backup method |
|---|---|---|---|---|
| Prometheus TSDB | `/opt/prometheus/data` | **15 days** (`--storage.tsdb.retention.time=15d`) + size cap | weekly TSDB snapshot, keep 4w/6m | restic filesystem of snapshot dir |
| Loki chunks + index | `/opt/loki/{chunks,index}` | **30 days** (Loki `retention_period`, compactor enabled) | 7d/4w/6m via restic | restic filesystem |
| GlitchTip Postgres | `/opt/glitchtip/pg` | live | 7d/4w/6m | **`pg_dump -Fc`** (consistent with other DBs), not raw volume |
| GlitchTip uploads/attachments | `/opt/glitchtip/uploads` | live | 7d/4w/6m | restic filesystem |
| Grafana DB (dashboards/users) | `/opt/grafana` | live | 7d/4w/6m | restic filesystem (or `grafana.db` dump) |
| Redis (GlitchTip broker) | `/opt/glitchtip/redis` | ephemeral | **not backed up** (broker state only) | n/a |

**Implementation:** add a **third restic repo `restic-ops` on `.166`** (new daily cron, e.g. **01:30 UTC**,
staggered before the others) reusing the same rclone remote + an `.166`-local restic passphrase. Mirror
`buildops-backup.sh` structure: `pg_dump -Fc` for GlitchTip PG into `/tmp/ops-dumps/`, then restic the data
dirs + dumps, then `forget --prune`. Keep Prometheus *hot* retention deliberately short (15 d) — long-term
metrics history is rarely worth the TSDB disk on an 80–240 GB box; cold snapshots cover audit needs.

**Pre-existing backup gaps surfaced (worth fixing alongside, but not blockers):**

- The `.167` `restic-surreal` script is **not version-controlled** — only `buildops-backup.sh` is in
  `scripts/backup/`. Recommend committing it for reproducibility.
- **No native `forgejo dump`** archive (roadmap flags this). The buildops job backs up Forgejo PG + data
  volume separately, which is recoverable but not the consistent single-archive Forgejo recommends.
- **No BCP/DR policy doc** (`governance/bcp-dr-policy.md` absent) and the **restore drill** script exists but
  per the rollback runbook was "not yet executed." Validate restore of the new `restic-ops` repo as part of
  Stage 6.

---

## D. Error-tracking plan (was "Sentry migration")

**Because Sentry is not in use (Finding 1), there is no migration — this is a greenfield rollout.** The
brief's freeze→swap-DSN→decommission arc does not apply. The realistic step sequence:

1. **Decide the error-tracking owner** (§G flag F-3): GlitchTip (self-hosted) vs Bugsink (self-hosted) vs
   keep PostHog Error Tracking (current, EU SaaS). *Assuming GlitchTip is chosen:*
2. **Deploy GlitchTip** on `.166` (Django + Celery + beat + Postgres + Redis via compose, behind Traefik at
   e.g. `errors.restormel.dev`). Create org/project, obtain DSN, store DSN in **Infisical** (not in repo).
3. **Instrument the app** — add `@sentry/sveltekit` to the dashboard with the **GlitchTip DSN**
   (`hooks.client.ts` + `hooks.server.ts` + `+error`). Keep basic exception capture only (matches what
   PostHog does today); skip performance tracing / replay (not in use, and GlitchTip's support is partial).
   *This is a later high-risk-security-reviewed task, not part of this plan.*
4. **Verify** errors arrive in GlitchTip from prod (trigger a test exception), and that the **GlitchTip →
   Loki webhook** lands error events in Grafana.
5. **Reconcile with PostHog.** Decide whether PostHog `handleError` capture is **removed** (GlitchTip owns
   errors) or **kept** (PostHog for product-analytics-linked errors, GlitchTip for engineering triage). Avoid
   double-capture noise. Update `governance/soa.md` A.5.7/A.5.25/A.8.15/A.8.16 to reflect the *actual* tool.
6. **Update governance** — GlitchTip is a new **self-hosted asset + processor**: add to
   `governance/asset-inventory.yaml`, `suppliers.yaml`, `ropa.yaml`, and the privacy notice (error payloads
   may contain user context / IPs — DPIA-lite consideration). The `notify-subprocessor-change.mjs` notifier
   fires on `suppliers.yaml` changes.

**Rollback condition:** GlitchTip is greenfield, so "rollback" = **keep PostHog Error Tracking as the error
system and shelve GlitchTip** if (a) GlitchTip ingest proves unreliable under prod load on the shared build
box, (b) its Postgres/Redis footprint pushes the box past safe headroom, or (c) error payloads raise a
data-protection concern not resolved by scrubbing. There is no Sentry to "keep temporarily" — the safe state
is the status quo (PostHog).

**Feature-coverage check (what we'd actually use):** today only **basic exception capture** is in use (via
PostHog). GlitchTip covers that fully (Sentry-SDK ingest, issue grouping, releases, source maps). Features
*not* used and therefore not a gap: performance tracing, session replay, profiling, cron monitors. So
**GlitchTip has no feature gap for our actual usage** — and neither does Bugsink.

---

## E. Integration checklist

Per-source status from the integration audit. Effort is rough (one Claude Code session = ~½–1 day human-equivalent).

| Source | Exists? | Reachable? | Action required | Effort |
|---|---|---|---|---|
| **GlitchTip** (errors → Loki) | ❌ greenfield | — | Deploy on `.166`; configure outbound webhook → Alloy `loki.source.api`; label `{source=glitchtip}` | M |
| **Coolify** (container logs) | ✅ on `.150` | 🟡 private/tunnel | Ship Docker logs via **Alloy `loki.source.docker`** per box; Coolify itself has **no Prometheus `/metrics`** (would need a custom API exporter — defer) | S (logs) / L (metrics, optional) |
| **Hetzner nodes** (CPU/RAM/disk/net) | ❌ no node_exporter | ✅ private mesh | Use **Alloy `prometheus.exporter.unix`** on each box → `remote_write` to Prometheus (no separate node_exporter needed) | S |
| **Forgejo** (`/metrics`) | 🟡 built-in, **not enabled** | 🟡 internal on `.150` | Enable `[metrics]` in Forgejo `app.ini` (Coolify env `FORGEJO__METRICS__ENABLED=true`, optional bearer token); add Prometheus scrape | S |
| **Postgres** | 🟡 split | 🟡 | Self-hosted PGs on `.150` (Forgejo, restormel): add **`postgres_exporter`** sidecar. **Prod app DB is Neon (external) → no Prometheus metrics**; use Neon Console / Neon API polling or app-layer query timing. See gap. | M (self-hosted) / L (Neon) |
| **SvelteKit dashboard logs** | ✅ structured-ish (`[prefix]` + `[dashboard-perf]` JSON; testing-runs-server already JSON-per-line) | ✅ stdout→Docker | Tail via Alloy `loki.source.docker`. Quick win: converge dashboard logs to **JSON-per-line** for clean LogQL parsing | S (ship) / S (JSON-ify) |
| **PostHog EU** (errors+analytics) | ✅ **live** (`hooks.server.ts:337`) | ✅ `eu.i.posthog.com` | Optional: PostHog **webhook → Alloy `loki.source.api`** to mirror chosen events into Loki for unified alerting (analytics stays in PostHog UI). Decide overlap with GlitchTip (§D.5) | S (optional) |

Legend: S ≈ small (hours), M ≈ medium (≈1 session), L ≈ large (multi-session / custom code).

**Key gaps called out:**
- **Neon gives no Prometheus metrics.** DB observability for prod is limited to Neon's own console unless we
  poll the Neon API into Prometheus (custom) — *or* until the planned migration off Neon to self-hosted
  Postgres (see `database-strategy` roadmap), after which `postgres_exporter` works directly.
- **Coolify exposes no Prometheus endpoint** — container *logs* are easy via Alloy; Coolify *metrics* would
  need a custom API exporter (defer; low value at our scale).
- **node_exporter is absent everywhere** — Alloy's unix exporter closes this without an extra component.

---

## F. Delivery stages

Re-ordered from the brief because **Sentry decommission is a no-op** and **GlitchTip is no longer a blocker
for anything**. Each stage is sized to ≈ one Claude Code session. Dependencies noted.

> **Stage 0 — Live capacity confirmation (PREREQUISITE, blocks all).**
> With founder-approved SSH, capture `free -h`, `df -h`, `docker stats` on `.166` (and `.150`/`.167` for
> baseline), confirm build-box disk size, and confirm the disk-guard cron is replicated on `.166`. Decide
> finally whether co-location holds or a 4th box is needed. *No build proceeds until this is green.* (Flag F-1.)

| Stage | Scope | Depends on | Notes |
|---|---|---|---|
| **1 — Observability core** | Deploy Grafana + Loki + Prometheus + central Alloy on `.166` via Coolify/compose; Traefik routes (`grafana.restormel.dev`); persistent dirs under `/opt/*`; Telegram contact point | Stage 0 | The spine. Nothing else is useful without it. |
| **2 — Host + Alloy agents** | Alloy agent on `.150` & `.167`: unix metrics `remote_write` + Docker logs `loki.write` to `.166` over private mesh | Stage 1 | Gives host metrics + container logs for all boxes. |
| **3 — Service integrations** | Enable Forgejo `/metrics` + scrape; Traefik metrics; `postgres_exporter` for self-hosted PGs on `.150`; converge dashboard logs to JSON | Stage 2 | Per §E, priority order. Neon left as documented gap. |
| **4 — GlitchTip deploy** | GlitchTip (web+worker+beat+PG+Redis) on `.166`; Traefik route; DSN → Infisical; governance records (asset/supplier/ropa/privacy) | Stage 1 (independent of 2–3) | **Only after §G flag F-3 decision.** Can run parallel to 2–3. |
| **5 — GlitchTip → Loki webhook** | GlitchTip webhook → Alloy `loki.source.api` → Loki `{source=glitchtip}`; verify unified view in Grafana | Stage 4 + Stage 1 | The brief's unified-alerting requirement. |
| **6 — Alerting + backup extension** | Grafana unified alert rules (5xx spike, disk, RAM, error spike, target-down) → Telegram; **`restic-ops` repo + cron on `.166`**; restore-drill the new repo; external dead-man's-switch | Stages 2–5 | Fold the brief's "Stage 5 alerting" + "Stage 6 backup" together — they're small and related. |
| **7 — Reconcile + document** | Per §G F-4 (additive): keep Uptime-Kuma (feeding Grafana) + PostHog; reconcile PostHog vs GlitchTip error ownership (if GlitchTip adopted); amend `security-monitoring-roadmap.md` ("host metrics via Alloy→Prometheus, not Beszel") + SoA to reflect reality | Stage 6 | Replaces the brief's "Sentry decommission" (a no-op). No tool is retired. |

App instrumentation with the GlitchTip SDK (the `@sentry/sveltekit` wiring) is a **separate follow-on task**
gated by `restormel-high-risk-security` (touches `hooks.server.ts`), not folded into a stage here.

---

## G. Flags for founder decision

- **F-1 — Live capacity not yet measured (blocks build).** All sizing uses *documented* specs; no
  `free`/`df`/`docker stats` were run (no SSH per access rules). **Need approval to SSH `.166`/`.150`/`.167`
  for live figures** before committing to co-location. Especially: build-box disk size (undocumented) and
  whether the disk-guard cron exists on `.166`. *Recommended: approve a one-off read-only capacity check.*

- **F-2 — CI vs monitoring on one box.** The build box doubles as CI runner. Co-locating the Ops Centre means
  heavy builds and monitoring share CPU/RAM/disk. Acceptable at current build cadence; the alternative is a
  dedicated CX22/CX32 (≈ €4–9/mo). **Decision: accept co-location, or pay for separation?**

- **F-3 — GlitchTip vs Bugsink vs keep PostHog (the real "error tracking" decision).** Since there's no
  Sentry and **PostHog Error Tracking is already live and EU-hosted**, the genuine choice is three-way:
  - **GlitchTip** — most mature, Sentry-SDK-compatible, v6 (Feb 2026), well-documented Grafana webhook
    patterns. Heaviest footprint (Django+Celery+PG+Redis ≈ 4 containers). US *company*, AGPL OSS, **self-hosted
    on our EU infra → meets sovereignty** (data never leaves EU; the maintainer's nationality is irrelevant to
    where data lives).
  - **Bugsink** — European-built, Sentry-SDK-compatible, **single-process / SQLite-or-Postgres**, much lower
    footprint. Given we have **no Sentry baggage** and headroom is the binding constraint, Bugsink's
    simplicity is a real fit for a lean solo-operator stack. Runner-up only on maturity/ecosystem.
  - **Keep PostHog Error Tracking** — zero new infra, already wired. But PostHog EU Cloud is **EU-hosted
    SaaS** (PostHog Inc is US) — which sits in tension with the brief's "no US-hosted SaaS / open-source
    self-hosted only" ethos. *Self-hosting GlitchTip/Bugsink would actually improve sovereignty over the
    PostHog-cloud status quo for error data.*
  > **Recommendation:** if a dedicated error tracker is wanted, **GlitchTip** per the brief — but given the
  > greenfield reality + box headroom being the constraint, **Bugsink is a legitimate lean alternative worth a
  > closer look.** This is close enough to warrant an explicit founder call.

- **F-4 — Additive/layered (recommended) vs replace.** The Ops Centre layers **on top of** the approved
  monitoring roadmap rather than replacing it. **Keep PostHog (analytics + errors), Uptime-Kuma (probes,
  surfaced in Grafana via its `/metrics`), Telegram (alert channel), fail2ban/Traefik (host defence), and
  the external dead-man's-switch.** The *only* thing not built is **Beszel** — and only because Alloy
  (added for logs) supplies host metrics to Prometheus for free, making a separate Beszel agent redundant.
  Beszel was never deployed, so this discards no live work. **Recommend: confirm the additive design** (this
  is a small amendment to the roadmap — "host metrics via Alloy→Prometheus instead of Beszel" — not a
  rewrite). The earlier "supersede" framing is withdrawn.

- **F-5 — Sovereignty footnote.** Two SaaS dependencies touch telemetry today and sit slightly outside the
  "fully self-hosted EU" ethos: **PostHog EU Cloud** (analytics+errors) and **Neon** (prod DB, AWS eu-west-2).
  Neither is in scope to change here, but the Ops Centre is the moment to note them — self-hosting error
  tracking narrows the PostHog dependency, and the planned Neon→self-hosted-Postgres migration would close the
  DB metrics gap *and* the DB-sovereignty gap together.

- **F-6 — Pre-existing backup gaps to fix opportunistically:** `.167` restic-surreal script not
  version-controlled; no native `forgejo dump`; no BCP/DR policy doc; restore drill never executed. Cheap to
  fold into Stage 6.

---

## Appendix — discovery sources (read-only, 2026-06-19)

- Topology / headroom: `governance/asset-inventory.yaml`, `docs/infra/suite-server-sizing.md`,
  `.forgejo/workflows/deploy-dashboard.yml`, `restormel-infra-access` skill. ⚠️ `docs/runbooks/infra-alert-response.md`
  shows the **old inverted topology** (.150↔.167) — superseded by the 2026-06-17 split.
- Sentry/PostHog: full grep of both repos; `apps/dashboard/src/hooks.{client,server}.ts`,
  `docs/infra/security-monitoring-roadmap.md` (B1), `governance/soa.md`.
- Backup: `scripts/backup/buildops-backup.sh`, `scripts/backup/buildops-backup.cron`,
  `.claude/skills/restormel-backup/SKILL.md`, `governance/asset-inventory.yaml` (AST-012),
  `planning/infra-migration-rollback-runbook.md`.
- Integration: `apps/dashboard/src/lib/server/{posthog-capture.ts,db-adapter.ts}`,
  `apps/dashboard/src/lib/debug/server-perf.ts`, `packages/testing-runs-server/src/logger.ts`,
  `deploy/docker-compose.coolify.yml`.

**No SSH, no infra changes, no config writes were performed during discovery.**
