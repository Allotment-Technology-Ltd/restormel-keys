---
id: REC-ADR-019
title: "Plan A (guided journey) is the MVP; Plan B (Autopilot) is an out-of-scope north star"
class: decision
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-27
last-reviewed: 2026-06-27
review-interval: P12M
retention: permanent
related: [REC-ADR-013, REC-ADR-014, REC-ADR-015, REC-ADR-016, REC-ADR-017, REC-ADR-018]
---

# ADR: Plan A (guided journey) is the MVP; Plan B (Autopilot) is an out-of-scope north star

## Status

**Draft** — design intent captured from the Restormel onboarding design handoff, pending product
confirmation. This ADR records a design decision; it does not authorise the build. Tracked under
**RES-113** — https://huly.allotmentology.tech/workbench/allotment-pm/tracker/RES-113.

## Context

The onboarding design session produced two distinct product directions for how a customer reaches
first value with Restormel — turning their documents into a queryable knowledge graph that returns
grounded, cited answers:

- **Plan A — the guided journey + persistent home.** An opinionated rail walks a new user through
  the five "aha" milestones (M0 Explore → M1 Build → M2 Verify → M3 Store → M4 Connect), gated, one
  decision at a time, to a live graph; after the first pass every area becomes a revisitable
  destination on a persistent dashboard the user lives in. The whole handoff bundle specifies this
  plan. Three personas (Initial / Learning / Advanced) differ only in how far down the spine they
  travel, with the mandatory spine being M0→M1→M4 and M2/M3 as opt-in depth.

- **Plan B — "Autopilot."** A clean-sheet, radically different interaction model: the user *briefs
  an operator* once in a single sentence ("answer support questions from our Notion + Zendesk, in
  Slack, read-only"), approves a proposed run-sheet, and the system runs the whole spine
  (build → trust → connect) end-to-end — pausing only for decisions that are genuinely the user's
  (a provider key, a non-destructive data choice) and **auditing itself** for trust, bringing only
  pre-triaged exceptions to ratify. Steady state is an "anti-dashboard": one mission you steer by
  intent, not a 13-section nav you navigate.

Both plans share the identical visual system, the same five ahas, and the same honesty/safety
principles — by design, so a future A/B test would read cleanly with the interaction model as the
only variable. The handoff explicitly forces the choice of what this build ships, and warns against
building Plan B (`01_CONCEPT.md` §7: "do not build B yet").

## Decision

**Plan A is the MVP we build and ship to test the market.** It is the opinionated guided
M0–M4 rail to first value, followed by the persistent dashboard the user lives in. It is the
safer, more buildable bet.

**Plan B (Autopilot) is captured but explicitly out of scope for this build.** It is preserved as
an annotated concept walkthrough (intro + seven frames + an A/B contrast table) so the vision and a
clean A/B framing are not lost, and is treated as a **north star to grow toward** — not a
deliverable. **Do not implement Plan B in this build.**

## Rationale

- **Buildability and risk.** Plan A is the safer, more buildable bet; Autopilot's "operator that
  runs the whole spine and self-audits" carries materially higher build complexity, which is the
  stated reason it is deferred (`01_CONCEPT.md` §7).
- **Market test first.** Plan A is the thing we are testing the market with; shipping it does not
  foreclose Autopilot — it earns the evidence to justify it.
- **A clean future A/B is preserved.** Because both plans share brand, ahas, and honesty
  principles, the captured Plan B keeps a clean A/B framing for later. The Autopilot artefact even
  names what such a test would measure — time to first grounded answer, setup completion rate, trust
  in results, perceived control, and returns to edit — and the bet each plan makes (Plan A risks
  "too much work to reach value"; Plan B risks "too little control / trust in autopilot").
- **No lost vision.** Capturing rather than discarding Autopilot protects the long-term product
  intent without committing engineering to it now.

## Source artefact

- **Design:** `design_handoff_restormel_onboarding/designs/Plan B - Autopilot.html`
  (the annotated Autopilot concept walkthrough and the A/B contrast table). Plan A is specified by
  the rest of the bundle — canonically `designs/Restormel Prototype.html`.
- **Screenshot:** `design_handoff_restormel_onboarding/screenshots/15-plan-b-autopilot.png`.
- **Docs:** `01_CONCEPT.md` §7 ("Plan A vs Plan B — do not build B yet") and `08_ARTEFACTS.md` §E
  ("The alternative bet — captured, not built"), plus the provenance map entry "Plan A is MVP;
  Autopilot is a north star → `Plan B - Autopilot.html` → `01_CONCEPT.md` §7".

## Consequences

- The build effort scopes to Plan A: the guided M0–M4 rail plus the persistent status-tile home,
  realised in the existing SvelteKit dashboard (`apps/dashboard`), reusing the codebase
  neo-brutalist token layer rather than the bundle's mock stylesheet. The single consolidated
  Connect area that Plan A specifies aligns with the dashboard's existing Connect surface
  (`apps/dashboard/src/routes/connect`).
- The Plan B artefact is retained in the repo as captured intent and reference for a later A/B,
  not as a backlog build item. Any future move to build Autopilot requires its own decision record.
- The product keeps a documented north star, so later prioritisation discussions inherit a
  pre-framed A/B with named success metrics rather than starting cold.
- No Plan B surfaces (single-prompt brief, autonomous run, self-audit-and-ratify, mission
  anti-dashboard) are to appear in this build, even partially.

## Scope boundary

- **This is captured-not-built for Plan B and MVP-scope for Plan A only.** It decides *which*
  direction we ship (Plan A) and that Plan B is preserved as a non-built north star. It does **not**
  authorise, design, or schedule any Plan B implementation.
- It does **not** design the Plan A build itself — the milestone screens, IA, state shape, and
  copy are specified by the rest of the handoff bundle and any follow-on build records, not here.
- It does **not** commit to running an A/B test, nor define its statistics, sample, or timing — it
  only notes that the captured artefact keeps that option open.
- It does **not** change the visual system, the five ahas, or the honesty/safety principles, which
  are common to both plans.

---

*Append-only record.* Do not rewrite this decision in place. If the choice changes — for example
if Autopilot moves into scope or an A/B test is authorised — supersede it with a new ADR that
references this one, rather than editing this file.
