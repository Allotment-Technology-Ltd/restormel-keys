---
id: REC-PLAN-017
title: "Verified Context — market positioning & backlog-prioritisation basis (mid-2026)"
class: planning
owner: adam
status: approved
classification: internal
control-tier: 2
created: 2026-06-26
last-reviewed: 2026-06-26
review-interval: P6M
approved-by: adam
approved-on: 2026-06-26
retention: P6Y-after-superseded
---

# Verified Context — market positioning & backlog-prioritisation basis (mid-2026)

**Purpose.** Records the external competitive/market research + repo-strategy synthesis (conducted 2026-06-26) that underpins Restormel's "Verified Context" positioning, and the RICE prioritisation it drove in the 2026-06-26 RES backlog review (96 issues). It is the durable basis for "why these priorities" so the next review re-runs against a written baseline rather than re-derives. Source-of-truth for strategy remains `docs/product/positioning.md` + the claims ledger; this record is the *market evidence* layer.

## Thesis
"Verified Context" — provenance-traced, quality-gated, evidence-bound knowledge an agent (or its auditor) can trace to the exact source span — sits in the **one large, well-funded category with no horizontal leader**: span-level citation/grounding verification + audit-grade sovereign provenance. The strategic shape: two layers of the stack are commoditising (LLM routing/BYOK, basic memory store/retrieve), two are hot with no winner (citation/source-span verification, sovereign audit-grade provenance). Lead with verification + sovereignty; treat Keys/routing as moat-by-bundling, not the headline; bet on MCP, hold A2A.

## 1. Competitive landscape
- **LLM gateways — commoditised, consolidating.** BYOK + multi-provider routing is table-stakes; hyperscalers (Vercel, Cloudflare) charge 0-markup on BYOK. Consolidation: **Portkey → Palo Alto Networks** (Apr–May 2026, folded into Prisma AIRS), **Helicone → Mintlify**. OpenRouter raised to ~$1.3B (CapitalG, May 2026). LiteLLM is the OSS default but commercially small. Value is migrating to governance/sovereignty, not routing breadth.
- **Memory / graph — funded, fragmented, no provenance.** Mem0 ($24M; AWS Agent SDK memory provider), Cognee ($7.5M, self-host-first, BYO backend), Letta, Zep/Graphiti. MS LazyGraphRAG cuts GraphRAG cost toward mainstream. **None offer cryptographic/span-level provenance** — a white space.
- **Eval / observability — crowded, consolidating.** Braintrust ($80M @ $800M, the CI-gating leader), **Promptfoo → OpenAI**, **Humanloop → Anthropic**, **Langfuse → ClickHouse**, LangChain $1.25B. These test *behaviour*, not *citation faithfulness*. A grounding-regression gate is open.
- **Provenance / grounding / citation-verification — HOT, no horizontal leader (the key finding).** 57% of RAG citations are post-hoc rationalisation; up to 27% point to the wrong passage. The best assets are split across vendors (Vectara HHEM, Patronus Lynx/HaluBench, Cleanlab TLM, Contextual GLM, Galileo Luna-2) — none unified into a category-defining product; source-span/claim-level citation is still research-stage (LongCite, VeriCite). Gaps a sovereignty-friendly product could own: self-hostable *verification* (not just RAG), source-span citation as a product, audit-grade exportable grounding evidence, and a CI grounding-regression gate.
- **MCP-security gateways — crowded + funded** (Lasso, Runlayer, Operant, Helmet; Cloudflare/Kong/Tyk bundle free). A verifying proxy must differentiate on verification, not generic security.

## 2. Regulatory & sovereignty tailwinds
- **EU AI Act:** Art. 50 transparency/text-marking from **Aug 2026** (nearest hard date); Art. 12 mandates lifecycle event-logging incl. who verified results. The Digital Omnibus (agreed May 2026) **deferred** high-risk Annex III to **Dec 2027** — a postponement, not a weakening; the provenance/traceability direction is firmly confirmed. Draft ISO/IEC 24970 (AI logging) emerging.
- **C2PA v2.3 (Dec 2025)** added manifests for unstructured text → content-provenance now extends to LLM output; "provenance that survives distribution" is unsolved.
- **Sovereignty** is the strongest *structural* tailwind: 61% of Western-European CIOs prioritise local providers; CLOUD Act means a US region ≠ sovereignty; **BYOK is now a procurement requirement** and a Schrems II transfer remedy.
- **Regulated RAG-trust pain is acute:** legal hallucinated-citation cases 1,227 (early 2026, +5–6/day, sanctions rising); finance SR 11-7 applied to GenAI/RAG; pharma 21 CFR Part 11 + draft EU Annex 22. Recurring demand: **passage-level source attribution** for auditors.

## 3. Ecosystem (MCP & A2A)
- **MCP is dominant + standardised** — donated to the Linux Foundation Agentic AI Foundation (Dec 2025); ~97M monthly SDK downloads; native in OpenAI/Google/Microsoft/AWS. Production servers ~1,300–2,000 (marketplace counts inflated). The safe distribution bet.
- **A2A is real but secondary** — 150+ orgs, broad cloud integration, but logo-adoption not deep production; solves a later-stage cross-org delegation problem. **Lead with MCP, add A2A only on buyer pull.**

## 4. Pricing
BYOK is monetised as a control-plane / % fee, not token markup (OpenRouter 5%, Vercel 0). Seat-based pricing is under pressure in dev-infra, but regulated verticals pay large per-seat sums (Harvey ~$1,200/lawyer/mo). The enterprise premium lives in **compliance + sovereignty + air-gap** (Langfuse Enterprise $2,499/mo; LiteLLM ~$30k/yr).

## 5. Prioritisation implications (drove the 2026-06-26 RES RICE review)
**UP (prioritise — High):**
1. Connect **verify** stage — span-level, claim-to-source citation verification (the spearhead; no horizontal leader).
2. Audit-grade, exportable grounding-evidence (EU AI Act Art. 12; the bridge to mandated compliance budget).
3. Sovereignty / self-host / BYOK-custody as a first-class, *marketed* capability.
4. Testing **grounding-regression CI gate** ("did grounding degrade in this PR?").
5. Door-1 first-party verified-retrieval MCP (lowest-friction distribution).

**DIFFERENTIATE-ONLY / DOWN (Medium/Low):** Keys-as-standalone-gateway (routing commodity — keep Keys as the BYOK-custody/governance/sovereignty control plane, control-plane-fee pricing); **Door-2 verifying-MCP-proxy** (crowded — build only as an extension of the Door-1 engine, lead with verification not security, **sequence after Door-1**); generic eval/observability (avoid); basic memory store/retrieve (integrate Cognee, add provenance).

**HOLD:** Door-3 A2A (thin spec-tracking slice until a buyer pulls); model-catalogue advisory (bundle into Keys, don't lead).

**Sequencing:** Q1 — Connect verify span-level + provenance export, self-hostable, with one regulated design partner (legal wedge given the sanctions wave). Q1–Q2 — Door-1 MCP + Keys repositioned as the BYOK-custody/sovereignty control plane. Q2 — Testing grounding gate. Q2–Q3 — Door-2 as a Door-1 extension. Ongoing — Graph as evidence/provenance visualisation. Hold — A2A.

## The two sentences for the backlog meeting
- Build the thing nobody owns (self-hostable, audit-grade, span-level citation verification) and wrap it in the thing buyers are now mandated to procure (EU-sovereign, BYOK-custody provenance), distributed first through the dominant ecosystem (MCP, Door-1).
- Stop competing where you'd lose (routing breadth, generic eval, generic MCP security, memory store/retrieve): keep Keys, Door-2, Testing and the catalogue as differentiated *support* for the verification spearhead, and hold A2A until a buyer pulls it.

---
*Caveats: market-size dollar figures vary by firm (treat CAGRs as the signal, not absolutes); the EU high-risk deadline deferral takes legal effect only on Official Journal publication (Art. 50 text-marking ~Aug 2026 is the nearest hard date); MCP production-server count ~1,300–2,000 (marketplace totals inflated). Load-bearing claims (Portkey→Palo Alto, Promptfoo→OpenAI, the Digital Omnibus deferral, OpenRouter $1.3B) were verified against primary sources. `records/register.yaml` is generated by `scripts/records/register.mjs` — regenerate it after this record lands; do not hand-edit.*
