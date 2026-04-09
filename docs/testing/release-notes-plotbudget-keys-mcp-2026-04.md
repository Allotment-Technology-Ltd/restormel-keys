# Restormel Keys + Testing + MCP — PlotBudget handoff (April 2026)

**Audience:** PlotBudget engineers and agents integrating **Restormel Keys**, **Restormel Testing**, and `**@restormel/mcp`**.

---

## 1. Restormel Testing packages (`@restormel/testing-*`)

If you are not already on a single aligned line, target `**^0.1.7**` across the Testing packages you use (CLI, bundle, GitHub Action, and any direct `@restormel/testing-*` peers) — **0.1.7** matches **`main`** post–PR **#79** (LLM budgets, egress, Runs server, CI fixes). Feature deltas: **[release-notes-plot-engineers-0.1.5.md](release-notes-plot-engineers-0.1.5.md)** (and **0.1.4**/**0.1.6** notes in-repo for earlier trains).

**Keys env (CLI / CI / judges):** Prefer canonical names:

- `RESTORMEL_KEYS_BASE` — site origin (scheme + host, no path)
- `RESTORMEL_GATEWAY_KEY` — Gateway key (`rk_…`)
- `RESTORMEL_PROJECT_ID` — from the Keys dashboard **Restormel Testing** hub

Compatibility aliases `RESTORMEL_KEYS_API_BASE_URL` / `RESTORMEL_KEYS_API_TOKEN` still work with the same values. See [keys-testing-onboarding.md](../keys-testing-onboarding.md) and [restormel-environment-vocabulary.md](../guides/restormel-environment-vocabulary.md) § Testing runner.

**Verify:** `pnpm exec testing doctor` (Node 20+, Playwright Chromium, optional resolve probe when URL + bearer are set).

---

## 2. `@restormel/mcp` **v0.1.10** (agents / IDE)

**Install:** `pnpm add -D @restormel/mcp@^0.1.10` (or your package manager). Configure `restormel-mcp` in the MCP client per [packages/mcp/README.md](../../packages/mcp/README.md).

**New tools (control plane + Testing):**


| Tool                          | Use                                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `testing.hub_snapshot`        | One call: Testing project context, environment UUIDs, masked Gateway key prefixes, suggested `RESTORMEL_*` snippet (placeholders). |
| `project.environments.list`   | `GET …/environments` — use ids for `RESTORMEL_ENVIRONMENT_ID` in CI.                                                               |
| `project.gateway_keys.list`   | Masked Gateway keys for a project.                                                                                                 |
| `project.gateway_keys.create` | Creates a new `rk_…`. **Response includes `rawKey` once** — store in secrets immediately; never log or commit.                     |
| `project.gateway_keys.delete` | Revoke a key by id.                                                                                                                |


**Also:** `testing.journey` accepts focus `**billing`**; suggested tool lists in journey phases were refreshed.

**Env (unchanged split):**

- **Control plane** (`projects.`*, `routes.*`, `policies.*`, new project/env/key tools): `RESTORMEL_CONTROL_PLANE_URL` + `RESTORMEL_SERVER_TOKEN` or `RESTORMEL_GATEWAY_KEY`.
- **Resolve probe:** `RESTORMEL_KEYS_BASE` + same Gateway bearer family as the CLI.

Runbook: [mcp-implementation-workflow.md](../runbooks/mcp-implementation-workflow.md) § D.

---

## 3. Hosted dashboard (restormel.dev)

- **Sidebar:** **Gateway keys** sits under **Set Up** next to **Restormel Testing** (faster path for CI env).
- **Overview:** **Restormel Testing in CI** track (Connections → Gateway key → copy env → `testing doctor`).
- **Per-page hints:** **Next** banner on routes like Testing hub, Connections, Rules, billing, settings, dev-tools (including MCP copy).
- **API:** `GET /keys/dashboard/api/projects/{projectId}/environments` — same auth model as project Gateway keys.

---

## 4. Quick copy-paste for PlotBudget CI

Workflow `env` (names are **runtime** names; map from your secret store as you prefer):

```yaml
env:
  RESTORMEL_KEYS_BASE: ${{ secrets.RESTORMEL_KEYS_BASE }}
  RESTORMEL_GATEWAY_KEY: ${{ secrets.RESTORMEL_GATEWAY_KEY }}
  RESTORMEL_PROJECT_ID: ${{ secrets.RESTORMEL_PROJECT_ID }}
```

Optional: `RESTORMEL_ENVIRONMENT_ID` when you pin dev vs prod slots (from the Testing hub or `project.environments.list` via MCP).

---

**Support links:** [Keys + Testing onboarding](../keys-testing-onboarding.md) · [Testing OSS consumption](oss-consumption.md) · [Keys in CI checklist](https://restormel.dev/testing/docs/guides/keys-ci-checklist) (in-dashboard mirror of repo docs).