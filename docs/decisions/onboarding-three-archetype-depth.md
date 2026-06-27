---
id: REC-ADR-014
title: "Three-archetype depth model — one spine, opt-in depth"
class: decision
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-27
last-reviewed: 2026-06-27
review-interval: P12M
retention: permanent
related: [REC-ADR-013, REC-ADR-015, REC-ADR-016, REC-ADR-017, REC-ADR-018, REC-ADR-019]
---

# ADR: Three-archetype depth model — one spine, opt-in depth

## Status

**Draft** — design intent captured from the Restormel onboarding design handoff, pending product confirmation. This ADR records a decision reached in the onboarding design session; it is not yet built and not yet approved. Captured against **RES-113** — https://huly.allotmentology.tech/workbench/allotment-pm/tracker/RES-113.

## Context

Onboarding has to make an abstract product — turning a customer's documents into a queryable knowledge graph that returns grounded, cited answers — **felt fast** by someone who may never have heard of a knowledge graph. The design session framed the whole journey as five sequenced "ahas" rather than a feature tour:

- **M0 Explore** — *"it answers from real sources"* (ask a pre-built demo graph, zero commitment).
- **M1 Build** — *"that's MY knowledge now"* (point Restormel at their own docs; the conversion moment).
- **M2 Verify** — *"I can trust it"* (trust score + triage of weak/unsourced claims).
- **M3 Store** — *"it runs on MY infra"* (move the graph onto their own database, non-destructively).
- **M4 Connect** — *"my product can use it"* (wire an app or agent and see it go live).

The recurring risk in onboarding is over-serving every user the full depth (which buries beginners in choices they aren't ready for) or building three divergent journeys (which triples surface area and fractures the codebase). The session resolved this by observing that the three target users — **Initial** ("just show me it works", zero config tolerance), **Learning** ("help me build mine, properly", a few meaningful choices), and **Advanced** ("give me the levers", own infra/models/agents) — do **not** want different journeys. They want the **same** journey walked to different depths. This ADR captures that resolution so the build sequences the spine before the depth.

## Decision

**Adopt a single journey walked at three depths — not three journeys, and never a fork.**

1. **One spine for everyone.** The mandatory spine is **M0 → M1 → M4** — explore, ingest, connect — the shortest path to a live graph. Every archetype is dropped onto this spine by default. It is the "minimum to aha" for *all* users.

2. **M2 and M3 are opt-in depth, never blockers.** Verify (M2) and Store (M3) carry real value for Learning and Advanced but are **never required** to reach an aha and **must never gate** the spine. They layer onto the same screens, not into separate paths.

3. **Per-archetype paths differ only in length:**
   - **Initial** — `M0 → M1 → M4`. Most guidance, fewest levers; recommended models stay silent; never sees a model name. Often skips Verify; never enters Store (managed store, invisibly).
   - **Learning** — `M0 → M1 → M2 → M4`. Adds the trust step; a few meaningful choices with recommended defaults; one connection (widget or REST API).
   - **Advanced** — `M0 → M1 → M2 → M3 → M4`. The full journey, least hand-holding, **advanced disclosures open by default** (e.g. per-stage model pickers at ingest), own DB + production keys, many connections (MCP read & read+write, API, GraphQL).

4. **Depth is progressive disclosure on a shared screen.** Read across any milestone row: Initial gets the minimum-to-aha default, Learning expands it with a guided choice or two, Advanced expands the same step into full control behind an "Advanced" reveal or via the persistent Graph home. **No archetype ever sees a different journey.**

5. **Build implication (the structural rule):** **build the spine columns first and make them flawless** — they carry every archetype's aha — then layer M2/M3 depth onto the same screens afterwards.

## Rationale

- **Ruthless simplicity.** The shortest credible path to a live graph is three steps; making that the universal default protects the beginner's time-to-first-answer without taking levers away from the operator who wants them later.
- **One codebase, not three.** Same screens at varying depth means progressive disclosure, not branching flows — far less surface area to build, test, and keep honest than three parallel journeys.
- **Aha-first, config-second.** Verify and Store are genuinely valuable but are *depth*, not *gates*; forcing them in front of the aha would delay the conversion moment (M1) and lose Initial users who only needed to see it answer with a citation.
- **A clean shipping order.** Declaring the spine mandatory and depth opt-in gives the build an unambiguous priority: spine first, layer depth after — so an incomplete first cut is still a complete journey for every persona.

## Source artefact

- **`design_handoff_restormel_onboarding/designs/Archetype Analysis.html`** — the canonical artefact for this decision: the three-archetype definitions, the "three users, one spine" principle, and the **personas × screens matrix** with the yellow minimum-to-aha spine column and M2/M3 marked as opt-in depth. Screenshot: `design_handoff_restormel_onboarding/screenshots/11-archetype-analysis.png`.
- **`design_handoff_restormel_onboarding/01_CONCEPT.md` §3** ("The three personas") — the path definitions and the design implication that M2/M3 are opt-in depth, build the spine first.
- **`design_handoff_restormel_onboarding/05_STATE.md` §2** (PATHS) — the `PATHS` map (`initial`/`learning`/`advanced`) that drives every "Next: …" CTA and the primary Home tile.
- **`design_handoff_restormel_onboarding/08_ARTEFACTS.md` §C** — names `Archetype Analysis.html` as the artefact for the persona model and "the single most important structural rule: build the spine first, layer depth after."

## Consequences

- **Spine before depth becomes the delivery order.** M0/M1/M4 are first-class build targets; M2/M3 are additive. A first cut that ships only the spine is still a usable, complete journey for all three personas.
- **A single `persona` + `progress` state drives path logic.** Per `05_STATE.md`, `PATHS[persona]` yields "the next milestone after X", which determines the primary (yellow) Home tile and the "Next: …" CTA. The screens are shared; only path length and disclosure depth vary. In the prototype `persona` is a demo switch; in production it is inferred or asked — selecting/inferring persona is out of scope here (see Scope boundary).
- **Depth must be reachable, not mandatory.** M2/M3 surfaces have to be enterable later from the persistent Graph home (revisitable screens with URLs and status), so a user who skipped them on first pass — or was on a shorter path — can still reach them. This keeps the rail-then-home model intact.
- **Advanced disclosures default-open for Advanced only.** Per-stage model pickers and similar levers render open by default for the Advanced archetype and behind an "Advanced" reveal for others — a per-screen disclosure rule, not a separate screen.
- **Realisation surface (captured, not designed here).** In the RES-113 worktree the natural landing points are the dashboard Connect ingest flow (`apps/dashboard/src/lib/server/connect/…`) and the existing `apps/dashboard/design-system/components/setup-checklist/` component; the spine maps onto these rather than introducing a parallel onboarding stack. This ADR does not specify that mapping — it only records that the depth model constrains it (spine first).
- **Plan-B "Autopilot" stays out.** This depth model is the Plan-A shape; it does not pull any Autopilot behaviour forward.

## Scope boundary — what this does NOT decide

- **This is captured, not built.** It records design intent from the handoff for product confirmation; it authorises no implementation, route, schema, or component.
- **Plan A (MVP) only.** Scoped to the Plan-A journey + persistent-home model. Plan B "Autopilot" (`designs/Plan B - Autopilot.html`) is explicitly out of scope (`01_CONCEPT.md` §7) and is a north star, not a build target.
- **Does not decide persona assignment.** How a user is placed into Initial / Learning / Advanced (inferred vs asked, and when) is out of scope; the prototype's demo switch is not the production mechanism.
- **Does not decide the per-screen specs.** The internal mechanics of M0–M4 (ingest run console, trust gates, non-destructive store handshake, Connect wizard) are owned by their own screens and their own ADRs — this ADR governs only the depth model and shipping order across them.
- **Does not decide navigation/IA.** The 4-item spine vs Settings IA is a separate decision (`Navigation Model.html` / `02_IA_AND_NAV.md`).
- **Numbers are illustrative.** The demo `graph` figures (ideas, trust, flagged counts) in `05_STATE.md` are prototype values to be wired to real API responses; they are not part of this decision.

> Append-only intent: supersede this ADR with a new ADR rather than rewriting it.
