---
name: restormel-suite-integrations-marketing
description: >-
  Suite and module landing information architecture for Restormel integrations: ecosystem proof placement, CTAs,
  cross-links to /keys/docs, Testing and Graph handoffs, and avoiding duplicate canonical product truth. Use when
  editing /, /keys, /testing, /graph, /integrations, or EcosystemStrip-style components.
---

# Suite integrations marketing

## Read first

- [docs/verified-context-claims-ledger.md](../../../docs/verified-context-claims-ledger.md) — **canonical truth for every quality/verification claim**: copy may only state what a `proven` ledger row backs; cite row numbers in the PR (template section "Marketing claims").
- [docs/documentation-strategy.md](../../../docs/documentation-strategy.md) — same links, doc map.
- [docs/design-system-index.md](../../../docs/design-system-index.md) — layout, tokens, third-party marks (if present).

## IA rules

1. **One story:** Suite hero states the product layer; a compact **stack rail** (`EcosystemStrip`) shows *Your stack → Restormel → Your product* with vendor chips and a link to the [integration catalog](/keys/docs/guides/integration-catalog)—do not duplicate full setup steps on marketing pages.
2. **Module landings:** Each pillar (Keys, Testing, Graph) gets a **short** ecosystem line or strip variant that links to the catalog and the 1–2 most relevant guides (e.g. Keys → gateways; Testing → CI + Keys onboarding).
3. **CTAs:** Prefer “Browse integrations” / “Integration catalog” over vague “Learn more” where the destination is the hub page.
4. **Canonical URLs:** Dashboard `https://restormel.dev/keys/dashboard`, Sign in `https://restormel.dev/keys/dashboard/login`, docs paths as in [documentation-strategy.md](../../../docs/documentation-strategy.md).

## Checklist before merge

- [ ] Every quality/verification phrase cites a **proven** row in the [claims ledger](../../../docs/verified-context-claims-ledger.md) (row numbers in the PR).
- [ ] New links resolve in `apps/dashboard` routes.
- [ ] No implied vendor partnership without legal review.
- [ ] Copy matches [restormel-third-party-brand-marks](../restormel-third-party-brand-marks/SKILL.md) for logos and trademarks.
