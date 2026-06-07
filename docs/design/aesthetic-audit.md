# Restormel — Aesthetic Audit

Audit of the current implementation against [`aesthetic-brief.md`](./aesthetic-brief.md).
Scope: the Connect product surface in `apps/dashboard` (the screens the brief
names — Connect home, pipeline wizard, graph review, runs/ingest console) plus
the shared neo-brutalist token layer and component primitives that feed them.

**This document is analysis only. Nothing was changed.**

## Summary

The vocabulary is in place and, in a few spots, the conviction is too: the
graph-review triage actions and the ingest run console are close to the brief.
But three systemic gaps undercut the whole surface:

1. **Tier 1 display type does not exist anywhere.** The largest type on any
   Connect screen is **48px** (`clamp(... , 3rem)`); the brief's hero tier is
   **64–96px**. Worse, almost everything that *should* be Tier 1 (trust score,
   metric counts, run number, page titles) sits in the **24–48px** band the
   brief explicitly forbids ("there is no Tier 2.5"). The dramatic Tier 1 → Tier
   2 jump never happens, so typography communicates content but is not the
   structure.
2. **Yellow is a theme, not a spotlight.** There are **36** yellow-fill sites
   across the Connect components. On the control panel alone, yellow appears on
   four stat cards, the cap band, two badges, a progress bar, validation pills,
   rail segments and severity stamps simultaneously. The "one primary action per
   screen" rule is not being followed.
3. **A legacy design system bleeds through.** `packages/keys-tokens/src/base.css`
   still defines the old dark-theme tokens (Inter, blurred shadows, rounded
   radii, pastel `--amber-insight` / `--coral-alert` / `--path-blue`). Connect
   components reference these in **24** places, softening the brutalist surface
   (1px borders, soft amber banners, `--text-sm`/`--text-xs` instead of the
   display/mono scale).

A fourth, narrower gap: the **pipeline stepper is inverted** relative to the
brief — completed steps are yellow and the active step is plain white, which is
the exact opposite of "active = yellow, completed = black filled with check."

---

## PRINCIPLE 1 — Typography is the structure

**CURRENT STATE.** The token scale exists and is correct
(`packages/keys-tokens/src/brutalist-rm.css`: `--text-display-xl: 78px`, `lg: 52px`,
`md: 32px`; `--text-mono-sm: 10px`; `--font-display: "Barlow Condensed"`). But the
Connect surface barely uses it. `--font-display` appears only **7 times** in the
entire Connect tree, and **all 7** are written `var(--font-display, var(--font-sans))`
— i.e. silently falling back to the legacy Inter sans if the display font is
missing, instead of committing to Barlow Condensed. The biggest rendered type
anywhere in Connect is `clamp(2rem, 8vw, 3rem)` = **48px**. Numbers that should
be heroes are mono, not display.

**GAP.** Tier 1 (64–96px Barlow Condensed 900) is absent. The "missing middle"
the brief forbids is in fact the *only* middle: trust score (max 48px), stat
counts (max 24px, in mono), page titles (32px), run number (max 40px). Tier 2 is
present and mostly correct. Tier 3 is fine. So there is no dramatic jump — the
hierarchy is graduated, exactly what the brief rules out.

**SPECIFIC INSTANCES.**
- `apps/dashboard/src/lib/components/connect/ConnectSetupLedger.svelte:537` —
  `.pulse-trust-score-num` (the trust score, *the* primary number) is
  `clamp(2rem, 8vw, 3rem)` (max 48px) and `font-family: var(--font-display, var(--font-sans))`.
- `ConnectSetupLedger.svelte:591` — `.pulse-stat-num` (Ideas/Links/Groups/Embed
  counts) is `clamp(1.1rem, 3vw, 1.5rem)` (max **24px**) and **`font-family: var(--font-mono)`**
  — metric numbers rendered as labels, not display.
- `apps/dashboard/src/lib/components/brutalist/BrutalPageHeader.svelte:46` —
  `.brutal-page-title` is `font-size: var(--text-display-md)` = **32px** on every
  screen that uses the shared header.
- `apps/dashboard/src/routes/keys/dashboard/connect/+page.svelte:24` — the
  Connect home `<h1 id="connect-hub-heading">` has **no styling at all** and does
  not use `BrutalPageHeader`; it renders as a default browser h1 in DM Sans, not
  Barlow Condensed display.
- `apps/dashboard/src/lib/components/connect/pipeline/ConnectIngestRunConsole.svelte:597,681`
  — run-status number `clamp(1.75rem, 4vw, 2.5rem)` / `clamp(1.5rem, 3vw, 2.25rem)`
  with the same `var(--font-display, var(--font-sans))` fallback.
- `ConnectSetupLedger.svelte:418` (`.ledger-headline`, incl. "ALL SYSTEMS GO")
  `clamp(1.75rem, 4.5vw, 2.5rem)` = max **40px** — the celebration moment is
  undersized.

**PRIORITY: P0** — visible on every screen, on every interaction.

---

## PRINCIPLE 2 — Yellow is a spotlight

**CURRENT STATE.** Yellow-fill backgrounds / yellow button variants appear **36
times** across the Connect components. The `primary` and `neon` variants of both
`BrutalButton` and `BrutalBadge` resolve to a yellow fill
(`BrutalButton.svelte:69` → `.brutal-btn-primary { background: var(--color-yellow) }`;
`BrutalBadge.svelte:27`), so any screen with several "primary" buttons gets
several yellow elements.

**GAP.** Yellow reads as the theme colour rather than a single spotlight. The
control panel is the worst offender — multiple yellow regions compete for the
eye at once. The brief allows exactly one yellow primary action per screen plus
the `ALL SYSTEMS GO` banner exception; everything else should be outline or
inverted (black fill / yellow text).

**SPECIFIC INSTANCES.**
- `ConnectSetupLedger.svelte:574` — `.pulse-stat { background: var(--color-yellow) }`:
  **all four** metric cards are solid yellow at once.
- `ConnectSetupLedger.svelte:759` — `.rail-seg-ok` fills every live rail with a
  yellow mix; with five rails live the strip is mostly yellow.
- `ConnectSetupLedger.svelte:115` + `:221` — the cap primary action *and* the
  first graph-issue button are both `variant="primary"` (yellow) and can render
  together; `:343` adds a `neon` (yellow) "Continue setup" button in the
  checklist.
- `ConnectSetupLedger.svelte:455` (`.ledger-progress-fill`), `:669`
  (`.validation-pill-weak`), `:924` (`.pulse-issue-severity`), `:1091`
  (`.ledger-steps-count`) — yellow used decoratively for state, not action.
- `apps/dashboard/src/lib/components/connect/pipeline/connect-pipeline.css:597` —
  `.wizard-step-completed` fills **every completed step** yellow (see Principle
  6); on a late wizard step this is 3–4 yellow chips plus the yellow CONTINUE
  button.

**Working correctly (keep):** the graph-review triage row gives yellow only to
the AI-suggested action (`ConnectGraphExplorer.svelte:1748` via
`reviewActionFillClass(...)`); the ingest console gives yellow to the active
stage only (`ConnectIngestRunConsole.svelte:616`); the pipeline CONTINUE button
is the yellow action on the wizard (`ConnectPipelineWizard.svelte:250` →
`.btn-primary`); the `ALL SYSTEMS GO` cap is the sanctioned exception
(`ConnectSetupLedger.svelte:93`).

**PRIORITY: P0** — the control panel is the Connect landing surface.

---

## PRINCIPLE 3 — Space is a design element

**CURRENT STATE.** Density exists in the right places: the rails strip, validation
pills, and journey checklist are tightly packed (`ConnectSetupLedger.svelte`
rails/validation blocks). The control panel uses a borderless inner bento grid
(`.pulse-grid { gap: 0 }`, `:472`) which reads as a single dense instrument — a
genuinely good brutalist move.

**GAP.** The *spacious* counterpart is missing. Because no element reaches Tier 1
size, the "heroes" never get the isolation that makes them important — the trust
score sits in a 8rem cell at 48px rather than breathing at 80px+ with generous
padding. The Connect home hero (`+page.svelte` `.hub`, `max-width: 52rem`,
`padding: 0.5rem 0 2rem`) is compact prose, not a spacious typographic hero. The
result is uniform medium density everywhere; the dense/spacious contrast that
should direct the eye is weak.

**SPECIFIC INSTANCES.**
- `routes/keys/dashboard/connect/+page.svelte:112-125` — `.hub` / `.hub-eyebrow`
  / `.hub-lead` are all small body type with tight margins; no spacious hero.
- `ConnectSetupLedger.svelte:493-508` — `.pulse-trust` `min-height: 8rem`,
  `padding: var(--space-4)` constrains the primary metric rather than letting it
  dominate.

**PRIORITY: P1** — most visible on the primary flow (home + control panel); resolves
largely as a by-product of fixing Principle 1.

---

## PRINCIPLE 4 — Data feels physical

**CURRENT STATE.** Metric cards exist (`.pulse-stat`, `.pulse-trust`) with offset
shadows on their containers, no chart junk and no icons — structurally aligned
with the brief. Status badges are mono/uppercase. The graph-review verdict system
(`graph-review-verdict-visual.ts`) gives each verdict a scannable uppercase stamp.

**GAP.** Two specific deviations from the brief's metric/badge rules:
- Metric numbers are **mono, not Tier 1 display**, and are small
  (`.pulse-stat-num` max 24px, `:591`). The brief: "the number is Tier 1 display
  type. The label is Tier 2 mono." Currently both number and label are mono — no
  weight contrast.
- The badge primitive has **no inverted (black fill / yellow text) "active"
  variant**. `BrutalBadge` offers only yellow-fill (primary/neon) or transparent
  outline (secondary/blue/coral); the brief calls for black-fill/yellow-text for
  the "currently active" state. It is also bordered at **1.5px** (`--border-thin`,
  `BrutalBadge.svelte:23`) rather than the 2px the brief specifies.

**SPECIFIC INSTANCES.**
- `ConnectSetupLedger.svelte:591-606` — `.pulse-stat-num` mono + `.pulse-stat-label`
  mono; numbers don't feel weighty.
- `apps/dashboard/src/lib/components/brutalist/BrutalBadge.svelte:8-9,23,27-35` —
  no inverted active variant; `border: var(--border-thin)` (1.5px).
- `ConnectSetupLedger.svelte:214` — active run uses `variant="neon"` (yellow)
  where the brief wants the inverted black/yellow "currently active" treatment.

**PRIORITY: P1** — the metrics are the point of the control panel.

---

## PRINCIPLE 5 — Borders are structural, not decorative

**CURRENT STATE.** The canonical border is correct: `--border: 2px solid #0c0c0c`
(`brutalist-rm.css`). Major structural boundaries (cap, body, bento grid, rails)
use it.

**GAP.** Two problems. (a) **1px / 1.5px softening** is widespread — **54**
instances of `1px`/`1px solid`/`border-thin` in the Connect tree, including the
home page's outcome cards and many internal dividers, which reads as softened
rather than committed. (b) The legacy stylesheet supplies rounded-radius and
soft-shadow tokens that some surfaces still pull in (see Principle cross-ref),
contradicting "2px solid black, no softening."

**SPECIFIC INSTANCES.**
- `routes/keys/dashboard/connect/+page.svelte:139` — `.hub-outcomes li`
  `border: 1px solid var(--rm-border)` (should be 2px or removed) with
  `border-radius: var(--rm-radius)` and no offset shadow — the home page's only
  cards look un-brutalist.
- `routes/keys/dashboard/connect/+page.svelte:158,166` — `.notice` / `.warn-banner`
  `border: 1px solid` and the warn banner uses the legacy soft `--amber-insight`
  colour instead of a brutalist outline/inverted treatment.
- Pervasive `--border-thin` (1.5px) on interactive dividers in
  `ConnectSetupLedger.svelte` (run-chip, validation-pill-ok, pulse-issue, rails
  internal separators) — defensible for *internal* density, but worth a
  meaningful-boundary review per the brief.

**PRIORITY: P1** — most visible on the Connect home (the soft 1px outcome cards
and amber banner are the first thing a new user sees).

---

## PRINCIPLE 6 — Interactions are theatrical

**CURRENT STATE.** The press/lift physics exist as utilities: `.brut-pressable`
lifts `-2px` with a larger shadow on hover and presses `+2px` with a 1px shadow
on active (`brutalist-utilities.css:64-83`); `.btn-primary` mirrors this
(`app.css:98-107`). The graph-review queue has a real slide-out
(`ConnectGraphExplorer.svelte:3469` `.unit-row-exiting { transform: translateX(-100%) }`).
The ingest console animates the active stage with a pulse
(`ConnectIngestRunConsole.svelte:625` `@keyframes run-pulse`). `prefers-reduced-motion`
is respected.

**GAP.**
- **The pipeline stepper is inverted from the brief.**
  `connect-pipeline.css:596` `.wizard-step-completed { background: var(--color-yellow) }`
  and `:600` `.wizard-step-active { background: var(--color-surface) }`. The brief
  says the **active** step is yellow and a **completed** step transitions to
  **black fill with a checkmark**. Today completed = yellow, active = white — the
  dial clicks the wrong way, and it multiplies yellow (Principle 2). The
  checkmark glyph exists (`PipelineWizardStepper.svelte:47`) but on a yellow, not
  black, chip.
- **Triage card fades as well as slides.** `.unit-row-exiting` sets both
  `translateX(-100%)` *and* `opacity: 0` (`ConnectGraphExplorer.svelte:3469-3473`).
  The brief is explicit: "Not fades. Slides."
- **List rows press *in* on hover instead of lifting.**
  `ConnectGraphExplorer.svelte:3456` `.unit-row:hover { transform: translate(2px, 2px) }`
  with a *smaller* shadow — the opposite of the brief's "hover lifts 2px, shadow
  grows." Defensible for a dense list, but it contradicts the stated physics.

**SPECIFIC INSTANCES.**
- `apps/dashboard/src/lib/components/connect/pipeline/connect-pipeline.css:596-604`
  — invert the completed/active treatment.
- `apps/dashboard/src/lib/components/connect/ConnectGraphExplorer.svelte:3469-3473`
  — drop the opacity fade from the slide-out.
- `apps/dashboard/src/lib/components/connect/ConnectGraphExplorer.svelte:3456-3458`
  — reconsider press-in vs lift on `.unit-row:hover`.

**PRIORITY: P1** for the stepper inversion (visible on the whole onboarding
flow); **P2** for the fade and the row hover.

---

## Cross-cutting finding — legacy design system bleed

`packages/keys-tokens/src/base.css` is the old dark-theme token set (Inter +
IBM Plex Mono, `--shadow-base/-md` with blur, `--radius-sm…2xl`, and the pastel
semantic ramp `--path-blue` / `--signal-teal` / `--amber-insight` /
`--coral-alert` / `--violet-depth`). `brutalist-rm.css` imports it and overrides
*some* tokens, but the un-overridden ones remain reachable. Connect components
reference these legacy tokens in **24** places — e.g. `--amber-insight` for the
warn banner (`+page.svelte:166`), `--text-sm` / `--text-xs` instead of the
display/mono scale throughout `ConnectSetupLedger.svelte`, and `--rm-radius`
(which is 0, so harmless, but signals reliance on the legacy alias layer).

This is the root cause behind several per-principle gaps (soft borders, soft
colours, graduated type). It is worth a dedicated token-hygiene pass: decide
which `base.css` tokens are still legitimate and quarantine or alias the rest to
brutalist values so a stray `var(--shadow-base)` or `var(--amber-insight)` can't
re-soften a surface.

---

## Implementation backlog (ordered by visual impact)

> Highest visual impact first. Each item: **file** · **change** · **why it serves
> the brief**. No item here has been implemented.

### Tier A — changes a user sees on first load of Connect

1. **Introduce a real Tier 1 display scale and apply it to the page title.**
   `BrutalPageHeader.svelte:46` (`.brutal-page-title` 32px → `clamp(3.5rem, 7vw, 6rem)`,
   Barlow Condensed 900, drop the `var(--font-sans)` fallback). Optionally add
   `--text-display-hero` (~80px) to `brutalist-rm.css`. *Why:* establishes the
   dramatic Tier 1 on every screen — the core of Principle 1.

2. **Give the Connect home a real typographic hero.**
   `routes/keys/dashboard/connect/+page.svelte:24` — route the `<h1>` through
   `BrutalPageHeader` (or style `.hub h1` as Tier 1 display) and convert
   `.hub-eyebrow` to a Tier 2 mono kicker. *Why:* the landing screen currently
   renders its headline in default DM Sans — the most visible violation of
   Principle 1 and 3.

3. **Make the trust score a Tier 1 hero.**
   `ConnectSetupLedger.svelte:537` — `.pulse-trust-score-num` to 64–96px Barlow
   Condensed 900, with more padding/isolation in `.pulse-trust` (:493). *Why:*
   the trust score is the brief's flagship example of a Tier 1 number and "data
   feels physical" (Principles 1 + 4).

4. **Promote metric counts to Tier 1 display.**
   `ConnectSetupLedger.svelte:591` — `.pulse-stat-num` from mono 24px to display
   ~48–64px; keep `.pulse-stat-label` as Tier 2 mono. *Why:* Principle 4 ("the
   number is Tier 1 display type, the label is Tier 2 mono") and creates the
   weight contrast that's currently absent.

5. **Cut yellow on the control panel down to one spotlight.**
   `ConnectSetupLedger.svelte` — make `.pulse-stat` (:574) and `.rail-seg-ok`
   (:759) outline/inverted instead of yellow-fill; demote the secondary
   graph-issue buttons (:221) and the `neon` checklist button (:343) to
   outline/blue; keep yellow only on the single primary action (and the
   `ALL SYSTEMS GO` cap). *Why:* Principle 2 — restore the spotlight.

6. **De-soften the Connect home cards and banner.**
   `routes/keys/dashboard/connect/+page.svelte:139,158,166` — outcome cards to
   `2px` border + offset shadow (or remove the border); replace the
   `--amber-insight` warn banner with a brutalist outline / inverted treatment.
   *Why:* Principles 4 + 5; removes the most visible legacy-soft surface.

### Tier B — primary-flow flows (wizard, runs, review)

7. **Invert the pipeline stepper to match the dial metaphor.**
   `connect-pipeline.css:596-604` — active step → yellow; completed step → black
   fill, yellow/white checkmark. *Why:* Principle 6's "dial clicking to a new
   position," and removes a major source of multiplied yellow (Principle 2).

8. **Add an inverted "active" badge variant; fix badge border weight.**
   `BrutalBadge.svelte` — add black-fill/yellow-text variant for "currently
   active," bump border to 2px, and use it for the live-run badge
   (`ConnectSetupLedger.svelte:214`). *Why:* Principle 4's badge rules.

9. **Make the run number and "ALL SYSTEMS GO" headline Tier 1.**
   `ConnectIngestRunConsole.svelte:597,681` and `ConnectSetupLedger.svelte:418`
   — bump to the new display scale, drop the sans fallback. *Why:* Principle 1;
   the run status and the celebration banner are named Tier 1 examples.

10. **Slide, don't fade, on triage confirm.**
    `ConnectGraphExplorer.svelte:3469-3473` — remove `opacity: 0` from
    `.unit-row-exiting`. *Why:* Principle 6 ("Not fades. Slides.").

### Tier C — hygiene and consistency

11. **Token-hygiene pass on the legacy layer.**
    `packages/keys-tokens/src/base.css` + `brutalist-rm.css` — quarantine or
    re-alias `--amber-insight` / `--coral-alert` / `--path-blue` / blurred
    `--shadow-*` / rounded `--radius-*` / `--font-sans` so Connect components
    can't pull soft values. Audit the 24 legacy references and the 54 `1px`/`1.5px`
    borders, converting meaningful boundaries to 2px and removing the rest.
    *Why:* Principles 5 + 1; removes the root cause of recurring softening.

12. **Reconsider list-row hover physics.**
    `ConnectGraphExplorer.svelte:3456-3458` — decide whether dense rows should
    press-in (current) or lift (brief default) and apply consistently. *Why:*
    Principle 6 consistency.

13. **Establish a "no Tier 2.5" lint/convention.**
    Document that font-sizes between ~16px and ~48px are disallowed for
    headings/numbers on Connect surfaces (body prose at 14–15px and Tier 1 at
    64px+ only). *Why:* prevents Principle 1 regression as new screens are added.
