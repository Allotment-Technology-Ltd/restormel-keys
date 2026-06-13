# npm packages — scope and install path

Canonical reference for **which packages exist**, **what to install when**, and **how to verify** they resolve from npm.

**Keys MVP (public default):** use **Keys REST** for resolve/catalog/models, **`@restormel/keys-elements`** for UI, **`@restormel/keys-cli`** / **`@restormel/doctor`** for local tooling, **`@restormel/mcp`** / **`@restormel/aaif`** for agents. See [keys-mvp-mode.md](../guides/keys-mvp-mode.md).

---

## Verify before you install

```bash
npm view @restormel/keys-elements version
npm view @restormel/keys-cli version
npm view @restormel/doctor version
npm view @restormel/mcp version
npm view @restormel/aaif version
```

---

## Recommended path (Keys MVP integrators)

| Package | Purpose |
|---------|---------|
| **Keys REST** (`/keys/v1/*`) | Resolve, catalog, models, policies — **no npm core required** |
| `@restormel/keys-elements` | Web Components: KeyManager, ModelSelector, CostEstimator |
| `@restormel/keys-cli` | `keys init`, `keys login`, `keys doctor`, `keys catalog fetch` |
| `@restormel/doctor` | Local setup check (REST env + config) |
| `@restormel/mcp` | MCP tools + stdio server for agents/IDEs |
| `@restormel/aaif` | AAIF contract + runtime helper for app/service hosts |

Migrate from in-process npm: [npm-to-rest-keys.md](../guides/npm-to-rest-keys.md).

```bash
pnpm add @restormel/keys-elements
pnpm add -D @restormel/keys-cli @restormel/doctor
```

---

## Deprecated — do not start new integrations

Bugfix-only until **2026-12-01**; see [npm-maintenance-window.md](../runbooks/npm-maintenance-window.md).

| Package | Use instead |
|---------|-------------|
| `@restormel/keys` | Keys REST + [npm-to-rest-keys.md](../guides/npm-to-rest-keys.md) |
| `@restormel/keys-svelte` | `@restormel/keys-elements` |
| `@restormel/keys-react` | `@restormel/keys-elements` |
| `@restormel/ui-graph-svelte` | `@restormel/graph-elements` + `POST /graph/v1/layout` |

Existing apps may stay on maintenance releases until migrated.

---

## Non-MVP suite packages (hidden by default)

Not promoted on restormel.dev when module flags are at MVP defaults:

| Train | Packages | When public |
|-------|----------|-------------|
| **Testing** | `@restormel/testing-*` | Enable `restormel-module-testing` — [docs/archive/testing/testing/oss-consumption.md](../archive/testing/testing/oss-consumption.md) |
| **Graph pillar** | `@restormel/graph-core`, `@restormel/graph-elements` | Enable `restormel-module-graph` (preview+) — [restormel-graph-sophia-consumer.md](../archive/deferred-products/restormel-graph-sophia-consumer.md) |
| **Platform** | `@restormel/contracts`, `@restormel/observability`, `@restormel/state`, … | Graph extensions / dogfood only — not Keys MVP onboarding |

---

## Publishing (maintainers)

- **Keys train:** tag `keys-v*` → `.github/workflows/publish.yml` (deprecated adapters still patch-only)
- **Elements:** published with Keys train
- **Testing train:** tag `testing-v*` when `RESTORMEL_PUBLISH_TESTING=true` → `publish-testing.yml`
- **Graph train:** tag `graph-v*` → `publish-graph.yml` (SOPHIA consumers)
- **Platform train:** tag `platform-v*` → `publish-restormel-platform.yml`

MVP publish matrix: [restormel-monorepo-packages.md](../architecture/restormel-monorepo-packages.md).

---

## pnpm monorepos

Install into the **app package** that contains your app code:

```bash
cd apps/my-app
pnpm add @restormel/keys-elements
```

See also: [/keys/docs/compatibility](https://restormel.dev/keys/docs/compatibility).
