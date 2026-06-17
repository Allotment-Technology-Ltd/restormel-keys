---
name: restormel-product-ops
description: >-
  Run the Restormel / Allotment Technology product-ops pipeline. Use this WHENEVER a task in any
  Restormel chat, Cowork, or Claude Code session implies creating, updating, prioritising, or
  tracking a product backlog item — a feature, bug, task, spike, decision/ADR, or roadmap item —
  even if the user doesn't say "issue" or "ticket". Triggers on: "log this", "add to the backlog",
  "raise a bug", "track this", "what's the status of", "move this to in progress / QA / ready to
  deploy", "create a ticket", "update issue #N", planning notes that should become work items, or
  discovery findings to capture against a PBI. It explains the Forgejo-native pipeline (create-or-
  update, the status lifecycle, and the correct route for your surface) so work lands consistently
  in Forgejo with a clean planning→delivery audit trail.
---

# Restormel product-ops pipeline

The product-management system of record is **Forgejo Issues** in `restormel-keys` (canonical, self-
hosted at `git.allotmentology.tech`, owner `Allotment-Technology-Ltd`). This skill is the *how to
operate it*; the canonical design lives in `product-ops/` (`PM-OPS-CENTRE.md`,
`LIFECYCLE-AND-AUTOMATION.md`, `IMPLEMENTATION.md`). Forgejo is canonical — never use the GitHub mirror.

## The one rule: create-or-update, then bind work by #N

1. **Find or create.** Search open issues by keyword (+ label filter). One good match → **update**
   it (comment + re-label). None → **create** it. Either way you get a number, **`#N`**.
2. **Bind the work to `#N`.** Put `#N` in the branch name, commit messages, and the PR
   (`Ref #N` for items tracked through deploy; `Closes #N` only if done at merge).
3. **Capture new info anytime** by referencing `#N` again — appends to that PBI, no duplicate.
   From there the status lifecycle moves automatically (below).

## The taxonomy (org-wide scoped labels — set these)

- `kind/` (one of): feature · bug · task · spike · decision
- `status/` (lifecycle, automated): triage → ready → in-progress → in-review → ready-deploy → deployed
- `priority/` (roadmap horizon): now · next · later
- `wave/`: w0 · w1 · w2 · w3  (ties to `gtm/ROADMAP.md`)
- `area/` (may be multiple): engine · proxy · mcp · site · docs · infra · security · gtm
- flag: `blocked` (overlays any status)

Milestones `W0…W3` group items by roadmap wave. An item with no milestone = unscheduled backlog.

## Route by your surface (this is the cross-surface part)

**You're in Claude Code (on the Mac — can reach Forgejo).** Act directly:
- Use a Forgejo MCP for natural-language create/edit/comment, OR the REST API.
- Set/transition `status/*` via `product-ops/forgejo-pack/lifecycle/set-status.sh <N> status/<x>`.
- To file/update from a spec, write an intent and run
  `python3 product-ops/forgejo-pack/intent/apply-issue-intents.py <dir>`.

**You're in Cowork (sandbox — CANNOT reach Forgejo).** Never try to call Forgejo directly.
Instead, **write an intent file** to `cowork-outbox/issue-intents/<slug>.yaml`; the Mac-side
`issue-intents` watcher applies it (create-or-update). Use the intent format below. For repo files
(templates, workflows) use the relay bundle flow instead (`cowork-relay/BUNDLE-FORMAT.md`).

**You're in the Restormel Claude chat project (no tools).** Produce the **intent YAML as text** and
hand it off per the project's convention — e.g. *"Hand to Cowork: drop this into
`cowork-outbox/issue-intents/`"* or *"Hand to Claude Code: apply with apply-issue-intents.py"*.
Don't claim to have filed it.

## Intent format (the portable unit of work)

```yaml
repo: restormel-keys            # owner is Allotment-Technology-Ltd
title: "Short imperative title"
match:                          # how to find an existing PBI before creating
  number:                       # if known, update this exact issue
  query: "distinctive words"    # else text search (Forgejo q=)
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
Reference example: `product-ops/forgejo-pack/intent/example-intent.yaml`; seed set in `intent/seed/`.

## The status lifecycle (auto-moves once #N is bound)

commit/branch refs `#N` → `in-progress` · PR opened `Ref #N` → `in-review` (QA) · merge →
`ready-deploy` · Coolify deploy → `deployed` + closed. Each transition posts a timeline comment;
commits/PRs cross-link automatically. That timeline is the audit trail — attach planning links at
creation so the PBI shows the full planning→delivery path.

## Guardrails

- Forgejo `origin` only; never the GitHub mirror. No secrets in issues/intents/logs.
- Don't build a parallel tracker — Forgejo Issues is the system of record; labels are the canonical state.
- In Cowork, route through the intent lane / relay (the sandbox can't reach Forgejo); don't fabricate success.
- If the work is record-/governance-related, also consult the **restormel-isms** skill.
