---
name: restormel-integration-docs-hub
description: >-
  Integration documentation hub and catalog pages: one index page that links to existing canonical guides, optional
  AAIF integrationStack field documentation, same-links compliance, and sitemap/sidebar updates. Use when adding
  /keys/docs/guides/integration-catalog or changing integrations IA under /keys/docs.
---

# Integration docs hub

## Read first

- [docs/governance/documentation-strategy.md](../../../docs/governance/documentation-strategy.md)
- [docs/architecture/keys-routing-contract.md](../../../docs/architecture/keys-routing-contract.md) — routing + AAIF `integrationStack` narrative.
- [.cursor/rules/01-doc-governance.mdc](../../rules/01-doc-governance.mdc)

## Rules

1. **Hub vs guide:** The [integration catalog](/keys/docs/guides/integration-catalog) **indexes** vendors and points to existing guides (Neon, OpenRouter, Portkey, Vercel AI Gateway, Keys+Testing onboarding, Cloud API / Zuplo, etc.). Do not paste full procedures that already live on those pages.
2. **AAIF:** Document optional `integrationStack` on `AAIFRequest` in [packages/aaif](../../../packages/aaif) README and in-app [/keys/docs/integrations/aaif](/keys/docs/integrations/aaif); keep JSON shape aligned with `@restormel/aaif` types (single source of truth).
3. **Same links:** Use only canonical Dashboard / Sign in URLs from documentation-strategy.
4. **One canonical owner:** If policy overlaps design vs docs, link from [docs/design/design-system-index.md](../../../docs/design/design-system-index.md) to the guide—do not duplicate trademark law in multiple places.
