---
name: restormel-keys-routing
description: Use when configuring or explaining Restormel Keys multi-step routes, resolve/simulate, SOPHIA ingestion workload/stage, MCP routing tools, or AAIF routingContext vs dashboard resolve.
---

# Restormel Keys routing (agent skill)

## First step

1. Call MCP **`docs.canonical_resolve`** with topic **`keys_routing_contract`** (or read `docs/architecture/keys-routing-contract.md` in-repo).
2. For a machine-readable surface list, call suite tool **`routing.capabilities`** (read-only).

## Control plane (no LLM execution)

- **`POST .../resolve`** — discovery (`workload` + `stage` or `routeId`), returns `stepChain` with rich per-step metadata (contract `2026-04-16+`; pools + parallel metadata), `attemptNumber` for server-advanced fallback.
- **`POST .../routes/{routeId}/simulate`** — dry-run + optional `stepDiagnostics`; optional `includeRoutingAttempts` for hypothetical tier outcomes.
- **`GET .../routes/{routeId}/export`** — portable route+steps bundle (JSON schema 1.0.0) for GitOps.
- **`POST .../routes/import`** — apply a bundle (create route, or **`replaceRouteId`** to overwrite metadata + steps).
- **`GET .../routes/{routeId}/explain-chain`** — read-only agent summary: route lifecycle, ordered steps, policies bound at workspace/project/environment/route (same layers as resolve).
- **MCP:** `routes.upsert_with_steps`, `routes.simulate`, **`routing.export`**, **`routing.import`**, **`routing.explain_chain`**, `routes.list`, etc. (see `routing.capabilities` output).

## AAIF

- Types: `AAIFRoutingContext` on `AAIFRequest` is pass-through for resolve alignment.
- **`executeAAIFRequest`** does not call HTTP resolve; hosts call `@restormel/keys` `resolve()` when they need `stepChain`.

## Security

- No raw keys in prompts or logs; use placeholders in examples ([`docs/governance/security-baseline.md`](../../../docs/governance/security-baseline.md)).
