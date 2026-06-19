---
id: REC-INC-002
title: "Incident — SurrealDB (surreal.restormel.dev) intermittent 504 under suspected CI/build contention"
class: evidence
owner: founder
status: open
classification: internal
control-tier: 3
created: 2026-06-18
last-reviewed: 2026-06-18
review-interval: P12M
approved-by: founder
approved-on: 2026-06-18
retention: P6Y
related: [REC-TPL-004, RISK-001, RISK-009, REC-PLAN-012, AST-009, AST-010, AST-014]
---

# Incident — SurrealDB 504 (Traefik gateway timeout), recovers to 200; suspected CI/build noisy-neighbour

> Filed from REC-TPL-004. Append-only once filed. Severity **medium** — intermittent
> availability degradation of the verification/knowledge-graph store (`surreal.restormel.dev`);
> recovers without intervention. No data loss, no confidentiality/integrity impact.
> **STATUS: OPEN** — root cause is architectural (confirmed) but the numeric resource
> bottleneck on the affected box could not be measured this session (see *Investigation —
> access blocker*). Recommended fix below; verification of the resource pressure (RAM/swap vs
> CPU vs disk-I/O) is an open follow-up requiring shell access to Box B (.150).

- **Detected:** 2026-06-18 (recurring) — operator-reported pattern: `surreal.restormel.dev`
  intermittently returns **504** (Traefik gateway timeout) then recovers to **200** a few minutes
  later. **Reported by:** operator. **Severity:** medium (intermittent availability,
  self-recovering, single internal data-store endpoint).

- **What happened:** SurrealDB served behind the Coolify-managed Traefik proxy intermittently
  fails to answer within Traefik's upstream timeout, producing a **504**. The window correlates
  (operator hypothesis) with CI / Coolify **build activity on the same host** — i.e. a
  noisy-neighbour resource-contention pattern. This is the failure mode named in risk-register
  **RISK-001** ("CI noisy-neighbour OOM/disk").

- **Impact:** `surreal.restormel.dev` (SurrealDB = AST-014, the Restormel verification /
  knowledge-graph store) intermittently unavailable for a few minutes at a time, then
  self-recovers. Affects verification/graph reads that depend on SurrealDB (e.g.
  `buildWorkspaceGraphStore` / `surreal-graph-store.ts`). **Availability only** — read/serve
  path; no data loss, no confidentiality or integrity impact. The live product (`restormel.dev`)
  runs on a *different* box (Box A / .167, AST-009) and is not directly implicated.

- **Investigation (2026-06-18, read-only):**

  **Topology — corrected (load-bearing finding).** DNS resolves the affected service to a
  *different* box than the task framing and the older skills assumed:

  | FQDN | Resolves to | Box | Role (per `governance/asset-inventory.yaml`) |
  |------|-------------|-----|-----|
  | `surreal.restormel.dev` | **77.42.125.150** | **Box B (.150, AST-010)** | build/ops: Forgejo, **Forgejo CI runner**, Coolify, monitoring, Infisical, **SurrealDB (AST-014)** |
  | `restormel.dev` (live product) | 77.42.124.167 | Box A (.167, AST-009) | prod runtime: dashboard, worker, app Postgres, Ory Hydra |
  | `secrets.restormel.dev`, `git.allotmentology.tech` | 77.42.125.150 | Box B (.150) | (corroborates Box B = build/ops) |

  This matches the canonical asset inventory: **AST-014 SurrealDB was "migrated from .167 in
  Phase 2"** and now lives on **Box B (.150)** *alongside the Forgejo CI runner and Coolify
  builds* (AST-010 notes). DNS is authoritative; SurrealDB self-reports `surrealdb-3.1.4` and
  `surreal.restormel.dev/version` → 200. The premise that SurrealDB lives on the ".167 surreal
  box" is **stale** — it predates the Phase-2 migration. (`restormel-backup` and
  `restormel-infra-alert-response` skills, and the SSH-approval target, still label .167 as
  "surreal" and need correcting — see follow-ups.)

  **Current health (this session, 2026-06-18 ~21:52 UTC).** `surreal.restormel.dev/health`
  sampled **12×** → **12/12 HTTP 200**, total time **0.173–0.194 s** (TTFB ~0.18 s). No 504
  reproduced at observation time — consistent with an *intermittent*, build-window-coupled
  symptom rather than a steady-state failure. So the box was not under contention when sampled.

  **Access blocker (why no box numbers this session).** The bottleneck, if real, is on the box
  that now hosts SurrealDB = **Box B (.150)**. Two independent blocks prevented gathering the
  required `free -m` / `swapon` / `df -h` / `uptime` / `docker stats` / OOM-log / SurrealDB
  RestartCount evidence:
  1. **Approval scope.** The operator's explicit SSH approval named **.167 only**. Reads against
     .150 were correctly auto-denied by policy (target not named in approval). The box that
     actually needs inspecting was therefore out of scope.
  2. **Key rejection on .167.** SSH to **.167** (the approved box) was rejected —
     `Permission denied (publickey)` for `deploy`, `root`, and `admin` with
     `~/.ssh/id_hetzner_allotment` (key fingerprint `SHA256:ZQuSHL7mPoeb…`). Port 22 is reachable
     (TCP connects; not a firewall block) — the key is simply not in .167's `authorized_keys`.
     The same key *does* authenticate to **.150** (an active Coolify ControlMaster session to
     `deploy@77.42.125.150` is up and answered `hostname` = `allotmentology-pilot`), so the key
     is valid for .150, not .167.

     Net: the *approved* box (.167) won't take the key and no longer hosts SurrealDB; the box
     that *does* host SurrealDB (.150) is outside the approval. Coolify's API (reachable on the
     existing `localhost:8000` tunnel) returns **401** without a bearer token, so the
     server/build-schedule list could not be read either.

- **Root cause:**
  - **Architectural (confirmed): SurrealDB is co-located with the CI/build plane on Box B
    (.150).** After the REC-PLAN-012 split moved the *product* to Box A (.167), Phase 2 moved
    **SurrealDB onto the build/ops box (.150)** that also runs the **Forgejo CI runner and
    Coolify builds**. A build burst (buildkit + image pulls + parallel jobs) competes with
    SurrealDB for RAM/CPU/disk-I/O on the shared host; SurrealDB stalls past Traefik's upstream
    timeout → **504**; when the build finishes, resources free and it recovers → **200**. This
    *is* the RISK-001 "CI noisy-neighbour" failure mode — re-introduced on a different box by the
    Phase-2 SurrealDB placement (the split removed it from the *product* box but recreated it
    against *SurrealDB*).
  - **Resource dimension (UNCONFIRMED — open):** whether the binding constraint is **RAM/swap
    (OOM/thrash)**, **CPU saturation**, or **disk-I/O** was *not* measured (access blocker).
    Box B is documented as a Hetzner CX33 (per asset inventory) with swap added as an OOM cushion
    (RISK-001 treatment). The alert-response skill records 8 GB + 2 GB swap for the box it calls
    "surreal-box" (now stale) and notes "two parallel builds have OOM'd the box in the past" —
    suggesting RAM/swap is the historically observed constraint — but this must be confirmed with
    live numbers before any RAM-sizing decision is made.

- **Remediation / recommended fix (prioritized — NO infra changes made this session):**

  **Quick mitigations (decouple SurrealDB from build contention — do first):**
  1. **Pin Coolify builds OFF the SurrealDB host.** SurrealDB now shares Box B (.150) with the
     CI runner + Coolify builder. Schedule builds so they do not run on the host serving
     SurrealDB — e.g. constrain Coolify build placement, or move SurrealDB to the box that does
     *not* build (Box A / .167 prod runtime, which has spare capacity), restoring the intent of
     the split. This is the single highest-leverage action.
  2. **Give SurrealDB a memory reservation + a restart policy.** Set a Docker memory
     *reservation* (soft floor) and a sane `restart: unless-stopped`/`always` policy on the
     SurrealDB container so a build burst cannot evict or starve it, and so it recovers cleanly if
     OOM-killed. (Verify current RestartCount once .150 access is available — a non-zero count
     would confirm OOM kills.)
  3. **Serialise / cap CI build concurrency.** Limit the Forgejo act-runner to **1 concurrent
     build** (or cap buildkit parallelism) on Box B so a build burst can't co-occur and so peak
     RAM/CPU/I-O is bounded. The alert-response runbook already records that *two parallel builds*
     historically OOM'd this box.
  4. **Raise Traefik's upstream timeout for the SurrealDB router** as a stop-gap so brief
     contention spikes degrade latency instead of returning 504 (treats the symptom, not the
     cause — pair with 1–3).

  **Structural fix:** complete **REC-PLAN-012** so the verification spine (SurrealDB) does not
  share a host with the CI/build plane. The split already exists conceptually; Phase 2 placed
  SurrealDB on the *build* box, which is the regression to correct. Either keep SurrealDB on the
  prod box (.167) or stand it on its own, off the builder.

  **RAM sizing:** **Not recommended yet — and quite possibly the wrong lever.** A specific
  RAM-size recommendation is deliberately withheld because the resource dimension is unconfirmed.
  If, on measurement, Box B shows **swap actively used + OOM kills in `dmesg`/`journalctl` +
  SurrealDB RestartCount > 0 during build windows**, *then* it is RAM/swap-bound and an upsize
  (e.g. CX33 → a higher-RAM Hetzner tier) is justified — quantify from the peak `free -m` during a
  build. **If instead load-avg ≫ nproc with low swap use, it is CPU-bound; if `await`/iowait is
  high with RAM/CPU headroom, it is disk-I/O-bound — in either of those cases more RAM will NOT
  help**, and the fix is build de-confliction (mitigations 1–3) or faster/more CPU. Decoupling
  builds from SurrealDB (mitigation 1) is the correct first move regardless of which dimension
  binds.

- **Follow-ups:**
  - **[OPEN — needs .150 access]** Measure Box B (.150) under a build window: `free -m`,
    `swapon --show`, `df -h` (vs 80% disk-guard), `uptime`/`/proc/loadavg` vs `nproc`,
    `docker stats --no-stream`, OOM evidence (`dmesg -T | grep -iE 'oom|killed process'`,
    `journalctl -k`), and SurrealDB container `RestartCount` + `StartedAt`. Correlate spikes with
    Forgejo Actions / Coolify build timestamps via Beszel. *This names the numeric bottleneck and
    decides whether RAM upsize is warranted.* Requires either the .150 key to be authorised for an
    operator-named SSH approval, or the operator running the commands.
  - **[OPEN]** Fix the **stale `.167 = surreal` assumption**: SurrealDB is on **.150** post-Phase-2.
    Correct `restormel-backup` (topology table still says `.167 = surreal`), the
    `restormel-infra-alert-response` skill (calls .167 "surreal-box"), and the SSH-approval target
    for future SurrealDB investigations (should be .150). Also resolve the **AST-014 location
    PLACEHOLDER** in `governance/asset-inventory.yaml` (founder to confirm host = .150) and the
    matching wording in RISK-001 treatment (which still implies SurrealDB on the build box is
    intended — flag the noisy-neighbour regression).
  - **[OPEN]** Authorise (or rotate in) an SSH key for the investigating identity on `.167` if
    box reads there are expected, and/or confirm `.150` is the correct approved target going
    forward.
  - **[OPEN]** Decide build-placement policy in Coolify (pin builds off the SurrealDB host) and
    set act-runner concurrency = 1. (mitigations 1 + 3.)
  - **[OPEN]** Add a SurrealDB Docker memory reservation + restart policy (mitigation 2).
  - Links **RISK-001** (CI noisy-neighbour OOM/disk — single-box blast radius) and **RISK-009 /
    REC-PLAN-012** (infra split + SurrealDB migration).

- **Closed:** — (open; pending Box B resource measurement and build-decoupling decision)
