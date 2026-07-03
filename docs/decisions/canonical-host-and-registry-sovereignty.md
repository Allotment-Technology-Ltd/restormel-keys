---
id: REC-ADR-012
title: "ADR: Canonical host & container registry — GitHub private dev-canonical, self-hosted Forgejo as the deploy/gitops source AND registry (plotbudget-v2 + sophia)"
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
related: [REC-ADR-006, REC-ADR-011]
---

# ADR: Canonical host & container registry for plotbudget-v2 and sophia

**Status:** **Approved — already in effect in production.** This ADR **records a de-facto pattern**
that has been live since **2026-06-23** (PlotBudget on K3s); it does **not** introduce or authorise
a new change. It is a governed (control-tier 2) decision artefact because it pins a standing
**sovereignty control on the production deploy path** — what Argo CD trusts and where container
images come from. **Records the de-facto pattern; supersedes nothing.** Tracked as **RES-50**.

## Context

PlotBudget (`plotbudget-v2`) and SOPHIA (`sophia`) are both developed with **GitHub as the
private, dev-canonical host** — that is where the engineering team works and where `git push`
lands first. Both repos are **private on GitHub**.

The production runtime is the self-hosted, EU-sovereign K3s cluster (GitOps via Argo CD from the
`restormel-gitops` app-of-apps; secrets via ESO → on-cluster Infisical). Putting a **US-controlled
GitHub dependency on the live pull/deploy path** — Argo pulling manifests from `github.com`, or
images pulled from `ghcr.io` — would reintroduce a US sub-processor into the sovereign deploy chain
and couple production availability to GitHub being reachable. That is incoherent with the
sovereignty posture the rest of the stack is built to (cf. the Zuplo→OSS-gateway sovereignty ADR
**REC-ADR-006**, which makes the same "no US dependency on the regulated/serving path" argument).

The existing UK-sovereign-hosting ADR (`docs/decisions/uk-sovereign-hosting.md`) is about **which
provider hosts the cluster** (Hetzner-EU vs Civo/iomart). It says **nothing** about per-repo
canonical host, GitHub-mirror topology, or where container images live for `plotbudget-v2` /
`sophia`. **This ADR is therefore additive, not a change to that one.**

## Decision

For **both** `plotbudget-v2` and `sophia`, by founder decision:

1. **GitHub stays the private, dev-canonical host.** Engineering continues to push to GitHub first;
   it remains the source of record for development.
2. **A Forgejo pull-mirror is maintained** on the self-hosted instance
   (`git.allotmentology.tech`, org `Allotment-Technology-Ltd`). Because the GitHub repos are
   private, the Forgejo mirror is **required** for the cluster to pull at all.
3. **Self-hosted Forgejo is the deploy / GitOps source.** Argo CD Applications pull **only** from
   the Forgejo mirror, never from `github.com`. Repo credentials are the in-cluster
   `argocd-repo-creds-forgejo` template covering `git.allotmentology.tech`.
4. **Self-hosted Forgejo is also the container registry.** Images are built and pushed to the
   **Forgejo container registry** at `git.allotmentology.tech` — **not `ghcr.io`**.

In one line: **GitHub = private dev-canonical; Forgejo = the only thing production trusts (source
and registry).**

## Rationale

- **Sovereignty of the deploy path.** No `github.com` / `ghcr.io` (US-controlled) dependency sits
  on the live pull-or-deploy path; the chain Argo→Forgejo→cluster is entirely self-hosted/EU.
- **Argo pulls only from Forgejo.** A single, controlled trust anchor for what reaches production;
  GitHub reachability is not a production-availability dependency.
- **GitHub stays private dev-canonical.** Developer ergonomics are preserved — the team keeps its
  GitHub workflow — while production trust is decoupled from it.

## Consequences

- **The Forgejo mirror is production-critical infrastructure, not a convenience copy.** If the
  mirror sync stalls, Argo cannot pull new revisions for these apps. Mirror health must be
  monitored like any other production dependency.
- **The Forgejo container registry is production-critical.** Pull availability and the registry
  backup/object-lock scope (crown-jewels DR) must cover it; image provenance now flows through
  Forgejo, so its access controls and push tokens (`FORGEJO_REGISTRY`, `write:package`) are part of
  the supply-chain control surface.
- **Two-host discipline.** Engineers must remember GitHub is dev-canonical but **not** what prod
  trusts; any "just point Argo at GitHub" or "pull from ghcr.io" shortcut silently breaks the
  sovereignty control and must be rejected at review.
- **ISMS reconciliation.** The asset/supplier inventory should reflect that GitHub is a
  dev-canonical sub-processor (private repos) while the production source-of-truth + registry are
  the self-hosted Forgejo — i.e. GitHub is deliberately kept **off** the production serving/deploy
  path.
- **Reversible.** The pattern is config (Argo `repoURL`, build push target); it can be repointed if
  the posture ever changes, but doing so is itself a sovereignty decision, not a routine edit.

## Evidence (live, verified 2026-06-27)

- **`restormel-gitops` `applications/workloads/sophia.yaml`** — Argo CD Application `sophia`,
  `spec.source.repoURL: https://git.allotmentology.tech/Allotment-Technology-Ltd/sophia.git`
  (`targetRevision: gitops/k3s`). Header comments: *"Source = Forgejo mirror … GitHub repo is
  private so Forgejo mirror is required"* and *"credential template `argocd-repo-creds-forgejo`
  covers `git.allotmentology.tech`"*. (Verified via Forgejo API, file sha `a8f5a43`.)
- **`restormel-gitops` `applications/workloads/plotbudget-supabase.yaml`** — Argo CD Application
  `plotbudget-supabase`, `spec.source.repoURL:
  https://git.allotmentology.tech/Allotment-Technology-Ltd/plotbudget-v2.git` (`targetRevision:
  main`). Header comment: *"repoURL = Forgejo mirror … GitHub repo is private so Forgejo mirror is
  required."* (Verified via Forgejo API, file sha `87bf399`.)
- **`plotbudget-v2` `deploy/k3s/argocd/plotbudget-supabase-application.yaml`** (the reference origin
  of the deployed copy) makes the trust decision explicit: *"Argo trusts Forgejo, not GitHub —
  founder chose the mirror"* and *"this is a PRIVATE GitHub repo:
  github.com/Allotment-Technology-Ltd/plotbudget-v2"*. (Verified via Forgejo API, file sha
  `e9e0635`.)
- **`restormel-keys` `.forgejo/workflows/deploy-k3s.yml`** — the K3s build+deploy pipeline builds
  and **pushes container images to the Forgejo registry, not ghcr.io**: `REG: git.allotmentology.tech`,
  authenticating with `secrets.FORGEJO_REGISTRY_USER` / `secrets.FORGEJO_REGISTRY_TOKEN`
  (`FORGEJO_REGISTRY`, `write:package`). (Verified in-repo.)
- **`plotbudget-v2` PR #211** — *"fix(gitops): PBI-hook image → Forgejo container registry (founder
  decision)"* — records the founder decision to host the image on the Forgejo registry rather than
  ghcr.io. (Per the PR record in the private `plotbudget-v2` repo; the registry direction itself is
  independently verified by `deploy-k3s.yml` above. The `plotbudget-v2` issue/PR API is not
  readable by the records token, so the PR title is cited as recorded, not re-fetched here.)
- **PlotBudget has been live on this pattern since 2026-06-23** — `plotbudget-supabase.yaml`
  records *"PR #312 merged to main (2026-06-23)"* and the app is now auto-syncing
  (*"plotbudget is live"*), corroborating the self-hosted-Supabase K3s cutover going live that day.
- **The existing UK-sovereign-hosting ADR does not cover this** — `docs/decisions/uk-sovereign-hosting.md`
  concerns provider choice (Hetzner-EU vs Civo/iomart) and contains no per-repo canonical-host,
  GitHub-mirror, or container-registry decision for `plotbudget-v2` / `sophia`. This ADR is additive.

## Relationship to other records

- **REC-ADR-006** (Zuplo → self-hosted OSS gateway) — same sovereignty principle: keep
  US-controlled services off the production serving/deploy path. This ADR applies it to the
  source-of-truth and the image registry.
- **REC-ADR-011** (prod Argo CD auto-sync) — the deploy-pipeline decision this one sits beneath;
  auto-sync reconciles from the Forgejo source/registry that this ADR pins as canonical.
- **RES-50** — the backlog item this ADR closes (record the already-live canonical-host & registry
  decision).
