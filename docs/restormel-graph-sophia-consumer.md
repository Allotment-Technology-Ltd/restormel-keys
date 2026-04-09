# Restormel Graph — SOPHIA consumer integration

**Audience:** agents and humans wiring **SOPHIA** (or any SvelteKit + Vite app) to **`@restormel/graph-core`** and **`@restormel/ui-graph-svelte`** from npm (or an approved local substitute).

**Canonical contract:** `packages/graph-core/src/viewModel.ts` in **restormel-keys** (banner: `RESTORMEL GRAPH CONTRACT v0`). **Sophia migration baseline:** restormel-keys `main` at the commit that first published **`@restormel/graph-core@0.1.0`** / **`@restormel/ui-graph-svelte@0.1.0`** (or the current `0.1.x` line). Drift policy: [CHANGELOG.md](../CHANGELOG.md) and § *Contract drift* below.

---

## 1. How dependencies resolve (npm vs monorepo)

### A. Recommended — npm (same pattern as `@restormel/keys`)

After maintainers push git tag **`graph-v*`** (e.g. **`graph-v0.1.0`**), CI publishes (see [`.github/workflows/publish-graph.yml`](../.github/workflows/publish-graph.yml)):

1. `@restormel/graph-core`
2. `@restormel/ui-graph-svelte` (depends on published `graph-core`; `pnpm publish` rewrites `workspace:*`)

**SOPHIA `package.json` (app or workspace package that owns the graph UI):**

```json
{
  "dependencies": {
    "@restormel/graph-core": "^0.1.1",
    "@restormel/ui-graph-svelte": "^0.1.1"
  }
}
```

Verify:

```bash
npm view @restormel/graph-core version
npm view @restormel/ui-graph-svelte version
```

### B. Alternative — git / tarball / `pnpm.overrides` (no npm yet)

Use when packages are **not** on npm or you need a branch build.

**Option B1 — `file:` tarballs** (matches Keys republish smoke pattern):

```bash
# In restormel-keys (maintainer)
pnpm --filter @restormel/graph-core run build
pnpm --filter @restormel/ui-graph-svelte run build
pnpm pack --filter @restormel/graph-core --pack-destination /path/to/tgz
pnpm pack --filter @restormel/ui-graph-svelte --pack-destination /path/to/tgz
```

In **SOPHIA**, point dependencies at those `.tgz` files and **override** transitive `graph-core` so `ui-graph-svelte` resolves the same tarball:

```json
{
  "dependencies": {
    "@restormel/graph-core": "file:./vendor/restormel-graph-core-0.1.0.tgz",
    "@restormel/ui-graph-svelte": "file:./vendor/restormel-ui-graph-svelte-0.1.0.tgz"
  },
  "pnpm": {
    "overrides": {
      "@restormel/graph-core": "file:./vendor/restormel-graph-core-0.1.0.tgz"
    }
  }
}
```

**Option B2 — `workspace:*`:** only valid when SOPHIA’s repo **vendors** restormel-keys graph packages as workspace members (unusual); prefer A or B1.

---

## 2. Stable import surface (use these entrypoints)

| Need | Import |
|------|--------|
| DTOs: `GraphData`, `GraphNode`, `GraphEdge`, `GraphRendererProps`, … | `import type { … } from '@restormel/graph-core/viewModel'` |
| Orbital layout | `import { computeLayout } from '@restormel/graph-core/layout'` |
| Trace labels / tags | `import { getNodeTraceTags, getNodeTraceLabel, formatTraceTag } from '@restormel/graph-core/trace'` |
| Workspace filters / scope helpers | `import { filterGraph, … } from '@restormel/graph-core/workspace'` |
| Barrel (all MVP exports) | `import { … } from '@restormel/graph-core'` |
| Canvas + optional detail | `import { GraphCanvas, NodeDetail, graphCanvasEdgeKey } from '@restormel/ui-graph-svelte'` |
| Strict TS props (callbacks, etc.) | `import type { GraphCanvasProps, NodeDetailProps } from '@restormel/ui-graph-svelte'` — `GraphCanvasProps` matches `GraphRendererProps` from graph-core |
| Optional built CSS (library artefact) | `@restormel/ui-graph-svelte/styles.css` — see §3 *styles.css vs host tokens* |

**Do not** rely on deep paths such as `node_modules/.../src/...` — only **`package.json` `exports`** are supported.

**`graphDataFromSophiaGraphKit`** (and similar) stays in **SOPHIA**; it must return **`GraphData`** matching **`@restormel/graph-core/viewModel`**.

---

## 3. CSS / design tokens

`GraphCanvas` and `NodeDetail` use **CSS variables** (SOPHIA Design B), for example:

- **Colours:** `--color-bg`, `--color-text`, `--color-muted`, `--color-dim`, `--color-border`, `--color-sage`, `--color-sage-bg`, `--color-sage-border`, `--color-amber`, `--color-copper`, `--color-blue`, `--color-teal`, `--color-coral`, `--color-purple`, `--color-surface`, `--color-surface-raised`
- **Radius / type / motion:** `--radius-sm`, `--radius-md`, `--font-ui`, `--text-meta`, `--text-ui`, `--text-body`, `--leading-body`, `--space-*`, `--transition-fast`, `--focus-ring-width`, `--focus-ring-color`, `--focus-ring-offset`

**SOPHIA** already loads these via `src/styles/design-tokens.css` — **no extra import** from Restormel is required if that sheet remains global.

**restormel-graph-demo** mirrors the same `:root` block in `apps/restormel-graph-demo/src/lib/graph-demo-tokens.css` for standalone parity.

**Package CSS:** `@restormel/ui-graph-svelte` also emits **`dist/ui-graph-svelte.css`** as export **`@restormel/ui-graph-svelte/styles.css`** (Svelte-scoped rules from the components). It does **not** define the palette variables above; host apps must still provide **`:root`** tokens for full visual parity.

### `styles.css` vs host tokens (avoid duplicate work)

- **If your app already imports a full SOPHIA-compatible `design-tokens.css` on `:root`** (same variable names as above), you **do not need** `@restormel/ui-graph-svelte/styles.css` for colours — component JS already inlines scoped rules for layout/animation.
- **Import `styles.css`** when you want the packaged **component-level** rules guaranteed in one place (e.g. minimal demo apps without a token file), or when debugging style drift — expect **no** `:root` palette from that file alone.
- **SOPHIA** may import both: tokens for globals + `styles.css` for parity with the library build; that is **optional**, not required for variables, and can duplicate some rules — prefer **one** source of truth for tokens and add `styles.css` only if you see missing layout/animation without it.

---

## 4. Peer dependencies and versions

| Package | Peers |
|---------|--------|
| `@restormel/ui-graph-svelte` | **`svelte`: `^5.0.0`** (SOPHIA `^5.53.x` satisfies this). |
| `@restormel/graph-core` | None. |

**`@sveltejs/kit`** is **not** a peer of `ui-graph-svelte`; it is a **consumer** framework. Align **Vite** + **`@sveltejs/vite-plugin-svelte`** with your existing SOPHIA versions.

---

## 5. Vite / SvelteKit (`ssr.noExternal`, `optimizeDeps`)

Prebundling can break workspace-linked or `node_modules` Svelte libraries. **SOPHIA** should mirror **restormel-graph-demo** (`apps/restormel-graph-demo/vite.config.ts`):

```ts
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  ssr: {
    noExternal: ["@restormel/ui-graph-svelte", "@restormel/graph-core"],
  },
});
```

If you see dev-time prebundle errors for `graph-core` only, try extending **`optimizeDeps.include`** with `@restormel/graph-core/layout` (rare).

**Validation:** restormel-keys runs **`bash scripts/smoke-graph-packages-consumer.sh`** in CI — tarball install + `pnpm run check` + `pnpm run build` on a copy of **restormel-graph-demo** outside the workspace graph.

---

## 6. Duplicate code policy (single source of truth)

After **`@restormel/ui-graph-svelte`** and **`@restormel/graph-core`** resolve from npm (or approved tarballs):

1. **Remove** SOPHIA-local **`src/lib/components/visualization/GraphCanvas.svelte`**, **`NodeDetail.svelte`**, **`semanticStyles.ts`** (replace imports with the package).
2. **Remove or slim** SOPHIA **`packages/graph-core`** MVP files **`viewModel.ts`**, **`layout.ts`**, **`trace.ts`**, **`workspace.ts`** — import from **`@restormel/graph-core`** subpaths instead.
3. **Keep** SOPHIA-only modules that still depend on **`@restormel/contracts`** (compare, lineage, …) **only** if they remain needed; do **not** duplicate Contract v0 DTOs — re-export from **`@restormel/graph-core/viewModel`** if a thin barrel helps, or delete local copies.

---

## 7. Contract drift guard

- **Authoritative DTOs:** restormel-keys **`packages/graph-core/src/viewModel.ts`**.
- **Drift check:** `diff packages/graph-core/src/viewModel.ts` (SOPHIA) vs the same path in restormel-keys at the **migration baseline** tag/commit, or re-run before each SOPHIA bump:

  ```bash
  diff -u path/to/sophia/packages/graph-core/src/viewModel.ts path/to/restormel-keys/packages/graph-core/src/viewModel.ts
  ```

- **As of `0.1.0`:** only intentional delta vs SOPHIA’s copy is **`GraphRendererProps` JSDoc** (points at `@restormel/ui-graph-svelte`). **No DTO field changes.**
- **If DTOs diverge in a future release:** bump **minor** or **major** per semver, list breaking fields in **CHANGELOG**, and update **`graphDataFromSophiaGraphKit`** before merging.

---

## 8. SOPHIA agent checklist (post-publish)

1. Add **`dependencies`** for **`@restormel/graph-core`** and **`@restormel/ui-graph-svelte`** (versions from npm or documented `file:` + overrides).
2. Add **`ssr.noExternal`** entries in **`vite.config.ts`** (§5).
3. Replace imports: local canvas / detail / semanticStyles → **`@restormel/ui-graph-svelte`**; types + layout/trace/workspace → **`@restormel/graph-core/*`**.
4. Keep **`graphDataFromSophiaGraphKit`**; ensure return type matches **`GraphData`**.
5. Confirm global CSS still loads SOPHIA design tokens (§3).
6. Remove duplicate local MVP **`packages/graph-core`** sources and visualization files (§6).
7. Run **`pnpm check`**, targeted tests, manual **`/dev/graph-portability`** parity.

---

## 9. Maintainer pointers

| Topic | Location |
|-------|----------|
| Publish train | Tag **`graph-v*`** → [`.github/workflows/publish-graph.yml`](../.github/workflows/publish-graph.yml) |
| Tarball consumer smoke | [`scripts/smoke-graph-packages-consumer.sh`](../scripts/smoke-graph-packages-consumer.sh) |
| Extraction / file map | [`docs/restormel/04-delivery/restormel-graph-sophia-extraction-artifacts.md`](restormel/04-delivery/restormel-graph-sophia-extraction-artifacts.md) |
| npm inventory | [`docs/reference/npm-packages.md`](reference/npm-packages.md) |
| `graph-core` tests | `pnpm --filter @restormel/graph-core test` |
