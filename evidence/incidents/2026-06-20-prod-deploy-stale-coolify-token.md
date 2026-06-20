---
id: REC-INC-006
title: "Incident — Prod dashboard/worker deploys silently failing for ~14 merges (Forgejo per-job network can't reach the on-box Coolify API; stale COOLIFY_TOKEN a separate contributing issue)"
class: evidence
owner: "@adam"
approved-by: "@adam"
approved-on: 2026-06-20
status: closed
classification: internal
control-tier: 3
created: 2026-06-20
last-reviewed: 2026-06-20
review-interval: P12M
retention: P6Y
related: [REC-TPL-004]
---

# Incident — Prod deploys silently failing (runner per-job network ↔ on-box Coolify)

> Filed from REC-TPL-004. Append-only once closed. Severity **high** (the production deploy
> pipeline was down — no merge reached prod for ~14 deploys — but there was **no outage**:
> prod kept serving the last-good code, no data loss, no confidentiality/integrity impact).
> The streak was **silent** (no alert), which is the key systemic gap. **NB: root cause was
> revised during investigation** — the first hypothesis (stale `COOLIFY_TOKEN`) was a *real but
> separate* problem; the actual deploy blocker is a **network reachability** failure (below).

- **Detected:** 2026-06-20 — agent, while shipping Phase 3 to prod. The `deploy-dashboard.yml`
  `deploy-prod` job had **failed on the last ~14 consecutive merges** (every `dashboard-v*` tag
  since ~commit `d289fbb0`), including #181 (Phase 3). **Reported by:** agent (Phase 3 deploy
  verification). **Severity:** high. **Recurring:** yes — every deploy since the infra migration.

- **What happened:** On each main merge touching `apps/dashboard/**` or `packages/**`,
  `auto-tag-release.yml` creates a `dashboard-v*` tag (this step **succeeded** every time), which
  triggers `deploy-dashboard.yml`'s `deploy-prod` job. That job runs in a **fresh Forgejo
  per-job bridge network** and `curl`s the on-box Coolify API to trigger the deploy. The curl
  **black-holes — TCP connect never completes — and the job dies after ~2m15s** (the per-job
  network's route to Coolify times out). So tags/releases were created but **no deploy ever
  ran** — prod stayed on pre-failure code.

- **Impact:** Merges to `main` were **not reaching production** — the prod dashboard
  (`deibtxcn1kl5flye5d3koiln`) and worker (`s5cf1bkq5egny7r4jqbxc1gn`) on Box A `.167` were stuck
  on old code. Phase 3 and every interim merge were absent from prod until manually deployed.
  **No outage, no data loss, no confidentiality/integrity impact** — prod served the last
  good build throughout.

- **Response / investigation (timeline, 2026-06-20 — diagnosis evolved):**
  1. Ruled Phase 3 out: #181's deploy `failure` matched the prior ~13.
  2. **Confirmed Coolify itself healthy** — triggered the deploy directly via the Coolify API
     (valid Infisical token): prod **dashboard + worker** redeployed to main HEAD `744fec7d`
     (Phase 3 Stages 0–7) → healthy, rolling updates completed. **Phase 3 live.**
  3. **Hypothesis A — stale token (WRONG as the blocker):** a read-only test from the box showed
     Coolify returning HTTP 401 to an unauthenticated call, and a stale **repo-level**
     `COOLIFY_TOKEN` (06-13) was found shadowing the org one. Re-synced + later fully cleaned the
     token (single valid org+repo secret). **A workflow_dispatch verify still failed** → token
     was not the deploy blocker.
  4. **Hypothesis B — Coolify API address (WRONG):** changed the deploy from the Coolify bridge
     gateway `10.0.1.1:8000` to the box's private IP `172.16.0.2:8000` (PR **#188**, merged).
     A verify from `main` **still timed out at ~2m20s** → address was not the blocker either.
  5. **Confirmed root cause from the actual job log:** the deploy job container runs on an
     **ephemeral per-job network** (`FORGEJO-ACTIONS-TASK-…-deploy-prod-network`); the run sat
     for **2m15s then failed** = TCP connect timeout. A *manually-created* bridge on the same box
     reaches Coolify instantly (HTTP 401), but the **runner's per-job network cannot reach the
     on-box Coolify at all** (neither `10.0.1.1` nor `172.16.0.2`). Attempts to catch a *live*
     per-job network to isolate the exact mechanism were thwarted by runner-queue timing
     (capacity 2) — left unresolved because the resolution path (below) retires the mechanism.

- **Root cause (corrected):** The push-based deploy depends on a **CI per-job container reaching
  the on-box Coolify control-plane API**, and the **Forgejo runner's ephemeral per-job network
  cannot route to that on-box service** (connect timeout). Internet egress from those networks
  works; reaching the host's own Coolify does not. The exact Docker-networking mechanism (why the
  per-job network specifically can't reach the host while an ad-hoc bridge can) was **not fully
  isolated**. The **stale `COOLIFY_TOKEN` was a genuine, separate misconfiguration** (Coolify's
  token rotated into Infisical during the `.167` migration but not into Forgejo Actions; a stale
  06-13 repo-level secret also shadowed the org one) — found and fixed — **but it was never the
  deploy blocker**: the connection never completed regardless of the token. No deploy-failure
  alert existed, so the broken pipeline went unnoticed for ~14 deploys.

- **Remediation (done / interim):**
  1. **Phase 3 deployed manually** (dashboard + worker → `744fec7d`) — live, healthy.
  2. **`COOLIFY_TOKEN` cleaned** — deleted the stale/shadowing entries, single valid org+repo
     secret (closes the separate credential issue).
  3. **PR #188 merged** — deploy targets `172.16.0.2:8000` (more robust than the bridge gateway,
     outside the docker pool) — does not fix the per-job-network reachability alone, but is the
     correct address for when reachability is restored.
  4. **Interim operating mode:** **manual Coolify deploys** (reliable, ~12 min) for any merge to
     ship to prod until auto-deploy is restored.

- **Resolution path (chosen):** **Superseded by the K3s / Argo CD GitOps migration** (target
  design + PRs #182–186; pipeline in #184). Coolify is retired and the **push** deploy (CI →
  on-box API) is replaced by **Argo CD pull** (CI builds → pushes image → bumps the manifest in
  git → in-cluster Argo CD syncs; prod gated via an in-cluster PostSync hook). That eliminates the
  failing path — **no CI step needs to reach an on-box control-plane API** — so this class of
  failure cannot recur. Fixing the *current* Coolify path (reconfigure the runner's job-network +
  restart) was **deliberately declined** as not worth the blast radius on a soon-to-retire
  mechanism.
  - **Migration INVARIANT (carry into the migration work):** the new pipeline must stay
    **outbound-only / pull-based** — never reintroduce a "runner job container → on-box
    control-plane API" step.

- **Follow-ups:**
  - **Restore hands-off deploy via the K3s/Argo migration**; until then, **manual deploys**. *(open)*
  - **Migration prereq:** a **docker-capable runner** for image builds (current runner has no
    docker socket — #184 flag). *(open)*
  - **Add a deploy-failure ALERT** — the streak was silent for ~14 merges. Notify on deploy/CI
    failure (Telegram/PostHog); carry into the new pipeline too. **Key systemic gap.** *(open — PBI)*
  - **`COOLIFY_TOKEN` deduped/cleaned** (single valid org+repo). *(done)*
  - **Token-rotation runbook:** rotating any credential must update **all** consumers (Infisical
    **and** Forgejo Actions repo+org). *(open)*
  - **Surface HTTP status in the deploy step** (drop bare `curl -sf`; log code+body) — would have
    shown "timeout" vs "401" immediately. *(open — applies to the new pipeline)*
  - **Risk register:** annotate `governance/risk-register.yaml` — change-management/availability:
    a deploy-mechanism dependency (runner→on-box API) silently broke prod auto-deploy after the
    infra migration. *(stage with a follow-up)*
  - **Closed:** 2026-06-20 (Phase 3 live; root cause identified as per-job-network ↔ on-box-Coolify
    reachability; resolution path = K3s/Argo migration; interim = manual deploys).
