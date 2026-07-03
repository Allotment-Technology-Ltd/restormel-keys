---
title: Restormel — Aesthetic Deepening Brief
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-07
last-reviewed: 2026-06-07
review-interval: P12M
---

# Restormel — Aesthetic Deepening Brief

> Transcribed from the design direction provided for the aesthetic deepening.
> The audit at [`aesthetic-audit.md`](./aesthetic-audit.md) is graded against this document.

## The brief

The current implementation has the *vocabulary* of neo-brutalism: the borders,
the shadows, the warm cream, the yellow, the condensed type. What it does not
yet have is the *conviction* of neo-brutalism — the sense that every design
decision was made because it was the only right decision, not because it fit
a rule.

Deepening the aesthetic means treating every screen as a designed artifact.
Not "a dashboard that uses neo-brutalist styling" but "a printed object that
happens to be interactive." The distinction is felt immediately by a user even
if they cannot name it.

## Aesthetic principles

### 1. Typography is the structure

In the current implementation, typography communicates content. In the deepened
version, typography *is* the layout.

Every screen has a typographic hierarchy that works before any colour or border
is applied. The hierarchy has three tiers, and they should be dramatically
separated — not graduated.

- **Tier 1 — Display.** Barlow Condensed, 900 weight, uppercase. Used for the
  primary number or status on a screen: the trust score, the current stage name,
  the run status, the graph node count. This should be uncomfortably large.
  **64–96px** where the viewport allows. It should feel like it wants to escape
  the container.
- **Tier 2 — Label.** Space Mono, 700 weight, uppercase, tracked. Used for
  section headings, column headers, status tags, every piece of metadata.
  **10–12px.** Precise. Clinical. The contrast with Tier 1 creates tension.
- **Tier 3 — Body.** DM Sans, 400 weight, sentence case. Used sparingly and
  only for prose that requires reading, not scanning. Descriptions, help text,
  copy. **14–15px**, generous line-height.

There is no Tier 2.5. There is no "medium-sized heading." The jump between
Tier 1 and Tier 2 should be dramatic.

### 2. Yellow is a spotlight

Yellow marks **exactly one** primary action per screen. Not the brand. Not the
theme. One action.

- Connect home: `START NEW RUN` is yellow.
- Pipeline wizard: the active `CONTINUE` button is yellow.
- Graph review: the primary triage action matching the AI verdict is yellow.
- Runs screen in progress: the current pipeline stage indicator is yellow.

Everything else — secondary actions, status indicators, tags, highlights — uses
the outlined treatment (black border, no fill) or the inverted treatment (black
fill, yellow or white text) but not yellow fill.

The exception: the `ALL SYSTEMS GO` banner is yellow. This is the product's
moment of celebration and it earns the yellow.

### 3. Space is a design element

Neo-brutalism uses compression and expansion deliberately to create rhythm and
direct attention.

- **Dense zones** — the activity log, the validation breakdown bar, the pipeline
  stage list — should feel tightly packed. Small text, minimal padding, the
  information pressing against its container.
- **Spacious zones** — the hero on each section (the primary metric, the page
  heading, the key action) — room to breathe. Generous padding above and below.
  The isolation makes them important.

The contrast between a dense zone and a spacious zone on the same screen tells
the user immediately what to look at and what to scan.

### 4. Data feels physical

Numbers in this product are meaningful. The trust score, the claim counts, the
stage progress — these represent real work done on real knowledge. They should
feel weighty.

- **Metric cards:** the number is Tier 1 display type. The label is Tier 2 mono.
  No chart decoration, no gradient fill, no icon. Just the number and what it
  means. The offset shadow on the card is what gives it physical presence.
- **Status badges:** uppercase mono, black border, no fill for neutral states.
  Yellow fill for the one badge that requires action. Black fill with yellow text
  for the "currently active" state (e.g. the running pipeline stage).

### 5. Borders are structural, not decorative

Every border in the product defines a boundary that means something: the border
between the nav and the content area, the border on a card that contains a
discrete piece of information, the border on a button that invites interaction.

Borders that don't define a meaningful boundary should be removed. Review every
border and ask: is this boundary meaningful? If not, remove it. If yes, make it
count — **2px solid black**, no softening.

### 6. Interactions are theatrical

When the user presses a button, something physical happens. Shadow drops to 2px.
The button moves 2px. It feels like pressing a key.

- When a card is hovered, the shadow grows and the card lifts 2px. It feels like
  picking something up.
- When a triage action is confirmed, the card **slides left** out of the queue.
  Not fades. Slides. It has been decided.
- When a pipeline stage completes, the stage indicator transitions to the
  completed state: the **yellow active state transforms to the black filled
  state with a checkmark.** It feels like a physical dial clicking to a new
  position.

These interactions communicate the product's underlying physics: things in this
product have weight and can be moved.

## What to leave alone

- The warm cream background (`#F3EAD0`) — correct and complete.
- The font choices (Barlow Condensed, Space Mono, DM Sans) — correct.
- The offset shadow system (3px / 5px / 7px, no blur) — correct.
- The border system (2px solid black) — correct.
- The product's overall information architecture — this brief is aesthetic only.
