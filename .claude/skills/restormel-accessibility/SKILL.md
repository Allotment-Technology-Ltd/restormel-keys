---
name: restormel-accessibility
description: >-
  Enforceable accessibility standard for the Restormel dashboard: WCAG 2.2 AA baseline (EAA-era),
  repo floors (44px targets, brut-focus ring, reduced-motion guards, colour-never-alone), SvelteKit
  focus management, live regions, ARIA patterns, and the getByRole-first test convention. Use when
  building or reviewing any dashboard UI, when a PR touches routes/components/styles/tests under
  apps/dashboard, when the user mentions accessibility, a11y, WCAG, focus, contrast, screen reader,
  or keyboard — not marketing-site copy edits or backend-only changes.
---

# Restormel accessibility

Canonical references: [docs/reviews/wave-r-design-usability-rubric.md](../../../docs/reviews/wave-r-design-usability-rubric.md) (rubric criteria R3–R5, X-invariants, severity ladder), [docs/design/ux-contracts.md](../../../docs/design/ux-contracts.md) (canonical states §3, dialog/keyboard contracts), [docs/design/onboarding-handoff/04_TOKENS.md](../../../docs/design/onboarding-handoff/04_TOKENS.md) (accessibility floors), [docs/design/DESIGN-SPECIFICATION.md](../../../docs/design/DESIGN-SPECIFICATION.md) (Accessibility section + v2 preamble **only** — the v1 body's dark palette and Tailwind/React examples are historical and do not apply).

Every rule below is checkable against a diff or a rendered screen. "Be accessible" is not a rule; "the 2px `brut-focus` ring — ink-paired, as this skill requires below — appears on every focusable when tabbing the changed route" is.

## Baseline and severity

| Rule | Requirement |
|------|-------------|
| Conformance target | **WCAG 2.2 AA.** Supersedes the "WCAG 2.1 AA" wording in DESIGN-SPECIFICATION: the EAA is in force (since 2025-06-28, EU consumers in scope) and draft EN 301 549 v4.1 incorporates 2.2 AA (final v4.1.1 expected in the Official Journal Oct 2026; the currently harmonised v3.2.1 still cites 2.1 AA — we pre-empt). 2.2 is backwards-compatible with 2.1, so building to it satisfies both. |
| Conformance claims | Cite WCAG 2.x criteria only. **Never** claim "WCAG 3" or "APCA compliance" — WCAG 3 is a working draft and APCA was removed from it. A colour ships only if it passes WCAG 2 ratios; an APCA Lc value is never sufficient. |
| 4.1.1 Parsing | Removed in WCAG 2.2. Never flag it. |
| Severity mapping | Per the rubric ladder: an **a11y barrier** (keyboard trap, missing accessible name, focus loss into `<body>`, contrast < AA) = **Major — fix before merge** unless owner-waived; a **dead-end state** = **Blocker** per the ladder (breaks a thesis invariant — never downgrade it to Major). Sub-44px target = **Minor** (fix-forward, filed + named in PR); sub-24px target = a likely WCAG 2.5.8 failure (unless the spacing or equivalent-alternative exceptions apply) = **Major**. |
| Novice-first | The "one next action" on any M0→M1→M4 spine screen must be a real focusable element with an accessible name — never conveyed by animation, position, or colour alone. Name that element in the PR for each touched spine screen so the reviewer can verify it with `getByRole`. |

## Focus and keyboard (R3-A2, X10, WCAG 2.4.3/2.4.7/2.4.11)

| Rule | Pass criteria |
|------|---------------|
| Reachability | Every interactive element reachable by Tab; tab order = visual order (R3-A2). No positive `tabindex`. |
| Focus visible | Every focusable shows the **`brut-focus`** ring at `:focus-visible`. `brut-focus` is canonical for all product chrome; the v1 blue tokens (`focus-ring-color: #4C8DFF`, 50% alpha) are legacy/viz-only — do not introduce them in new dashboard components. |
| Ring contrast | The shipped `.brut-focus` is a bare 2px `--color-yellow` (`#FFD600`) outline, and 04_TOKENS' floor asks only for a "yellow focus ring" — this skill imposes a **stricter** requirement (as with 44px vs 24px): yellow against cream `#F0E6D2/#F3EAD0` is ~1.1:1 and **fails WCAG 1.4.11 (3:1)**, so any yellow ring or yellow fill must be paired with an ink (≥2px, `#0C0C0C`) outline, offset, or existing hard border so the focus boundary itself meets 3:1. Never a bare yellow ring on cream. |
| Focus not obscured (2.4.11) | Sticky headers, toasts, non-modal panels, and banners must never fully cover the focused element. Test with all sticky chrome mounted. |
| Escape | Escape closes any overlay you introduce (X10); focus returns to the opener. |
| No focus loss | Never destroy the focused element (via `{#if}`, panel swap, list mutation) without explicitly relocating focus — jsdom/browser both drop it to `<body>`. |
| Targets | Hit targets ≥ **44px** (04_TOKENS floor — deliberately stricter than WCAG 2.2's 24px; keep 44). Inline text links exempt. Icon buttons, chip-dismiss ×, row actions: pad inside the hard border to reach 44px. |
| Shortcuts | Keyboard shortcuts never fire from inputs; modifier chords early-return; results announced on the polite live region (ux-contracts). |

**How to verify:** tab the full changed route in `pnpm --filter dashboard dev` with sticky chrome present — every stop shows the ink-paired ring, order matches layout, Escape closes overlays, nothing is fully hidden behind fixed chrome. In tests: `await user.tab()` / Playwright `toBeFocused()` assertions on swap and close paths. When adding a new interactive surface, screenshot the `:focus-visible` state and attach it to the PR description.

## Colour, contrast, and state (R3-A3, R4-A3, X2)

| Rule | Pass criteria |
|------|---------------|
| Text contrast | 4.5:1 normal, 3:1 large text (ink on cream and ink on yellow pass; **verify any grey/mono secondary label numerically**). Never alpha colours for text. |
| Non-text contrast | 3:1 for UI component boundaries. Hard ≥2px ink borders on cream pass trivially — this is why the brutal border invariant (X2) is an a11y asset, not a constraint. Yellow-fill-vs-canvas boundaries need the ink border (see focus table above). |
| State never colour-only | Glyph + word, always (R3-A3, R4-A3). Selected picker state = glyph + text, not fill alone. `■`/`□` rail glyphs already satisfy this — keep the pattern. |
| Token discipline | No colour/spacing literals in new components — `--rm-*`/`--brut-*`/`--color-*` tokens only (04_TOKENS). |
| Uppercase scope | Mono uppercase is restricted to **short operational nouns/ledger labels only** (X12 reconciliation); body copy, help text, and error messages are sentence case. Do not put `text-transform: uppercase` on anything longer than a label — all-caps degrades scanability and dyslexic readability. |

**How to verify:** extend [apps/dashboard/src/lib/styles/brutalist-contrast.test.ts](../../../apps/dashboard/src/lib/styles/brutalist-contrast.test.ts) with any **new colour pair** you introduce (it pins existing token pairs to WCAG ratios); run an axe-core scan on the rendered route (browser axe DevTools today; `@axe-core/playwright` with `withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa'])` once the e2e suite exists). Grep the diff for hex literals and `text-transform: uppercase` outside label classes.

## Motion (X9, R3-A3, WCAG 2.3.3 craft)

| Rule | Pass criteria |
|------|---------------|
| Per-animation guards | **Every** added animation carries its own `prefers-reduced-motion: reduce` guard **with a static informative fallback** (X9, ux-contracts: heartbeat strip, nav-pending, LiveRunChip all go static-but-legible). |
| No blanket kill-switch | Do **not** add the DESIGN-SPECIFICATION v1 blanket `* { animation-duration: 0.01ms !important }` rule — it can break "static text carries the signal" states. The per-animation contract wins this conflict. |
| Brand motion not exempt | The 100ms mechanical press, pulsing dots, and offset-shadow hover shifts are brand DNA **and** vestibular triggers — they are gated like everything else, never treated as essential. |
| Svelte transitions | Built-in transitions (`fly`, `slide`, `scale`, `crossfade`) and `spring`/`tweened` do **not** respect `prefers-reduced-motion` by themselves (svelte#5346 — closed by shipping `prefersReducedMotion` in `svelte/motion`, not by making transitions auto-respect it). No shared repo wrapper exists yet: gate JS-driven motion with `prefersReducedMotion` from `svelte/motion` or a `matchMedia('(prefers-reduced-motion: reduce)')` check (local pattern: `ConnectIngestRunConsole.svelte`) — or extract a shared wrapper first. Ungated motion transitions in a diff are a Major. CSS-only kill-switches miss JS-driven motion. |
| Signal never motion-only | Nothing (including the novice's "one next action") may be conveyed by animation alone. |

**How to verify:** toggle OS reduce-motion (macOS: System Settings → Accessibility → Display → Reduce motion), reload the route, confirm every animated element renders a static state that still carries its information; screenshot both states and attach them to the PR description. Grep the diff for `transition:` / `animate:` / `spring(` / `tweened(` without a reduced-motion gate.

## SvelteKit / SPA rules (R4-A1, ux-contracts, WCAG 4.1.3)

| Rule | Pass criteria |
|------|---------------|
| Page titles | Every route sets a distinct `<svelte:head><title>` ("Page — Restormel"). SvelteKit's default navigation behaviour announces the new title — a missing/duplicate title makes navigation silent. |
| Full navigations | Keep SvelteKit's default focus/announcement behaviour **or** replace it wholesale in `afterNavigate` (move focus to the new view's `<h1 tabindex="-1">`, suppressing the visible outline on programmatic-only focus). Never half-replace it. `goto(..., { keepFocus: true })` still loses focus if the element vanishes. |
| Panel transitions | Stepper/panel transitions move focus to the new panel's heading (R4-A1). On drawer/rail open: focus moves in; modal surfaces trap focus (`aria-modal` + `inert` background); on close, focus returns to the opener. |
| Live regions | One persistent polite (`role="status"`) + one assertive (`role="alert"`) region per layout, rendered empty at boot, **never inside `{#if}`/`{#key}` blocks** (recreated regions don't announce). Visually hidden via the clip pattern, not `display:none`/`aria-hidden`. Inject complete message text atomically — one sentence max, no interactive content. |
| Loading semantics | `aria-busy="true"` on the **one container** being replaced (not per skeleton), flipped to `false` when done; skeleton placeholders `aria-hidden="true"`; completion announced via the status region ("12 documents loaded"). Nav-pending uses `aria-busy` + `role="progressbar"` + sr-only `role="status"`, animation reduced-motion-suppressed (ux-contracts). |
| Canonical states | Every flow defines loading/error/empty/success with ≥1 recovery action (ux-contracts §3). Honest absent states — **never a fabricated `0`** (that's a Blocker under the rubric ladder). Destructive confirms state blast radius. |
| Mobile read-only tier | ≥44px targets; mutations **hidden**, not disabled-and-teasing. |

**How to verify:** getByRole tests asserting focus destination after each panel swap; one VoiceOver + Safari pass per release on the golden path (M0→M1→M4) confirming navigation, loading start/finish, and error states are actually announced — record the result (date, route, pass/fail per state) in the release PR body; check the diff shows no live region born inside a conditional.

## ARIA patterns used in this codebase

| Pattern | Contract |
|---------|----------|
| Stepper | `aria-current="step"` on the active step; panel change moves focus to the new heading (R4-A1). |
| Tabs | Full ARIA tabs pattern (`tablist`/`tab`/`tabpanel`, arrow-key operation) **or** real links with `aria-current` — one choice, applied consistently across both sections (R5-A1). Never a styled `<div>` hybrid. |
| Dialog / rail | `role="dialog"` + `aria-modal` + `aria-labelledby`; Escape closes; focus trapped and returned to opener. Reference implementation + test: `DossierRail.svelte` / `DossierRail.test.ts` (`apps/dashboard/src/lib/components/dashboard/`). |
| Status | `role="status" aria-live="polite"` for async results; `role="alert"` reserved for errors needing interruption. |
| Structure | Labelled regions, exactly one `h1`, no heading-level skips (R3-A1); tables get real headers, lists real list semantics; export links name their object (R5-A2). |
| Icon buttons | `aria-label` mandatory. Data viz (sparklines, graphs) gets a text alternative (R3-A2). |
| Custom components | Name, role, value (4.1.2): if it isn't a native element, it declares role, accessible name, and state (`aria-expanded`, `aria-selected`, `aria-checked`) and handles the pattern's keys. (Advisory, not a review gate: reach for native elements first.) |

**How to verify:** `getByRole` queries in the component's test are the check — if `getByRole("tab", { name: ... })` can't find it, the pattern is broken. Run axe on the route state with the widget open.

## WCAG 2.2 additions — dashboard-specific rules

| Criterion | Enforceable rule here |
|-----------|----------------------|
| 2.5.7 Dragging | Any drag interaction (graph-canvas panning, reordering) has a single-pointer non-drag alternative (buttons/menu/click). |
| 2.5.8 Target size | Covered by the stricter 44px floor above. |
| 3.2.6 Consistent help | Help/docs/contact links appear in the same relative order on every page that has them. |
| 3.3.7 Redundant entry | Within one flow (onboarding, connect setup), never make the user re-type what they already gave — auto-populate or offer selection. |
| 3.3.8 Accessible auth | Never block paste in credential fields; correct `autocomplete` tokens so password managers work; no transcription CAPTCHAs in any auth step. |

**How to verify:** axe covers target-size; the rest are diff review + a keyboard/pointer walkthrough of the touched flow (attempt the drag interaction with clicks only; paste into every credential field).

## Testing conventions (getByRole-first)

1. **Query by role + accessible name**: `getByRole("button", { name: /skip onboarding/i })` — the repo convention (see `DossierRail.test.ts`, `RouteCoverageIndicator.test.ts`, `ModeSelector.test.ts`). Every functional test is thereby a cheap a11y test. `getByTestId` or CSS selectors require a comment justifying why no role/name exists.
2. Current stack: `@testing-library/svelte` + `// @vitest-environment jsdom`, doc-comment citing the ux-contracts §3 stage under test. (If the repo migrates to `vitest-browser-svelte`/Playwright locators — the 2026 direction, since Svelte 5 runes misbehave under jsdom — the same role-first convention carries over: `page.getByRole(...)` over `page.locator(...)`.)
3. **svelte-check must be warning-free**: `pnpm --filter dashboard run check`. Treat `a11y_*` warnings as errors. Every `<!-- svelte-ignore a11y_* -->` carries a parenthesised justification; un-annotated ignores fail review.
4. **Compiler warnings are shallow** — dynamic attribute values, cross-component heading order, and all CSS (contrast, focus visibility) escape them entirely. A clean svelte-check is the floor, never the finish line.
5. **axe layering**: component-level axe (jsdom) is a fast pre-filter only — it misses layout/contrast rules. Page-level axe in a real browser is authoritative. Per-page `disableRules` only with a linked ticket.
6. Automation ceiling is ~30–57% of WCAG issues. Per release, manually run — and record the results in the release PR body: full keyboard walkthrough; one screen-reader pass (VoiceOver/Safari minimum; date + pass/fail, see §SvelteKit verify); 400% zoom / 320px reflow (the ~892px content column must reflow, not clip — attach the 320px screenshot); reduced-motion check (the §Motion screenshots are the artifact).

## Anti-patterns

- A bare yellow focus ring or yellow fill floating on cream with no ink border — invisible boundary, 1.4.11 failure.
- Reaching for the v1 blue focus tokens in product chrome — legacy; `brut-focus` is canonical.
- `text-transform: uppercase` on body copy, empty-state prose, or error messages — uppercase is for ledger labels only.
- A blanket `*`-selector reduced-motion kill-switch instead of per-animation guards with static fallbacks.
- Raw `transition:fly`/`slide` without a reduced-motion gate (`prefersReducedMotion` or `matchMedia`).
- Live regions created on demand or inside `{#if}` — they will not announce.
- `aria-busy` sprinkled per-skeleton instead of once on the swapped container; skeletons visible to AT.
- Disabled-and-teasing mutation buttons on the mobile read-only tier — hide them.
- Fabricated `0` where state is genuinely absent — rubric Blocker.
- Citing "WCAG 3" or "APCA" in a conformance claim, or flagging 4.1.1 Parsing.
- Fighting the design system: the hard ink borders, flat fills, and explicit hit areas are the *easiest* AA-passing visual language available — work with them.

## Workflow

1. Read this skill before touching any dashboard UI; skim the rubric criteria (R3–R5, X2/X5/X9/X10) for the surface class you're editing.
2. Build with native elements and existing `Brutal*` primitives (see [restormel-neu-brutalist-ui](../restormel-neu-brutalist-ui/SKILL.md)) — they carry `brut-focus`/`brut-pressable` already.
3. While building: distinct title, focus plan for every conditional swap, states per ux-contracts §3, tokens only.
4. Before PR: `pnpm --filter dashboard run check` clean; role-first tests for new interactive behaviour (focus destination, Escape, accessible names); contrast test extended for new colour pairs.
5. Manually: tab walkthrough of the changed route (+ reduce-motion toggle if you added motion); attach the focus-visible and reduced-motion screenshots to the PR description.
6. Classify any residual issue with the rubric severity ladder and name it in the PR (Minor = fix-forward, filed).

## Related skills and docs

| Resource | Use |
|----------|-----|
| [restormel-neu-brutalist-ui](../restormel-neu-brutalist-ui/SKILL.md) | Visual DNA, `Brutal*` primitives, token discipline |
| [docs/reviews/wave-r-design-usability-rubric.md](../../../docs/reviews/wave-r-design-usability-rubric.md) | Verbatim criteria + severity ladder for review |
| [docs/design/ux-contracts.md](../../../docs/design/ux-contracts.md) | Canonical states, dialog/keyboard/live-region contracts |
| [docs/design/onboarding-handoff/04_TOKENS.md](../../../docs/design/onboarding-handoff/04_TOKENS.md) | Token-level accessibility floors |
| [apps/dashboard/src/lib/styles/brutalist-contrast.test.ts](../../../apps/dashboard/src/lib/styles/brutalist-contrast.test.ts) | Pinned WCAG contrast pairs — extend, don't bypass |

## Staleness & upkeep

Update this skill when any of these change: the EN 301 549 harmonisation status (draft v4.1 → final v4.1.1 in the Official Journal, expected Oct 2026 — flip the baseline note from "pre-empting" to "harmonised"); WCAG 3 leaving working-draft status; a shared reduced-motion wrapper landing in the dashboard (then mandate it by name in §Motion); the dashboard test stack migrating off jsdom (`vitest-browser-svelte`) or gaining a Playwright e2e suite (then make `@axe-core/playwright` the mandatory CI check and update §Testing); new `Brutal*` primitives that change the focus-ring implementation; any rubric revision to the R/X criteria cited here. Verify checkout freshness (`git fetch` + compare `origin/main`) before treating cited file paths as current.