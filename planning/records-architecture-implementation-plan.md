---
id: REC-PLAN-002
title: Records & Information Architecture — Implementation Plan
class: planning
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-14
last-reviewed: 2026-06-14
review-interval: P6M
approved-by: founder
approved-on: 2026-06-14
retention: review-only
related: [REC-ADR-001, REC-GOV-001]
---


# Restormel Records & Information Architecture — Implementation Plan

This is the build plan for the federated, repo-anchored records architecture agreed in the design consultation. It is written to be handed to **Claude Code** to execute, with a companion **Claude Cowork** operator surface described at the end.

It assumes the design decisions already made: Forgejo is the single governance plane; one front-matter convention drives a generated records register; CI enforces freshness, schema, append-only evidence, and mirror discipline; SvelteKit is the publish layer; the wiki is deferred. If any of that is unfamiliar, read the design write-up first — this document is the *how*, not the *why*.

---

## How to use this document

- **Claude Code** executes Phases 0–6 in order. Each phase is independently valuable and ships behind a PR.
- **You (founder)** supply the items in *Decisions needed from you* and approve PRs.
- **Cowork** is set up after the plumbing exists (last section) — it's your operator cockpit, not part of the build.
- The CI machinery runs in **warn-only** mode first and is flipped to **blocking** only once green. Don't skip that ordering.

---

## Operating principles for the build agent

These are standing instructions for Claude Code. They matter more than any single step.

1. **Work in branches and PRs.** Never commit straight to `main`. One PR per phase (or per logical sub-unit within a phase). Each PR description states what it does and which acceptance criteria it satisfies.
2. **Forgejo is canonical. GitHub is a push-only mirror.** Never write to the GitHub remote. Never `git push` to it manually. The only thing that touches GitHub is the Forgejo→GitHub mirror job. If you find yourself about to push to GitHub, stop — that's the drift this whole architecture exists to prevent.
3. **Warn before you block.** All CI jobs land non-blocking. They are flipped to blocking only in Phase 4, and only after a clean run. A red pipeline on day one trains people to ignore the pipeline.
4. **Make every script idempotent.** Backfill scripts, the register generator, seed scripts — all must be safe to run twice and produce the same result. No "oops it duplicated everything on re-run."
5. **Ask before anything destructive.** `rm`, history rewrites, force-pushes, deleting branches, lifecycle deletes on object storage — surface it and wait for a yes. Disposition of records is *deliberate*, never incidental.
6. **Do not invent governance or legal content.** For policies, RoPA, SoA, legal documents: scaffold the structure, insert clearly-marked `TODO` / `[PLACEHOLDER — founder/counsel]` blocks, and flag them. A confident-looking policy full of made-up specifics is worse than an honest skeleton. Real content comes from the founder (and counsel where flagged).
7. **Stay proportionate to stage.** Restormel is a Founders-Circle UK LTD, not a 200-person org. Lean templates. Mark anything that's "later / optional / when you have customers" as exactly that. Don't build a compliance bureaucracy nobody has the headcount to feed.

---

## Decisions needed from you (human inputs)

Claude Code should gather these before the phases that need them. Most can be stubbed with placeholders and filled in later, but flag them rather than guessing.

| # | Decision | Needed by | Default if you don't decide now |
|---|----------|-----------|--------------------------------|
| 1 | **Owner identities** — Forgejo usernames/handles for each record area (eng lead, founder, etc.) for CODEOWNERS | Phase 2 | Single `@founder` owner everywhere; split later |
| 2 | **Retention numbers** — confirm the starting defaults (below) with counsel | Phase 4 (can ship as draft earlier) | Use the defaults, marked "draft — pending counsel" |
| 3 | **Object storage** — MinIO vs Garage vs Forgejo LFS for binary evidence | Phase 4 | Forgejo LFS to start (no new service); migrate later |
| 4 | **Internal-route auth** — how the authed SvelteKit route gates internal docs (Forgejo OAuth, reverse-proxy auth, etc.) | Phase 5 | Defer the internal route; ship public-only first |
| 5 | **Cowork write path** — does Cowork commit to the repo directly (via git/MCP), or draft locally for you/Claude Code to commit? | Cowork setup | Draft-locally-then-commit (more control, one manual step) |
| 6 | **Published domain** — subdomain for the public docs/legal surface | Phase 5 | Use an existing staging domain |
| 7 | **Review cadences** — confirm `review-interval` defaults per tier | Phase 1 | P12M for Tier 2, P12M soft for Tier 1 |

> **Retention defaults to confirm with counsel** (this is a starting point, not legal advice): policies — current + superseded kept 6y; compliance evidence — 3y rolling; legal document versions — all versions, 6y after no longer in force (Limitation Act horizon); DPIA/RoPA — life of the processing; incident records — 6y; most HR records — held outside this system.

---

# The phases

## Phase 0 — Decide and record (no moves)

Land the architecture as a decision before touching anything. This makes the whole plan itself the first managed record.

**Tasks**
- Create `docs/adr/00XX-records-architecture.md` capturing: the federated repo-anchored decision, the Documents-vs-Records distinction, the four control tiers, and the deferral of the wiki and dedicated GRC SaaS. Reference this implementation plan.
- Set its front-matter (`class: decision`, `control-tier: 1`, append-only intent).

**Acceptance**
- ADR merged to `main`. No files moved, nothing renamed. The decision is on the record and reversible only by another ADR.

---

## Phase 1 — Metadata, additive

Introduce the front-matter convention and backfill the existing technical docs. Purely additive — nothing moves, nothing breaks.

**Tasks**
- Author `records/SCHEMA.md` — the single source of truth for the metadata convention. Full spec below; reproduce it exactly.
- Write a **backfill script** that adds front-matter to existing files under `/docs`, deriving `last-reviewed` from each file's last commit date (`git log -1 --format=%cI -- <path>`), defaulting `class: technical`, `control-tier: 1`, `status: approved`, `classification: internal`. Idempotent — skip files that already have front-matter.
- Run it against `/docs`, open a PR, eyeball the result.

### `records/SCHEMA.md` — front-matter specification

Every managed Markdown record carries this YAML front-matter. This convention serves four consumers at once — date-stamping, the records register, the compliance/evidence agent, and eventual Connect ingest — so getting the controlled vocabularies right **before** backfilling is the single highest-leverage thing in this whole plan. Re-keying later is the one genuinely expensive mistake.

```yaml
id:              # e.g. REC-POL-001 — see ID scheme. Stable, unique, never reused.
title:           # Human-readable title.
class:           # technical | decision | planning | governance | evidence | legal | people
owner:           # Must match a CODEOWNERS entry (a person/handle, not a team alias).
status:          # draft | approved | deprecated | superseded
classification:  # public | internal | confidential | restricted
control-tier:    # 0 | 1 | 2 | 3
created:         # YYYY-MM-DD
last-reviewed:   # YYYY-MM-DD
review-interval: # ISO 8601 duration, e.g. P12M. CI computes next-review = last-reviewed + interval.
approved-by:     # REQUIRED when control-tier >= 2. The named approver.
approved-on:     # REQUIRED when control-tier >= 2. YYYY-MM-DD.
retention:       # Controlled vocabulary — see retention grammar.
supersedes:      # OPTIONAL — id of the record this replaces (lineage).
related:         # OPTIONAL — list of related ids.
```

**`classification` does triple duty** — it is the ISO access-control attribute, the per-document ACL that Connect will eventually enforce, *and* the publish gate (only `public` ever renders to the public site). The compliance metadata and the retrieval/ACL metadata are the same metadata; that's why one convention works.

**ID scheme** — `REC-<TYPE>-<NNN>`, zero-padded, never reused even after disposition:

| class | TYPE code | example |
|-------|-----------|---------|
| technical | `TECH` | REC-TECH-001 |
| decision | `ADR` (architecture) / `DEC` (business) | REC-ADR-001 |
| planning | `PLAN` | REC-PLAN-001 |
| governance | `GOV` (or `POL` for a policy specifically) | REC-POL-001 |
| evidence | `EVID` | REC-EVID-001 |
| legal | `LEG` | REC-LEG-001 |
| people | `PPL` | REC-PPL-001 |

**Retention grammar** — controlled vocabulary, not free text:
- `P<duration>` — keep for a fixed period from `created` (e.g. `P3Y`).
- `P<duration>-after-<trigger>` where `<trigger>` ∈ `superseded` | `no-longer-in-force` | `processing-ends` (e.g. `P6Y-after-superseded`).
- `life-of-processing` — keep while the processing it documents is active (RoPA, DPIA).
- `permanent` — never disposed.
- `review-only` — no retention obligation; kept at owner's discretion.

**Binaries can't carry front-matter.** A binary record (a signed PDF, an exported report) gets a **sidecar** `<filename>.meta.yaml` carrying the same fields, plus a register entry. Example: `evidence/q1-access-review.pdf` + `evidence/q1-access-review.pdf.meta.yaml`.

**Acceptance**
- `records/SCHEMA.md` merged.
- All existing `/docs` files carry valid front-matter; `last-reviewed` reflects real commit history; re-running the backfill changes nothing.

---

## Phase 2 — Register and CI (warn-only)

Stand up the generated register and the enforcement machinery — but every check is **non-blocking** for now.

**Tasks**

**The register generator.** Write a script that produces `records/register.yaml` from source. Behaviour:
- Walk the repo tree. For every Markdown file with front-matter, extract the fields. For every binary with a `.meta.yaml` sidecar, extract those. For every line in `evidence/ledger.jsonl`, include it as a record.
- Emit a single flat, **deterministically sorted** list (sort by `id`) with each record's key fields plus a computed `next-review` (`last-reviewed` + `review-interval`).
- Deterministic output: running twice on an unchanged tree produces byte-identical files. This is what makes `register-verify` possible.
- The register is *generated*, never hand-edited. It cannot drift from source because it *is* source, recompiled.

**The six Forgejo Actions** (all warn-only at this stage):

1. `frontmatter-validate` — schema check against `SCHEMA.md`. For `control-tier >= 2`, missing `owner`/`approved-by`/`approved-on`/`retention` is an error (warning for now); Tier 1 missing optional fields is a warning.
2. `freshness-check` — compute `next-review`; warn at T-30 days; for `control-tier >= 2`, overdue is an error (warning for now).
3. `register-generate` + `register-verify` — regenerate the register and assert the committed file matches the freshly-generated one. Catches a stale committed register.
4. `ledger-append-guard` — diff `evidence/ledger.jsonl` against the previous commit; fail if any *prior* line was changed or removed. New lines appended at the end are fine. Enforces append-only evidence.
5. `mirror-verify` — assert the GitHub mirror's `HEAD` equals Forgejo's `HEAD`, and that no commit landed on GitHub that didn't come through the mirror job.
6. `codeowners-check` — assert every tracked record path is covered by a CODEOWNERS rule. No orphaned records with no owner.

**CODEOWNERS** — map paths to owners (handles are placeholders pending Decision #1):

```
/docs/            @eng-lead
/docs/adr/        @eng-lead
/decisions/       @founder
/planning/        @founder
/governance/      @founder      # ISMS owner
/evidence/        @founder
/legal/           @founder      # counsel reviews out-of-band
/people/          @founder
/records/         @founder
```

**Mirror discipline** — configure Forgejo→GitHub as a push mirror; branch-protect `main` on the GitHub side so nothing can be written there directly; the `mirror-verify` job is the assertion that this holds.

**Acceptance**
- `records/register.yaml` exists and is generated, not hand-written.
- All six jobs run on PRs, all non-blocking, and a clean run is green.
- CODEOWNERS covers every record path.
- GitHub mirror is push-only and branch-protected; `mirror-verify` passes.

---

## Phase 3 — Bring planning home

Move planning artefacts into the repo and re-point Claude Projects to ingest *from* the repo rather than being the home itself. This closes the sovereignty gap where planning lived only in a US-SaaS project's knowledge.

**Tasks**
- Create `/planning`. Move the context pack, PRDs, and positioning docs in, with `class: planning`, `control-tier: 1`, `classification: internal`.
- Re-point Claude Projects so its knowledge is a **projection** of `/planning`, not the source. The repo file is canonical; the Project ingests a copy. (Exact mechanism depends on current Projects sync options — if no live sync exists, document a simple refresh step the founder runs.)

**Acceptance**
- Planning docs live in `/planning` with valid front-matter.
- Claude Projects reads from the repo; there is exactly one place to edit any planning fact, and it's the repo.

---

## Phase 4 — Greenfield compliance, then flip to blocking

Create the governance and evidence areas from scratch (no migration cost — none of this exists yet), then turn the CI from advisory to enforcing.

**Tasks**

**Seed `/governance`** (Tier 2 — scaffold + flagged placeholders, do not invent content):
- `governance/information-security-policy.md` — skeleton.
- `governance/access-control-policy.md` — skeleton.
- `governance/risk-register.yaml` — structured, with one or two clearly-marked example rows.
- `governance/ropa.yaml` — Record of Processing Activities skeleton (living register).
- `governance/soa.md` — Statement of Applicability stub referencing ISO 27001 Annex A controls with a per-control status.
- `governance/suppliers.yaml` — supplier register.
- `governance/asset-inventory.yaml` + `governance/data-inventory.yaml` — CIS Controls 1–2; the asset/data inventory feeds the RoPA.

**Seed `/evidence`** (Tier 3 — append-only / immutable intent):
- `evidence/ledger.jsonl` — empty, for non-file events (the things that don't warrant their own file).
- `evidence/templates/access-review.md`, `posture-report.md`, `dpia.md`, `incident.md`.
- `evidence/posture/` — directory for generated posture reports.

**Wire object storage** (Decision #3): stand up the chosen backend (MinIO/Garage on Coolify, or Forgejo LFS), establish the `.meta.yaml` sidecar + register-entry pattern for binaries, and configure lifecycle rules for retention. Disposition is **logged in the register**, never a silent `git rm` or bucket delete.

**Flip CI to blocking** — once a full run is green, make `frontmatter-validate`, `freshness-check`, `ledger-append-guard`, and `register-verify` **blocking for Tier 2 and Tier 3 records**. Tier 0/1 stay advisory. This is the moment the architecture starts holding the line on its own.

**Acceptance**
- `/governance` and `/evidence` exist with seeded skeletons; all generated/invented content is clearly flagged for the founder/counsel.
- Object storage is wired with the sidecar pattern and lifecycle rules.
- CI is blocking for Tier 2/3 and a clean run is green. A Tier 2 doc that goes stale, or loses its approver, now *fails the build*.

---

## Phase 5 — Publish layer

Make the SvelteKit surface render from the repo, gated by `classification`.

**Tasks**
- Build-time rendering: read front-matter; **only `classification: public` renders to public routes**.
- Public route: legal documents and API docs, each showing **effective dates and version history** (drawn from `supersedes` lineage + commit history).
- Authed internal route (Decision #4): internal/confidential docs behind auth. If undecided, ship public-only and defer.
- Sub-processor change hook: when the sub-processor list changes, fire a notification (for the customer-facing change-notification obligation).

**Acceptance**
- Public site renders only `public` records; nothing internal leaks.
- Legal/API pages show effective dates and prior versions.
- Sub-processor changes trigger a notification path.

---

## Phase 6 — Evidence agent, then Connect

The recurring agent that produces posture reports and opens issues — and the bridge to dog-fooding Connect.

**Tasks**
- Scheduled job (Forgejo Action cron, or Coolify cron): read the register + front-matter, produce a **dated posture report** to `evidence/posture/` listing overdue / missing / stale records, and **open issues** for overdue Tier ≥ 2 items.
- The posture report is itself a Tier 3 compliance record — standing proof that the ISMS is monitored — *and* the first real Connect workload.
- **Connect bridge (later):** point Connect at the repo tree, using the front-matter convention as its schema. The evidence agent becomes a Connect app. This is the dog-food goal; mark it as a milestone, not part of the initial build.

**Acceptance**
- Posture reports generate on schedule and land in `/evidence/posture/`.
- Overdue Tier ≥ 2 records auto-open issues.
- The front-matter convention is documented as Connect's ingest schema for when Connect is wired in.

---

# The Cowork operator surface

The build above is Claude Code's job — repo plumbing, CI, templates, the agent. **Cowork is a different surface for a different job: it's your non-technical operator cockpit** for the irreducible human work that no amount of automation removes.

Recall the honest division from our earlier conversation: the system runs all the bookkeeping and enforcement, but it can't perform real-world controls or substitute your judgement. Cowork is where *you* do that small core of real work — with the admin tax stripped out.

## What Cowork is

Claude Cowork is the agentic mode in the **Claude Desktop app** (not the terminal) — same agent architecture as Claude Code, aimed at non-coding knowledge work. It runs locally in an isolated VM, with **folder-level access to your local files** and **MCP connectors**, on paid plans (Pro/Max/Team/Enterprise), on macOS and Windows. It supports **recurring tasks via `/schedule`**.

> Product facts current as of this session (2026-06-14); Cowork is in active research preview, so check the release notes for changes. Sources: get-started — https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork ; product page — https://claude.com/product/cowork ; release notes — https://support.claude.com/en/articles/12138966-release-notes

## Two honest limitations — read before relying on it

These follow directly from the house guardrails and matter for a sovereignty-first compliance setup:

1. **Cowork is Anthropic-side / US-SaaS** — same sovereignty class as Claude Projects. That's *acceptable here* because your records **live on sovereign Forgejo**, not in Cowork. Cowork is an operation-and-drafting surface in front of the system of record, not the system of record itself.
2. **Cowork is currently flagged as not suitable for regulated data** — the platform lacks audit-log / compliance-API / data-export tracking of Cowork activity. Practical consequence: don't make Cowork hold your most sensitive evidence, and don't treat a Cowork session as the audit trail. The canonical artefact and the trail live in the **repo + CI**, which *do* give you attributable history. Cowork drafts, operates, and reminds; the repo records.

## Keeping the repo canonical

Everything Cowork produces must land in the repo via commit/PR, so a Cowork-drafted policy goes through the **same CI** (schema, freshness, register) as anything else — held to the identical standard. Two ways to wire that (Decision #5):

- **(a) Cowork commits directly** — via a git MCP connector or by working in a checked-out clone in a granted folder, then opening a PR. Most automated; depends on Cowork's git capability and your comfort letting it commit.
- **(b) Cowork drafts, you commit** — Cowork writes into a local drafts folder; you (or Claude Code) commit. One manual step, clearer human-in-the-loop, more control.

Either way the PR hits CI, and the repo remains the control plane.

## Setup steps

1. Install Claude Desktop and enable Cowork (paid plan).
2. Grant Cowork folder access to a **local clone of the repo** (route a) or a **dedicated drafts folder** (route b).
3. Add MCP connectors you'll use — git (if route a), issue tracking, and whatever access-management tools the access review needs to read from. Claude in Chrome can serve as a connector for pulling things from web admin consoles.
4. Install the role playbooks below as Cowork agents/plug-ins.
5. **On `/schedule`:** it requires the desktop app open and the computer awake — scheduled tasks stop when the app closes, and it doesn't sync. So treat Cowork `/schedule` as a *convenience nudge*, and let the **Forgejo cron evidence agent (Phase 6) be the reliable, canonical scheduler**. The repo reminds you whether or not your laptop is on.

## The recurring playbooks

These map one-to-one onto the irreducible human core. In each, Cowork removes the admin tax; the judgement stays yours.

- **Quarterly access review.** Cowork pulls current access lists (via MCP / Chrome connector), diffs against the last review, flags anomalies, you decide revocations, and it drafts the access-review record from the template → into the repo (PR). *You* decide who keeps access; Cowork assembles and files. (A review closed four seconds after it opened still tells its own story — the point is to actually look.)
- **Policy review.** When the posture report flags a policy as due, Cowork opens it, summarises what's changed in the business since the last review, proposes edits, you approve → PR. Collapses to review-a-draft.
- **Incident / material-change capture.** A quick-capture playbook: you describe what happened, Cowork drafts the incident or change record to template → ledger line or record file → PR. Logged while it's fresh.
- **Annual management review.** Cowork assembles the pack from the repo (risks, incidents, posture reports, objectives), walks you through the agenda, and captures your decisions as a management-review record → PR.
- **Drafting governance docs.** Seeding and expanding policies, RoPA entries, SoA notes — review-a-draft instead of write-from-scratch.

The through-line is the same as the rest of the system: Cowork makes the real work cheaper and runs the reminders and playbooks, but it can't run the access review *for* you or decide *for* you. It clears everything around the judgement so the only thing left for you to spend effort on is the judgement.

---

# Build-order checklist

- [ ] **Phase 0** — ADR recording the architecture (no moves)
- [ ] **Phase 1** — `SCHEMA.md`; backfill front-matter on `/docs`
- [ ] **Phase 2** — register generator; six Forgejo Actions (warn-only); CODEOWNERS; mirror push-only + branch-protected
- [ ] **Phase 3** — `/planning` populated; Claude Projects re-pointed to ingest from repo
- [ ] **Phase 4** — seed `/governance` + `/evidence`; object storage; **flip CI to blocking for Tier 2/3**
- [ ] **Phase 5** — SvelteKit classification-gated rendering; public legal/API with effective dates + versions
- [ ] **Phase 6** — scheduled evidence agent → posture reports + auto-issues; Connect bridge (later)
- [ ] **Cowork** — desktop setup; folder/MCP access; role playbooks; canonical scheduling stays on Forgejo cron

> Reminder for the build agent: get the controlled vocabularies in `SCHEMA.md` right **before** backfilling. Re-keying later is the one expensive mistake.
