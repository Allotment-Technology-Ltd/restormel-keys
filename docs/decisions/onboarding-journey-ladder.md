---
id: REC-ADR-013
title: "Onboarding as a learn-by-doing milestone ladder (M0–M4)"
class: decision
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-27
last-reviewed: 2026-06-27
review-interval: P12M
retention: permanent
related: [REC-ADR-014, REC-ADR-015, REC-ADR-016, REC-ADR-017, REC-ADR-018, REC-ADR-019]
---

# ADR: Onboarding as a learn-by-doing milestone ladder (M0–M4)

## Status

**Draft.** Design intent captured from the Restormel onboarding handoff bundle; pending product confirmation before any build commitment. This ADR is the *decision of record* for the onboarding journey's shape; the authoritative rationale lives in the cited handoff artefacts. Tracked as **RES-113** — https://huly.allotmentology.tech/workbench/allotment-pm/tracker/RES-113.

## Context

Restormel turns a customer's documents into a queryable knowledge graph that returns grounded, cited answers. Onboarding's job is to make that abstract value *felt, fast*, by someone who has never heard of a knowledge graph. A feature-led tour (Ingestion → Validation → Endpoints) fails this: it leads with mechanism, names nouns, and front-loads choices the user is not yet equipped to make.

The handoff design consultation settled the central navigation question — how a brand-new user reaches a live graph without being trapped by choice, while a returning user still gets a place they can live in and revisit. The resolution is to model onboarding not as a feature list and not as a one-shot wizard, but as a sequence of **realisations** ("ahas"), each earned by doing one concrete thing, that later collapses into a persistent, revisitable hub. The same pass cut the information architecture from ~13 destinations to a tight spine, because a sprawling nav neither mirrors the user's loop nor reinforces the ahas.

This record captures that decision so the journey's spine is not silently reordered or re-scattered during build.

## Decision

**1. Model onboarding as a five-milestone ladder that sequences ahas, not features.** Each milestone delivers exactly one realisation, in order:

- **M0 Explore — *"it answers from real sources."*** Ask a pre-built demo graph a question, get a cited answer. Zero commitment, instant value, before any setup.
- **M1 Build — *"that's MY knowledge now."*** Point Restormel at the user's own docs, watch it ingest, ask the same way. The conversion moment.
- **M2 Verify — *"I can trust it."*** See a trust score, triage weak/unsourced claims, watch the score climb to production-grade.
- **M3 Store — *"it runs on MY infra."*** (Advanced only.) Move the graph from the managed store onto the user's own database, safely and non-destructively.
- **M4 Connect — *"my product can use it."*** Wire an app or agent to the graph and see it go live.

Every screen leads with the aha, not the mechanism: headlines are outcomes ("Build your graph", "Make it trustworthy", "Connect your app"), never nouns ("Ingestion", "Validation", "Endpoints").

**2. Opinionated guided rail on first pass; persistent revisitable Home afterwards.** A new user is walked M0→M4 gated, one decision at a time, so they reach a live graph without facing choices they are not ready for. After the first pass, every area becomes revisitable in any order, and the journey becomes a **persistent Home** — a dashboard of status tiles that always surfaces the one sensible next action. The two coexist: the rail never traps (Home is always reachable), and Home never dumps (it always points at the next step). Journey position is *derived from graph state*, not a separate wizard router.

**3. The ruthless-efficiency IA is the structural expression of this.** The navigation is a **4-item spine — Home · Build · Verify · Connect** — plus a tucked **Settings** group (Providers, Store, Routes, Audit, Metrics). Primary sections are action verbs aligned to the ahas; occasional config and opt-in depth do not earn top-level nav. The milestone→section mapping is `m0→home, m1→build, m2→verify, m3→store(Settings), m4→connect`. Note M3/Store is deliberately *not* in the primary spine — it is advanced-only depth.

## Rationale

- **Felt value beats explained value.** Sequencing one realisation per milestone gets a never-heard-of-a-knowledge-graph user to a cited answer (M0) and then to *their own* cited answer (M1) before asking for commitment — the conversion happens because the value was experienced, not described.
- **Rails for the unsure, a hub for the returning.** First-timers need an opinionated single-decision-at-a-time path; repeat users need an any-order home they live in. Modelling the journey as a state-derived rail that resolves into a hub serves both from one structure instead of a throwaway wizard plus a separate dashboard.
- **A narrow spine mirrors the loop and reinforces the ahas.** The original ~13 destinations blurred together (Prove / Agents / Connections / Gateway-keys all sounded like "connect"). Collapsing to Build → Verify → Connect makes the nav teach the mental model, and keeps occasional config from competing with the primary loop.
- **This is the captured design intent, not an implementation.** The handoff is explicit that the artefacts encode *intent* (order of steps, which aha each delivers, the rail↔home balance); the mechanic may adapt to what the real data and APIs allow, but the spine and its sequence are the durable decision.

## Source artefact

- **Primary structural artefacts** (under `design_handoff_restormel_onboarding/designs/`): `Onboarding Journey.html` — the five-milestone ladder (per rung: need, aha, gate, what it reveals; plus first-run vs returning-user home frames); `Navigation Model.html` — the ruthless-efficiency IA (≈13 → 4-item spine + tucked Settings, and the rail↔home coexistence / redoable-actions map). Supporting: `Archetype Analysis.html` (personas × screens, the mandatory M0→M1→M4 spine with M2/M3 as opt-in depth) and `Restormel Prototype.html` (the synthesised end-to-end clickable reference).
- **Screenshots:** `design_handoff_restormel_onboarding/screenshots/09-onboarding-journey.png` and `12-navigation-model.png`.
- **Explanatory docs:** `01_CONCEPT.md` §2 (sequence ahas, not features), §4 (opinionated rails → persistent home) and §5.9 (ruthless-efficiency nav); `02_IA_AND_NAV.md` (the final 4-item IA and state-derived routing); and the provenance map in `08_ARTEFACTS.md` ("Sequence ahas, not features", "Guided rail → persistent home", "Ruthless-efficiency nav (4 + Settings)").

## Consequences

- **The spine becomes the build order, not just the nav.** The mandatory path M0→M1→M4 is the "minimum to aha" for every persona; M2 (Verify) and M3 (Store) layer on as opt-in depth and must never be blockers. Build the spine first, layer depth after.
- **Home is the highest-leverage screen.** It is where the user lands every session after the first and carries the "opinionated but not trapping" balance — status tiles, a graph hero, locked tiles that state a reason, and exactly one yellow next action.
- **The current dashboard nav must converge toward the 4-item spine.** As realised in the worktree, today's `apps/dashboard/src/lib/nav-config.ts` / `dashboard-hub-nav.ts` still expose the very sections this decision consolidates — separate **Prove**, **Agents**, and **Routes** strips (e.g. `PROVE_HUB_TABS`, `AGENTS_HUB_TABS`, `ROUTES_HUB_TABS`). Adopting this ADR means folding Prove → a Home action, Agents/Gateway-keys → Connect, and Routes/Store/Metrics/Audit → the tucked Settings group, with journey position derived from graph state rather than a wizard router. This is a re-shaping target, not a finished mapping.
- **Verbs over nouns is a copy constraint, not just a label choice** — it propagates into headlines, section names, and Home tile actions, and downstream ADRs in this set (per-milestone decisions) inherit it.
- **Reordering the ladder is a governed change**, not a casual nav tweak — the sequence *is* the decision, so any change to milestone order or spine membership should come via a superseding ADR.

## Scope boundary

This record decides **only** the *shape* of the onboarding journey: the five-milestone aha ladder (M0–M4), the rail→persistent-home model, and the 4-item-spine IA that expresses it. It explicitly does **not**:

- **Build anything.** This is captured design intent pending product confirmation — no Svelte routes, components, state objects, or nav config are committed by this ADR.
- **Decide the per-milestone mechanics** — model-at-ingest, the honest run console, the three trust gates + trust score, the non-destructive Store handshake, or the one-area-many-shapes Connect model. Those are the substance of the sibling ADRs in this set (REC-ADR-014…REC-ADR-019).
- **Decide Plan B (Autopilot).** Only **Plan A** — the journey plus persistent home — is in scope; it is the MVP and the thing being tested with the market. Autopilot is captured as a north star and is **explicitly out of scope for this build** (`01_CONCEPT.md` §7).
- **Fix final routes, slugs, copy, or token usage** beyond the spine labels named above; those are settled at build time against the real codebase, preserving the intent where the mechanic must differ.

> Append-only intent: supersede this ADR with a new ADR rather than rewriting it.
