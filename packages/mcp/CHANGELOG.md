# @restormel/mcp

## 0.2.0

### Minor Changes

- **Horizon suite read tools:** `docs.canonical_resolve`, `testing.config_validate`, `observability.trace_summarize`, `graph.fixture_validate`, `state.memory_preview` — offline / local-safe helpers with stable `RST_SUITE_*` codes, input size caps, and Vitest coverage (fixtures under `test/fixtures/`).
- **Exports:** `RESTORMEL_SUITE_TOOL_NAMES`, `RestormelSuiteToolName`, `CANONICAL_DOC_TOPICS`, and programmatic **`suiteResolveCanonical`**, **`suiteValidateTestingConfig`**, **`suiteSummarizeTrace`**, **`suiteValidateGraphFixture`**, **`suiteMemoryPreview`** (shared with dashboard **`POST /keys/dashboard/api/suite/invoke`**).
- **Node:** `engines.node` is **>=20** (aligns with `@restormel/testing-config`).
- **Dependencies:** `@restormel/contracts`, `@restormel/observability`, `@restormel/state`, `@restormel/testing-config` (workspace).

## 0.1.10

### Minor Changes

- **Control-plane Testing/Keys:** `project.environments.list` (`GET …/environments`), `testing.hub_snapshot` (project + env ids + masked keys + env snippet), `project.gateway_keys.list` / `.create` / `.delete` (Gateway key lifecycle; **rawKey once on create** — treat as secret).
- **`testing.journey`:** optional focus **`billing`**; suggested MCP tool lists updated across phases.

## 0.1.9

### Minor Changes

- **Projects (read):** `projects.list`, `project_models.list` — control-plane `GET` for automation and agent workflows.
- **Restormel Testing:** `testing.journey` (structured onboarding map), `testing.ci_env_template` (canonical env snippet, placeholders only), `testing.resolve_probe` (single `POST` to `/v1/testing/resolve-model`, HTTP status only).

## 0.1.8

Prior releases — see git history and `packages/mcp/README.md`.
