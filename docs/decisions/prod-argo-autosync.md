---
id: REC-ADR-011
title: "ADR: Prod Argo CD auto-sync — relaxation of the operator-gated prod deploy control (REC-INC-006)"
class: decision
owner: "@adam"
status: approved
classification: internal
control-tier: 2
created: 2026-06-27
last-reviewed: 2026-06-27
review-interval: P12M
approved-by: "@adam"
approved-on: 2026-06-27
retention: permanent
related: [REC-INC-006, REC-INC-022, REC-ADR-006]
---

# ADR: Prod Argo CD auto-sync — relaxation of the operator-gated prod deploy control

**Status:** **Approved — executed.** Founder-approved 2026-06-27 and applied the same day via
**`restormel-gitops` PR #65**. This ADR records a deliberate **relaxation of a standing
ISMS/operational control** and the rationale that makes the relaxation safe. It is therefore a
governed (control-tier 2) decision artefact, not a draft direction.

## Summary of the change

The production Argo CD Application **`restormel-app-prod`** was flipped from **manual
(operator-gated) sync** to **auto-sync**:

```yaml
syncPolicy:
  automated:
    prune: true
    selfHeal: true
    allowEmpty: false
```

The same PR (#65) also added **app-tier HorizontalPodAutoscalers** and **removed the static
`replicas`** from the prod Deployment (replica count is now HPA-owned).

This **relaxes the prior control** — *"prod is never main-auto-deploy / prod sync stays
manual/gated; the operator clicks Sync"* — which traces to incident **[[REC-INC-006]]** (prod
auto-deploy silently broke for ~14 merges because a CI deploy job dialled an **on-box
control-plane API** that the ephemeral CI subnet route collided with). The lesson banked from
REC-INC-006 was *outbound-only, pull-based deploys*; that invariant is **preserved** — Argo
**pulls** from git. What changes is only whether the final reconcile waits for a human click.

## Context — why the manual gate existed, and why that reason is spent

The manual gate was introduced in the K3s cutover design (`planning/k3s-cluster-target-design.md`
§8) for two reasons, both now closed:

1. **The empty-DB CUTOVER gate.** During cutover, prod ran on a freshly bootstrapped, initially
   empty database; an unattended auto-sync could have rolled a workload against an unprepared
   data layer. **That gate is closed** — prod is live on K3s, serving `restormel.dev` against a
   populated CNPG `pg-restormel`, the migration path proven.
2. **REC-INC-006 defensiveness.** After the silent 14-merge auto-deploy failure, the safe default
   was "no automatic prod rollout at all." But REC-INC-006's *actual* root cause was an
   **inbound on-box control-plane call** from CI, not GitOps reconciliation. Argo's pull model
   already removes that failure mode; a manual click added latency, not safety.

By the time an image bump reaches Argo, **review has already happened upstream**:

- **PR review + merge** on `restormel-keys` (CODEOWNERS-gated).
- **CI** — the required Security scan, the full dashboard build, and the bundled-asset guard.
- **The `deploy-k3s` pipeline gate** — `K3S_DEPLOY_ENABLED` plus *build-must-go-green* before any
  image is built, pushed, and the tag bumped into the gitops repo.

An operator hand-sync sat **after** all of that. It was a manual confirmation of an
already-reviewed, already-built, already-green artefact — latency, not a distinct control.

## Decision

Enable `syncPolicy.automated` (`prune: true`, `selfHeal: true`, `allowEmpty: false`) on
`restormel-app-prod`. Prod now **auto-syncs the reviewed artefact** once the upstream pipeline has
produced and committed the image-tag bump. The deploy control moves **upstream** (PR + CI +
pipeline gate); the human gate is removed from the reconcile step.

## Why it is safe — the runtime protections carry the safety

The safety case rests on runtime controls that make a bad rollout **self-isolating and
self-reverting**, not on a pre-rollout human click:

- **RollingUpdate + readiness probes** — an unready pod takes **no traffic**; a broken image never
  displaces healthy serving pods.
- **PodDisruptionBudget `minAvailable: 1`** + **required node anti-affinity** — at least one
  healthy replica always serves, spread across nodes.
- **Fail-closed migration entrypoint** — the app runs pending DB migrations on start against CNPG;
  a bad migration **crash-loops the new pods → they stay unready → the old ReplicaSet keeps
  serving**. Code can never silently outrun (or corrupt) the prod schema. (This is the same
  fail-closed invariant the manual era relied on — REC-INC-001's banked lesson.)
- **`selfHeal: true`** — out-of-band drift is reconciled back to git, so the live state cannot
  diverge from the reviewed source of truth.
- **retry + backoff** on the sync operation — a transient failure retries rather than wedging.
- **`revisionHistoryLimit: 5`** — recent ReplicaSets retained for fast rollback.

### Rollback

**Revert the gitops image-bump commit** in `restormel-gitops`; Argo auto-syncs prod back to the
prior good image. Every prod release remains a **named, revertable git commit** — the property the
manual `dashboard-v*` tag gave us before, now the sole gate.

## Residual risks (documented, accepted with mitigations)

1. **A successful-but-non-backward-compatible migration.** The fail-closed entrypoint catches a
   *failing* migration, not one that *succeeds* yet breaks the still-running old ReplicaSet during
   the rollout window (e.g. a destructive column drop).
   **Mitigation:** **expand/contract migration discipline**, enforced at **PR review** — additive
   first, destructive changes only after the old code path is gone. This is the primary control
   that the upstream-gate model now leans on.
2. **No working staging environment as a pre-prod gate.** The staging Argo app's Helm **values
   files are missing**, so there is currently no live pre-prod surface to catch a bad rollout
   before prod. **Flagged as a follow-up** — restore a functioning staging/preview Argo app so an
   image is exercised on a non-prod surface before prod auto-sync.
3. **`prune: true` is enabled.** Prune deletes cluster resources that disappear from git.
   **Verified safe at the time of the change:** every Argo-tracked resource in the `restormel-prod`
   namespace is present in git (raw manifests under `applications/restormel-app-prod/`), so there
   is nothing for prune to orphan-delete. This must stay true — any out-of-band-created prod
   resource that is *not* in git would be pruned on the next sync.

## Relationship to other records

- **[[REC-INC-006]]** — the incident this control originally hardened against; its
  outbound-only / pull-based invariant is **preserved**, not weakened.
- **REC-INC-022** (`evidence/incidents/2026-06-27-node-memory-limit-overcommit.md`) — the
  NodeMemoryLimitOvercommit alert whose remediation (right-sizing via app-tier HPAs + removing
  static replicas) ships in the **same PR #65** as this auto-sync change.
- `planning/k3s-cluster-target-design.md` §8 — the design doc that stated the original
  manual-gate rule (updated to point here).
- `CLAUDE.md` standing operational norms — the prod-deploy line (updated to point here).
- `deploy/k3s/**` gitops + runbook docs — updated so the operator-Sync procedure no longer
  contradicts the live auto-sync behaviour.

## Follow-ups

- **Restore a working staging Argo app** (missing values files) as a real pre-prod gate
  (residual risk 2).
- **Codify expand/contract migration review** as an explicit PR-review checklist item
  (residual risk 1).
- Keep the **prune invariant** true: never create prod resources out-of-band that are not in git
  (residual risk 3).
