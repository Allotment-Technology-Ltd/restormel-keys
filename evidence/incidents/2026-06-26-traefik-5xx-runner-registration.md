---
id: REC-INC-021
title: "Traefik 5xx spike — on-cluster runner registration failures (self-resolved)"
class: evidence
owner: adam
status: closed
classification: internal
control-tier: 3
created: 2026-06-26
last-reviewed: 2026-06-26
review-interval: P12M
approved-by: adam
approved-on: 2026-06-26
retention: P6Y
---

# Incident — Traefik 5xx spike from on-cluster runner registration failures

- **Detected:** 2026-06-26 ~12:14 UTC — Alertmanager page `Traefik5xxSpike` (cluster Traefik edge 5xx rate >5% over 5m).   **Reported by:** Prometheus / Alertmanager (Ops Centre).   **Severity:** low.
- **What happened:** During bring-up of the new on-cluster Forgejo Actions runner (`k3s-oncluster`, namespace `forgejo-runner`) the act_runner repeatedly failed `RunnerService/Register` with HTTP 500. The registration token captured from the `forgejo actions generate-runner-token` CLI was mangled — the CLI writes a log line to stdout interleaved with the token, so the parsed value was truncated/invalid. ~8 failed Register calls in the `12:13:32`–`12:13:52` window pushed the edge 5xx rate to ~4.7–>5 %, tripping the page.
- **Impact:** None customer-facing. The only affected route was the internal runner-registration RPC `/api/actions/runner.v1.RunnerService/Register` on the on-cluster Forgejo backend. `git.allotmentology.tech` and `secrets.restormel.dev` served 200 throughout; no data affected, no user-facing degradation.
- **Response (timeline):** Pulled per-router Traefik access logs → all 5xx were the Register RPC on the forgejo backend. Bypassed the unreliable CLI parsing by reading the valid 40-char token directly from the `action_runner_token` DB table and re-creating the runner registration Secret. Runner registered ("declare successfully") at `12:14:00`; edge 5xx dropped to **0** immediately (0 / 80 requests over the following 2 minutes). Self-resolved — no remediation beyond completing the registration. Confirmed the alert cleared.
- **Root cause:** Manual runner-bootstrap token-extraction error (CLI stdout mixes a log line with the token) → repeated invalid-token registration attempts that the edge surfaced as 500s. Occurred during the crown-jewels Stage A Forgejo + Infisical on-cluster cutover (DNS flips of `git.allotmentology.tech` + `secrets.restormel.dev` → 135.181.25.76).
- **Follow-ups:** (1) Prefer DB- or API-sourced runner registration tokens over CLI-stdout parsing for any future runner provisioning. (2) Retire the legacy `.150`-world runners (`hetzner-build` / `hetzner-pilot`) so jobs route only to `k3s-oncluster`. (3) Gitops-ify the `forgejo-runner` Deployment for durability.   **Closed:** 2026-06-26.
