---
id: REC-ADR-022
title: "First-run Home is minimal and state-derived — R3-U4 superseded for the onboardingJourney path"
class: decision
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-07-01
last-reviewed: 2026-07-01
review-interval: P12M
approved-by: founder
approved-on: 2026-07-01
retention: permanent
supersedes: "docs/reviews/wave-r-design-usability-rubric.md — rule R3-U4 (scoped to onboardingJourney-flag-ON Home only; R3-U4 unchanged for flag-OFF)"
related: [REC-ADR-013, REC-ADR-019, REC-ADR-020, REC-ADR-021]
---

# ADR: First-run Home is minimal and state-derived — R3-U4 superseded for the onboardingJourney path

## Status

**Approved (founder, 2026-07-01).** Recorded to resolve a live conflict found while diagnosing
why the RES-113 redesign doesn't yet read as novice-friendly. Drafted in the RES-113 MVP
refinement plan (§2) and approved by the founder together with the nav-style, Store-timing and
Verify-persistence decisions recorded in the Consequences below. Tracked under **RES-113**.

## Context
R3-U4 requires: "First-run = unlit ledger. Cold workspace renders the same masthead with unlit
rows... Any separate onboarding widget/wizard card/'getting started' block = fail." It targeted
a specific anti-pattern — a wizard bolted beside the old Verified-Context masthead — assuming
Home was a fixed six-panel set (trust cap, factor rails, ready-to-verify, inbox, runs, agent
traffic) for every user, always.

REC-ADR-020, approved 15 days later, redefines Home's job entirely: one adaptive path, a
mandatory minimal M0→M1→M4 spine, with M2 Verify and M3 Store strictly opt-in, surfaced only
when real graph state warrants it. Depth "must stay reachable but never forced or
default-visible for an empty/early workspace" — the opposite instruction to R3-U4's literal text.

The shipped code confirms which one the build followed:
`apps/dashboard/src/routes/keys/dashboard/home/+page.svelte`, `onboardingJourney` flag ON,
renders `M2VerifyHub` unconditionally — trust meter, three gates (Sources/Embed/Validate), a
triage-queue card, the scorecard rails, and the K4 readiness ledger — regardless of whether the
workspace has ever run an ingest. This is R3-U4's "render the full apparatus, just unlit" logic
taken to its endpoint, and it is the mechanism behind the founder's "not streamlined" verdict.

## Decision
For the onboardingJourney-flag-ON path, REC-ADR-020 wins. R3-U4's mandate to render the full
masthead (unlit) on first run is **superseded**. Its anti-pattern rule — Home is ONE surface,
never a second bolted-on onboarding widget — is **preserved**, restated here:

1. **Home is singular.** No separate wizard/getting-started card exists anywhere; every state
   renders inside the one Home route.
2. **Home's content is state-derived, not fixed.** An empty/early workspace (no completed
   ingest run) renders only the M0/M1 invitation — what a graph is, one CTA into ingest —
   nothing else. `M2VerifyHub`, the trust meter, gates, and triage queue do not render.
3. **M2 Verify appears only when state warrants it** (REC-ADR-020's own trigger): once ingest
   produces claims, and only then, do outstanding/flagged counts promote Verify content onto
   Home — showing only what's outstanding, not the full gate/meter/triage set pre-emptively.
4. **One primary action per state**, per the redesign's own success criterion.

## Rationale
R3-U4 predates the M0–M4 adaptive-path decision and encoded an assumption (fixed full masthead)
that decision later replaced. REC-ADR-020 is later, onboarding-specific, and founder-approved
with novice-friendliness as its explicit goal; R3-U4's genuine contribution (no second
onboarding UI) is kept, not discarded.

## Consequences
- `+page.svelte`'s `onboardingJourney` branch must gate `M2VerifyHub` behind real graph state
  instead of rendering it unconditionally.
- R3-U4 remains fully in force, unedited, for the flag-OFF legacy masthead — the byte-identical
  invariant is untouched.
- Wave R rubric gets an annotation pointing here for the flag-ON surface; the historical R3-U4
  text is not rewritten (append-only).
- **Nav style is STRIPPED/minimal (founder decision, 2026-07-01).** On the flag-ON journey nav,
  unreachable items render as plain dimmed text — **no** status dots, **no** count badges, **no**
  inline lock-reason text in the chrome. Clicking a dimmed item explains why it is locked: the
  reason lives behind the click, not in the nav. This overrides the orientation-rich drafting
  (dots, inline "locked because…" text, Verify badge) in the RES-113 nav/IA spec; the discovery
  requirement (a novice can find out WHY something is locked) is satisfied by the click-through
  explanation.
- **Settings/Store is present from S1 (empty workspace) onward — collapsed, never promoted
  (founder decision, 2026-07-01).** Store/M3 existence is not gated on ingest state; this is the
  REC-ADR-020-conformant reading ("always-available advanced affordance"), and the nav spec's
  "Settings group appears at S2" language is struck.
- **The Verify tab is monotonic — once shown, it stays (founder decision, 2026-07-01).** This is
  explicitly a **UX choice beyond this ADR's (and REC-ADR-020's) own text**: the ADR trigger is
  forward-only (Verify comes forward when flagged/low-trust claims exist) and says nothing about
  removal. Persistence is adopted to avoid mid-session nav flicker, and is recorded as a
  deliberate UX decision, not an ADR-derived requirement.

## Scope boundary
Decides only first-run/early-state Home composition for the onboardingJourney flag. Does not
reopen the M0–M4 ladder (REC-ADR-013), the adaptive-path decision (REC-ADR-020), or MVP scope
(REC-ADR-021).

---

**Append-only.** Supersede with a new ADR rather than rewriting this file.
