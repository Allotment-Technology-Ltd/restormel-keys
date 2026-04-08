# Restormel monorepo — package map

**Canonical repo:** [restormel-keys](https://github.com/Allotment-Technology-Ltd/restormel-keys) (Keys product, Testing runner, tokens source, dashboard, integrations).

End users consume **published npm packages**; this document is for contributors.

## Workspace layout

| Path | npm scope / app | Role |
|------|-----------------|------|
| `packages/keys-tokens` | `@restormel/keys-tokens` | Design tokens + CSS entrypoints; publish tag **`tokens-v*`** |
| `packages/core` | `@restormel/keys` | Headless BYOK core |
| `packages/svelte`, `react`, `elements` | `@restormel/keys-*` | UI adapters |
| `packages/cli` (Keys) | `@restormel/keys-cli` | Keys CLI wrapper |
| `packages/doctor`, `validate` | `@restormel/doctor`, `@restormel/validate` | OSS tooling |
| `packages/aaif`, `mcp` | `@restormel/aaif`, `@restormel/mcp` | Contracts / MCP |
| `packages/testing-core` … `testing-github-action`, `packages/restormel-testing` | `@restormel/testing-*`, `@restormel/testing-bundle` | Goal-based testing runner, CLI, optional meta-package (`testing-bundle`), composite Action; publish tag **`testing-v*`** (or workflow dispatch) |
| `apps/dashboard` | `dashboard` (private) | Keys marketing + dashboard SvelteKit app (**Connections**, **Restormel Testing** hub, encrypted provider credentials); Testing marketing/docs at **`/testing`** (`src/routes/testing/`) |
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
```

`@restormel/testing-bundle` is a thin **meta-package** (CLI + browser adaptor dependency) for consumers who want one `pnpm add -D` line; it contains no runtime code.

**Keys adapter:** `@restormel/testing-keys-adapter` calls `POST …/v1/testing/resolve-model` with the Gateway bearer; the response may include an **inline** provider key when the Keys deployment stores encrypted credentials for the binding (`RESTORMEL_HOSTED_INLINE`). See [keys-testing-onboarding.md](../keys-testing-onboarding.md).

## Build / test commands (root)

- **Testing TypeScript:** `pnpm run build:testing-packages` (`tsconfig.testing-packages.json`)
- **Testing unit tests:** `pnpm run test:testing`
- **Testing in dashboard (svelte-check):** `pnpm --filter dashboard run check` (already part of `check:dashboard`; included in `check:testing` via `typecheck:testing-dashboard`)
- **Full testing gate:** `pnpm run check:testing`

## Historical repos

Content previously in **restormel-testing** and **restormel-platform** (tokens) now lives here. Do not treat those repositories as authoritative for new work.
