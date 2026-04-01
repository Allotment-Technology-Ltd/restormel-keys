---
name: restormel-product-flow-diagrams
description: >-
  Builds minimal inline SVG architecture diagrams for Restormel Keys marketing and proof pages using
  only --rm-* design tokens. Use when editing /keys/use-cases, adding “how Keys sits in the app” visuals,
  or any Keys dashboard page that needs clean flow diagrams without Tailwind or icon packs.
---

# Restormel product flow diagrams

## When to use

- `/keys/use-cases` or similar **product proof** pages.
- Any **library-first / embedding** explanation where a simple stack or fan-in clarifies boundaries.
- Do **not** use for dense technical docs that already have sequence diagrams elsewhere—keep these **editorial and sparse**.

## Hard constraints

- **Tokens only:** `var(--rm-text)`, `var(--rm-muted)`, `var(--rm-dim)`, `var(--rm-border)`, `var(--rm-sage)`, `var(--rm-surface)`, `var(--rm-surface-raised)`, `var(--rm-bg)`, and `color-mix(in oklab, var(--rm-sage) …)` for Keys emphasis. Use `var(--rm-font-ui)` for SVG text via scoped CSS targeting `svg text`.
- **No** Tailwind, no Lucide/Heroicons clutter, no stock illustrations, **no fake metrics** or invented logos.
- **No** new brand colours; sage accent only for the Keys layer (stroke + light fill mix).

## Layout patterns

| Pattern | Use for |
|--------|---------|
| **Horizontal four-step** | Generic “UI → logic → Keys → providers” (operating model). |
| **Vertical stack** | Single-threaded pipeline (e.g. privacy extraction: UI → framework server → Keys → providers). |
| **Fan-in** | Multiple server routes or surfaces converging on one Keys layer, then providers (combined mode). |

Keep **3–5 boxes** per diagram. Prefer **short labels** (two words max on one line; optional subline in smaller muted text).

## SVG implementation

1. **Wrapper:** `div.flow-diagram` (or `figure.case-diagram`) with scoped styles so `rect`, `line`, `text` pick up tokens via classes: e.g. `.flow-rect`, `.flow-keys`, `.flow-line`, `.flow-text`, `.flow-sub`.
2. **Sizing:** `viewBox` fixed; `width="100%"`, `height="auto"`, `preserveAspectRatio="xMidYMid meet"`, `max-height` in CSS if needed.
3. **Corners:** `rx` / `ry` aligned with `--rm-radius` feel (~4–6px in user space, e.g. `rx="4"`).
4. **Arrows:** `stroke` + optional `marker-end` with small triangle using same stroke colour as `--rm-border`, or a short diagonal/vertical segment—avoid heavy arrowheads.

## Accessibility

- If a **text list** immediately duplicates the diagram (same four layers), mark the SVG **`aria-hidden="true"`** to avoid repetition.
- If the diagram **adds** structure (case-specific paths), use **`role="img"`** + **`aria-labelledby`** pointing to a visible or `.flow-sr-only` caption, or a concise `aria-label`.
- Never convey meaning **only** in colour; Keys layer should also differ by **stroke weight** or **label text**.

## Canonical reference

See `apps/dashboard/src/routes/keys/use-cases/+page.svelte`: operating horizontal flow, PLOT vertical stack, Sophia fan-in.

## Check before merge

- `pnpm --filter dashboard run check`
- Diagram still readable at ~320px width (mobile).
