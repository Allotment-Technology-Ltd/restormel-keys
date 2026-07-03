# Architecture

High-level architecture summary for Restormel Keys — a headless BYOK (Bring Your Own Key)
and provider-routing library for AI apps. UI, CLI, and MCP surfaces are thin wrappers around
one control plane; there's no hidden lock-in to a specific framework or database.

**Product shape:** REST API (Keys REST, `/keys/v1/*`) is the primary integration surface.
UI: `@restormel/keys-elements` (Web Components). CLI: `@restormel/keys-cli`, `@restormel/doctor`.
Agents: `@restormel/mcp`, `@restormel/aaif`. `@restormel/keys`, `@restormel/keys-svelte`, and
`@restormel/keys-react` are deprecated (maintenance-only until 2026-12-01) — use Keys REST
for new integrations.

**Repo shape:** pnpm monorepo. `packages/` — routing core, UI packages (Svelte/Elements/React),
CLI (`keys-cli`, `doctor`, `validate`), agent surfaces (`aaif`, `mcp`), supporting packages
(`contracts`, `observability`, `context-packs`, `state`), graph packages, and the
`testing-*` family. `apps/` — small demo and reference apps only (the hosted dashboard/control
plane is a separate, not-yet-open-sourced product — see [STATUS.md](STATUS.md)). `docs/`,
`examples/`, `scripts/`, `skills/`, `subagents/` — documentation, runnable examples, and
repo tooling.

**Data & self-hosting:** the client packages (`keys-cli`, `keys-elements`, `mcp`, etc.) are
transport clients — they don't require a database. If you self-host the control plane behind
Keys REST, Postgres is required and **Neon is the documented, recommended provider** — see
[NEON.md](NEON.md) for why, and
[docs/guides/database-neon-for-self-hosters.md](docs/guides/database-neon-for-self-hosters.md)
for the setup guide (schema, Neon Auth, CI preview branches).

## How a routing decision flows

```mermaid
sequenceDiagram
  participant App as App / backend
  participant Core as @restormel/keys core
  participant Policy as Policies + entitlements
  participant Health as Availability + trust health
  participant Route as Route selector
  participant Prov as Selected provider/model
  participant Obs as Decision metadata + provenance

  App->>Core: Execution request (task + constraints)
  Core->>Policy: Evaluate policy + entitlement checks
  Policy-->>Core: Allowed options / restrictions
  Core->>Health: Read availability + trust signals
  Health-->>Core: Current provider/model health
  Core->>Route: Select route under constraints
  Route-->>Core: Provider/model decision
  Core->>Prov: Execute request
  Prov-->>Core: Response / error
  Core->>Obs: Emit trace + decision metadata
  Core-->>App: Normalized response
```

## Package relationships

```mermaid
flowchart LR
  subgraph UserSurfaces["User-facing surfaces"]
    Docs["Docs"]
    DevTools["CLI / MCP integrators"]
  end

  subgraph CorePackages["Headless and integration packages"]
    Keys["@restormel/keys (core)"]
    AAIF["@restormel/aaif"]
    MCP["@restormel/mcp"]
    CLI["@restormel/keys-cli"]
    UI["UI packages (Svelte / Elements / React)"]
  end

  subgraph DataAndControl["Control-plane / state surfaces"]
    Catalog["Model catalog seed + drift checks"]
    Routes["Routes, policies, steps"]
    Prov["Provenance metadata + lifecycle history"]
    Health["Provider trust health + readiness + coverage"]
  end

  Docs --> UI
  DevTools --> AAIF
  DevTools --> MCP
  DevTools --> CLI

  UI --> Keys
  AAIF --> Keys
  CLI --> Keys

  Keys --> Routes
  Keys --> Health
  Keys --> Catalog
  Routes --> Prov
```

See [docs/decisions/](docs/decisions/) for the architecture decision records behind these
choices.
