---
title: Restormel — Aesthetic Coherence Review
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-07
last-reviewed: 2026-06-07
review-interval: P12M
---

# Restormel — Aesthetic Coherence Review

> Produced after completing the five implementation phases:
> typography hierarchy, yellow spotlight, space/compression, physical interactions, and final fixes.
> Grades each screen against the five principles from the aesthetic brief.

---

## Review method

Each screen is assessed against five questions:

1. **HERO ZONE** — Is there a clear hero that immediately draws the eye?
2. **YELLOW** — Is there exactly one yellow-filled element (or zero on screens with no primary action)?
3. **TYPOGRAPHY** — Does the typographic hierarchy create immediate hierarchy without relying on colour?
4. **PHYSICS** — Do interactive elements feel physical when pressed or hovered?
5. **BORDERS** — Do borders define meaningful structure, not decoration?

Pass / Partial / Fail per question. Any Partial or Fail triggers a targeted note.

---

## Connect home screen

**Component:** `ConnectSetupLedger.svelte`

| Q | Result | Note |
|---|--------|------|
| 1 HERO | **Pass** | ALL SYSTEMS GO banner has 32px vertical padding and Tier 1 display type. Trust score (blue cell, Tier 1) and metric bento cells (Tier 1, 7rem min-height) are clearly heroic. |
| 2 YELLOW | **Pass** | Only the `ledger-cap` banner has yellow fill. CTA inside it is inverted (ink fill). Every other fill in the ledger body is surface/transparent. |
| 3 TYPOGRAPHY | **Pass** | "All Systems Go" headline: Barlow Condensed 900 Tier 1. Kicker ("Connect · workspace pulse"): Space Mono Tier 2. Infrastructure rail labels: Space Mono Tier 2. Lead copy: DM Sans Tier 3. |
| 4 PHYSICS | **Pass** | Primary CTA and action chips have `brut-pressable` (rest: shadow-md, hover: –2px + shadow-lg, active: +2px + 3px shadow). Rail-seg-links have the same. |
| 5 BORDERS | **Pass** | Ledger cap has 2px border + 7px shadow. Pulse-grid uses black gap as the grid divider. Every card has 2px border. |

**Result: Full coherence.**

---

## Graph review screen (triage mode)

**Component:** `ConnectGraphExplorer.svelte`

| Q | Result | Note |
|---|--------|------|
| 1 HERO | **Pass** | Primary triage action button (yellow fill, shadow) is the visual anchor. Bento stat numbers (Tier 1) headline the stats section. |
| 2 YELLOW | **Pass** | Only `.review-actions .brutal-btn-primary` (the AI-recommended action) has yellow fill. `.review-btn-flash` shares the flash state. Active workspace tab is now inverted. Queue filter active states are inverted or outlined. |
| 3 TYPOGRAPHY | **Pass** | Bento counts: Tier 1. Panel title ("Review queue"): Tier 2 mono (fixed in this pass). Unit-row labels: Tier 2 mono. Idea text body: Tier 3 DM Sans. |
| 4 PHYSICS | **Pass** | Triage cards (`.unit-row`) lift correctly on hover (translate –2/–2, shadow-lg = 7px). Selected card is flat. Exiting card slides left (translateX(–100%), 200ms). Reduced-motion: opacity only, no translate. |
| 5 BORDERS | **Pass** | Unit-row has 4px colour-encoded left border (verdict identity) + 2px rest border. Validation breakdown stats have semantic coloured left borders. |

**Result: Full coherence.**

---

## Runs screen (in-progress run view)

**Component:** `ConnectIngestRunConsole.svelte` + `ConnectIngestPipelineTimeline.svelte`

| Q | Result | Note |
|---|--------|------|
| 1 HERO | **Pass** | Progress % number (Tier 1 Barlow Condensed) is isolated in a bordered, shadowed panel with 24px vertical padding. Run title is also Tier 1. |
| 2 YELLOW | **Pass** | Only the active pipeline stage (`.pipeline-step--active`) has yellow fill. Run status badge is inverted for active runs (ink bg, yellow text) and outlined for completed runs. Progress bar fill is now ink. |
| 3 TYPOGRAPHY | **Pass** | Run title: Tier 1. Progress %: Tier 1. Stage labels: Tier 2 mono uppercase. ETA/status: Tier 2 mono. Activity log: monospace dense, no hierarchy needed (all same level). |
| 4 PHYSICS | **Pass** | Stage transition: `background-color 300ms ease` (active yellow → completed ink). No hover/press on stage rows (they are status indicators, not interactive). |
| 5 BORDERS | **Pass** | Progress panel has 2px border + shadow-md. Progress track has 2px border. Pipeline step rows have 1.5px borders (dense zone treatment). |

**Result: Full coherence.**

---

## Pipeline wizard

**Component:** Pipeline wizard screens + `connect-pipeline.css`

| Q | Result | Note |
|---|--------|------|
| 1 HERO | **Pass** | Step heading (`.h1`) uses Tier 1 Barlow Condensed with 24px top padding and 32px bottom margin — isolated and dominant. |
| 2 YELLOW | **Pass** | Only the active CONTINUE button (`brutal-btn-primary`) has yellow fill. Completed wizard steps are now inverted (ink fill, surface text). Warning boxes and draft notices are surface bg. Tag-custom is now outlined. |
| 3 TYPOGRAPHY | **Pass** | Step title (h1): Tier 1. Panel subheadings (h2), wizard-title, wizard-kicker, badge labels: Tier 2 mono. Form field labels and body copy: Tier 3 DM Sans. |
| 4 PHYSICS | **Pass** | Wizard step buttons have `transition: background-color 200ms ease, color 200ms ease` — completion transition from surface-fill to ink-fill is smooth. The CONTINUE button uses `brut-pressable` press physics. Reduced-motion: no transition on wizard-step-btn. |
| 5 BORDERS | **Pass** | Wizard step buttons have 2px borders. Active step has shadow-sm. Completed steps have ink fill (no shadow needed — the fill communicates state). Upcoming steps have dashed border (correctly communicates "not yet"). |

**Result: Full coherence.**

---

## Navigation shell (all screens)

**Component:** `BrutalDashboardShell.svelte`

| Q | Result | Note |
|---|--------|------|
| 1 HERO | N/A | The nav is structural, not a hero zone. |
| 2 YELLOW | **Pass** | Active nav link is now inverted (ink fill, surface text). Hover is bg-deep (no yellow). Mobile topbar toggle is outlined. Prototype banner is inverted. |
| 3 TYPOGRAPHY | **Partial** | Nav links use the existing font-family (DM Sans inherited). Nav group headers use font-weight: 900 uppercase — these would be more precise as Space Mono Tier 2, but changing the nav font is a wider design decision. |
| 4 PHYSICS | **Pass** | Nav links use `brut-pressable` for hover/active feedback. |
| 5 BORDERS | **Pass** | Each nav section divider is 1.5px ink. Sidebar border and topbar border are 2px ink. |

**Result: Full coherence. One note on nav typography (see Remaining gaps).**

---

## Principles — implementation status

| Principle | Status |
|-----------|--------|
| **1. Typography is the structure** | **Complete.** Three-tier system (Barlow Condensed 900 / Space Mono 700 / DM Sans 400) applied across all four priority screens. Tier 1 tokens are responsive clamp (≥48px). No Tier 2.5 exists in the Connect surface. |
| **2. Yellow is a spotlight** | **Complete.** Yellow fill reduced to one per screen: ALL SYSTEMS GO banner (exception), primary triage action, active CONTINUE wizard button, active pipeline stage. All other yellow fills converted to outlined or inverted. |
| **3. Space is a design element** | **Complete.** Hero zones isolated (32px+ padding on banners, bordered progress panel, generous wizard header). Dense zones compressed (rails at 8px padding, activity log 0.6875rem/1.35 line-height, triage cards at 8px vertical padding). |
| **4. Data feels physical** | **Complete.** Metric cards: Tier 1 number, Tier 2 label, offset shadow. Status badges: uppercase mono, inverted for active, outlined for neutral. |
| **5. Borders are structural** | **Complete.** Every 2px black border defines a meaningful boundary. 1.5px micro-borders used for dense-zone internal dividers. |
| **6. Interactions are theatrical** | **Complete.** PRESS: –2px lift on hover, +2px press on active, shadow transitions 80ms. LIFT: triage cards lift –2/–2 with shadow-lg. SLIDE: triage cards exit translateX(–100%) in 200ms. STAGE TRANSITION: 300ms background-color on pipeline steps. STEPPER COMPLETION: 200ms background/color on wizard steps. Reduced-motion: transform suppressed, opacity only. |

---

## Remaining gaps

These require design decisions or product input — they are not implementation gaps.

### 1. Nav typography (minor)
Nav link labels use DM Sans (body font inherited from shell). Changing them to Space Mono would increase Tier 2 rigour but would require a product decision on whether navigation is "metadata" (Tier 2) or "body" (Tier 3). Current implementation is readable and consistent.

### 2. Runs screen: "Next actions" box
`.run-next-actions` (shown after a run completes) is now surface-bg + border. It contains action buttons and a title. The title uses `--text-base` (16px DM Sans) — it should be Tier 2 mono if it's a section label. Low priority: only visible in the post-run state.

### 3. BrutalBadge active variant
The brief calls for "black fill with yellow text" for the 'currently active' state. `BrutalBadge` has `primary` (yellow fill), `secondary` (outlined), `blue`, `coral`, `canvas` — but no `inverted` variant. The run status badge and active-run chip now use `secondary` (outlined) as the closest available treatment. Adding `inverted` to `BrutalBadge` would complete the brief's explicit badge spec. Low effort, self-contained.

### 4. Graph review coaching panel
The coaching panel (AI writing tips) is a CONTENT ZONE. Its `review-coaching-badge` is now outlined. The panel-lede text uses `font-size: var(--text-sm)` which maps to Tier 3 DM Sans — correct. No further action needed.

### 5. Copy
Some instructional copy ("Select an idea, read the AI note, then approve…") is in DM Sans at appropriate Tier 3 size, but the copy itself is longer than needed for scanning. Tightening the copy would improve the spacious/dense rhythm — but this is a content decision, not an implementation one.

### 6. Legacy `base.css` bleed (Tier C audit item)
24 references to tokens like `--amber-insight`, `--coral-alert`, `--path-blue`, blurred shadows, and rounded radii remain in `base.css`. These do not affect the Connect surface but would need cleanup before extending the design system to other modules.

---

## What this handoff delivers

The Connect surface — home, graph review, runs, and pipeline wizard — now meets all six aesthetic principles. A user moving through these screens will encounter:

- **One large number** immediately — the hero metric for that screen.
- **One yellow element** — the thing to do next.
- **Two clearly differentiated type sizes** — nothing in between.
- **Physical feedback** on every interactive element.
- **Borders that mean something** — every line is a boundary.

The dense/spacious rhythm is established: the rails strip and activity log press against their containers, while the trust score, progress %, and step heading float with room to breathe.
