---
id: REC-ADR-020
title: "One adaptive onboarding path — explicit personas retired"
class: decision
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-27
last-reviewed: 2026-06-27
review-interval: P12M
approved-by: founder
approved-on: 2026-06-27
retention: permanent
supersedes: REC-ADR-014
related: [REC-ADR-013, REC-ADR-014, REC-ADR-021]
---

# ADR: One adaptive onboarding path — explicit personas retired

## Status

**Approved (founder, 2026-06-27).** **Supersedes [REC-ADR-014](onboarding-three-archetype-depth.md)** (the three-archetype depth model). Decided in the RES-113 onboarding direction session; tracked under **RES-113** — https://huly.allotmentology.tech/workbench/allotment-pm/tracker/RES-113.

## Context

REC-ADR-014 captured a **three-archetype depth model** — Initial / Learning / Advanced — where the same journey is walked to different depths, the path chosen by which persona the user is. That model assumed a persona is assigned (in the prototype, a demo switch; in production, "inferred or asked"). Two facts make the explicit-persona version the wrong thing to build:

- **There is no persona-inference mechanism, and two incumbent taxonomies collide with it.** The codebase has a derived 2-phase `initial|operational` (`connect-journey.ts`) and a currently-disabled 5-mode `user-mode` store — neither is the handoff's 3-archetype model, and nothing infers a persona today. Building a third taxonomy *plus* an inference engine is real machinery.
- **Ruthless simplicity is the guiding principle.** A pre-assigned persona that gates path length is a lever the product has to set, store, and reason about. The depth a user needs is already legible from the **state of their graph and what they are doing** — so the path can adapt itself without a persona variable at all.

## Decision

**Retire the explicit Initial / Learning / Advanced personas. There is ONE adaptive onboarding path that progressively discloses depth from real graph state and user actions — no persona is inferred, asked, or stored.**

- **The mandatory spine survives unchanged: M0 → M1 → M4 is the universal path** to a live graph, for *every* user. (This invariant carries over from REC-ADR-014.)
- **M2 Verify and M3 Store remain opt-in depth, never blockers** — but they are surfaced by **state and affordance**, not by a pre-assigned archetype: e.g. **Verify** comes forward when the graph has flagged/low-trust claims to triage; **Store (own-DB)** is an always-available advanced affordance for the user who wants their own infra. Depth appears when it is relevant, and is always reachable from the persistent Home; it is never forced and never gated behind a persona.
- **No persona model.** There is no `persona` field driving path length, no inference, and no "which archetype are you" question. The `PATHS[persona]` construct from the prototype's state model (`05_STATE.md` §2) is **replaced** by a path **derived from graph state** (the next sensible action falls out of what is and isn't done yet).

## Rationale

- **Less to build, nothing to get wrong.** No taxonomy, no inference engine, no persona persistence, no collision with the two incumbent taxonomies — the single largest simplicity win available in the onboarding redesign.
- **One path to build and test, not three.** Progressive disclosure on a shared journey is far less surface than three parallel paths, and a first cut of the spine is automatically complete for everyone.
- **The depth still gets to the people who want it** — it is surfaced by the graph's own state (flagged claims → Verify) and by a standing advanced affordance (own-DB → Store), which is a *more honest* trigger than a guessed persona.
- **It coheres with the rest of the direction:** journey position is derived from server state, not a persisted client store; there is one Home, one path, one vocabulary (REC-ADR-021).

## Consequences

- **Path logic derives from graph state, not a persona.** The "what's my next step / which Home tile is primary" computation reads the real spine/hub payload, consistent with the codebase's server-derived spine and its deliberate avoidance of the client-blocker pattern.
- **Progressive-disclosure rules replace persona branches.** Each surface decides what to reveal from state (e.g. Verify foregrounds when `flagged > 0`; Advanced disclosures like per-stage model pickers and own-DB are available on demand, not persona-defaulted-open).
- **REC-ADR-014 is superseded** but its two durable principles (mandatory spine; opt-in depth) are preserved here verbatim — only the explicit-persona mechanism is dropped.
- **Downstream records that referenced the 3 personas** (e.g. the model-at-ingest "advanced disclosure open for the Advanced persona") are reread as "open on demand / when state warrants," not "open for persona X."

## Scope boundary

- Decides **only** that the journey is one state-adaptive path with no explicit personas. It does **not** re-decide the milestone ladder (REC-ADR-013), the per-milestone mechanics, or the IA/vocabulary/Home/release calls (REC-ADR-021).
- It does **not** forbid ever asking a single lightweight intent question in future; it forbids building a **persona taxonomy + inference** now. Revisit by a superseding ADR if a real need appears.
- **Plan A (MVP) only**; Plan B "Autopilot" remains out of scope (REC-ADR-019).

---

**Append-only.** Supersede with a new ADR rather than rewriting this file. If personas are ever reintroduced, do it via a record that supersedes REC-ADR-020.
