# Phase 1 — Restormel engineering spec (monorepo)

**Purpose:** Objectives, acceptance pointers, non-goals, and SOPHIA paths for Phase 1 platform extraction. **Implementation and npm publish** ship from **restormel-keys**; keep this file aligned with programme narrative in SOPHIA when that repo’s mirror exists.

**Status:** Canonical for **this repository**. If SOPHIA adds `docs/restormel/phase1-restormel-engineering-spec.md`, treat it as the **programme** source of truth for stakeholder wording; **merge or reconcile** acceptance IDs and links here so agents working in `restormel-keys` do not drift.

**Related:** Agent instructions (verbatim prompt + comms snippet) live in **[phase1-agent-prompt-restormel-engineering.md](./phase1-agent-prompt-restormel-engineering.md)**.

---

## 1. Objectives (packages)

Implement and **publish** under `@restormel/*`:

| Package | Role |
|--------|------|
| `@restormel/contracts` | Shared reasoning / API contracts (scope per programme; not graph-core v0 DTOs). |
| `@restormel/observability` | Shared observability primitives aligned with extraction notes. |
| `@restormel/graph-core` | **Contract v0** — DTOs + layout / trace / workspace only; **no** `@restormel/contracts` inside MVP graph-core. |
| `@restormel/ui-graph-svelte` | Svelte 5 canvas + semantic styles; consumes published graph-core. |
| `@restormel/graph-reasoning-extensions` | **Lift** from SOPHIA `packages/graph-reasoning-extensions` (compare, lineage, projection, and other reasoning modules that must **not** live inside graph-core v0). |
| `@restormel/state` | **Restormel State** — append-only agent memory events, deterministic `projectWorkingMemory`, Stoa-oriented helpers, correlation with context packs and observability runs (depends on **`@restormel/context-packs`** for input typing). |

**In this repo today:** `packages/graph-core`, `packages/ui-graph-svelte`, `apps/restormel-graph-demo`, public `/graph` docs, **`packages/contracts`**, **`packages/observability`**, **`packages/graph-reasoning-extensions`** (`@restormel/graph-reasoning-extensions`), **`packages/context-packs`**, **`packages/state`**. CI runs build + test for platform packages; publish via git tag **`platform-v*`** → `.github/workflows/publish-restormel-platform.yml` (after **`NPM_TOKEN`** and maintainer verification).

---

## 2. Acceptance tests (where to find them)

- **Detailed acceptance tests** (command-level, CI gates, version matrices) should be enumerated in the same document set as SOPHIA’s Phase 1 programme once merged. Until then, require at minimum:
  - `pnpm` workspace build + test for each new package.
  - No new **secrets** or credential placeholders in repo (see `docs/security-baseline.md`).
  - **graph-core** / **ui-graph-svelte**: tarball consumer smoke (`scripts/smoke-graph-packages-consumer.sh`) passes; tag **`graph-v*`** publish workflow succeeds.
  - **Public integrator doc** for graph UI: `https://restormel.dev/graph/docs/integration/sveltekit` stays the canonical consumer narrative.
- **SOPHIA spec paths (reference tree):** programme and extraction notes under SOPHIA `docs/restormel/` and `docs/restormel/04-delivery/` (e.g. graph extraction artefacts, contracts notes). Use those filenames on SOPHIA default branch for file-level acceptance and port maps.

**Mirror URLs (GitHub):**

- SOPHIA repo: `https://github.com/Allotment-Technology-Ltd/sophia`
- Intended programme files (when present):  
  - `https://github.com/Allotment-Technology-Ltd/sophia/blob/main/docs/restormel/phase1-restormel-engineering-spec.md`  
  - `https://github.com/Allotment-Technology-Ltd/sophia/blob/main/docs/restormel/phase1-agent-prompt-restormel-engineering.md`

---

## 3. Non-goals

- **Do not** fold compare / lineage / projection into `@restormel/graph-core` Contract v0; keep them in **`@restormel/graph-reasoning-extensions`** (or app-specific adapters) per [GRAPH_CORE_V0_SCOPE.md](../../packages/graph-core/GRAPH_CORE_V0_SCOPE.md) and [restormel-graph-sophia-extraction-artifacts.md](04-delivery/restormel-graph-sophia-extraction-artifacts.md).
- **Do not** treat CLI or MCP as the only integration surface; step-by-step docs on **restormel.dev** remain primary for humans and agents.
- **Do not** duplicate live credentials or realistic secrets in docs or examples.

---

## 4. SOPHIA source layout (lift target)

- **graph-reasoning-extensions:** `packages/graph-reasoning-extensions` in SOPHIA (package name today may be `@sophia/graph-reasoning-extensions` or equivalent — confirm in SOPHIA `package.json` before lift).

---

## 5. Restormel monorepo — publish + API stability

After packages exist:

- Define **semver tags / workflows** per package line (align with existing `graph-v*`, keys, testing patterns).
- **API stability:** document breaking vs additive changes in root `CHANGELOG.md` and package READMEs; published `.d.ts` is the contract for TS consumers.

---

## 6. SOPHIA reintegration (post-release)

After **`@restormel/graph-reasoning-extensions`** is published and stable:

- SOPHIA **replaces** `@sophia/graph-reasoning-extensions` (or local workspace equivalent) with **`@restormel/graph-reasoning-extensions`**.
- Follow the **reintegration checklist** in SOPHIA Phase 1 / migration docs (dependency bump, adapter imports, Vite `ssr.noExternal`, lockfile, E2E smoke).
- **Public integration guide** for graph stack: [Integrate Restormel Graph in a SvelteKit app](https://restormel.dev/graph/docs/integration/sveltekit) — ensure `ssr.noExternal` lists **both** `@restormel/ui-graph-svelte` and `@restormel/graph-core`.

---

## 7. Completion criteria (programme)

- Restormel monorepo: packages published, APIs stable, docs and CI green.
- SOPHIA: dependency bump and removal of duplicated platform code per reintegration checklist.
- Phase 1 extraction documentation: agent prompt + this spec stay **word-aligned** on links and acceptance pointers (single source of truth: **[phase1-agent-prompt-restormel-engineering.md](./phase1-agent-prompt-restormel-engineering.md)** for the copy-paste agent block).
