---
description: Wire MCP (Model Context Protocol) to Restormel Keys — policy evaluate vs control-plane URLs.
---

# MCP & agent setup

**Canonical variable names** (do not invent synonyms): repo `docs/guides/restormel-environment-vocabulary.md` or in-product [Environment vocabulary](https://restormel.dev/keys/docs/guides/environment-vocabulary).

Agents and IDEs run **`@restormel/mcp`** as a **local stdio server**. Credentials live in **that process environment only** — same trust model as a backend worker: never expose Gateway keys in the browser or client bundles.

## Two URL shapes (do not mix them up)

| Goal | Variable | Hosted example | Auth |
|------|----------|----------------|------|
| **`entitlements.check` → live policies** | `RESTORMEL_EVALUATE_URL` | `https://restormel.dev/keys/dashboard/api/policies/evaluate` | `RESTORMEL_GATEWAY_KEY` (`rk_…`, Bearer) |
| **Route/policy MCP tools** (`routes.*`, `policies.*`, `fallback_chain.set`) | `RESTORMEL_CONTROL_PLANE_URL` | `https://restormel.dev/keys/dashboard` (no trailing slash; paths append `/api/projects/…`) | `RESTORMEL_SERVER_TOKEN` or `RESTORMEL_GATEWAY_KEY` (Bearer) |

**Evaluate** uses the **full** Dashboard API path including `/api/policies/evaluate`. **Control-plane** uses the **dashboard app base** so `{CONTROL_PLANE}/api/projects/{id}/…` resolves correctly — it is **not** the same string as the evaluate URL.

Deep dive (tables, checklist, verification): **Documentation** on restormel.dev → [MCP](https://restormel.dev/keys/docs/integrations/mcp) and [Cloud API](https://restormel.dev/keys/docs/cloud-api) (Policy evaluate). Repo canonical runbook: `docs/runbooks/mcp-implementation-workflow.md`.

## Related API docs

- [Policies evaluate](/dashboard-api/policies-evaluate) — request/response for this endpoint
- [Dashboard API overview](/dashboard-api/overview) — resolve, routes, runtime vs Gateway API

## Security (short)

- Do not log `RESTORMEL_GATEWAY_KEY`, `RESTORMEL_SERVER_TOKEN`, or provider API keys.
- MCP tool output must not include raw secrets; prefer masked identifiers and fingerprints for key metadata.

Product baseline: [Security baseline](https://restormel.dev/keys/docs/security-baseline) (in-app docs).

## Suite read tools (Horizon Phase 1) — HTTP mirror

**stdio (default):** `@restormel/mcp` registers **`docs.canonical_resolve`**, **`testing.config_validate`**, **`observability.trace_summarize`**, **`graph.fixture_validate`**, **`state.memory_preview`** — no network for those tools.

**Zuplo / consumer key:** The gateway exposes **`POST /api/suite/invoke`** with the same policy stack as other forwarded **`/api/*`** routes (consumer key → injected backend Gateway key). Request body: **`{ "tool": "<name>", "payload": { ... } }`** — see repo **`docs/integrations/restormel-suite-tool-envelope.schema.json`**. The dashboard handler is **`POST /keys/dashboard/api/suite/invoke`**.

Do **not** send raw provider secrets or full trace dumps to untrusted logs; treat payloads like MCP stdio arguments.
