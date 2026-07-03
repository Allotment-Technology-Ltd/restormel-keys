# Status

Where this project is today. Kept in sync with [ROADMAP.md](ROADMAP.md).

**Stage:** Active development, pre-1.0. Packages are versioned and released independently —
see the status column in [README.md](README.md#packages-public-integrators) for what's stable
vs. deprecated.

## What's shipped

- **Keys REST** — the control-plane API (`/keys/v1/*`) for BYOK credential storage, routing,
  and provider selection. The recommended integration path for new apps.
- **`@restormel/keys-elements`** — Web Components UI (key manager, model selector, cost
  estimator) for apps that want a ready-made front end.
- **`@restormel/keys-cli`, `@restormel/doctor`, `@restormel/validate`** — setup, health-check,
  and CI-friendly credential validation tooling.
- **`@restormel/mcp`** — MCP tools + stdio server, for agents and IDEs that need to resolve
  routing/BYOK decisions as part of a tool call.
- **`@restormel/aaif`** — a typed request/response contract + runtime helper for hosts that
  want to mirror routing/resolve decisions without going through MCP.
- **Deprecated, maintenance-only until 2026-12-01:** the in-process `@restormel/keys` npm
  core, `@restormel/keys-svelte`, `@restormel/keys-react` — replaced by Keys REST +
  `@restormel/keys-elements`.

## Self-hosting

Neon Postgres is the documented default database for self-hosted deployments that need the
full control plane. See [NEON.md](NEON.md) and
[docs/guides/database-neon-for-self-hosters.md](docs/guides/database-neon-for-self-hosters.md).
Client packages (`keys-cli`, `keys-elements`, `mcp`, etc.) don't require a database themselves
— they're transport clients against Keys REST.

## Testing

`@restormel/testing-*` (deterministic suites, CLI, GitHub Action) is available but not part of
the primary integration path documented in the README — see
[docs/restormel-monorepo-packages.md](docs/restormel-monorepo-packages.md).

---

*Update when the package table or self-hosting story changes.*
