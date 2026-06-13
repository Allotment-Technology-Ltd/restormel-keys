# Graph MVP product memo (2026-06-03)

## Decision

**Default: `restormel-module-graph` = `disabled`.** Graph npm packages (`@restormel/graph-core`, `@restormel/ui-graph-svelte`, `@restormel/graph-elements`) remain published for **SOPHIA** and library consumers. The **suite marketing pillar** and dashboard product hub stay hidden until Graph has a defined operator surface.

## What Graph is today

- **Library + docs** for embedding graph canvases in host apps (SOPHIA reference consumer).
- **Connect knowledge graph** targets (Postgres spine, Surreal writer) — separate from the Graph *marketing* module.
- **No GA dashboard hub** for suite operators (unlike Keys and Connect).

## MVP stance

| Mode | Behaviour |
|------|-----------|
| `disabled` (MVP default) | Hide from suite nav, footer, proof gallery; redirect `/graph` marketing |
| `preview` | Show with Preview badge; docs links only; MCP `graph.fixture_validate` on |
| `enabled` | Full suite pillar (future — requires product definition) |

## Open questions (post-MVP)

1. Dashboard hub for graph inspection vs SOPHIA-only embed?
2. Relation to Connect pipeline graph store (single “knowledge graph” story)?
3. When to promote from `preview` → `enabled`?

## Links

- [keys-mvp-mode.md](../guides/keys-mvp-mode.md)
- [keys-mvp-module-flags.md](../guides/keys-mvp-module-flags.md)
- [SUITE-ARCHITECTURE-MIGRATION.md](../architecture/SUITE-ARCHITECTURE-MIGRATION.md)
