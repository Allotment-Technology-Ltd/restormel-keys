# Restormel monorepo — package map

**Canonical repo:** [restormel-keys](https://github.com/Allotment-Technology-Ltd/restormel-keys) (Keys product, Testing runner, tokens source, dashboard, integrations).

End users consume **published npm packages**; this document is for contributors.

## MVP publish trains (2026-06)

| Train | MVP default | Notes |
|-------|-------------|-------|
| **`keys-v*`** | Publish | Core product |
| **`tokens-v*`** | Publish | Dashboard dependency |
| **`testing-v*`** | Skip unless `RESTORMEL_PUBLISH_TESTING=true` | Packages remain in monorepo; CI extended job optional |
| **`graph-v*`** | Publish for SOPHIA | Suite marketing gated via PostHog |
| **`platform-v*`** | Minimal (`contracts`, `mcp`, `aaif`) | Defer `state`, `context-packs` unless Connect needs them |

Module flags: [guides/keys-mvp-mode.md](../guides/keys-mvp-mode.md).

## Workspace layout

| Path | npm scope / app | Role |
|------|-----------------|------|
| `packages/keys-tokens` | `@restormel/keys-tokens` | Design tokens + CSS entrypoints; publish tag **`tokens-v*`** |
| `packages/core` | `@restormel/keys` | Headless BYOK core |
| `packages/svelte`, `react`, `elements` | `@restormel/keys-*` | UI adapters |
| `packages/cli` (Keys) | `@restormel/keys-cli` | Keys CLI wrapper |
| `packages/doctor`, `validate` | `@restormel/doctor`, `@restormel/validate` | OSS tooling |
| `packages/aaif`, `mcp`, `support` | `@restormel/aaif`, `@restormel/mcp`, `@restormel/support` | Contracts / MCP / **Restormel Support** (doc-grounded chat runtime; dogfood in `apps/dashboard`). Owner: [RESTORMEL-SUPPORT.md](RESTORMEL-SUPPORT.md). Publish tag **`support-v*`** → [`.github/workflows/publish-support.yml`](../.github/workflows/publish-support.yml) |
| `packages/graph-core`, `packages/ui-graph-svelte` | `@restormel/graph-core`, `@restormel/ui-graph-svelte` | **Restormel Graph** — Contract v0 + contracts-free helpers; Svelte 5 canvas (ported from SOPHIA). **Public docs (dashboard):** `https://restormel.dev/graph` and `https://restormel.dev/graph/docs` (canonical integrator: `/graph/docs/integration/sveltekit`). Publish tag **`graph-v*`** → [`.github/workflows/publish-graph.yml`](../.github/workflows/publish-graph.yml). SOPHIA: [docs/archive/deferred-products/restormel-graph-sophia-consumer.md](../archive/deferred-products/restormel-graph-sophia-consumer.md). Scope: [packages/graph-core/GRAPH_CORE_V0_SCOPE.md](../../packages/graph-core/GRAPH_CORE_V0_SCOPE.md); extraction map: [docs/archive/suite-migration-status/restormel-graph-sophia-extraction-artifacts.md](../archive/suite-migration-status/restormel-graph-sophia-extraction-artifacts.md) |
| `packages/contracts`, `packages/observability`, `packages/graph-reasoning-extensions`, `packages/context-packs`, `packages/state` | `@restormel/contracts`, `@restormel/observability`, `@restormel/graph-reasoning-extensions`, `@restormel/context-packs`, `@restormel/state` | **Phase 1 platform** (+ **Phase 2 context packs** + **Restormel State**) — Zod contracts + trace/event shaping + reasoning graph extensions (compare, lineage, projection, …). **`@restormel/context-packs`** is dependency-free: pass-specific LLM context text from a portable retrieval-shaped payload. **`@restormel/state`** depends on context-packs for correlation typing: append-only memory events, `projectWorkingMemory`, context-pack / observability correlation (SOPHIA Stoa helpers are app-local; see `docs/architecture/state-sophia-integration.md`). Publish tag **`platform-v*`** → [`.github/workflows/publish-restormel-platform.yml`](../.github/workflows/publish-restormel-platform.yml). Phase 1 spec: [docs/archive/suite-migration-status/phase1-restormel-engineering-spec.md](../archive/suite-migration-status/phase1-restormel-engineering-spec.md). Context packs: [docs/archive/suite-migration-status/PHASE2-EXTRACTION-STATUS.md](../archive/suite-migration-status/PHASE2-EXTRACTION-STATUS.md). State: [docs/architecture/RESTORMEL-STATE.md](RESTORMEL-STATE.md). **Horizon programme** (Themes A–J, Theme L, MCP inventory): [docs/architecture/HORIZON-PLATFORM-PROGRAMME.md](HORIZON-PLATFORM-PROGRAMME.md). |
| `packages/testing-core` … `testing-github-action`, `packages/testing-runs-server`, `packages/restormel-testing` | `@restormel/testing-*`, `@restormel/testing-bundle` | Goal-based testing runner, CLI, optional HTTP **Runs API** server (`testing-runs-server`), meta-package (`testing-bundle`), composite Action; publish tag **`testing-v*`** (or workflow dispatch). Config JSON Schema draft: `packages/testing-config/schema/restormel-testing-config.v1.schema.json` |
| `apps/dashboard` | `dashboard` (private) | Keys marketing + dashboard SvelteKit app (**Connections**, **Restormel Testing** hub, encrypted provider credentials); Testing marketing/docs at **`/testing`** (`src/routes/testing/`) |
| `apps/restormel-graph-demo` | `restormel-graph-demo` (private) | SvelteKit demo: **`/dev/graph-portability`** mock **`GraphData`** + **`GraphCanvas`** |
| `platform/` | (mostly non-published) | Cursor template, module scaffold mirror, shared composite copies |

## @restormel/testing-* dependency graph

```mermaid
flowchart BT
  testing_core["@restormel/testing-core"]
  testing_config["@restormel/testing-config"]
  testing_keys_adapter["@restormel/testing-keys-adapter"]
  testing_browser["@restormel/testing-browser-playwright"]
  testing_report["@restormel/testing-report"]
  testing_runner["@restormel/testing-runner"]
  testing_cli["@restormel/testing-cli"]
  testing_bundle["@restormel/testing-bundle"]
  testing_action["@restormel/testing-github-action"]
  testing_runs_server["@restormel/testing-runs-server"]

  testing_bundle --> testing_cli
  testing_bundle --> testing_browser

  testing_config --> testing_core
  testing_keys_adapter --> testing_core
  testing_browser --> testing_core
  testing_report --> testing_core
  testing_runner --> testing_core
  testing_runner --> testing_config
  testing_runner --> testing_keys_adapter
  testing_runner --> testing_browser
  testing_cli --> testing_config
  testing_cli --> testing_keys_adapter
  testing_cli --> testing_report
  testing_cli --> testing_runner
  testing_action --> testing_runner
  testing_action --> testing_report
  testing_action --> testing_keys_adapter

  testing_runs_server --> testing_runner
  testing_runs_server --> testing_config
  testing_runs_server --> testing_report
  testing_runs_server --> testing_keys_adapter
```

`@restormel/testing-bundle` is a thin **meta-package** (CLI + browser adaptor dependency) for consumers who want one `pnpm add -D` line; it contains no runtime code.

**Keys adapter:** `@restormel/testing-keys-adapter` calls `POST …/v1/testing/resolve-model` with the Gateway bearer; the response may include an **inline** provider key when the Keys deployment stores encrypted credentials for the binding (`RESTORMEL_HOSTED_INLINE`). See [keys-testing-onboarding.md](../guides/keys-testing-onboarding.md).

## Build / test commands (root)

- **Testing TypeScript:** `pnpm run build:testing-packages` (`tsconfig.testing-packages.json`)
- **Testing unit tests:** `pnpm run test:testing`
- **Testing in dashboard (svelte-check):** `pnpm --filter dashboard run check` (already part of `check:dashboard`; included in `check:testing` via `typecheck:testing-dashboard`)
- **Full testing gate:** `pnpm run check:testing`

## Historical repos

Content previously in **restormel-testing** and **restormel-platform** (tokens) now lives here. Do not treat those repositories as authoritative for new work.
