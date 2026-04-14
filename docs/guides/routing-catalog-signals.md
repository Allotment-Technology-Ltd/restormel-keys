# Routing and catalog signals (design note)

**Status:** Reference — not an operational runbook until product opts in.

## Goal

Optional feedback loop: provider/model health signals (e.g. from [`reportCatalogModelObservation`](../../packages/core/src/dashboard/client.ts) or aggregated failure metrics) could inform **cooldown** or **deprioritization** of route steps.

## Trust boundary

- **No automatic chain mutation** without explicit operator configuration (future feature).
- **No secrets** in telemetry or agent-facing summaries ([security baseline](../security-baseline.md)).
- Correlate only **masked** identifiers and **aggregated** counts.

## Canonical contract

See [keys-routing-contract.md](../keys-routing-contract.md) for the authoritative routing API. This document reserves space for a future “signals → policy hints” design.

## Read-only crowdsignals today (operator opt-in)

Keys does **not** reorder or cool down routes automatically. For **forensics only**, `GET …/routes/{routeId}/explain-chain?includeCatalogHints=true` returns **`catalogCrowdHints`**: aggregated deprecated/retired **report counts** from `POST /api/catalog/observations` for provider/model pairs used by the route’s steps (and the route default model when resolvable). Default is **off**; no mutation of routes or policies. Closure notes: [routing-implementation-checkpoints-closed.md](routing-implementation-checkpoints-closed.md).

## Before any cooldown / reorder automation (product + threat model)

Do **not** ship server-side chain mutation driven by catalog or failure telemetry until:

1. **Explicit opt-in** per workspace or project (not a silent default), with UI copy that states what may change (step order, skip windows, policy hints).
2. **Threat model sign-off** for poisoning, Sybil reports, and mis-scoped aggregates — see [threat-model-starter.md](../threat-model-starter.md) (*Catalog observations → routing automation*).
3. **Human-in-the-loop or policy object** gate for the first version (for example: hints only, or “suggested diff” requiring publish).
4. **Audit events** for any automated or semi-automated apply path.

Until then, **read-only** `includeCatalogHints` and observation APIs remain the supported surface.
