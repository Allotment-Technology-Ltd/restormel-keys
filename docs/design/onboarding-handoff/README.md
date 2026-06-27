# Handoff: Restormel onboarding & core navigation

This bundle hands the full body of work from our design session to a developer using
Claude Code, to implement in the **Restormel Keys** codebase (Svelte).

---

## 0. Read this first

- **The HTML/JSX files in `designs/` are design references, not production code.** They are
  prototypes that show intended *look*, *copy*, *flow*, and *behaviour*. They were built in
  HTML + a little React (for the clickable prototype) purely because that is the fastest way
  to make an interactive mock. **Do not lift the React.** The task is to **recreate these
  designs as Svelte components in `apps/dashboard`**, using the codebase's existing patterns,
  token layer, and `.btn` / `.card` / `.brut-*` utility classes.
- **Plan A is the MVP to build.** The opinionated journey + persistent home (everything in
  this bundle except `Plan B — Autopilot.html`) is what we are shipping to test the market.
- **Plan B (Autopilot) is a documented future goal, not in scope now.** It is included so the
  vision is captured; see `01_CONCEPT.md` §7.
- The work is **hi-fi**: final colours, type, spacing, copy, and interactions. Recreate the UI
  faithfully — but always through the codebase's existing components, not by copying CSS.

## 1. What this is for

Restormel turns a customer's documents into a **knowledge graph** their apps and agents can
query with grounded, cited answers. This design covers the **first-run journey** that takes a
brand-new user from "what even is this" to a **live graph their app is using**, plus the
**persistent navigation** they live in afterwards.

The journey is five milestones:

| | Milestone | The job | The "aha" |
|---|---|---|---|
| M0 | **Explore** | Ask a demo graph, see a cited answer | *"Oh — it answers from real sources."* |
| M1 | **Build** | Point it at your docs, watch it ingest | *"That's **my** knowledge now."* |
| M2 | **Verify** | Triage weak claims, trust score climbs | *"I can trust what it says."* |
| M3 | **Store** *(advanced)* | Move to your own database | *"It runs on **my** infra."* |
| M4 | **Connect** | Wire an app / agent to the graph | *"My product can use it."* |

The mandatory spine is **M0 → M1 → M4**. M2 and M3 are opt-in depth (see personas in
`01_CONCEPT.md`).

## 2. How to use this bundle with Claude Code

1. Open the Restormel Keys repo in Claude Code with this folder available.
2. Have it read the docs in order: `01` → `08`. They are written to be self-sufficient — a dev
   who wasn't in the session can build from them alone.
3. Build in the order in `07_PROMPTS.md` — each prompt is a self-contained, paste-ready task
   that names the exact screen, the design file to open, and the acceptance criteria.
4. Keep a design file open beside Claude Code for pixel/copy reference while it builds.

## 3. The codebase (what we know — confirm before building)

From the `restormel-keys` folder we saw during the session:

- **Framework:** Svelte / SvelteKit, dashboard app at `apps/dashboard/`.
- **Tokens already exist** in `packages/keys-tokens/` (`base.css`, `brutalist-rm.css`). The
  whole design uses these — **you should not be inventing colours or spacing.** `04_TOKENS.md`
  maps every value used in the mocks back to a token so you can reuse the real ones.
- **Global element + utility classes** live in `apps/dashboard/src/app.css` and
  `…/lib/styles/brutalist-utilities.css` — `.btn`, `.btn-primary`, `.card`, `.brut-kicker`,
  `.status-*`, etc. The mocks reproduce these; **prefer the real classes**.
- **Navigation is config-driven** via something like `nav-config.ts`. The IA change in
  `02_IA_AND_NAV.md` is primarily an edit to that config plus a few new routes.

> ⚠️ These are observations from a snapshot, not gospel. Have Claude Code confirm the current
> structure (`apps/dashboard/src/routes`, the nav config, the token package) before editing.

## 4. React → Svelte: the short version

The clickable prototype (`Restormel Prototype.html` + `proto-app.jsx`) is React. Don't port it
line-by-line. The mapping is mechanical and is spelled out fully in `06_SVELTE.md`:

- `useState` → Svelte 5 `$state` runes (or stores)
- derived values (`const trust = …`) → `$derived`
- `useEffect` timers → `$effect` / `onMount`
- the `localStorage` persistence → a small `graph.svelte.ts` store
- per-screen components → `.svelte` files under a `lib/onboarding/` feature folder
- the inline prototype CSS → **delete it**; use the real token classes

The **state model itself** (a `graph` object + a `progress` map + a `persona`) ports directly —
that is the valuable part, and it is documented in `05_STATE.md`.

## 5. What's in this bundle

**Docs (read in order):**

- `README.md` — this file
- `01_CONCEPT.md` — mental model, the five ahas, the three personas, every design lesson and
  the rationale behind each major decision, and Plan A vs Plan B
- `02_IA_AND_NAV.md` — the **final, simplified** navigation (the ruthless-efficiency pass) and
  the persistent-home model
- `03_SCREENS.md` — per-screen specs: layout, components, copy, states
- `04_TOKENS.md` — exact design tokens and how they map to `packages/keys-tokens`
- `05_STATE.md` — the state model, flows, and every edge / unhappy state
- `06_SVELTE.md` — the full React→Svelte translation guide + suggested file structure
- `07_PROMPTS.md` — sequenced, paste-ready Claude Code prompts
- `08_ARTEFACTS.md` — a guide to **every reference file** in `designs/`: what it is, what
  decision it captures, and **why** — plus a decision→artefact→doc provenance map, so you can
  adapt to how the real code actually works without losing the design intent

**Design references (`designs/`):** the HTML prototypes and the design-system stylesheet.
See `03_SCREENS.md` for which file shows which screen, and **`08_ARTEFACTS.md` for what each
file is and why** it was designed that way. The single most useful one is
`Restormel Prototype.html` — the end-to-end clickable flow.

**Screenshots (`screenshots/`):** a rendered PNG of every design file — a quick visual index,
referenced inline from `08_ARTEFACTS.md` so you can skim the whole body of work without opening
each HTML file.

## 6. Build order (TL;DR)

1. **Foundation** — confirm tokens/classes; add the four new routes + nav config (`02`).
2. **Home** — the persistent graph home with status tiles (the hub everything returns to).
3. **M1 Build** — the ingest wizard + live run console + edge states (the most complex piece).
4. **M0 Explore** — the demo-graph ask (first-run only).
5. **M4 Connect** — the connection wizard + connections manager.
6. **M2 Verify** — the make-ready hub + triage.
7. **M3 Store** *(advanced)* — the safe DB connection + non-destructive data choice.
8. **Polish** — persona-aware paths, empty/loading/error states, transitions.

Plan B (Autopilot) is **not** in this build order — it is a future bet.
