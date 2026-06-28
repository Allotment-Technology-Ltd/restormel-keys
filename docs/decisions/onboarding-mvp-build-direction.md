---
id: REC-ADR-021
title: "Onboarding MVP — pinned build direction (M0–M4 + overarching)"
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
related: [REC-ADR-005, REC-ADR-008, REC-ADR-013, REC-ADR-015, REC-ADR-016, REC-ADR-017, REC-ADR-018, REC-ADR-019, REC-ADR-020, REC-PLAN-017]
---

# ADR: Onboarding MVP — pinned build direction (M0–M4 + overarching)

## Status

**Approved (founder, 2026-06-27).** Records the build-shaping decisions from the RES-113 onboarding
direction session (a structured founder Q&A across M0–M4 and the cross-cutting questions). It binds
*how* the approved design (REC-ADR-013…020) is realised; it does not re-open *what* the design is.
Tracked under **RES-113** — https://huly.allotmentology.tech/workbench/allotment-pm/tracker/RES-113.

## Guiding principle

**Ruthless simplicity in the experience; uncompromising completeness in the substance.** Simple on
the surface (one adaptive path, one Home, one vocabulary, reuse what already works); complete and
honest underneath (the wizard matches the design, verification is real, nothing faked or half-built).
Every decision below resolves that way.

## Overarching frame

1. **One adaptive path, no personas.** Depth (Verify / Store) is surfaced from graph state and
   actions, not a pre-assigned archetype. *(Decided in **REC-ADR-020**, which supersedes the
   three-archetype model REC-ADR-014.)*
2. **One vocabulary, canonical everywhere.** The **M0–M4 / Build · Verify · Connect** vocabulary is
   adopted end-to-end, **renaming the live `connect·ingest·make_ready·review·go_live` spine** —
   *including* analytics. Funnel continuity is preserved by **dual-emitting** the old and new stage
   events during a migration window, then retiring the old names once dashboards are migrated (no
   data gap, clean cutover).
3. **One Home.** The mock's persistent tile-Home, the shipped Answer Console landing, and the
   existing `/home` collapse into a **single Home** — a persistent status-tile hub that **leads
   first-run with the ask** and gives returning users the one sensible next action.
4. **One big cut (built behind flags, released when all-green).** The first release ships the
   **spine + full-EBV M2 + #288/M3 together** — not a thin spine first. It is assembled in the
   pre-merge **Integration Train** (RES-114) with each workstream behind a flag, flipped on together
   and released only when **every** piece (spine, full-EBV Verify, #288→Store, enforced-key Connect)
   is green. Nothing half-built reaches prod.
5. **Derived state, verification as the through-line** (corollaries): journey position is **derived
   from the server spine**, never a persisted client store; and **verified, cited answers are the
   through-line on every milestone** (M0 shows citations, M1 shows them on the user's data, M2
   deepens them) — the differentiation is never a skippable step.

## M0 — Explore

- **Reuse the shipped surface** (Answer Console + `FirstRunStrip`) reskinned as the M0 hero — do not
  rebuild the mock's `AskGraph`.
- **One shared, read-only demo graph** for every new workspace (no per-workspace provisioning).
- **Corpus = Restormel's own public docs** (dogfood): the visitor asks Restormel's docs and gets
  cited answers pointing at real Restormel pages — zero IP/accuracy risk, genuinely recognisable,
  self-demonstrating.
- **First-run only:** M0 collapses into "ask *your* graph" on Home once the user has ingested.

## M1 — Build

- **Restructure the wizard to the mock's literal flow** (Sources → Configure → Running → Done) **but
  keep the existing run-console engine** under a reskin — preserve SSE live-resume, stall/reclaim of
  durable runs, reduced-motion handling and the single-source completion ledger; do **not** rebuild
  the ~2,170-line console.
- **Model choice stays at ingest** (REC-ADR-015), inline as an **Advanced disclosure at Configure**;
  the **Domain pack folds into Configure with a smart default** (Advanced reveal to change it).
- **Stage display: friendly-grouped (~4 user-meaningful rungs) + a details expander** for the back
  half (validate · remediate · store). Honest (nothing hidden) and uncluttered.
- **Add an "ask your data" step at Done**, reusing the M0 component on the user's freshly-built
  graph — this is the conversion aha.
- **Ship bar: real execution + honest edge states.** M1 ships only when full ingest execution is
  wired (no stub/faked conversion) **and** the honest failure / auto-backoff / bad-key states are
  wired (REC-ADR-016). This requires surfacing the engine's real rate-limit backoff to the console
  (today it only logs a retry line).

## M2 — Verify

- **Wire full Evidence-Bound Verification now** — verbatim-span binding + source-version-hash recheck
  + cross-model entailment + abstention — so "verified" / "production-grade" is **true**, not a
  structural fig-leaf. (Lifts the honesty risk the review flagged; aligns with REC-PLAN-017's
  verification spearhead.)
- **Build a real incremental trust-recompute path** so the trust number genuinely moves as the user
  triages (not a faked animation, and not the deferred-only recompute).
- **Honour the accept-guard:** a claim with no bound evidence cannot be Accepted-as-supported, so
  "done" means **every claim triaged**, not "all green to zero."
- **One real vocabulary** — Supported / Weak / Unsupported + the real readiness stages, shown with
  plain labels; no parallel mock vocabulary to maintain.
- **Sequencing:** Verify + EBV is built as a **parallel workstream** (it does not gate the spine's
  development) but is part of the one big release (frame §4).

## M3 — Store *(advanced depth)*

- **Ship M3 in this cut**, which makes **PR #288 / REC-ADR-008** (host-managed Postgres tier on,
  founder sign-off after the G4 gate) a **prerequisite to land first** within this program.
- **Managed-Postgres-as-origin narrative:** "your graph lives in the managed Postgres store → connect
  your own DB → decide non-destructively." The managed origin is #288's default tier.
- **All three non-destructive options** (use existing / add alongside / keep separate). **"Add
  alongside" = flag duplicates, never auto-merge** — copy in alongside existing data, flag apparent
  collisions for review, never silently merge or overwrite (honours "nothing deleted or
  overwritten"). Real merge tooling is deferred.
- **Minimal proven engines** for the own-DB target — only those we can both read-only-verify and
  serve from (Surreal / Neo4j); the rest stay listed-but-coming-soon. (Builds on the read-only verify
  + node-count probe per REC-ADR-017.)

## M4 — Connect

Already pinned in the **REC-ADR-018 addendum** (founder, 2026-06-27): **MCP + REST only** for MVP;
**enforced** read vs read+write **scope**; the MCP connection serves **both Door-1 (first-party) and
Door-2 (verifying proxy, REC-ADR-005 / W-series)**; and **the key *is* the connection** — minted
purpose-bound (type/access/target on the key record), not a separate `serving_connections` entity.

## Build & release shape this implies

Parallel workstreams — **spine** (M0–M4 IA + Home + one vocabulary) · **full-EBV verification** (M2)
· **#288 → Store** (M3, #288 lands first) · **enforced-key Connect** (M4) — integrated behind flags
in the **Integration Train** (RES-114) and released as **one flagged cut when all are green**.
Critical-path dependency: **#288** (host-managed Postgres, founder sign-off after G4) because M3 is in
the cut. Analytics migrate by **dual-emit then retire**. Any keys/credentials/Connect/server-route or
graph-store work goes through the **`restormel-high-risk-security`** review before its PR.

## Scope boundary

- This record pins **build direction**; it does not author the build, schedule it, or replace the
  per-milestone ADRs (REC-ADR-013, 015–020) or the RES-113 review — it consolidates and binds them.
- **Plan A (MVP) only**; Plan B "Autopilot" remains out of scope (REC-ADR-019).
- Open *build-detail* items remain (e.g. how to QA the fail/rate/bad-key edge states without a fake
  fault injector; the exact #288 sequencing) — tracked in the RES-113 review, not decided here.

---

**Append-only.** Supersede with a new ADR rather than rewriting this file.
