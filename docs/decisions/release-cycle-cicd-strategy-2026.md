---
id: REC-ADR-024
title: "ADR — Release Cycle & CI/CD Strategy: local → preview → integration → prod (build-once, promote-by-digest)"
class: decision
owner: founder
status: approved
classification: internal
control-tier: 2
created: 2026-07-02
last-reviewed: 2026-07-02
review-interval: P12M
approved-by: founder
approved-on: 2026-07-02
retention: permanent
related: [REC-ADR-023, REC-ADR-011, REC-PLAN-022, REC-ADR-001]
---

# ADR: Release Cycle & CI/CD Strategy — local → preview → integration → prod (2026)

**Status:** Approved (founder sign-off 2026-07-02). Promoted from the working draft at
`restormel-ops/planning/release-cycle-cicd-strategy-2026.md`, grounded in a full review of
`restormel-keys/.forgejo/**`, `restormel-gitops`, and the Teasynaer repo. This record is the
governed source of truth; `DEPLOY-PIPELINE.md` (§5.6 below, not yet written) will be its
operational companion once Phase 1 lands.

**Decides:** how a change gets from a laptop to production with the right test at each stage,
adapted for high-volume agentic development.

## Context

The pipeline as built is wired close to inverted from the target flow. Verified 2026-07-02
against the live repos:

1. **Integration tests the wrong thing.** `integration-train.yml` batches PRs labelled `stage`
   onto a throwaway `integration` branch (nightly / on-label / dispatch), skip-on-conflict, and
   deploys *that*. Integration shows un-merged work-in-progress, not the post-merge state of
   `main`. What gets signed off there is not what lands.
2. **Merge → `main` can auto-deploy straight to prod.** `auto-tag-release.yml` fires on any merge
   touching `apps/dashboard/**` or `packages/**`, cuts the next `dashboard-v*` tag, which triggers
   `deploy-k3s.yml` → prod build → Argo auto-sync (`K3S_DEPLOY_ENABLED==1`, itself the subject of
   **[[REC-ADR-011]]**). There is no "merged main lands on integration for review" gate in the
   path at all.
3. **Prod is a different build than integration.** `deploy-prod` runs
   `k3s-build-push-bump.sh prod`, which rebuilds the image from the tag and bumps prod manifests
   by `:tag`. Integration's dashboard is pinned by `@sha256:` digest, its worker by tag, prod both
   by tag — three separate artefacts via two mechanisms. Nothing promotes the
   integration-approved image to prod; every prod release is an unverified new build.

Supporting findings: both `restormel-nonprod` and `restormel-prod` Argo Applications now
auto-sync (prod flipped 2026-06-27 per **[[REC-ADR-011]]**); `bootstrap/appprojects.yaml` still
states prod sync is "MANUAL/GATED" — stale, not enforced; no ApplicationSet/PR-generator preview
scaffolding exists although `argocd-values.yaml` already sets `applicationSet.enabled: true`
(unused); no kustomize overlays, each env is a hand-maintained manifest dir;
`DEPLOY-PIPELINE.md` is referenced from gitops but does not exist. **Teasynaer** (the manual-QA
regression runner) is an early scaffold, pre-Milestone-1, not deployed.

## Decision

Adopt the target model **local → preview (per-feature, isolated) → integration (merged `main`,
the QA gate) → prod (promote by digest)**. The organising principle: **build once, promote by
digest** — the image that passes integration is the byte-identical image that runs in prod, so
"what differs from integration" is only environment config, never code.

### The 6 locked decisions (founder, 2026-07-02)

1. **Retire the `stage` train.** `integration-train.yml`'s train job and the `stage` label are
   removed once merge→integration is automatic; ephemeral previews cover isolation, integration
   covers "merged `main`."
2. **Merge → integration is automatic; merge → prod is not.** `auto-tag-release.yml` stops
   auto-releasing prod on merge. A new merge→integration deploy reuses the build-once digest.
3. **Prod is a manual promotion of a digest, never a rebuild.** A `promote <from-env> <to-env>`
   mode in `k3s-build-push-bump.sh` copies a digest between manifests. The prod release act is a
   **gitops promotion PR** pinning dashboard **and** worker to `@sha256:` digest; its merge is the
   founder's deploy gate.
4. **Canary from the start.** Prod `Deployment`→`Rollout` (Argo Rollouts) ships together with
   digest promotion in Phase 1 — canary steps + automated analysis (health/error-rate) +
   auto-rollback, never a canary with no abort path.
5. **Preview DBs seed from a sanitised `restormel_staging` snapshot**, not from prod's
   `restormel_ops`. A masking pass covers PII / ingested-document content / evidence fields
   (RISK-017/018). A per-preview ephemeral CNPG database is seeded from the snapshot and torn
   down with the preview namespace.
6. **Teasynaer serves both preview and integration.** M1 (deploy + first regression deck) is
   pulled forward into Phase 2, alongside ephemeral previews, so AI+manual regression exists at
   the feature-isolation stage as well as the merged-`main` gate. An interim manual checklist
   covers the gap until Teasynaer M2 wires the automatic AI Run.

### Environments and what each proves

| Env | Trigger | Proves | Data |
|---|---|---|---|
| Local | dev/agent loop | compiles, unit under test works | docker pg |
| Preview (per-feature) | PR open; flag by default, ephemeral namespace on-demand via `preview` label | feature works in isolation | ephemeral CNPG, sanitised `restormel_staging` snapshot |
| Integration | merge to `main` (auto) | merged `main` is releasable — the go/no-go gate | `restormel_staging` (pg-platform) |
| Production | manual promotion of the integration-approved digest | the identical artefact runs healthily under prod config | `restormel_ops` (pg-restormel) |

### Testing strategy — right test, right stage

Unit/typecheck/lint and component/contract tests stay required on every PR (`ci.yml` unchanged:
`build-and-test`, `security`, `bundled-asset-guard` required; `connect-eval-gate`,
`connect-g4-retrieval-gate`, `records-governance` path-scoped). Security/supply-chain gains SBOM +
cosign signing + SLSA provenance. Agentic e2e regression and Teasynaer's manual regression move to
**integration** and are blocking go/no-go inputs. Prod gets only a thin smoke + config-diff check,
blocking with auto-rollback — the least testing, because the artefact is already proven upstream.

## Rework list (mapped to findings)

1. Stop merge→prod: change `auto-tag-release.yml` so a merge no longer auto-tags a prod release.
2. Add merge→integration (auto); retire `integration-train.yml`'s train job + `stage` label.
3. Build once: add a `promote <from-env> <to-env>` mode to `k3s-build-push-bump.sh` (copy digest,
   no rebuild); preserve the existing split-token security model (build never holds the gitops
   token; bump never executes untrusted context).
4. Prod = digest promotion: pin dashboard **and** worker by `@sha256:` digest in
   `restormel-gitops`, set by a promotion PR; gate with `verify-image-pin.sh` (RES-117) + a new
   config-diff check.
5. Ephemeral previews: activate the already-enabled ApplicationSet; add a PR-generator
   ApplicationSet rendering a scale-to-zero namespace per `preview`-labelled PR.
6. Fix stale governance: correct `bootstrap/appprojects.yaml`'s manual-sync note (superseded by
   **[[REC-ADR-011]]**; the real prod gate is the promotion-PR merge) and write the missing
   `DEPLOY-PIPELINE.md`.
7. Supply-chain hardening: SBOM, cosign signing, SLSA provenance, admission/policy check that prod
   only runs signed+provenanced digests.
8. Progressive prod rollout: convert prod `Deployment`→`Rollout` (Argo Rollouts), canary steps +
   automated analysis + auto-rollback on the promoted digest.

## Phasing

- **Phase 1 (highest value):** retire the `stage` train; stop merge→prod auto-tag; add
  merge→integration auto-deploy; add `promote` mode; convert prod to digest-pinned via a
  promotion PR; Argo Rollouts canary for prod from day one; fix the stale appprojects note;
  commit `DEPLOY-PIPELINE.md`. *Outcome: merged `main` lands on integration automatically; prod
  is a canary'd digest promotion of the tested artefact.*
- **Phase 2:** ephemeral preview ApplicationSet behind the `preview` label with sanitised-snapshot
  seeded DBs; Teasynaer M1 (deploy + first deck) at preview and integration; SBOM + cosign +
  provenance, prod admission requires signed+provenanced digests.
- **Phase 3:** blocking agentic e2e regression (Playwright + LLM-judge) at preview + integration;
  Teasynaer M2 (auto AI-Run clears the deterministic deck, human signs off the remainder; fails
  auto-file Huly tickets + evidence bundles).

## Cutover & rollback

Every rework item lands as a reviewable PR that keeps the current working pipeline intact until
its replacement is proven: the arming vars `K3S_DEPLOY_ENABLED` and `INTEGRATION_TRAIN_ENABLED`
stay live kill-switches through the cutover; new paths land behind a flag/var or run in parallel
with the old ones; the old path (`stage` train, tag-triggered prod rebuild) is retired only once
the new path (merge→integration, digest promotion, canary) is green. No workflow may merge to
`main`/gitops or run `kubectl`/`argocd sync` against prod on its own — the gitops promotion PR's
merge is the sole prod deploy act, matching the control **[[REC-ADR-011]]** already established
for Argo auto-sync. Rollback at every stage is a git revert: reverting the promotion commit
re-points prod at the previous digest deterministically, because artefacts are immutable and
addressed by digest.

## Risks & mitigations

- **Digest promotion misses a needed rebuild** (e.g. a base-image CVE fix): scheduled rebuilds of
  `main` + Renovate (already present) re-enter at integration; promotion is for release, not
  patching.
- **Ephemeral previews overload the small cluster** (3× cx43): scale-to-zero + label-gated (not
  every PR) + TTL teardown — the hybrid-isolation decision exists precisely to bound this.
- **Teasynaer slips:** the pipeline works with an interim manual checklist; Teasynaer upgrades the
  gate, it is not a hard dependency.
- **Integration DB drift vs prod:** integration uses `restormel_staging`; migrations stay
  additive and fail-closed (the same invariant **[[REC-ADR-011]]** already relies on) so one image
  migrates cleanly in both.
- **A successful-but-non-backward-compatible migration** slipping through digest promotion: same
  residual risk **[[REC-ADR-011]]** already carries — expand/contract migration discipline,
  enforced at PR review, is the primary control.

## Relationship to other records

- **[[REC-ADR-023]]** (dual-mode ingest verification engine) — a sibling architecture decision
  from the same review cycle; no direct dependency, but both assume the same build-once/promote
  release discipline for shipping their respective components safely.
- **[[REC-ADR-011]]** (prod Argo CD auto-sync) — this ADR does not reopen that relaxation; it
  changes *what* reaches the auto-syncing prod Application (a promoted digest instead of a fresh
  tag-triggered rebuild) and *how* it gets reviewed beforehand (integration go/no-go). The
  residual risks and rollback story logged there (expand/contract migration discipline, prune
  safety, the missing pre-prod surface) carry forward and are partially closed by this ADR's
  Phase 2 ephemeral previews and Phase 1 integration gate.
- **REC-PLAN-022** (the RES-114 "Integration Train" plan) — this ADR **supersedes** REC-PLAN-022's
  operating model. REC-PLAN-022 approved pre-merge batch testing on a throwaway `integration`
  branch (the `stage` label train); this ADR's Decision §1 explicitly retires that train once
  merge→integration auto-deploy (§Rework item 2) is live, replacing "test PRs before merge" with
  "test merged `main` before promoting to prod." REC-PLAN-022 stays the historical record of why
  the train existed and its locked decisions on staging infra (DB seeding, oauth2-proxy gate)
  carry forward into this ADR's preview/integration environments where still applicable.
- **[[REC-ADR-001]]** (records & information architecture) — this record follows the federated,
  repo-anchored convention it establishes.

## Follow-ups

- Write `DEPLOY-PIPELINE.md` (Phase 1, rework item 6) — this ADR is its source.
- Correct `bootstrap/appprojects.yaml`'s stale manual-sync note (Phase 1, rework item 6).
- Once Phase 1 lands, file the individual PRs as evidence/ledger entries per the records
  maintenance norm (`records/SCHEMA.md`) — each is a material change to the deploy pipeline asset.
- Re-evaluate REC-PLAN-022's status (currently `approved`) once its train mechanics are formally
  retired in a landed PR — mark `superseded` by this record at that point, not before.
