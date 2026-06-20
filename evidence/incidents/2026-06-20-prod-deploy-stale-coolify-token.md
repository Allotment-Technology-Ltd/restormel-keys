---
id: REC-INC-006
title: "Incident — Prod dashboard/worker deploys silently failing for ~14 merges (stale Forgejo Actions COOLIFY_TOKEN → 401)"
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

# Incident — Prod deploys silently failing (stale Forgejo Actions COOLIFY_TOKEN)

> Filed from REC-TPL-004. Append-only once closed. Severity **high** (the production
> deploy pipeline was down — no merge reached prod for ~14 deploys — but there was **no
> outage**: prod kept serving the last-good code, no data loss, no confidentiality/integrity
> impact). The streak was **silent** (no alert), which is the key systemic gap.

- **Detected:** 2026-06-20 — agent, while shipping Phase 3 to prod. The
  `deploy-dashboard.yml` "Trigger Coolify production deploy" job was found to have **failed
  on the last ~14 consecutive merges** (every `dashboard-v*` tag since ~commit `d289fbb0`),
  including #181 (Phase 3). **Reported by:** agent (Phase 3 deploy verification).
  **Severity:** high. **Recurring:** yes — every deploy since the infra migration.

- **What happened:** On each main merge that touches `apps/dashboard/**` or `packages/**`,
  `auto-tag-release.yml` creates a `dashboard-v*` tag (this step **succeeded** every time),
  which triggers `deploy-dashboard.yml`'s `deploy-prod` job. That job's Coolify API call
  returned **HTTP 401** and `curl -sf` failed the job (~2m15s in = runner start-up + instant
  auth failure). So tags/releases were created but **no deploy ever ran** — prod stayed on
  pre-failure code.

- **Impact:** Merges to `main` were **not reaching production** — the prod dashboard
  (`deibtxcn1kl5flye5d3koiln`) and worker (`s5cf1bkq5egny7r4jqbxc1gn`) on Box A `.167` were
  stuck on old code. Phase 3 and every interim merge were absent from prod until manually
  deployed. **No outage, no data loss, no confidentiality/integrity impact** — prod continued
  serving the last successfully-deployed build throughout.

- **Response (timeline, 2026-06-20):**
  - Found #181's prod deploy `failure` matched the prior ~13; ruled Phase 3 out as the cause.
  - **Confirmed Coolify itself healthy** by triggering the deploy directly via the Coolify
    API (valid token from Infisical): prod **dashboard** redeployed to main HEAD `744fec7d`
    (all of Phase 3 Stages 0–7) → container healthy, rolling update completed. **Phase 3 live.**
  - Founder-authorised the **worker** deploy: redeployed to `744fec7d` → rolling update
    completed. Both prod apps now on Phase 3.
  - **Root-caused via read-only SSH to `.150`** (Coolify control plane): `curl` to the
    runner's `http://10.0.1.1:8000` **and** `http://localhost:8000` both returned **401**;
    `:8000` bound on `0.0.0.0` (docker-proxy); the `coolify` docker network gateway **is**
    `10.0.1.1`. Coolify is reachable and responding — it simply **rejects the token**. Network
    / bind hypothesis ruled out → **authentication failure (stale token)**.
  - **Remediation:** re-synced the Forgejo Actions **`COOLIFY_TOKEN`** (repo **and** org) from
    the valid Infisical value (`PUT … HTTP 204`). Also found a **repo-level `COOLIFY_TOKEN`
    dated 06-13 shadowing the org-level one** (06-16) — repo secrets win in Forgejo — and
    updated both.

- **Root cause:** **Credential drift** — Coolify's API token was rotated during the infra
  migration to Box A `.167` (2026-06-17, REC-PLAN-012) and the topology update (2026-06-19).
  **Infisical was updated** with the new token (so manual/agent deploys worked) **but the
  Forgejo Actions `COOLIFY_TOKEN` secret was not**, so every workflow-driven deploy received
  HTTP 401. A stale **repo-level** `COOLIFY_TOKEN` (06-13) additionally shadowed the
  org-level secret (06-16), so even the 06-16 rotation would not have taken effect for this
  repo. `curl -sf` surfaces 401 only as a non-zero exit (no body), and there was **no
  deploy-failure alert**, so the broken pipeline went unnoticed for ~14 deploys.

- **Remediation (done):**
  1. Manual Coolify deploys of **dashboard + worker** to main HEAD `744fec7d` — Phase 3 live
     on prod, both apps healthy.
  2. Re-synced Forgejo Actions `COOLIFY_TOKEN` (**repo + org**) from Infisical (`204`).

- **Follow-ups:**
  - **Verify auto-deploy end-to-end** on the next merge (or a `workflow_dispatch=prod`) —
    confirm the `deploy-prod` job goes green with the re-synced token. *(open)*
  - **Remove the duplicate/shadowing repo-level `COOLIFY_TOKEN`** so there is a single source
    of truth (prefer org-level) and investigate why two exist. *(open)*
  - **Add a deploy-failure ALERT** — the failure streak was silent for ~14 merges. Notify on
    `deploy-dashboard.yml` job failure (Telegram/PostHog) so a broken deploy pipeline is loud.
    This is the **key systemic gap**. *(open — PBI)*
  - **Token-rotation runbook:** when rotating Coolify (or any) credentials, update **all**
    consumers — Infisical **and** Forgejo Actions (repo **and** org) secrets. Add to the
    secret-rotation checklist. *(open)*
  - **Make the deploy step surface the HTTP status** (drop bare `curl -sf`; log the Coolify
    status code + body on failure) for faster future diagnosis. *(open)*
  - **Risk register:** annotate `governance/risk-register.yaml` — credential drift after infra
    migration silently broke the prod deploy pipeline (change-management / availability).
    *(stage with a follow-up)*
  - **Closed:** 2026-06-20 (Phase 3 live on prod; `COOLIFY_TOKEN` re-synced repo+org). Pending
    the end-to-end auto-deploy verification on next deploy.
