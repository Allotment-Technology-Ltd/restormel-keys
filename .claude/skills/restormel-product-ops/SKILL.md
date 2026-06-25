---
name: restormel-product-ops
description: >-
  Run the Restormel / Allotment Technology product-ops pipeline. Use this WHENEVER a task in any
  Restormel chat, Cowork, or Claude Code session implies creating, updating, prioritising, or
  tracking a product backlog item — a feature, bug, task, spike, decision/ADR, or roadmap item —
  even if the user doesn't say "issue" or "ticket". Triggers on: "log this", "add to the backlog",
  "raise a bug", "track this", "what's the status of", "move this to in progress / QA / ready to
  deploy", "create a ticket", "update issue #N", planning notes that should become work items, or
  discovery findings to capture against a PBI. It explains the Huly-native pipeline (create-or-
  update, the status lifecycle, project routing, and the correct route for your surface) so work
  lands consistently in Huly with a clean planning→delivery audit trail.
---

# Restormel product-ops pipeline

The product-management **system of record is Huly** — self-hosted (in-cluster on the K3s sovereign
cluster, ns `huly`, EU) at **`huly.allotmentology.tech`**, workspace `allotment-pm`. Huly **replaces
Forgejo Projects** for the *tracker*. **Forgejo stays canonical for git + CI + the ISMS records** —
only the PM board moved (see `product-ops/HULY-MIGRATION.md`; ISMS asset AST-030 + the project↔product
map REC-GOV-008 in restormel-keys `governance/`). This skill is the *how to operate it*; the canonical
design lives in `product-ops/` (`HULY-MIGRATION.md`, `LIFECYCLE-AND-AUTOMATION.md`, `PM-OPS-CENTRE.md`).

## Projects (the new top-level routing) — one Huly project per in-scope product

Every PBI belongs to exactly one **Huly Tracker project**, keyed to the product's ISMS `product:` tag.
The canonical map is **REC-GOV-008** (`governance/pm-project-product-map.yaml` in restormel-keys); the
operational routing copy is `product-ops/forgejo-pack/repo-project-map.yaml`:

| Huly project | identifier | ISMS `product:` | Forgejo repos that route here |
|---|---|---|---|
| Restormel | `RES` | `restormel` | restormel-keys, restormel-ops, restormel-gitops |
| Allotmentology | `ALOT` | `allotmentology.tech` | allotmentology.tech |
| PlotBudget | `PLOT` | `plotbudget` | plotbudget-v2 |
| Sophia | `SOPH` | `sophia` | sophia |

Pick the project from the repo/product the work touches. If unsure, default to **Restormel [RES]** and
flag it. (Huly itself is infra — AST-030, `product: shared` — not a project of its own.)

## The one rule: create-or-update, then bind work by issue id

1. **Find or create.** Search the project's issues by keyword (+ label filter). One good match →
   **update** it (comment + re-label). None → **create** it. Either way you get an issue id, **`RES-N`**
   (the project identifier + number, e.g. `RES-91`, `ALOT-3`).
2. **Bind the work to the issue id.** Put the id in the branch name, commit messages, and the PR
   (`Ref RES-N` for items tracked through deploy; `Closes RES-N` only if done at merge).
3. **Capture new info anytime** by referencing the id again — appends to that PBI, no duplicate.
   From there the status lifecycle moves automatically (below).

## The taxonomy (Huly labels + milestones — set these)

- `kind/` (one of): feature · bug · task · spike · decision
- `status/` (lifecycle, first-class Huly statuses, automated): triage → ready → in-progress →
  in-review → ready-deploy → deployed
- `priority/` (roadmap horizon): now · next · later
- `wave/`: w0 · w1 · w2 · w3  (ties to `gtm/ROADMAP.md`)
- `area/` (may be multiple): engine · proxy · mcp · site · docs · infra · security · gtm
- flag: `blocked` (overlays any status)

Milestones `W0…W3` group items by roadmap wave. An item with no milestone = unscheduled backlog.
(Carried over from the Forgejo taxonomy — the lifecycle/labels/milestones are unchanged; only the
backend is Huly, where statuses are first-class and automatable — the gap Forgejo's board had.)

## Route by your surface (this is the cross-surface part)

**You're in Claude Code (on the Mac — can reach Huly).** Act directly:
- Use the **Huly MCP** for natural-language create/edit/comment/status, OR the **Huly REST API**
  (`connectRest`, token auth) directly.
- Set/transition `status/*` via the repointed bridge `product-ops/forgejo-pack/lifecycle/set-status.sh
  <RES-N> status/<x>` (now writes Huly REST, not Forgejo labels).
- To file/update from a spec, write an intent (below) and run the applier — repointed to Huly REST —
  `python3 product-ops/forgejo-pack/intent/apply-issue-intents.py <dir>`.

**You're in Cowork (sandbox — CANNOT reach Huly).** Never try to call Huly directly.
Instead, **write an intent file** to `cowork-outbox/issue-intents/<slug>.yaml`; the Mac-side
`issue-intents` watcher applies it to **Huly REST** (create-or-update). Use the intent format below.
For repo files (templates, workflows) use the relay bundle flow (`cowork-relay/BUNDLE-FORMAT.md`).

**You're in the Restormel Claude chat project (no tools).** Produce the **intent YAML as text** and
hand it off per the project's convention — e.g. *"Hand to Cowork: drop this into
`cowork-outbox/issue-intents/`"* or *"Hand to Claude Code: apply with apply-issue-intents.py"*.
Don't claim to have filed it.

## Intent format (the portable unit of work)

```yaml
project: RES                    # REQUIRED — the Huly project (RES | ALOT | PLOT | SOPH); see the
                                # project table above / REC-GOV-008. Determines where the PBI lands.
title: "Short imperative title"
match:                          # how to find an existing PBI before creating
  id:                           # if known, update this exact issue (e.g. RES-91)
  query: "distinctive words"    # else text search within the project
  labels: [area/proxy]          # optional AND filter on the match
kind: feature                   # → kind/feature
status: ready                   # → status/ready (omit to leave status alone)
priority: now                   # → priority/now
wave: w2                        # → wave/w2
area: [proxy, engine]           # → area/*
body: |
  Context + acceptance criteria as a checklist.
links:                          # appended for audit (planning docs, ADRs, ROADMAP)
  - https://git.allotmentology.tech/Allotment-Technology-Ltd/restormel-keys/src/branch/main/planning/
comment: |                      # used only when UPDATING an existing PBI
  New info captured from discovery/planning.
```
Reference example: `product-ops/forgejo-pack/intent/example-intent.yaml`; seed set in `intent/seed/`
(the 26 seed intents are tool-agnostic — they import into Huly via the repointed applier / Huly MCP).
NOTE: the legacy `repo:` field is superseded by `project:`; an intent that still carries `repo:` is
mapped to its project via REC-GOV-008 (`repo-project-map.yaml`) on apply.

## The status lifecycle (auto-moves once the id is bound)

commit/branch refs `RES-N` (Forgejo Actions) → Huly `in-progress` · PR opened `Ref RES-N` →
`in-review` (QA) · PR merged → `ready-deploy` · **ArgoCD `sync-succeeded` + `healthy`** (Argo
notifications webhook) → `deployed` + close. Each transition posts a timeline comment; commits/PRs
cross-link via the bridge. That timeline is the audit trail — attach planning links at creation so the
PBI shows the full planning→delivery path. (The "deployed" signal is now Argo notifications, not a
Coolify callback — the cluster is GitOps/Argo.)

## Guardrails

- **Huly is the PM system of record** — labels/statuses there are the canonical state. **Forgejo stays
  canonical for git + CI + records**; never reopen Forgejo Projects as a parallel tracker.
- Forgejo `origin` only for git; never the GitHub mirror. No secrets in issues/intents/logs.
- Don't build a parallel tracker — one PBI per unit of work, bound by id; route by `project`.
- In Cowork, route through the intent lane / relay (the sandbox can't reach Huly); don't fabricate success.
- Huly access is via the portal forward-auth gate (same boundary as Argo/Grafana) + a Huly local login;
  a break-glass local admin exists (RISK-015 / REC-POL-002). Don't put credentials in intents/logs.
- If the work is record-/governance-related, also consult the **restormel-isms** skill.
