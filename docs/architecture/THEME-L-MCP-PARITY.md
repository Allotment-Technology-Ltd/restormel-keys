# Theme L — MCP agent / human parity (Horizon suite tools)

**Purpose:** For each **suite** MCP tool, record the **human doc** anchor and **dashboard** equivalent (or explicit CLI/API-only). Keeps agents and operators aligned.

**MCP inventory:** [HORIZON-PLATFORM-PROGRAMME.md](./HORIZON-PLATFORM-PROGRAMME.md) §3.

| MCP tool | Human doc | Dashboard / product surface | HTTP mirror (Zuplo) |
|----------|-----------|----------------------------|----------------------|
| `docs.canonical_resolve` | [/keys/docs/integrations/mcp](https://restormel.dev/keys/docs/integrations/mcp), programme [HORIZON-PLATFORM-PROGRAMME.md](./HORIZON-PLATFORM-PROGRAMME.md) | Dev Tools → MCP (tool list + programme link) | `POST /api/suite/invoke` + `tool` / `payload.topic` |
| `testing.config_validate` | [/testing/docs](https://restormel.dev/testing/docs) — config reference, [oss-consumption.md](../archive/testing/testing/oss-consumption.md) | Restormel Testing hub — YAML/CI context | `POST /api/suite/invoke` + `payload.content` / `format` |
| `observability.trace_summarize` | Graph docs reasoning / traces; [RESTORMEL-STATE.md](./RESTORMEL-STATE.md) correlation | API-only for v1 — no dedicated dashboard page | `POST /api/suite/invoke` + `payload.traceJson` |
| `graph.fixture_validate` | [/graph/docs/integration/sveltekit](https://restormel.dev/graph/docs/integration/sveltekit) | API-only — integrators use graph demo / host app | `POST /api/suite/invoke` + `payload.graphJson` |
| `state.memory_preview` | [/graph/docs/extensions/state](https://restormel.dev/graph/docs/extensions/state) | API-only — SOPHIA/host projects materialise UI | `POST /api/suite/invoke` + `payload.eventsJson` |

Envelope: [restormel-suite-tool-envelope.schema.json](../integrations/restormel-suite-tool-envelope.schema.json). Runbook: [mcp-suite-troubleshooting.md](../runbooks/mcp-suite-troubleshooting.md).

**Suggested next step in agent flows:** Prefer `testing.journey` with `focus: testing_ci` after validating config; use `docs.canonical_resolve` before citing repo paths in PRs.
