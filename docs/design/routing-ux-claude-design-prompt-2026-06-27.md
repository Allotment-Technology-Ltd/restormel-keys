---
title: "Routing UX redesign — Claude Design / Figma prompt (Pick & Live)"
class: technical
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-27
last-reviewed: 2026-06-27
review-interval: P6M
---

> Copy-paste-ready prompt for **Claude Design** to generate high-fidelity mockups of the
> recommended "Pick & Live" routing journey. Companion to
> `routing-ux-simplification-2026-06-27.md`.
>
> **Run it inside the "Restormel Dashboard" design-system project** (synced from the live
> dashboard via `/design-sync`). That project carries the product's REAL components and tokens,
> so Claude Design builds the routing screens from real parts that map 1:1 onto shippable Svelte
> code — instead of inventing a generic (and, as the first draft of this prompt did, subtly
> wrong) look. The "USE THE DESIGN SYSTEM" block below replaces the old hand-described visual
> language. Sibling prompt for the Connect dashboard:
> `connect-dashboard-claude-design-prompt-2026-06-27.md`.

Design high-fidelity mockups for the redesigned "route" creation and editing experience of **Restormel Keys**, a BYOK (bring-your-own-key) AI gateway. A "route" sends an AI request to a provider/model with optional ordered fallback steps ("if this model fails, try the next"). The redesign collapses a sprawling, multi-tab, multi-commit editor into a single autosaving canvas, and physically separates a second product (Connect document-ingestion stage-routing) onto its own canvas-free board.

== PRODUCT CONTEXT (what the user is trying to do) ==
The user's ONE intent is: "point this route at a model and make it live." Today that takes ~4 commit clicks across 2 tabs, ~44 controls, raw-JSON textareas, and a pointless "publish" version gate — even though routes are already live. The redesign makes it ONE click: clicking "+ NEW ROUTE" creates a real, already-LIVE route on a sensible recommended default and opens the canvas. Everything autosaves. There is no Save button, no Apply button, no Publish button, no version gate. State is shown by a single status pill: SAVING… → LIVE · SAVED.

== USE THE DESIGN SYSTEM (build from the product's REAL parts — do not re-invent the look) ==
Build every screen from the **"Restormel Dashboard"** design system in this project. It is
**neo-brutalist**; use its real tokens with their real values, never hand-picked colours:
- **Canvas** `--color-bg` warm cream `#f3ead0`; **card/input surface** `--color-surface` `#fffef0`.
- **PRIMARY accent / main CTA fill** = `--color-yellow` `#ffd600` with **black text**. (This is the
  product's primary — the first draft of this prompt wrongly used teal as the primary fill. Teal is
  NOT the primary button colour.)
- **LIVE / verified / "resolves ✓" / success signal** = `--signal-teal` `#2ec4b6` (used for the LIVE
  pill, the selected radio, and the resolves-✓ chip — teal earns its keep here, just not as the CTA).
- **Warning / attention** = `--amber-insight` `#ffb84d` / `--brut-amber`; **error / destructive** =
  `--coral-alert` `#f25c54` / `--brut-coral` (used sparingly, e.g. a born-DISABLED step, an error toast).
  State chips use `--state-ok-*` / `--state-warn-*` / `--state-fail-*`.
- **Ink / borders / shadows** = `--color-ink` `#0c0c0c`. Borders are **2px solid ink, hard 90°
  corners, radius 0** (`--border`). Shadows are **hard offset, no blur** (`--shadow-sm/md/lg` =
  `3/5/7px 3/5/7px 0 ink`). On press a button "presses into" its shadow.
- **Type**: display = **Barlow Condensed** (`--font-display`, chunky UPPERCASE headings); mono =
  **Space Mono** (`--font-mono`, labels / status / model IDs like "together / gpt-5.2" / metadata,
  UPPERCASE); body = **DM Sans** (`--font-body`). Buttons are mono, uppercase, 12px, 700, tracking
  0.06em. Spacing on the `--space-*` scale — generous, grid-aligned; a confident engineering tool,
  not a soft SaaS dashboard.
- **Pills/chips**: rectangular, thick-bordered, uppercase mono. LIVE = teal fill. SAVING… = paper
  surface with an animated mono ellipsis. resolves ✓ = small teal-outlined chip.
- Drag handles render as a mono "[::]" glyph. Flow connectors between steps are thick ink vertical
  connectors with a small mono label "if it fails ↓".

**Reuse these real component cards (compose the screens from them; don't redraw primitives):**
- Buttons / chips / inputs / cards: **BrutalButton**, **BrutalBadge**, **BrutalInput**,
  **BrutalCard**, **BrutalBentoGrid**, **BrutalErrorBanner**, **BrutalLoadingState**,
  **BrutalPageHeader**. Shell frame: **AppLogo**, **CommandPalette**, **UserMenu**, **EmptyState**.
- The route-chain summary on a route card → **RoutePipelineStrip**; coverage/health → **RouteCoverageIndicator**.
- The Connect screens (4 & 5) reuse the Connect cards: **ConnectPipelineReviewLaunch**,
  **SetupChecklist**, **ConnectProviderKeyPanel**, **ConnectSourcesPanel** (these also anchor the
  fuller Connect-dashboard prompt). A LIVE/run indicator → **LiveRunChip**.

== SCREENS TO PRODUCE (5) ==

SCREEN 1 — ROUTES (unified list + inline create).
A single top-level page titled "ROUTES" with a prominent teal "[+ NEW ROUTE]" button top-right. Below, a vertical stack of route cards, each a thick-bordered paper card with hard offset shadow:
- Route name in chunky uppercase + a teal "LIVE" pill on the right.
- A mono one-line chain summary: "together / gpt-5.2  →  claude-sonnet-4-6".
- A muted mono meta line: "2 steps · edited 4m ago" and a secondary "[ EDIT ]" button.
At the bottom, ONE visually-distinct card for the other product: "CONNECT INGESTION — 7 stages routed · OK" with a "[ OPEN STAGE BOARD → ]" button and a small mono caption "(canvas-free surface)". This card looks deliberately different (e.g. a left teal spine) to signal it's a separate product. Do NOT show any per-route "publish" or "draft" badges.

SCREEN 2 — ROUTE CANVAS (the one and only gateway editor surface).
A back link "< ROUTES", an editable route-name field, and the status pill reading "LIVE · SAVED" (teal) with a mono sub-line "autosaved · resolves [✓]" and a single secondary "[ TEST ]" button. The body is a vertical flow:
- A "PRIMARY" step card: thick border, drag handle "[::]", the model shown as mono "together / gpt-5.2", and a secondary "[ CHANGE MODEL ]" button.
- A thick black connector labelled "if it fails ↓".
- A "FALLBACK 1" step card with "[ CHANGE MODEL ]" and a small "[ X ]" remove button.
- A secondary "[ + ADD FALLBACK ]" button, with mono helper text "(born DISABLED until a model is confirmed)". Show one example of a newly-added step in a DISABLED state: greyed fill, red-outlined "DISABLED — PICK A MODEL" chip, no LIVE styling.
- A collapsed disclosure row "> ADVANCED (timeout, retries, cost) — API only".
- A quiet footer link "history · rollback".
CRITICAL: there must be NO "Apply changes", NO "Apply to server", NO "Publish", NO "Save" buttons anywhere. The absence is the point.

SCREEN 3 — MODEL PICKER (modal/sheet — the single decision).
A thick-bordered modal titled "CHANGE MODEL — PRIMARY" with an "[ X ]" close. A radio list of provider/model options in mono: the first is selected (teal radio) and tagged "PRODUCTION (RECOMMENDED)" in a teal chip; others are plain. A "[ search models ___ ]" input. A single primary teal button "[ USE THIS MODEL ]" bottom-right. Clean, one decision, nothing else.

SCREEN 4 — CONNECT · STAGE BOARD (the separate product — canvas-free).
Back link "< ROUTES", title "CONNECT INGESTION — STAGE MODELS", and a top-right secondary button "[ USE RECOMMENDED FOR ALL ]". Below, a flat brutalist TABLE (not a canvas, not a flow): columns STAGE | MODEL | STATUS. Rows like "Extraction | [ together/gpt-5.2 ▾ ] REC | ● ok", "Validation | [ together/gpt-5.2 ▾ ] REC | ● ok" (highlight this row subtly — it is the founder's real "Knowledge Validation" route), "Embedding", "Summarise". Each MODEL cell is a dropdown select; a teal "REC" tag marks recommended picks; STATUS is a teal "● ok" dot. Footer: mono "autosaved / no canvas · no publish step" on the left; on the right a teal "● All stages ready" then a big primary "[ RUN INGESTION → ]" button. There must be NO drag handles, NO fallback steppers, NO reorder affordance, NO flow connectors, NO publish/version — this surface deliberately has none of the canvas concepts.

SCREEN 5 — CONNECT LAUNCH / THE FORK (one-directional boundary).
Title "CONNECT · LAUNCH INGESTION". A vertical 3-item checklist, each a thick-bordered row with a teal check: "1 ✓ Source connected — google-drive", "2 ✓ Credentials — together key [ bind ]", "3 ✓ Stage models — 7/7 recommended". Under item 3, an inline secondary "[ REVIEW STAGE BOARD ]" with caption "(inline, not the editor)". A large central primary button "[ ▶ RUN FIRST INGEST ]". At the very bottom, a small quiet text link: "Need a custom gateway route instead? → Routes". This link is intentionally understated — it is the only bridge between the two products and it goes one way.

== THE FLOW THE MOCKS MUST TELL (left-to-right narrative) ==
ROUTES list → click [+ NEW ROUTE] → ROUTE CANVAS already shows "LIVE · SAVED" (done in one click) → optional CHANGE MODEL picker → optional ADD FALLBACK (born disabled). Separately: CONNECT LAUNCH (3 checks) → REVIEW STAGE BOARD → USE RECOMMENDED FOR ALL → RUN INGESTION. One save model underneath both; ingestion never opens the gateway canvas.

== DO NOT INCLUDE (the removed complexity — their absence is the design) ==
- NO "Apply changes" / "Apply to server" / "Revert" buttons.
- NO "Save route" button and NO separate save for name vs steps.
- NO "Publish draft" button, NO draft banner, NO version/published-version duality, NO "Versions" tab (history/rollback is only a quiet footer link).
- NO tabs of any kind (no Flow / Configuration / Versions / More; no Rules / Ingestion strip).
- NO raw-JSON textareas (switchCriteria, retryPolicy, costPolicy, modelPool, notes) — these are API-only and must not appear.
- NO "Parallel group id" / "Parallel branch role" free-text fields.
- NO Add-step dialog with duplicate Provider/Model/Fallback/Timeout fields — model choice happens only in the Model Picker.
- NO Guard rails / policy-binding panel, accordion, or badge.
- NO second/duplicate routes list, NO "Project routes" cross-link, NO "New route" redirect.
- NO confirm() dialogs for publish/rollback/delete shown as design elements.
- On the Stage Board: NO canvas, NO drag handles, NO reorder, NO fallback stepper, NO publish, NO version.

== DELIVERABLE ==
Five high-fidelity frames (desktop, ~1280px wide), in the brutalist language above, on the cream/paper background, that together read as a single confident before-was-chaos / now-one-click story. Prioritise SCREEN 1 (ROUTES) and SCREEN 2 (ROUTE CANVAS) as the hero frames. Show one DISABLED born-step state and one SAVING… → LIVE·SAVED pill state to make the autosave model legible.