# 01 · Concept, lessons & rationale

This is the "why" behind every screen. If you only read one doc before building, read this one —
the layouts in `03_SCREENS.md` only make sense on top of this model.

---

## 1. The core idea

Restormel turns a customer's documents into a **knowledge graph** — a structured, queryable
representation of everything in their sources — that their apps and agents can ask, getting back
**grounded answers with citations** instead of hallucinations.

The product's job in onboarding is to make that abstract value **felt**, fast, by a person who
has never heard of a knowledge graph. We do that by sequencing **aha moments**, not features.

## 2. The five ahas (the spine)

The entire journey is built to deliver five realisations in order. Each milestone exists to
produce exactly one:

- **M0 Explore — *"it answers from real sources."*** Before any setup, the user asks a
  pre-built demo graph a question and gets a cited answer. Zero commitment, instant value.
- **M1 Build — *"that's MY knowledge now."*** They point Restormel at their own docs, watch it
  ingest, then ask *their* data the same way. This is the conversion moment.
- **M2 Verify — *"I can trust it."*** They see a trust score, triage a handful of weak/unsourced
  claims, and watch the score climb to production-grade.
- **M3 Store — *"it runs on MY infra."*** (Advanced only.) They move the graph from Restormel's
  managed store onto their own database — safely, non-destructively.
- **M4 Connect — *"my product can use it."*** They wire an app or agent to the graph and see it
  go live.

**Design implication:** every screen leads with the aha, not the mechanism. Headlines are
outcomes ("Build your graph", "Make it trustworthy", "Connect your app"), never nouns
("Ingestion", "Validation", "Endpoints").

## 3. The three personas (who walks the path)

The prototype switches between three archetypes. They differ only in **how far down the spine
they go** — the screens are the same, the path length changes.

- **Initial** — brand new, wants the minimum path to a live graph.
  Path: **M0 → M1 → M4**. Skips Verify and Store. Sees the most guidance, the fewest levers.
- **Learning** — building their first real graph, wants some guidance.
  Path: **M0 → M1 → M2 → M4**. Adds the trust step.
- **Advanced** — wants the levers: own infra, own models, agents.
  Path: **M0 → M1 → M2 → M3 → M4**. The full journey, least hand-holding, advanced disclosures
  open by default (e.g. per-stage model pickers).

**Design implication:** M2 and M3 are **opt-in depth**, never blockers. The "minimum to aha" for
*everyone* is M0→M1→M4. Build that spine first; M2/M3 layer on.

## 4. The mental model: opinionated rails → persistent home

This was the central navigation decision (see `02_IA_AND_NAV.md` for the resulting structure).

- **First pass = a guided rail.** A new user is walked M0→M4, gated, one decision at a time, so
  they reach a live graph without facing choices they aren't ready to make. The journey nudges.
- **After the first pass = a persistent home.** Every area becomes **revisitable in any order**.
  The home is a dashboard of status tiles; the user lives here and re-enters any area to redo a
  "redoable action" (add sources, change a route, swap a model, rotate a key, re-triage).

The art is that these coexist: the rail never traps you (you can always reach home), and the
home never dumps you (it always surfaces the one sensible next action).

## 5. Design lessons from the session (carry these into code)

These were learned the hard way during the session. They are **requirements**, not suggestions.

1. **Order config *before* the work it configures.** Originally model-choice sat in a late
   milestone, implying you could retroactively re-pick the models ingestion already ran on. That
   is wrong. **Model choice lives at ingest (M1)** as an *"Advanced: choose a model per stage"*
   disclosure that defaults to recommended. Production *keys* are entered where they're first
   needed, framed as forward-looking ("what the models run on"), never as a retro table.

2. **Ingest-config is a recurring loop, not a one-time step.** Sources + models + store get
   revisited every time the user adds documents. The home and journey reflect this — "Build" is
   a place you return to, not a step you finish.

3. **Decompose "make ready" into honest gates.** M2 is three readiness gates — *Sources*
   (every idea sourced), *Embed* (everything retrievable), *Validate* (weak claims triaged) —
   shown with real status (done / needs-you / auto-done / needs-review), feeding one **trust
   score**. Clearing all three flips the graph to production-grade.

4. **"Connect" is one concept with many shapes.** Don't scatter serving across Prove / Agents /
   Gateway-keys. There is **one Connect area** holding a list of connections; each connection is
   a *type* (chat widget / MCP / REST API / SDK / GraphQL) with an *access level* (read, or
   read+write) and its **own key**. First connection uses a 3-step wizard (Type → Access →
   Name); after that it's a manager (list, add, configure, delete). Users can have many.

5. **Use plain language for access.** "Read" vs "Read + write" explained in human terms
   ("look things up" vs "look up *and* contribute back"), with human-named capabilities — not
   scopes/OAuth jargon.

6. **Be honest by default, especially under failure.** Every ingest stage is named and visible.
   If one fails, it **stops there and says which**, with a retry — earlier stages are saved. Rate
   limits show an automatic-backoff message, not an error. No silent magic, no fake progress.

7. **Safety framing for destructive-sounding actions.** Connecting your own database only proves
   Restormel can *reach* it — nothing is read in, copied, or overwritten. When the target DB
   isn't empty, the user gets a **non-destructive choice** (use existing / add to it / keep
   separate) with an explicit "nothing is deleted, you can switch back" guarantee.

8. **Make-ready and connections are screens, not modals.** Anything revisitable with status
   needs a back button and a URL — they are destinations, not popups.

9. **Ruthless efficiency in nav.** The IA was cut from ~13 destinations to a 4-item spine plus a
   tucked Settings group. If a thing is occasional config, it does not earn top-level nav.
   See `02_IA_AND_NAV.md`.

## 6. The visual system in one paragraph

Restormel is **neo-brutalist**: warm cream canvas (`#f3ead0`), near-white card surfaces, hard
**2px ink borders**, **offset hard shadows** (no blur, e.g. `5px 5px 0 #0c0c0c`), a single
**yellow** (`#ffd600`) primary accent used sparingly for the one true CTA, square corners
(radius 0), and a tri-font stack: **Barlow Condensed** (900, uppercase) for display, **Space
Mono** for labels/buttons/metadata, **DM Sans** for body. Teal = success/verified, amber =
warning/insight, coral = error. Full values in `04_TOKENS.md`. This already exists in the
codebase token layer — match it by reusing it.

## 7. Plan A vs Plan B (do not build B yet)

- **Plan A — the journey + persistent home** (this entire bundle). Opinionated rail to first
  value, then a dashboard you live in. **This is the MVP.** It's the safer, more buildable bet
  and the thing we're testing the market with.

- **Plan B — "Autopilot"** (`Plan B — Autopilot.html`). A radically different model: you *brief
  an operator* once ("make our support docs answerable by the helpdesk agent") and the system
  runs the whole spine end-to-end, pausing only for the few decisions that genuinely need a
  human (a key, a non-destructive data choice), and auditing **itself** for trust. The dashboard
  becomes a *mission you steer by intent*, not a set of controls.

  Plan B is captured as an **annotated concept walkthrough** so the vision isn't lost, and so we
  have a clean A/B framing later (the file ends with a contrast table naming the bet each plan
  makes and what a test would measure: time-to-first-answer, completion, trust, perceived
  control). **It is explicitly out of scope for this build** due to build complexity — we ship A
  first, and treat Autopilot as a north star to grow toward.
