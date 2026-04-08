# @restormel/mcp

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
