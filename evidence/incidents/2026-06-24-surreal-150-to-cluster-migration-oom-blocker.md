---
id: REC-INC-019
title: "Migration — SurrealDB .150 → K3s cluster: export verified, import blocked by surreal-0 2Gi OOM"
class: evidence
owner: founder
status: open
classification: internal
control-tier: 3
created: 2026-06-24
last-reviewed: 2026-06-24
approved-by: founder
approved-on: 2026-06-24
retention: P6Y
related: [REC-TPL-004, REC-INC-002]
---

# Migration — SurrealDB `.150` → K3s cluster (data load) — export OK, import OOM-blocked

> Filed from REC-TPL-004 (planned-migration execution that hit a service-availability fault on the
> target). Append-only once filed. Pairs with restormel-keys **PR #311** (prep artifacts + cutover
> runbook). Severity **low** — confined to the in-cluster target DB (not yet a prod consumer);
> live prod (restormel.dev, usesophia.app) stayed **HTTP 200 throughout**; source `.150` untouched.

- **Detected / window:** 2026-06-24 ~17:55–19:10 UTC, during founder-APPROVED execution of the
  SurrealDB `.150` → cluster migration (move the live philosophy/STOA graph off `.150` and populate
  the EMPTY in-cluster graph that Sophia-on-K3s already serves). **Reported by:** migration agent.
  **Severity:** low (no data loss; no confidentiality/integrity impact; source intact; prod green).

- **What happened:**
  - **EXPORT — SUCCESS, verified.** Fresh `surreal export` of `.150` `main/sophia`
    (`https://surreal.restormel.dev`, root, v3.1.4) → **608,977,907 bytes (~609 MB)**, **61 DEFINE
    TABLE / 312 INSERT**, **272,498 records across 56 populated tables** (61 defined). Matches PR
    #311's dry-run exactly. Source root creds resolved from Infisical `restormel-ops`/prod
    (`SURREAL_BOX_URL` = wss://surreal.restormel.dev, `SURREAL_BOX_ROOT_USER/PASS`, NS `main` / DB
    `sophia`) — staged into a scoped in-cluster ESO-equivalent k8s Secret `surreal-src-150`
    (`SURREAL_SRC_URL/USER/PASS`) consumed only by the import Job.
  - **IMPORT — BLOCKED.** Every attempt to load the export into the in-cluster `surreal-0`
    (StatefulSet `surreal`, ns `data`, **2Gi memory limit**) ended in surreal-0 being
    **OOM-killed (exit 137)**, partial load, and the importer connection dropping mid-stream.
    surreal-0 restarted **9 times** over the window (each time it recovered, ready, on the 20.8 GB
    PVC; no data corruption — partial loads were dropped + the `sophia` DB recreated clean each time).
  - **Target left CLEAN:** in-cluster `main/sophia` reset to **0 tables** (empty) at close, ready for
    the gated re-run; the partial 8-table load from the first attempt was removed.

- **Impact:** In-cluster SurrealDB (`surreal-0`, ns `data`) saw repeated ~few-second restarts during
  the import window. **No prod consumer is yet pointed at it** (DNS `surreal.restormel.dev` still →
  `.150`; Restormel dashboard targets are per-workspace in Postgres, not the cluster). Sophia-on-K3s
  reads the in-cluster graph and was already serving EMPTY before/after (the condition this migration
  exists to fix — unchanged, not worsened). restormel.dev and usesophia.app verified **HTTP 200**
  before, during, and after. Source `.150` (`77.42.125.150`) was **read-only export only** — fully
  intact and WARM as rollback.

- **Root cause:** SurrealDB's HTTP `/import` (and `/sql`) buffer and process a whole request in
  memory, and **`INSERT RELATION` records (in/out record-link resolution) are markedly more
  memory-intensive per record than NORMAL inserts.** A single 15.6 MB `claim` INSERT (1,000 NORMAL
  records) imports fine under 2Gi; but relation-heavy chunks OOM 2Gi even when shrunk to ~2 MB /
  ~2,000 records (table `about_subject`/`active_in_period` etc. carry ~23.5 K relations in 4 MB).
  The full 609 MB single-stream `surreal import` (PR #311's Job, Option A) OOMs immediately.
  Net: **the import cannot complete within surreal-0's current 2Gi limit at any practical chunk
  size** — the target needs more memory for this one-time bulk load. (Also found + fixed en route:
  PR #311's Job used `command: ["/bin/sh", …]` on the **distroless** `surrealdb/surrealdb:v3.1.4`
  image → `StartError` `/bin/sh: not found`; the working Job invokes `/surreal` directly.)

- **Response (actions + timeline):**
  1. Verified prod green + cluster reachable (KUBECONFIG k3s-create); read PR #311 Job + runbook.
  2. Resolved `.150` source creds from Infisical (scoped, values never printed); created scoped
     in-cluster Secret `surreal-src-150`. Confirmed cluster `main/sophia` EMPTY and both engines
     v3.1.4.
  3. Applied PR #311's import Job → `/bin/sh` StartError (distroless). Authored a corrected,
     reviewable in-cluster Job (`/surreal` direct; export-from-150 init + busybox size-guard).
  4. Iterated the load method against repeated surreal-0 OOMs: full-stream → byte-chunked HTTP
     `/sql` → record-sub-batched → **native `/import` of line-boundary chunk files** (correct
     SurrealQL parsing, no laptop/port-forward in the data path). Each method got further; all
     ultimately OOM-killed surreal-0 on the relation-heavy tables.
  5. Confirmed export integrity (272,498 / 56) directly against `.150`. Reset cluster `sophia`
     clean. Staged the gated re-run artifacts. Kept `.150` warm.

- **Follow-ups (gated — founder/operator GO required; exact commands handed to orchestrator):**
  1. **Raise `surreal-0` memory for the bulk load** (StatefulSet `surreal`, ns `data`): `limit`
     **2Gi → 6Gi**, `request` 512Mi → 1Gi. Node `restormel-sovereign-master1` has ~16 GB (≈6.2 GB
     requested) — ample headroom. This is the unblock. Restore to 2–3Gi after verification (optional).
  2. **Apply the corrected import Job** (`surreal-chunked-import`, ns `data`) — secret
     `surreal-src-150` + ConfigMap `surreal-import-script` already in cluster. Verify cluster
     `main/sophia` == **272,498 / 56**.
  3. Confirm Sophia-on-K3s + dashboard now read the populated graph (no longer empty).
  4. **DNS flip** `surreal.restormel.dev` A `77.42.125.150` → `135.181.25.76` (cluster ingress),
     300 s TTL, via Hetzner CLOUD token (`HCLOUD_TOKEN`). Keep `.150` WARM as rollback.
  5. File the closing addendum here (counts matched, cutover done) and sync the
     `sophia-surreal-backup` Argo app.

- **Closed:** open (export done + verified; import + DNS gated on the surreal-0 memory raise).

---

## Addendum — 2026-06-24 ~19:50 UTC — IMPORT COMPLETE & VERIFIED (append-only)

The gated blocker was cleared: the **6Gi memory raise was made DURABLE in the GitOps source**
(cluster-addons / sovereign-stack StatefulSet `surreal`, limit 2Gi→**6Gi**, request 512Mi→**1Gi**),
confirmed live on both the StatefulSet spec and the running `surreal-0` pod with selfHeal keeping it
(a `kubectl patch` alone had been reverting — the raise had to live in git). With 6Gi the
relation-heavy tables no longer OOM.

- **Import:** ran the corrected in-cluster Job (`surreal-chunked-import`, distroless-fixed, export
  fresh from `.150` → split to line-boundary chunks with `EXPLODE=1`/`MAX_RECS=500` so big
  `INSERT [...]`/`INSERT RELATION [...]` arrays are sub-batched → native `/import`). Completed
  **113 chunks in 187 s, Job `Complete 1/1`, surreal-0 restarts=0 (no OOM).**
  - Fixed en route (now in the importer): SurrealDB exports strings with **double quotes**
    (`"Russell's Paradox"`) when text contains an apostrophe; the record-splitter now tracks both
    `'` and `"` delimiters (validated: 287 big lines, 0 count-mismatches, 0 depth-imbalances).
- **VERIFICATION — EXACT MATCH (surreal-root, in-cluster):** cluster `main/sophia` =
  **272,498 records / 56 populated tables / 61 defined** — **per-table delta vs `.150` source = 0
  across all 61 tables.** Graph traversal intact (`claim ->about_subject-> subject` resolves);
  scoped DB user `importer` (Sophia's auth) present.
- **Sophia-on-K3s fix confirmed:** Sophia's `SURREAL_URL = http://surreal-db.data:8000` (NS `main`
  / DB `sophia`) — the exact path now returns `claim` count 33,980 (was the EMPTY graph). The
  in-cluster graph is **populated and queryable** — the empty-graph condition is resolved.
- **Prod stayed green throughout** (restormel.dev 200, usesophia.app 200). Source `.150` untouched +
  WARM as rollback. **DNS NOT flipped** (`surreal.restormel.dev` → `77.42.125.150`) — the gated
  flip → `135.181.25.76` is the coordinator/founder's step (runbook §5.4), after which file the
  final cutover line + sync `sophia-surreal-backup`.

- **Status:** data load **DONE & VERIFIED**. Remaining gated cutover steps: DNS flip + (optional)
  restore surreal-0 limit to ~3Gi post-cutover + sync `sophia-surreal-backup` Argo app.
