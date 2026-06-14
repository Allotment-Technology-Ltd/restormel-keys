---
title: Restormel — product & market positioning
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-13
last-reviewed: 2026-06-13
review-interval: P12M
---

# Restormel — product & market positioning

**Status:** Canonical (positioning SSOT). **Last reviewed:** 2026-06-13.
**Owner:** Allotment Technology Ltd.

This is the single source of truth for **what Restormel is, who it is for, and why it wins**.
Marketing copy, docs intros, decks, and external briefs derive from here. Every
quality/verification claim must trace to a `proven` row in the
[Verified Context claims ledger](verified-context-claims-ledger.md) — see the
[pivot roadmap's claims-integrity rule](verified-context-pivot-roadmap.md).

---

## 1. One-liner

**Restormel is the verified-context layer for AI products** — provenance-traced,
quality-gated knowledge that an agent (or its auditor) can trace back to the exact source
span it came from.

Supporting line: *One AI product layer for your stack — route requests, ingest and verify
knowledge, and serve agents context you can prove.*

## 2. The category bet: Verified Context

From the June 2026 functionality/competitive review:

- **Routing is a commodity** — LiteLLM, OpenRouter, Portkey-OSS.
- **Graph/memory building is crowded** — Mem0, Zep, Cognee, Microsoft GraphRAG.
- **Output evals are taken** — Braintrust, DeepEval, Promptfoo.
- **Provably trustworthy *context* is an empty category**, with a digital-provenance
  regulatory tailwind.

Restormel's verification spine already enforces this end-to-end: evidence-bound
verification (every claim bound to a quoted span + source-version hash, deterministically
re-checkable), span-scoped cross-model entailment with abstention, a published quality bar
(≥90% supported / ≤2% unsupported), trust scores, and exportable provenance traces.

**The falsifiability test that defines the product:** a skeptical user can click any
"verified" claim through to the quoted span in the source and check it themselves. If
measured efficacy does not support a phrase, the phrase changes — not the measurement.

## 3. Who it's for

| Buyer / user | Job to be done | Why Restormel |
|---|---|---|
| **Teams shipping AI in regulated / high-stakes domains** (legal, pharma, finance, gov) | Ground agents in knowledge they can defend to an auditor | Every answer carries a citation + provenance trace; uncertainty routes to human review, never into the graph |
| **AI product engineers** | Add control (BYOK, routing, budgets, entitlements) without running gateway infra | Keys is the control plane; sits above existing providers/gateways, no rip-and-replace |
| **Platform / ops teams** | Stand up agent-ready knowledge infrastructure without a platform group | Connect: guided ingest → retrieve → verify against a BYO graph store |
| **Agent / IDE builders** | Retrieval that returns citable, verified context over MCP/AAIF | Verified-retrieval MCP tool + AAIF verification envelope |

## 4. The suite

One signed-in workspace at **restormel.dev**. "Route · Ingest · Verify."

| Product | Capability | MVP status | What it is |
|---|---|---|---|
| **Keys** | Route | **Live** | The **control plane for verified context**. BYOK custody, model→provider routing with fallback chains, policies, budgets, entitlements. Routing/BYOK are *supporting* capabilities, not the headline; gateway comparisons are removed, not rebutted. |
| **Connect** | Ingest · Retrieve · Verify | **Live** | The knowledge pipeline carrying the verification spine. Ingest structured corpora, retrieve curated/ranked/citable context, verify claims against source. BYO Surreal/Postgres graph store. |
| **Testing** | Assure | **Flag-off** (`restormel-module-testing`) | CI quality gates for AI behaviour. Real product; not in the MVP marketing/docs default. Docs archived under `docs/archive/testing/` until re-enabled. |
| **Graph** | Visualise | **Flag-off** (`restormel-module-graph`) | Reasoning-graph UI components. Marketing + in-app docs exist behind the flag; see [GRAPH MVP memo](GRAPH-MVP-PRODUCT-MEMO.md). |

MVP defaults are enforced in code: `apps/dashboard/src/lib/module-flags-types.ts`
(`MVP_MODULE_DEFAULTS`: `connect` + `keys` on; `testing`, `graph`, `gatewayProviders`,
`guardrails`, `environments`, `modelPools`, `hostedRuntime` off). Flags are PostHog
`restormel-module-*` (EU project) and `RESTORMEL_MODULE_FLAGS`.

## 5. What we can prove (and therefore say)

Marketing may only assert the `proven` rows of the
[claims ledger](verified-context-claims-ledger.md). As of 2026-06-13 all ten rows are
`proven`, including:

- "Every claim is validated against its source" (omitted/unparseable verdict fails safe).
- "Every supported claim is backed by a verbatim quote you can check yourself."
- "Misattributed claims are caught structurally" (deterministic binding, not model opinion).
- "A different model family checks the extraction" (cross-model routing by default).
- "Published quality bar: ≥90% supported, ≤2% unsupported" (CI-enforced).
- "Uncertainty goes to human review, not into the graph."

Signed-off efficacy bars (product owner, 2026-06-10, re-run weekly in CI): fabricated-tier
recall ≥ 95%, cross-model misattribution recall ≥ 90%, false-flag ≤ 15%, affirm-unseen = 0%
under cross-model routing.

## 6. Competitive framing

- **vs gateways/routers (LiteLLM, OpenRouter, Portkey):** not a competitor — Keys is the
  application/control layer above them. Do **not** ship gateway-vs-Keys comparison tables.
- **vs memory/graph (Mem0, Zep, Cognee, MS GraphRAG):** they build graphs; Restormel makes
  the graph's contents *provable* — evidence-bound, audit-traceable, quality-gated.
- **vs eval tools (Braintrust, DeepEval, Promptfoo):** they evaluate *outputs/prompts*;
  Restormel evaluates and gates the *knowledge/context* (and offers context-regression CI).

## 7. Go-to-market

- **Motion:** invite-only **Founders Circle** while learning (first 50 founding members →
  12 months Pro). PLG / self-serve **before** heavy enterprise (see
  [gtm-plg-enterprise-sequencing](gtm-plg-enterprise-sequencing.md)).
- **Distribution:** MCP-native (verified-retrieval tool + catalog listings), AAIF envelope
  for non-MCP frameworks.
- **Sovereignty angle:** UK/EU self-host (Coolify), BYOK custody, BYO graph store, EU-region
  analytics — a genuine differentiator for regulated buyers.

## 8. Stack (current truth)

UK/EU self-host on **Coolify**; **Forgejo-native** CI (migrated off GitHub Actions/Vercel,
cutover 2026-06-13); **Neon Postgres** (spine) + **BYO SurrealDB** (graph); **PostHog EU**
analytics; **Zuplo** gateway for the Cloud API; **Paddle** billing. See
[ARCHITECTURE.md](../../ARCHITECTURE.md) and [docs/infra/](../infra/).

## 9. Related canonical docs

- [Verified Context claims ledger](verified-context-claims-ledger.md) — what we can prove.
- [Verified Context pivot roadmap](verified-context-pivot-roadmap.md) — delivery + claims-integrity rule.
- [Restormel Connect product brief](CONNECT-PRODUCT.md) — Ingest/Retrieve/Verify.
- [Suite operator model](SUITE-OPERATOR-MODEL.md) — canonical operator vocabulary.
- [Documentation strategy](../governance/documentation-strategy.md) — IA + same-links rules.
- [Monetisation](gtm-plg-enterprise-sequencing.md) · pricing lives at `/keys/pricing`.
