# Restormel Dashboard — design system bundle

This directory is the **product's design system expressed as static, self-contained
HTML cards** — the single source of truth that **Claude Design** reads (via
`/design-sync`) so prototypes inherit Restormel's *real* neo-brutalist look instead of
a generic mock. Generated from the live dashboard code (`src/app.css` tokens +
`src/lib/components/**`).

Full workflow + rationale: [`docs/design/claude-design-tandem-workflow-2026-06-27.md`](../../../docs/design/claude-design-tandem-workflow-2026-06-27.md).

## Use it

```bash
cd apps/dashboard/design-system
claude
> /design-sync     # pushes these cards to a claude.ai/design design-system project
```

Then prototype in Claude Design against that project. `/design-sync` is user-invoked
(it authenticates with your claude.ai/design login).

## Structure

```
design-system/
  styles.css              # CANONICAL token + base stylesheet (derived from src/app.css).
                          # Every card links it; tokens live here only.
  foundations/index.html  # palette, type scale, spacing, shadows — the reference sheet
  components/<name>/index.html   # one card per component, multiple variants/states each
```

26 cards across: **Foundations**, **Components / Brutalist** (the `brutalist/*`
primitives — button, badge, input, card, bento, banners, loading, page-header),
**Shell** (logo, user menu, command palette, empty state, …), **Surfaces /
Dashboard** (readiness card, setup checklist, route strip, …), **Surfaces / Route
Creator** (the connect pipeline wizard + stepper + panels).

## Conventions

- **First line of every card** is `<!-- @dsCard group="..." -->` — Claude Design
  indexes the bundle from these markers.
- **`styles.css` is the only place tokens are defined.** Cards link it; never
  redefine a token in a card. Change the look in one place.
- **Cards are pure static HTML+CSS** — no Svelte, no JS, no build step. Interactive
  states are shown side-by-side statically (default / hover / focus / error /
  disabled).
- **No secrets** — placeholders only (`rk_live_••••`); the bundle syncs to an external
  service, treat it as publishable.
- **Real tokens + class names only** — fidelity is the whole point.

## Keeping it in sync

When a `brutalist/*` primitive, an `app.css` token, or a key surface changes in the
product, update its card here and re-run `/design-sync`. For a broad refresh,
regenerate the bundle (the `design-system-bundle` Claude Code workflow that produced
it) and review the diff. See the tandem-workflow doc for the drift norm.
