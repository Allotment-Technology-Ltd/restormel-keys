---
title: Restormel documentation index
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-13
last-reviewed: 2026-06-13
review-interval: P12M
---

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
| [Verified Context claims ledger](product/verified-context-claims-ledger.md) | Every public quality claim → the evidence that proves it |
| [Verified Context pivot roadmap](product/verified-context-pivot-roadmap.md) | The pivot delivery plan + claims-integrity rule |
| [Documentation strategy](governance/documentation-strategy.md) | Docs IA, same-links rule, agent-readability |

## Product

- [`product/positioning.md`](product/positioning.md) — positioning SSOT.
- [`product/public-pages-revamp-plan.md`](product/public-pages-revamp-plan.md) — **Phase 2** programme (public pages + docs revamp; swarm plan).
- [`product/model-catalogue-advisory-plan.md`](product/model-catalogue-advisory-plan.md) — **plan** (open provider/model selection + derived suitability & cost; provider-neutral + region filtering; broad self-maintaining catalogue; multi-agent delivery).
- [`product/CONNECT-PRODUCT.md`](product/CONNECT-PRODUCT.md) — Connect (Ingest · Retrieve · Verify).
- [`product/CONNECT-DOMAIN-PACKS.md`](product/CONNECT-DOMAIN-PACKS.md) · [`CONNECT-EXTRACTION-MAP.md`](product/CONNECT-EXTRACTION-MAP.md) · [`CONNECT-INGEST-QUALITY-BAR.md`](product/CONNECT-INGEST-QUALITY-BAR.md).
- [`product/SUITE-OPERATOR-MODEL.md`](product/SUITE-OPERATOR-MODEL.md) — operator vocabulary.
- [`architecture/HORIZON-PLATFORM-PROGRAMME.md`](architecture/HORIZON-PLATFORM-PROGRAMME.md) — capability programme.
- [`product/GRAPH-MVP-PRODUCT-MEMO.md`](product/GRAPH-MVP-PRODUCT-MEMO.md) — why Graph is flag-off in MVP.
- [`product/gtm-plg-enterprise-sequencing.md`](product/gtm-plg-enterprise-sequencing.md) — GTM. Pricing lives at `/keys/pricing`.

## Architecture, contracts & decisions

- [`architecture/SUITE-ARCHITECTURE-MIGRATION.md`](architecture/SUITE-ARCHITECTURE-MIGRATION.md) — suite migration programme.
- [`architecture/keys-routing-contract.md`](architecture/keys-routing-contract.md) — canonical routing contract.
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

- [`design-system-index.md`](design/design-system-index.md) — entry point.
- [`DESIGN-TOKENS.md`](design/DESIGN-TOKENS.md) · [`DESIGN-SPECIFICATION.md`](design/DESIGN-SPECIFICATION.md) · [`COMPONENT-INVENTORY.md`](design/COMPONENT-INVENTORY.md) · [`design/`](design/).
- [`ux-contracts.md`](design/ux-contracts.md) — nav/copy/state contracts.

## Reviews (point-in-time)

[`reviews/`](reviews/) — dated audits/reviews (Connect ingest, dashboard UX/latency, keys
core journey). Dated by nature; not living docs.

## Governance & process

[`security-baseline.md`](governance/security-baseline.md) · [`threat-model-starter.md`](governance/threat-model-starter.md) ·
[`release-readiness.md`](governance/release-readiness.md) · [`reliability-standards.md`](governance/reliability-standards.md) ·
[`prompt-governance.md`](governance/prompt-governance.md) · [`skills.md`](governance/skills.md) · [`subagents.md`](governance/subagents.md) ·
[`working-agreement.md`](governance/working-agreement.md) · [`seo-review.md`](reference/seo-review.md) ·
[`docs-archive-externalisation-plan.md`](governance/docs-archive-externalisation-plan.md) (deferred: move archive out of git).

## Platform & modules

[`platform-modularization.md`](architecture/platform-modularization.md) · [`platform-inventory.md`](architecture/platform-inventory.md) ·
[`restormel-monorepo-packages.md`](architecture/restormel-monorepo-packages.md) · [`restormel-module-default-stack.md`](architecture/restormel-module-default-stack.md) ·
[`template-restormel-module-repo.md`](architecture/template-restormel-module-repo.md).

## Archive

[`archive/`](archive/) — superseded material, **traceability only** (see its README for the
"what replaced it" map).
