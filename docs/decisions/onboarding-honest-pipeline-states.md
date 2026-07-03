---
id: REC-ADR-016
title: "Honest, visible pipeline states (name the failing stage)"
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
related: [REC-ADR-013, REC-ADR-014, REC-ADR-015, REC-ADR-017, REC-ADR-018, REC-ADR-019]
---

# ADR: Honest, visible pipeline states (name the failing stage)

## Status

**Approved as the product direction — founder steer, 2026-06-27:** the Claude Design onboarding handoff is the hard-won, iterative *direction of travel for the product — stick as close to it as possible*. This record’s decision stands as approved; the capture note below is retained for context, and faithful-realisation tensions (e.g. trust-meter/EBV honesty, M3/M4 backend) are tracked in the RES-113 review, not in this decision.

**Draft — design intent captured from the onboarding handoff, pending product confirmation.**
This record *captures* a design decision made during the Restormel onboarding design session; it
does not authorise a build. It is one of seven ADRs (REC-ADR-013..019) carving up that handoff.
Tracked as **RES-113** — https://huly.allotmentology.tech/workbench/allotment-pm/tracker/RES-113.

## Context

M1 ("Build") is the conversion moment of onboarding — the user points Restormel at their own
documents, watches it ingest, then asks *their* data a question and gets a cited answer ("that's
MY knowledge now"). Ingest is a multi-stage pipeline (Extract → Relate → Group → Embed …; the bundle names the first four, with later stages — validate, remediate, store — derived from the live pipeline), it is slow enough to need a progress surface, and it can fail part-way for
reasons the user did not cause and cannot see (a provider rate-limit, a bad or expired key, a stage
error).

The design session learned — "the hard way", recorded as a **requirement, not a suggestion**
(`01_CONCEPT.md` §5 lesson 6) — that the failure mode of an opaque pipeline is corrosive: a spinner
that hides which stage is running, a generic error toast, or fake progress that keeps climbing after
something has already broken all teach the user that the product is not to be trusted. That is fatal
for a product whose entire pitch is *trustworthy, grounded, cited answers*. Honesty in the run
console is therefore not polish layered on at the end — it is the first proof of the product
principle, delivered at the exact moment the user is deciding whether to believe Restormel.

The real ingest backend already exposes the substrate this decision needs: per-stage status
(`completed`/`active`/`queued`/`failed`/`skipped`), a single-running-stage focus model, a durable
resume checkpoint, and a captured `last_error`. So the decision is about how that truth is *surfaced
and framed*, not about inventing new telemetry.

## Decision

**Every ingest stage is named and visible, with honest status, and the run never lies — especially
under failure.** Concretely, the run console:

1. **Names every stage and shows its true status** — `done` / `active` / `queued` — with real
   per-stage and overall progress. Exactly one stage is `active` at a time. No hidden steps, no
   composite "processing…", no progress that advances past work that has not happened.

2. **On failure, STOPS at the failing stage and names it.** The active stage flips to a coral
   "failed" row; a coral banner names *which* stage failed and reassures that **earlier stages are
   saved**, and a **single Retry** action is offered (re-runs clean from a saved checkpoint). The
   run does not silently continue, does not collapse to a generic toast, and does not discard
   completed work.

3. **Rate-limits are shown as automatic back-off, not an error.** An amber (not coral) banner —
   "Provider rate-limited. Backing off and retrying automatically — no action needed." — and the
   stage shows "rate-limited…" then resumes itself. A throttle the system handles is never dressed
   up as a failure the user must act on.

4. **Bad / expired keys are caught on Launch, before the run starts.** Validation happens at the
   Configure step: on Launch a rejected key keeps the user on Configure with a coral banner
   ("Provider rejected this key. It's expired or lacks access…") and **never enters the run**, so a
   half-started run cannot strand the user mid-pipeline on a credential problem.

5. **No silent magic, no fake progress.** The governing pattern for every unhappy state is: **name
   what failed, reassure about what is safe, offer the single obvious recovery.** Never a generic
   toast.

These states are **wired to real ingest/connection errors**, not stubbed — honesty is a product
principle, so a real rate-limit must render the rate-limit treatment and a real stage error must
name that stage.

## Rationale

- **The honesty *is* the value proof.** Restormel sells grounded answers over hallucination; a run
  console that hides or fakes its own state contradicts the pitch at the conversion moment. Showing
  the truth — including failure — is the cheapest, earliest demonstration that the product does not
  paper over reality (`01_CONCEPT.md` §5.6).
- **Naming the failing stage turns a dead end into a recoverable step.** "It broke" is a reason to
  leave; "Embed failed — Extract/Relate/Group are saved, Retry" is a reason to stay. Preserving
  completed work makes retry cheap and removes the fear that retry means starting over.
- **Distinguishing throttle from failure prevents false alarms.** A rate-limit the system is already
  handling should not read as red; treating it as amber/"no action needed" keeps the user calm and
  truthful about who is doing the work.
- **Catching keys before the run is honesty about ordering.** A credential is a precondition, so it
  is checked as a precondition — failing fast on Configure rather than failing ugly mid-run.
- **The backend already supports it.** Per-stage status, single-active focus, a resume checkpoint,
  and a captured error are present in the real pipeline, so honest surfacing is a faithful read of
  existing truth rather than new instrumentation.

## Source artefact

- **Primary mock:** `docs/design/onboarding-handoff/designs/M1 Flow.html` — the M1 ingest flow,
  specifically the step-3 **per-stage run console** (the live progress tracker with done/active/
  queued rows and per-stage + overall ETA) and its failure / rate-limit / bad-key edge treatments.
- **Screenshot:** `docs/design/onboarding-handoff/screenshots/02-m1-build-flow.png`.
- **Concept doc:** `01_CONCEPT.md` §5 lesson 6 ("Be honest by default, especially under failure").
- **Artefact guide:** `08_ARTEFACTS.md` §B (`M1 Flow.html` — "the honesty of the run console … is the
  whole point: no fake progress, name the stage that fails") and its provenance map line *"Honest run
  console (name the failing stage) → M1 Flow.html → 01 §5.6, 05_STATE.md"*.
- **Supporting state spec:** `05_STATE.md` §7 (the REQUIRED edge/unhappy-states table — stage-fail,
  rate-limited, bad/expired key, empty — with exact copy) and the build instruction in
  `07_PROMPTS.md` prompt 4 ("Implement ALL edge states … the edge/honesty states are not optional
  polish — wire them to real ingest/connection errors, don't stub them out").

## Consequences

- **Realised through the existing ingest telemetry layer.** If/when built, this surfaces the real
  per-stage status the backend already produces (`apps/dashboard/src/lib/server/connect-ingest-
  progress.ts` — `ConnectIngestStageProgress` with `completed`/`active`/`failed`/`queued`/`skipped`,
  single-running-stage focus, a `last_error`, and a durable resume checkpoint) polled by the run
  store (`apps/dashboard/src/lib/stores/live-run-poll.ts`). "Earlier stages are saved" maps to the
  resume checkpoint; "name the failing stage" maps to the failed-status row + `last_error`.
- **An error taxonomy is required, not optional.** The build must distinguish at least three classes
  — stage-failure (coral, stop + name + retry), provider rate-limit (amber, auto-backoff, self-
  resume), and credential rejection (caught on Configure, never enters the run) — and map every real
  ingest/connection error onto one of them. A catch-all "something went wrong" toast is a defect
  against this ADR.
- **Retry must be checkpoint-resumable and idempotent**, so a single Retry does not duplicate or
  re-derive already-completed stages.
- **Key validation must run at Launch**, before any stage starts, so credential failures cannot
  strand a half-run.
- **Accessibility / motion:** honest states must survive `prefers-reduced-motion` (show the end
  state, never a stuck pre-animation), per `05_STATE.md` §8.
- **Touches Connect ingest / SvelteKit server routes / provider keys** — any implementation goes
  through the `restormel-high-risk-security` review before a PR, per repo norms.

## Scope boundary

This ADR **captures a design decision; it does not build, schedule, or design the implementation.**
It specifically does **not**:

- Authorise code, a sprint, or a deadline — RES-113 is a design-capture ticket, not a build order.
- Cover **Plan B (Autopilot)** — this is **Plan A MVP** intent only; Autopilot is an explicit
  north-star, out of scope (`01_CONCEPT.md` §7).
- Specify the exact pipeline stage list, ETA algorithm, polling cadence, retry/backoff parameters,
  or the visual/token details of banners and rows — those are implementation choices for the build,
  bounded only by the honesty principle above.
- Decide M2 (Verify) gate states, M3 (Store) connection-failure handling, or empty-state designs
  beyond noting they follow the same "name / reassure / single recovery" pattern; those are their
  own screens (and, where decision-worthy, their own ADRs in this set).
- Redefine the underlying ingest telemetry or error semantics; it consumes the existing backend
  truth, it does not change it.

---

*Append-only record. Do not rewrite this ADR to change the decision — if this is revisited or
overturned, supersede it with a new ADR that references REC-ADR-016, and update this record's status
to `superseded` rather than editing the decision in place.*
