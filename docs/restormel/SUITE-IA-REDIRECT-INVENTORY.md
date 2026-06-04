# Suite IA overhaul — redirect and disclosure inventory

**Status:** Reference (Theme L IA programme). **Canonical onboarding:** dashboard-first per [documentation-strategy.md](../documentation-strategy.md) and [SUITE-OPERATOR-MODEL.md](./SUITE-OPERATOR-MODEL.md).

## Disclosure tiers

| Tier | Purpose | Public nav | Examples |
|------|---------|------------|----------|
| **0** | Suite orientation | Suite docs hub `/docs` only | Run vs Embed, operator model link |
| **1** | Task / journey | Product docs sidebars (≤8 links) | Journeys, walkthrough index, integration catalog |
| **2** | Reference | Search + deep links; collapsed "Reference" | Vendor guides, Cloud API, walkthrough phases, MCP/AAIF |

## Suite docs hub (canonical)

- **Hub:** `https://restormel.dev/docs`
- **Suite quickstart (Tier 1):** `https://restormel.dev/docs/quickstart`
- **How it fits together (deduped):** `https://restormel.dev/docs/how-it-fits-together`

Module copies at `/keys/docs/how-it-fits-together`, `/testing/docs/how-it-fits-together`, `/graph/docs/how-it-fits-together` remain as **stubs** linking to the suite page (no redirect required).

## Duplicate journeys (collapsed in nav, URLs preserved)

| Parallel tree | Action | Notes |
|---------------|--------|-------|
| Keys main walkthrough `/keys/docs/walkthrough/*` | Tier 2 — hidden from default sidebar | Linked from walkthrough index only |
| Keys integrations-walkthrough `/keys/docs/integrations-walkthrough/*` | Tier 2 — hidden from default sidebar | Merged narratively under Integrations journey |
| Testing walkthrough `/testing/docs/walkthrough/*` | Tier 2 | Sidebar shows walkthrough index only |
| Per-product "how it fits together" | Stub → suite page | Content not duplicated |

## Product doc counts (inventory baseline)

| Tree | Page count (`+page.svelte`) | Default sidebar target |
|------|----------------------------|------------------------|
| Keys | 56 | ≤8 visible + Reference collapse |
| Testing | 34 | ≤8 visible + Reference collapse |
| Graph | 14 | ≤8 visible + Reference collapse |
| Connect | marketing `/connect/docs` | Links to suite hub + dashboard |

## URL redirects

| From | To | Mechanism |
|------|-----|-----------|
| `/docs/keys` | `/keys/docs` | `+page.server.ts` 302 |
| `/docs/testing` | `/testing/docs` | `+page.server.ts` 302 |
| `/docs/graph` | `/graph/docs` | `+page.server.ts` 302 |
| `/knowledge`, `/knowledge/*` | `/connect`, `/connect/*` | `hooks.server.ts` 308 |
| `/keys/dashboard/knowledge/*` | `/keys/dashboard/connect/*` | `hooks.server.ts` 308 |
| `/keys/dashboard/api/knowledge/*` | `/keys/dashboard/api/connect/*` | `hooks.server.ts` 308 |
| `/docs/knowledge`, `/docs/knowledge/*` | `/docs/connect`, `/docs/connect/*` | `hooks.server.ts` 308 |

Canonical dashboard and module paths unchanged per documentation-strategy same-links table. Suite sidebar **Capability docs** links point directly at product doc roots (no orphan `/docs/{product}` pages required).

## Sitemap / nav code anchors

| Surface | File |
|---------|------|
| Marketing header | `apps/dashboard/src/lib/site-nav.ts`, `SiteHeader.svelte` |
| Suite docs | `apps/dashboard/src/lib/suite/docs-nav.ts`, `routes/docs/*` |
| Keys docs sidebar | `apps/dashboard/src/lib/keys/docs-nav.ts` |
| Testing docs | `apps/dashboard/src/lib/testing/docs-nav.ts` |
| Graph docs | `apps/dashboard/src/lib/graph/docs-nav.ts` |
| Connect docs | `apps/dashboard/src/lib/connect/docs-nav.ts`, `routes/connect/docs/*` |
| Dashboard | `apps/dashboard/src/lib/nav-config.ts` |
