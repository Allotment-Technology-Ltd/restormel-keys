---
id: REC-ADR-015
title: "Model choice happens at ingest, never retroactively"
class: decision
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-27
last-reviewed: 2026-06-27
review-interval: P12M
retention: permanent
related: [REC-ADR-013, REC-ADR-014, REC-ADR-016, REC-ADR-017, REC-ADR-018, REC-ADR-019]
---

# ADR: Model choice happens at ingest, never retroactively

## Status

**Draft — design intent captured from the onboarding handoff, pending product confirmation.**
This ADR records a design decision lifted from the Restormel onboarding design capture; it does
not authorise or specify a build. It is one of seven ADRs (REC-ADR-013…REC-ADR-019) capturing the
locked decisions behind the onboarding journey. Tracked as **RES-113** —
https://huly.allotmentology.tech/workbench/allotment-pm/tracker/RES-113.

## Context

Restormel's onboarding turns a customer's documents into a knowledge graph through a sequenced
journey (M0 Explore → M1 Build → M2 Verify → M3 Store → M4 Connect), where each milestone exists
to deliver one "aha". **M1 Build is the conversion moment**: the user points Restormel at their
own docs, watches it ingest stage-by-stage (Extract → Relate → Group → Embed …), then asks their
own data and gets cited answers.

Ingestion runs *on* specific models — one model that can **extract** and one that can **embed** at
minimum (a single provider key may cover both). The question this ADR settles is **where in the
journey the user chooses those models.**

An earlier design put a per-stage **model table in a later milestone**. That was wrong: it
implied a user could retroactively re-pick the very models ingestion had *already run on* —
inviting the false mental model that you can re-point a completed run at a different model without
re-ingesting. Config that sits *after* the work it configures is dishonest about cause and effect.
This was named explicitly as the first hard-won lesson of the design session ("order config before
the work it configures").

## Decision

**Per-stage model selection lives inside the M1 ingest step, before the run — never in a later
milestone, and never as a retroactive table.**

Concretely:

- On the M1 **Configure** step, the primary affordance is a single provider-key field plus an
  **"Advanced: choose a model per stage"** disclosure. The disclosure is **collapsed by default**
  and **open by default for the Advanced persona** (who wants the levers); recommended models are
  the default for everyone else.
- The minimum to continue is coverage, not configuration: one model that can **extract** and one
  that can **embed** (one key may satisfy both, or providers may be mixed). Continue only lights up
  when both requirements are met.
- When the disclosure is opened, the per-stage catalogue is revealed **in place at M1** — showing
  the recommended pick per stage and what each added key covers. Non-essential upgrades (e.g. a
  stronger **validation** model) are flagged as **recommended but non-blocking**, and may be added
  later at M2 — they do not gate the run.
- **Production keys are entered where they are first needed, framed forward-looking** — "what the
  models run on" — never presented as a retrospective table of what already happened. (The M3
  Store "Keys" step follows the same forward-looking framing.)
- Changing models after a run is achieved by **re-ingesting** (ingest-config is a recurring loop,
  revisited each time documents are added), **not** by editing a retroactive picker that pretends
  to rewrite a finished run.

## Rationale

- **Config must precede the work it configures.** Choosing the model *before* the run is the only
  honest ordering: the model is a cause of the ingest output, so the choice belongs upstream of it.
- **It protects the M1 aha** ("that's MY knowledge now") by keeping the conversion screen
  truthful — no fake ability to retro-swap the engine behind an already-built graph.
- **Recommended defaults keep the minimum path light.** Initial/Learning personas paste one key and
  go; only the Advanced persona is shown the full per-stage levers by default. Depth is opt-in, not
  a wall of options.
- **Re-ingest as the change path** matches the wider model that "Build" is a place you return to,
  not a step you finish — so "change a model" naturally means "run it again on your docs", which is
  what actually happens.

## Source artefact

- **Primary design:** `design_handoff_restormel_onboarding/designs/M1 Add Models.html` — the
  "Advanced: choose a model per stage" disclosure inside the ingest step, with state A (nothing
  added; two hard requirements, one key field, recommendation teaser) and state B (mixed providers,
  catalogue revealed, validation flagged as a non-blocking upgrade).
- **Screenshot:** `design_handoff_restormel_onboarding/screenshots/03-m1-add-models.png`.
- **Forward-looking production-keys framing:** `design_handoff_restormel_onboarding/designs/M3
  Flow.html` (the "Keys" step — production keys framed as what the models run on, not a retro
  table).
- **Build instruction it grounds:** `design_handoff_restormel_onboarding/07_PROMPTS.md`, Prompt 4
  ("models are chosen HERE, never retroactively").
- **Reasoning docs:** `01_CONCEPT.md` §5.1 (lesson 1, "order config before the work it
  configures"), reinforced by §3 (Advanced persona, advanced disclosures open by default) and §5.2
  (ingest-config is a recurring loop); `08_ARTEFACTS.md` §B (the `M1 Add Models.html` entry) and
  its provenance map ("Model choice at ingest, not retroactive → `M1 Add Models.html` → §5.1").

## Consequences

- **M1 Build (the Configure step) owns model selection.** When built, this is the home for the
  provider-key field and the per-stage disclosure — likely realised through the M1 ingest route and
  an existing per-stage model catalogue/route-builder (e.g. `route-builder-model-catalog`) plus the
  staged ingest worker (`connect-ingest-worker` / `connect-ingest-progress`). This ADR captures the
  *placement and framing* decision; it does not design those modules.
- **Later milestones must not present a retroactive model table.** M2 Verify and M3 Store may
  surface the *recommended validation upgrade* as a non-blocking, forward-looking add — but neither
  may offer a UI that implies re-picking the models a completed run already used.
- **The "Models" home tile re-enters Build**, not a standalone model-config screen — consistent with
  "redoable actions re-enter their area".
- **The change-a-model path is re-ingest.** Product and copy must make clear that swapping a model
  means running ingest again (on new or updated docs), with earlier completed stages honoured —
  there is no silent retro-apply.
- **Defaults must exist per stage** so the minimum path stays a single paste-a-key action; the
  catalogue's recommendations are the fallback when the user does not open the disclosure.

## Scope boundary

This record **captures a design decision; it does not build or authorise it.** It does **not**:

- specify the model catalogue's data model, the provider list, ranking/suitability logic, or how
  keys are validated, encrypted, or stored (separate concerns, and any provider-equality or
  catalogue decisions are their own records);
- decide the M2 trust-gate mechanics, the M4 Connect wizard, or the M3 Store data-move flow (their
  own ADRs in this set);
- define routing internals or the resolve/simulate path;
- cover **Plan B "Autopilot"**, which is explicitly out of scope — this is **Plan A MVP only**
  (`01_CONCEPT.md` §7).

It fixes one thing: **model choice is configured at ingest, before the run, never as a retroactive
table.**

---

*Append-only record. Do not rewrite this decision in place. If the placement or framing of model
choice changes, supersede it with a new ADR that references this one, rather than editing the
intent captured here.*
