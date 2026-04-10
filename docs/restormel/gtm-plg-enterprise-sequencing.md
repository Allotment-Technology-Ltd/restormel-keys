# GTM sequencing — self-serve (PLG) before heavy enterprise procurement

**Status:** Canonical operational note for go-to-market ordering. Complements [docs/01-product-strategy.md](../01-product-strategy.md) and [ROADMAP.md](../../ROADMAP.md).

## Why this matters

Enterprise adoption often implies **long sales cycles**, **security questionnaires**, **DPAs**, **vendor onboarding**, and **procurement**. Those steps burn time and cash **before** recurring revenue. For an upstart, leading only with enterprise-shaped SKUs risks building **SIEM exports, webhooks, and hosted control planes** without a buyer on the hook.

## Recommended sequence

1. **Land with PLG / self-serve** — npm packages, dashboard signup, copy-paste env, **BYO-GPU** and **BYOK** guides, Restormel Testing in **customer-funded** CI. Revenue or traction here funds later enterprise work.
2. **Expand with sales-assist** — Help teams that outgrow self-serve without full procurement (shared Slack, office hours, design review).
3. **Enterprise attach** — Webhooks, audit/SIEM exports, SSO guarantees, DPAs: ship when a **named** customer or design partner **sponsors** the work (contract or LOI), not only because the roadmap lists it.

## Self-serve vs procurement-heavy (quick reference)

| Surface | Typical path | Procurement-heavy? |
|--------|----------------|---------------------|
| npm / CLI / local MCP | Developer installs; Gateway key in env | **Low** |
| Dashboard routes / policies | Sign in + Gateway key | **Low** |
| BYO-GPU docs + private endpoints | Customer cloud; Restormel does not host GPU | **Low** |
| Testing in GitHub Actions | Customer runners; customer Minutes bill | **Low** |
| Org-wide SSO + SCIM | Security review | **High** |
| Outbound webhooks to customer SIEM | Infosec + secret handling + SLAs | **Medium–high** |
| DPA / subprocessor list / residency | Legal | **High** |

## Implication for roadmap

Treat **events, webhooks, and hosted MCP** as **Phase 2 attach** unless a buyer explicitly funds them. Prefer shipping **evidence exports** and **guides** that work **without** procurement first (e.g. downloadable **Release pack** JSON from CI).

## Related docs

- [BYO-GPU and NGC accessibility](../guides/byo-gpu-ngc-accessibility.md) (repo doc; mirrored in-app under Keys guides)
- [Webhooks and audit MVP](../integrations/webhooks-audit-mvp.md)
- [Restormel-first assessment](../reference/restormel-first-assessment.md) (integration contract / less PS)
