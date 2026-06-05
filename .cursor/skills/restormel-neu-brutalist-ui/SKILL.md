---
name: restormel-neu-brutalist-ui
description: >-
  Neo-brutalist dashboard and Connect UI: hard borders, offset shadows, flat accent fills, mono labels,
  BrutalCard/BrutalButton primitives, and Restormel token discipline. Use when redesigning dashboard
  surfaces, Connect hub panels, operator cards, status ledgers, or any in-app UI that should match
  the brutalist graph explorer — not soft SaaS cards.
---

# Restormel neu-brutalist UI

Canonical references: [docs/DESIGN-TOKENS.md](../../../docs/DESIGN-TOKENS.md), [docs/design-system-index.md](../../../docs/design-system-index.md), [neubrutalism.com](https://neubrutalism.com/) (visual grammar).

## Visual DNA (non-negotiable)

| Rule | Restormel implementation |
|------|---------------------------|
| Borders | `var(--border)` / `var(--border-thin)` — ink, 2–3px, **no pill radii** on cards |
| Shadows | `var(--shadow-md)` / `var(--shadow-lg)` — **hard offset, zero blur** |
| Corners | `border-radius: 0` everywhere on brutal surfaces |
| Color | Flat fills only — cream canvas `#F3EAD0`, ink `#0C0C0C`, yellow **CTA/highlight only**, blueprint blue for secondary emphasis |
| Type | Display: Barlow Condensed / bold UI titles; operational labels: `var(--font-mono)` uppercase tracking |
| Depth | Layered cards with **overlap** (`brut-overlap`) — cap stripe + body card, not floating soft panels |
| Interaction | `brut-pressable` + `brut-focus` — hover lifts (-2px), active presses (+shadow collapse) |

## Component inventory (dashboard)

Prefer existing primitives under `apps/dashboard/src/lib/components/brutalist/`:

- `BrutalCard`, `BrutalButton`, `BrutalBadge`, `BrutalBentoGrid`, `BrutalPageHeader`
- Utilities: `apps/dashboard/src/lib/styles/brutalist-utilities.css`
- Prototype patterns: `apps/dashboard/src/routes/prototype/brutalist-dashboard/+page.svelte`

**Do not** introduce Tailwind on dashboard surfaces. Use `--rm-*` / `--brut-*` / `--color-*` tokens.

## Layout patterns

1. **Ledger / status panel** — yellow or neon **cap** (kicker + headline + badge) stacked above white **body** card with `margin-top: -2px` overlap; inside: bento grid (rails left, vitals right).
2. **Check rails** — square glyphs `■` / `□` in mono, one tile per infrastructure check; ok tiles get yellow fill or sage accent border.
3. **Vitals block** — oversized stat numeral (trust score, counts); supporting text small mono; single primary CTA (`BrutalButton variant="blue"`).
4. **Progressive disclosure** — `<details>` for secondary lists (journey steps), not a second duplicate card.

## Accessibility

- Maintain WCAG AA contrast on yellow fills (ink text on yellow).
- `min-height: 44px` on interactive rows; visible `:focus-visible` via `brut-focus`.
- Semantic headings inside regions; `aria-label` on composite status panels.

## Anti-patterns

- Duplicate status blocks (summary banner + separate health list) — **merge into one ledger**.
- Soft `border-radius: var(--rm-radius)` cards on Connect operator surfaces when brutal primitives exist.
- Gradients, glassmorphism, or blurred shadows.
- Full-bleed yellow backgrounds (yellow = accent band or CTA, not page wash).

## Workflow

1. Read this skill before editing Connect/dashboard UI.
2. Reuse `Brutal*` components; extend with scoped CSS in the Svelte file using token variables.
3. Compare mentally to `ConnectGraphExplorer` — if the new surface looks like generic `--rm-surface` cards, push harder on borders, overlap, and mono labels.
