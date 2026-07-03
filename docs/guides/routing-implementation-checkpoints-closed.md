---
title: Routing parity — closed checkpoints (reference)
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-04-14
last-reviewed: 2026-06-13
review-interval: P12M
---

# Routing parity — closed checkpoints (reference)

**Status:** Reference — records outcomes of planning **CHECKPOINT** items from the Sophia routing parity plan. **Canonical routing API** remains [keys-routing-contract.md](../architecture/keys-routing-contract.md).

## Export / import schema vs DB and MCP

- **DB:** `routes` / `route_steps` columns match portable bundle fields (`apps/dashboard/migrations/*`, `replaceRouteStepsFromSnapshot` in `neon.ts`). Bundle schema: [route-graph-bundle.schema.json](../schemas/route-graph-bundle.schema.json) (`schemaVersion` **1.0.0**).
- **HTTP:** `GET …/routes/{routeId}/export`, `POST …/routes/import`.
- **MCP:** `routing.export`, `routing.import` (names aligned with `routing.capabilities`).

## advanceOn / retryOn — SDK, OpenAPI, SOPHIA consumer

- **OpenAPI / HTTP:** `docs/api/openapi.yaml` documents resolve/simulate `stepChain` and related fields.
- **SDK:** `@restormel/keys` `ResolveStepChainEntry` in `packages/core/src/dashboard/types.ts` includes optional `advanceOn` / `retryOn`.
- **SOPHIA:** [sophia-keys-routing-consumer.md](sophia-keys-routing-consumer.md) describes host interpretation; Keys echoes config only.

## stepchain-machine-readable-triggers — scope trim

- **Keys:** Echoes `advanceOn` / `retryOn` string arrays from step JSON when present; does **not** evaluate triggers (host / worker data plane).

## routingAttempts — OpenAPI vs MCP outputSchema

- **OpenAPI:** Simulate response documents `routingAttempts` (and `stepDiagnostics`).
- **MCP:** `routes.simulate` **outputSchema** describes the full success **`data`** object (resolve-shaped fields + `perStepEstimates`, `wouldRun`, `switchOutcomePreview`, optional `stepDiagnostics` / `routingAttempts`). Nested `stepChain` / `fallbackCandidates` rows use open objects for forward compatibility. **`routing.export`** **outputSchema** matches the portable bundle (`schemaVersion` **1.0.0**, `route` / `steps` as open objects). **`routing.import`** success **`data`** is `{ route, steps }` (control-plane rows after apply). **`routing.explain_chain`** success **`data`** matches `buildRoutingExplainChainData` (including optional `catalogCrowdHints`). Zod: `packages/mcp/src/register-tools.ts`; JSON Schema mirrors: `packages/mcp/src/routing-mcp-output-schemas.ts`.

## Doc drift (periodic)

- Run from repo root: `bash scripts/routing-doc-drift-check.sh` (also invoked from `scripts/review-docs.sh`). Uses lightweight string checks; extend the script when contracts change.

## Generated-from-markdown pipeline

- **Not in use** for routing docs. If a pipeline is added later: amend [prompt-governance.md](../governance/prompt-governance.md) and [prompts-reference.md](../governance/prompts-reference.md) first so canonical vs generated duplication is explicit.

## New MCP routing tools vs `routing.explain` and `routes.*`

| Surface | Role |
|---------|------|
| `routing.explain` | Static catalog-style model→provider explanation (no control plane). |
| `routes.*` | CRUD + simulate on the control plane. |
| `routing.export` / `routing.import` | GitOps bundle read/write. |
| `routing.explain_chain` | Read-only aggregate: route + steps + policy binding layers. |

## Example host (resolve → AAIF)

- See [examples/aaif-resolve-then-execute/README.md](../../examples/aaif-resolve-then-execute/README.md) (placeholders only; no secrets).

## @restormel/aaif semver when types expand

- **RoutingPlan / RoutingAttempt** types shipped in `@restormel/aaif`; **patch/minor** bump per [CHANGELOG.md](../../CHANGELOG.md) consumer notes when extending request shapes.

## Cursor skill vs prompts

- **Skill:** `.cursor/skills/restormel-keys-routing` (and `.agents` symlink) stays the live agent entry for multi-surface routing work.
- **Prompts:** Governed under `prompts/` + [prompts-reference.md](../governance/prompts-reference.md). Do not duplicate the skill body into prompt packs; **link** to the skill or canonical doc.

## Dashboard — publish vs draft (visual affordance)

- Route detail shows a **draft** banner when `version !== publishedVersion` (with link to publish flow in dashboard). Full step-level visual diff remains future polish; **a11y:** banner uses `role="status"` and visible text (no color-only state).

## AAIF RoutingPlan types

- Optional **mirror types** for hosts attaching resolve-shaped payloads: `packages/aaif/src/types.ts` (`AAIFRoutingPlan`, `AAIFRoutingPlanStep`, `AAIFRoutingAttempt`, …). Not a substitute for HTTP resolve.

## Catalog signals — opt-in read path (no default automation)

- **Design:** [routing-catalog-signals.md](routing-catalog-signals.md).
- **Keys (read-only, off by default):** `GET …/explain-chain?includeCatalogHints=true` attaches aggregated **crowd observation counts** per step model pair (same trust model as `GET /api/catalog`). **No** automatic cooldown or reorder; operators interpret hints. **Threat model:** automation that mutates routes stays **opt-in** and gated on product + [threat-model-starter.md](../governance/threat-model-starter.md) (*Catalog observations → routing automation*) + [security baseline](../governance/security-baseline.md).

## SOPHIA / stage enum / epic close-out

- **Stage strings:** Single vocabulary in `INGESTION_STAGES` (`apps/dashboard/src/lib/server/ingestion-routing.ts`); confirm SOPHIA worker matches runbook.
- **Epic close-out:** When SOPHIA merges worker parity, archive or reprioritize deferred plan rows in the external backlog.

## Cursor plan — Sophia routing parity (todo inventory)

**Canonical YAML:** `~/.cursor/plans/sophia_routing_parity_8d00bcd5.plan.md` (**42** todos). **As of 2026-04-16:** **39** marked **completed** in Keys (including all checkpoints except the three SOPHIA-merge items below). Older tracking sometimes cited **47** items (extra checklist rows or deferred product ideas); treat **42** as the authoritative plan count.

**IDE todo list drift:** Cursor can keep showing **merged todos** from older agent sessions (different titles than the plan `id` / `content` fields). If you see long lists of routing checkpoints that are already done in repo, **clear or ignore them** and use this section + the plan file above — do not treat stale UI rows as backlog.

**Remaining (3) — require SOPHIA or post-SOPHIA human verification**

| Plan todo id | Role |
|--------------|------|
| `pause-amend-plan-after-stage-vocab-remediation` | **CHECKPOINT:** When SOPHIA ships ingestion **enum**, confirm no duplicate **stage** strings in Keys DB for the same ingestion slot. |
| `sophia-worker-implementation` | **External repo:** SOPHIA implements rich **stepChain**, error-class advancement, deprecate side-channel JSON where safe (SOPHIA backlog). |
| `pause-amend-plan-after-sophia-consumer-plan` | **CHECKPOINT:** Epic close-out when SOPHIA merges — archive deferred items or promote to Keys v1.1. |

**MCP `outputSchema` hardening (Keys):** Zod in `packages/mcp/src/register-tools.ts`; JSON Schema mirrors in `packages/mcp/src/routing-mcp-output-schemas.ts` for **`routing.export`**, **`routing.import`**, **`routing.explain_chain`**, and **`routes.simulate`**.
