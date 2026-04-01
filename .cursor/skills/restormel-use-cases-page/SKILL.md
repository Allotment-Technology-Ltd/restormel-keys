---
name: restormel-use-cases-page
description: >-
  Maintains the Restormel Keys /keys/use-cases product-proof page: thesis hero, three modes, shared primitives,
  operating model, PLOT vs Sophia case blocks, patterns grid, and CTA. Use when asked to revise use cases,
  testimonials, or “product proof” marketing for Keys.
---

# Restormel Keys use-cases page (`/keys/use-cases`)

## File

- **Route:** `apps/dashboard/src/routes/keys/use-cases/+page.svelte`
- **Shell:** Unchanged site header/footer via `keys` layout; do not move to a separate app.

## Product framing (non-negotiable)

Keys is **library-first**, **BYOK + routing + policy**, **embeddable**, **not** a generic gateway, **not** a model marketplace, **not** generic observability. Preserve the three modes: **builder-side routing**, **end-user BYOK**, **combined mode**.

## Page IA (keep unless deliberately restructuring)

1. Hero (thesis + two panels: what Keys is / what page proves)
2. What Keys is for (intro column + mode rail with “Used when”)
3. Shared primitives (name/detail grid)
4. How Keys sits inside your app (diagram + numbered stack or diagram as supplement)
5. PLOT case (privacy / practical adoption; vertical flow diagram)
6. Sophia case (complexity / combined mode; fan-in diagram)
7. Patterns (3×2, each with **Prevents**)
8. Closing CTA (takeaway + docs / walkthrough / start free)

## Visual rhythm

Alternate **typographic** sections (primitives table) with **boxed** sections (cases, patterns). Avoid ornamental jump chips unless they filter real content.

## Diagrams

Follow [.cursor/skills/restormel-product-flow-diagrams/SKILL.md](../restormel-product-flow-diagrams/SKILL.md).

## After edits

- Run `pnpm --filter dashboard run check`
- Meaningful copy/structure changes: one line in `CHANGELOG.md` under the current repo date if appropriate
- Do not commit secrets; no raw key examples in copy
