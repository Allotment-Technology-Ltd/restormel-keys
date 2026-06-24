---
id: REC-INC-012
title: "Incident — Tier-A in-cluster Forgejo runner apply (restormel-keys#300) crashlooped the ci-build runner pod; rolled back via gitops; no prod impact"
class: evidence
owner: "@adam"
approved-by: "@adam"
approved-on: 2026-06-24
status: closed
classification: internal
control-tier: 3
created: 2026-06-24
last-reviewed: 2026-06-24
review-interval: P12M
retention: P6Y
related: [REC-TPL-004, REC-INC-010, RISK-001, AST-022]
---

# Incident — Tier-A in-cluster CI runner apply crashlooped (rolled back, prod unaffected)

> Filed from REC-TPL-004. Append-only once closed. **Severity: low** — fault confined to a brand-new,
> non-prod CI-substrate namespace (`ci-build`); zero production impact at any point. Filed per the
> mandatory incident-on-remediation rule (a new crashloop was introduced by an apply and then rolled back).

- **Detected:** 2026-06-24 ~14:57 UTC, during the operator run that applied the Tier-A in-cluster Forgejo
  Actions runner pool (the gitops half of `restormel-keys#300`). **Reported by:** the automation operator
  itself, immediately, in-session, the moment the runner pod entered CrashLoopBackOff. **Severity:** low.

- **What happened:** The Tier-A manifest set (in-cluster `act_runner` daemon + rootless buildkit, ns
  `ci-build`) was landed 1:1 into `restormel-gitops` (PR #13) so the app-of-apps root would create the
  `ci-runners` Argo Application and auto-sync it. All Tier-A manifests passed `kubectl apply
  --dry-run=server` beforehand. On live sync the Application created the namespace, quota, SA, configmap,
  service, both Deployments, and the NetworkPolicy cleanly, **but three resources failed**, two of them
  manifest defects in the source PR (not merely missing operator inputs):
  1. **`buildkitd` Deployment — PodSecurity-blocked, never scheduled.** The ns is labelled
     `pod-security.kubernetes.io/enforce=baseline`, but rootless buildkit requires
     `seccompProfile=Unconfined` + the apparmor-unconfined annotation, which the **`baseline` PSA level
     forbids**: `pods "buildkitd-…" is forbidden: violates PodSecurity "baseline:latest": forbidden
     AppArmor profiles … seccompProfile … must not set … to "Unconfined"`. `ReplicaFailure=FailedCreate`,
     0 pods. The `00-namespace.yaml` comment claiming "baseline is the tightest that still allows the
     rootless buildkit pattern" is **incorrect** — baseline cannot admit Unconfined seccomp/apparmor.
  2. **`forgejo-runner-registration` ExternalSecret — provider 404.** ESO could not resolve key
     `FORGEJO_RUNNER_REGISTRATION_TOKEN` in the `infrastructure` Infisical project (env prod):
     `status-code=404 … Secret … not found`. So no registration secret was created; the runner init
     container (token `optional: true`) skipped registration, the daemon then failed with
     `registration file not found, please register the runner first` / `open /data/.runner: no such file
     or directory` → **CrashLoopBackOff** (runner pod, ~4 restarts on `restormel-node2`).
  3. **`forgejo-registry-push` ExternalSecret — invalid render.** The `.dockerconfigjson` template
     (`printf "%s:%s" .regUser .regToken | b64enc`) produced an embedded newline:
     `Secret "forgejo-registry-push" is invalid: data[.dockerconfigjson]: Invalid value: … invalid
     character '\n' in string literal`. ESO also could not adopt the pre-existing **hand-applied**
     `forgejo-registry-push` secret (`creationPolicy: Owner` will not adopt a secret it did not create).

- **Impact:** **None to production.** The fault was confined to the new `ci-build` namespace (CI build
  substrate, no serving traffic). Throughout the apply and rollback, all prod endpoints stayed healthy:
  `restormel.dev`→200, `usesophia.app`→200, `api.plotbudget.com/auth/v1/authorize?provider=google`→302,
  `grafana.allotmentology.tech`→307, `argo.allotmentology.tech`→307. The off-cluster `.166` Docker runner
  was **never touched** and continued to serve all CI — no CI capacity was lost. One crashlooping runner
  pod existed for ~5 minutes before rollback; no other workload was affected (cluster-wide non-running pod
  count returned to zero after rollback).

- **Response (timeline, UTC 2026-06-24):**
  - ~14:50 — `restormel-gitops` PR #13 merged (Tier-A manifests + the `ci-runners` Argo Application;
    Tier-B KEDA ScaledJob committed but excluded from sync — correctly gated, KEDA CRDs absent).
  - ~14:53–14:57 — app-of-apps root refreshed; it created the `ci-runners` Application, which synced the
    `ci-build` resources. Runner pod entered Error/CrashLoopBackOff; buildkitd `FailedCreate`; both
    ExternalSecrets `SecretSyncedError`.
  - ~14:57 — diagnosis from `kubectl get events -n ci-build` surfaced the three failures above. Prod
    re-verified healthy; crashloop confirmed contained to `ci-build`.
  - ~14:59 — **rollback via gitops** (the managed path): `restormel-gitops` PR #14 reverted PR #13
    (removed `applications/addons/ci-runners.yaml` + `ci-runners/**`), merged.
  - ~15:00 — root app-of-apps refreshed → **pruned** the `ci-runners` Application → tore down the
    `ci-build` workloads (and the Argo-owned `ci-build` namespace, incl. the two hand-applied secrets).
  - ~15:00 — verified: `ci-build` namespace gone, **zero crashlooping/non-running pods cluster-wide**,
    all prod endpoints healthy. Direct `kubectl delete secret` of the hand-applied secrets was
    **deliberately not performed** (a destructive in-place mutation flagged for explicit approval); the
    gitops prune removed them cleanly instead. No Infisical bulk read was performed (golden rule honoured;
    key verification was left to ESO's own resolution, which produced the 404 evidence above).

- **Root cause:** The Tier-A manifests in `restormel-keys#300` were authored read-only and validated only
  with `--dry-run=server`, which does **not** exercise PodSecurity admission for the *workload* pods,
  ESO provider resolution, or secret-template rendering. Three latent defects therefore reached live sync:
  a PSA-level mismatch for rootless buildkit, an un-provisioned registration token in Infisical, and a
  malformed dockerconfigjson template. The apply was correct as a *process* (gitops PR → Argo sync, `.166`
  preserved, Tier-B gated) but the *artefact* was not apply-ready.

- **Follow-ups:**
  - [ ] **Fix `restormel-keys#300` before re-apply (manifest defects):**
    (a) give `buildkitd` a PSA exemption — set `pod-security.kubernetes.io/enforce=privileged` on the
        `ci-build` namespace (keep `audit/warn=restricted` for visibility), since rootless buildkit's
        Unconfined seccomp/apparmor cannot run under `baseline`; and
    (b) fix the `forgejo-registry-push` `.dockerconfigjson` template so it renders single-line (e.g.
        `b64enc` of a pre-trimmed value / avoid the literal-block newline) — validate with a real ESO
        sync, not just dry-run.
  - [ ] **Operator pre-stage (apply preconditions):** provision `FORGEJO_RUNNER_REGISTRATION_TOKEN` (and
        confirm `FORGEJO_REGISTRY_USER` / `FORGEJO_REGISTRY_TOKEN`) in the `infrastructure` Infisical
        project (env prod); then re-stage the `ci-build` secrets such that ESO owns them (or let ESO
        create them fresh — do **not** hand-apply, which blocks `creationPolicy: Owner` adoption).
  - [ ] **Re-apply Tier-A** only after the two items above, and **prove**: runner registers (Online in
        Forgejo Site-Admin → Actions → Runners), buildkitd Ready, and a smoke `runs-on: k3s-build` job
        builds + pushes — dual-run for a week before migrating the build-and-bump job; **never remove the
        `.166` runner in the same change** (cutover step 6).
  - [ ] **Add the asset-inventory entry** (`governance/asset-inventory.yaml`: the in-cluster CI runner
        pool + its Forgejo registration) **in the apply PR**, per the `restormel-isms-records`
        event-trigger matrix — only at successful apply, not now (nothing is live).
  - [ ] **Credential rotation (cross-ref REC-INC-010):** unrelated to this incident, but the
        root-level prod secret rotation flagged in **REC-INC-010** (incl. `FORGEJO_*`, `COOLIFY_TOKEN`,
        `PG_RESTORMEL_*`, `SURREAL_*`, `SMTP_PASS`, `SSH_KEY_PROD_167`, `TELEGRAM_BOT_TOKEN`,
        `BREVO_API_KEY`) remains **open and founder-flagged** — track there, not here.
  - **No `RISK-001` register change required** — this was a contained CI-substrate fault with no
    availability impact; it does not alter the single-host blast-radius treatment status.

- **Closed:** 2026-06-24 (rolled back cleanly; prod healthy; re-apply gated on the fixes above).
