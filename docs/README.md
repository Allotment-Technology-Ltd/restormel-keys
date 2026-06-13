# Restormel documentation index

The map of the `docs/` tree. Per [doc governance](../.cursor/rules/01-doc-governance.mdc):
**one canonical source per topic** — Canonical = current authority, Reference = useful but
not authoritative, Archive = superseded (traceability only).

> Reorganised in the 2026-06-13 documentation audit: the March "Master Build Pack" and a
> second contradictory era were archived. Start here, not from old numbered files.

## Start here (current truth)

| Doc | Owns |
|-----|------|
| [Product & market positioning](product/positioning.md) | **What Restormel is, who it's for, why it wins** (Verified Context) |
| [STATUS.md](../STATUS.md) | Where we are now + next actions |
| [ROADMAP.md](../ROADMAP.md) | Milestones |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | System shape (summary; details below) |
| [Verified Context claims ledger](verified-context-claims-ledger.md) | Every public quality claim → the evidence that proves it |
| [Verified Context pivot roadmap](verified-context-pivot-roadmap.md) | The pivot delivery plan + claims-integrity rule |
| [Documentation strategy](documentation-strategy.md) | Docs IA, same-links rule, agent-readability |

## Product

- [`product/positioning.md`](product/positioning.md) — positioning SSOT.
- [`restormel/CONNECT-PRODUCT.md`](restormel/CONNECT-PRODUCT.md) — Connect (Ingest · Retrieve · Verify).
- [`restormel/CONNECT-DOMAIN-PACKS.md`](restormel/CONNECT-DOMAIN-PACKS.md) · [`CONNECT-EXTRACTION-MAP.md`](restormel/CONNECT-EXTRACTION-MAP.md) · [`CONNECT-INGEST-QUALITY-BAR.md`](restormel/CONNECT-INGEST-QUALITY-BAR.md).
- [`restormel/SUITE-OPERATOR-MODEL.md`](restormel/SUITE-OPERATOR-MODEL.md) — operator vocabulary.
- [`restormel/HORIZON-PLATFORM-PROGRAMME.md`](restormel/HORIZON-PLATFORM-PROGRAMME.md) — capability programme.
- [`restormel/GRAPH-MVP-PRODUCT-MEMO.md`](restormel/GRAPH-MVP-PRODUCT-MEMO.md) — why Graph is flag-off in MVP.
- [`restormel/gtm-plg-enterprise-sequencing.md`](restormel/gtm-plg-enterprise-sequencing.md) — GTM. Pricing lives at `/keys/pricing`.

## Architecture, contracts & decisions

- [`restormel/SUITE-ARCHITECTURE-MIGRATION.md`](restormel/SUITE-ARCHITECTURE-MIGRATION.md) — suite migration programme.
- [`keys-routing-contract.md`](keys-routing-contract.md) — canonical routing contract.
- [`decisions/`](decisions/) — ADRs (evidence-bound verification, AAIF envelope, verified-memory, pricing UX).
- [`rfc/`](rfc/) · [`routing/`](routing/) — Phase F routing (accepted/shipped).
- [`reference/domain-models.md`](reference/domain-models.md) · [`reference/policy-enforcement.md`](reference/policy-enforcement.md) · [`reference/catalog-governance.md`](reference/catalog-governance.md).
- [`api/`](api/) · [`schemas/`](schemas/) — API specs.

## Guides (how-to)

[`guides/`](guides/) — current integrator + operator how-tos: verified context (AAIF/agent
memory), Connect BYO graph, Neon for self-hosters, environment vocabulary, MVP mode +
module flags, npm→REST migration, security review, third-party brand marks, and the
Cursor MCP helpers.

## Reference (non-authoritative)

[`reference/`](reference/) — npm package scope (truth-sourced via `npm view`), implemented
behaviour, model-catalog ingestion, founding-pro promo, startup credits, Innovate-UK appendix.

## Runbooks & infra (ops)

- [`infra/`](infra/) — **Coolify** cutover runbook, env inventory, server sizing (current host).
- [`runbooks/`](runbooks/) — Zuplo gateway setup, dashboard Postgres migrations, Paddle go-live,
  service-admin operators, Connect ingest hosted worker, MCP workflows.

## Design system

- [`design-system-index.md`](design-system-index.md) — entry point.
- [`DESIGN-TOKENS.md`](DESIGN-TOKENS.md) · [`DESIGN-SPECIFICATION.md`](DESIGN-SPECIFICATION.md) · [`COMPONENT-INVENTORY.md`](COMPONENT-INVENTORY.md) · [`design/`](design/).
- [`ux-contracts.md`](ux-contracts.md) — nav/copy/state contracts.

## Reviews (point-in-time)

[`reviews/`](reviews/) — dated audits/reviews (Connect ingest, dashboard UX/latency, keys
core journey). Dated by nature; not living docs.

## Governance & process

[`security-baseline.md`](security-baseline.md) · [`threat-model-starter.md`](threat-model-starter.md) ·
[`release-readiness.md`](release-readiness.md) · [`reliability-standards.md`](reliability-standards.md) ·
[`prompt-governance.md`](prompt-governance.md) · [`skills.md`](skills.md) · [`subagents.md`](subagents.md) ·
[`working-agreement.md`](working-agreement.md) · [`seo-review.md`](seo-review.md).

## Platform & modules

[`platform-modularization.md`](platform-modularization.md) · [`platform-inventory.md`](platform-inventory.md) ·
[`restormel-monorepo-packages.md`](restormel-monorepo-packages.md) · [`restormel-module-default-stack.md`](restormel-module-default-stack.md) ·
[`template-restormel-module-repo.md`](template-restormel-module-repo.md).

## Archive

[`archive/`](archive/) — superseded material, **traceability only** (see its README for the
"what replaced it" map).
