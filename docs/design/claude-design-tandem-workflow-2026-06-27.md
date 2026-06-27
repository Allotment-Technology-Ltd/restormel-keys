---
title: Claude Code ⇄ Claude Design ⇄ Cowork — the design-to-build tandem
class: technical
control-tier: 1
classification: internal
owner: "@adam"
status: draft
created: 2026-06-27
last-reviewed: 2026-06-27
review-interval: P6M
---

# Claude Code ⇄ Claude Design ⇄ Cowork — the design tandem

**Goal:** prototype new UI in **Claude Design** using the *real* Restormel product design
language, so a prototype the founder approves can be implemented as Svelte with high
confidence — *without first building it on a live service to "see how it looks"*. The bridge
that makes this safe is a **design-system bundle** kept in sync from the product code.

This is the answer to: *"so we end up with designs that actually reflect the product layout
and design… I can safely prototype in Claude Design before we commit to building the code on a
live service."*

---

## The pieces

| Piece | What it is | Where |
|-------|-----------|-------|
| **The product** | The SvelteKit 2 / Svelte 5 dashboard — neo-brutalist. Tokens in `app.css`; primitives in `src/lib/components/brutalist/*`; surfaces in `dashboard/`, `connect/pipeline/`, etc. | `apps/dashboard/` |
| **The design-system bundle** | Static, self-contained HTML **`@dsCard`** preview files that mirror the product's tokens + components 1:1. The single source of truth Claude Design reads. | `apps/dashboard/design-system/` |
| **Claude Design** | `claude.ai/design` — where you prototype new screens/flows. Once synced, its "Design System" pane *is* our real components, so prototypes inherit the genuine look. | claude.ai/design |
| **`/design-sync`** | Claude Code skill (+ the `DesignSync` tool) that pushes the local bundle → a claude.ai/design **design-system project**. Incremental — one component at a time, never a wholesale replace. | run in Claude Code |
| **Claude Code / Cowork** | Claude Code (this CLI) extracts + maintains the bundle and implements approved prototypes back into Svelte. Cowork is the async relay for hand-offs. | this repo |

---

## The round-trip (the loop)

```
   ┌──────────────────────────────────────────────────────────────────┐
   │                                                                    │
   │   apps/dashboard  ──(extract)──►  design-system/  ──(/design-sync)─┐
   │   (Svelte source)                 (@dsCard HTML)                   │
   │        ▲                                                           ▼
   │        │                                                  claude.ai/design
   │   (implement)                                            (prototype new flow
   │        │                                                  on the REAL system)
   │        └────────── Cowork / Claude Code ◄──(export/spec)──────────┘
   │                    (build the approved prototype as Svelte)
   └──────────────────────────────────────────────────────────────────┘
```

1. **Code → bundle (extract).** Claude Code reads the product components + `app.css` tokens and
   writes/refreshes the `@dsCard` HTML cards in `apps/dashboard/design-system/`. (First build:
   the `design-system-bundle` workflow. Ongoing: re-run it, or hand-edit the affected card.)
2. **Bundle → Claude Design (`/design-sync`).** `cd apps/dashboard/design-system && claude`,
   then `/design-sync`. It diffs the local cards against the chosen claude.ai/design
   design-system project and pushes the changes. Now Claude Design's design system matches prod.
3. **Prototype in Claude Design.** Design the new screen/flow there. Because it builds on the
   synced primitives (real colours, type, brutalist shadows, the actual Brutal* components), the
   output already looks like Restormel — not a generic mock.
4. **Design → code (implement).** Export the prototype (or its spec/HTML). Claude Code / Cowork
   implements it as Svelte, **reusing the real `brutalist/*` primitives and tokens** rather than
   re-styling from scratch. Because the prototype was built on those same primitives, the
   translation is mechanical, not interpretive.
5. **Close the loop.** Any genuinely new component created during implementation gets a card
   added back to the bundle, so the next `/design-sync` keeps Claude Design current.

---

## How to run it

```bash
# one-time / when the product's design changes — refresh the bundle from code
#   (re-run the design-system-bundle workflow in Claude Code, or edit the changed card by hand)

# push the bundle to Claude Design
cd apps/dashboard/design-system
claude
> /design-sync
#   → pick (or create) the "Restormel Dashboard" design-system project
#   → review the plan (which cards will be written/deleted) → approve → it pushes

# then open claude.ai/design, select that project's design system, and prototype.
```

`/design-sync` is **user-invoked** (it authenticates against your claude.ai/design login), so
the founder runs it — Claude Code prepares the bundle so there is something faithful to push.

---

## Bundle conventions (so it stays faithful + machine-syncable)

- **One card per component**, at `design-system/components/<kebab-name>/index.html`; foundations
  at `design-system/foundations/index.html`.
- **First line of every card** is `<!-- @dsCard group="..." -->`. Claude Design builds its
  Design-System pane index from these markers (compiled into `_ds_manifest.json`). Group
  taxonomy: `Foundations`, `Components / Brutalist`, `Shell`, `Surfaces / Dashboard`,
  `Surfaces / Route Creator`.
- **`design-system/styles.css` is the canonical token + base stylesheet** (derived from
  `app.css`). Every card links it; no card redefines tokens. Change the look in *one* place.
- **Cards are pure static HTML+CSS** — no Svelte syntax, no JS framework, no build step. Render
  interactive states *side by side* statically (default / hover / focus / error / disabled).
- **Multiple variants per card** — a card documents the component's states + sizes, not one
  instance.
- **No secrets, ever.** Use obvious placeholders (`rk_live_••••`). The cards are synced to an
  external service; treat them as publishable.
- **Real tokens + real class names only.** The whole point is fidelity — never invent a colour,
  font, spacing, or alternate style.

---

## Keeping it in sync (the drift norm)

The bundle is only useful while it matches the product. Treat a change to a `brutalist/*`
primitive, a token in `app.css`, or a key surface as **also** a change to its card:

- **Small change** → edit the one affected card, re-run `/design-sync`.
- **Broad change** (new tokens, several components) → re-run the `design-system-bundle`
  workflow to regenerate, review the diff, `/design-sync`.
- **Optional guard** → a periodic Claude Code check (or CI advisory) that flags cards whose
  source component changed since the card was last written. Worth adding once the bundle settles.

---

## Division of labour

| Tool | Owns |
|------|------|
| **Claude Code (this CLI)** | Extract + maintain the bundle from product code; implement approved prototypes as Svelte; run drift checks. |
| **Claude Design** | Visual prototyping of new flows on the synced design system; founder-facing exploration before any code is written. |
| **`/design-sync`** | The one-way push: local bundle → claude.ai/design design-system project (founder-run, login-scoped). |
| **Cowork** | Async relay / hand-off between the founder, Claude Design exports, and Claude Code implementation — same outbox relay already used for this repo. |

---

## Status (2026-06-27)

- First bundle built by the `design-system-bundle` workflow: foundations (tokens + `styles.css`
  + palette/type/spacing/shadow card) + cards for the `brutalist/*` primitives, the app shell,
  the dashboard surfaces, and the route-creator. Lives at `apps/dashboard/design-system/`.
- **Next (founder):** `cd apps/dashboard/design-system && claude` → `/design-sync` → create the
  "Restormel Dashboard" design-system project → push. Then prototype the **routing "Pick &
  Live" redesign** (see `docs/design/routing-ux-simplification-2026-06-27.md` +
  `…-claude-design-prompt-2026-06-27.md`) on the real system — the first real use of this loop.
