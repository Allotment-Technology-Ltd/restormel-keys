---
id: REC-GOV-022
title: "Restormel Component Menu — Licensing Clearance & Curated Menu (Report B) [PENDING COUNSEL]"
class: governance
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-07-01
last-reviewed: 2026-07-01
review-interval: P6M
retention: review-only
related: [REC-PLAN-026, REC-PLAN-023, REC-ADR-023]
---

> **PENDING COUNSEL — fact-gathering to inform legal review, NOT legal advice.** Every "CLEARED" verdict is a research judgement on public licence/ToS text and **must be confirmed by counsel before launch**. **No component ships to production until counsel returns CLEARED** (gating backlog item — Action #1). The **BLOCKED** set (NV-Embed-v2, Patronus Lynx 8B/70B, Bespoke-MiniCheck-7B, all Jina embeddings/rerankers) and the **AMBIGUOUS** set (lytang MiniCheck, Surya) stay out of managed defaults/swaps until resolved. This record is the **source of truth for the component menu + presets, pending counsel**; on clearance it graduates to a **Tier-2 governed vendor/compliance register** with founder+counsel approval. **Proposed id/placement/status — reconcile at merge; class governance chosen for its compliance/vendor nature, filed at tier 1 while pending.**

# Restormel Component Menu: Licensing Clearance, Value/Quality Assessment & Curated Menu (June 2026)

**This document is fact-gathering to inform legal review. It is NOT legal advice. Every "CLEARED" verdict below is a research judgement on publicly available licence/ToS text and must be confirmed by counsel before launch, with a signed agreement or written vendor confirmation on file.**

## TL;DR
- The safest, best-value backbone for Restormel's commercial verification-SaaS is **permissively-licensed open weights (Apache-2.0 / MIT) for the embedder, reranker and a small entailment checker, paired with a commercially-indemnified hosted API (Anthropic, OpenAI, or Google Vertex) as the independent cross-model verifier** — this clears the third-party-service gate and preserves all four moat invariants without depending on any non-commercial model.
- Several popular components are **BLOCKED** for Restormel's use case because they are non-commercial: **NV-Embed-v2, Patronus Lynx 8B/70B, Bespoke-MiniCheck-7B, the lytang MiniCheck checkpoints, and Jina v3/v4 embeddings & all Jina rerankers (CC-BY-NC-4.0)**. The moat-critical verifier slot must therefore be built on **IBM Granite Guardian (Apache-2.0), Vectara HHEM-2.1-Open (Apache-2.0), Qwen3 (Apache-2.0), or an indemnified frontier API** — never on a non-commercial checkpoint.
- Deployment and jurisdiction are configurable presets, not selection filters: a **Fully-managed/best-value** preset (hosted APIs) is the default; **Highest-accuracy**, **Regional-residency**, and **Self-host/air-gapped** presets re-bundle the same licence-cleared menu. The single biggest open legal question for counsel is the **"who is the licensee on a curated swap"** structuring point (Restormel-as-licensee vs pass-through).

---

## (a) The Licensing Clearance Framework

Because Restormel sells **verification as a hosted, multi-tenant service to third parties**, the bar is stricter than "commercial use allowed". Every candidate model — open-weight or hosted-API — must clear ten tests:

1. **Licence/ToS identity & version** — exact name, version, date, governing clause.
2. **Commercial use** — permitted at all?
3. **Service-to-third-parties / multi-tenant SaaS** — the crux. Many "open"/source-available licences and some API ToS restrict hosted-service, reselling, or competing-service use.
4. **Acceptable-use / prohibited-use policy** — could it bite for regulated-domain verification (legal/medical/financial)?
5. **Scale clauses** — e.g. Llama 700M-MAU; do they touch Restormel or its customers?
6. **Attribution/naming** — "Built with Llama", Gemma notice, copyright notices.
7. **Output/derivative rights** — can verdicts/scores be resold freely? Any bar on using outputs to train/distil Restormel's own checker?
8. **Indemnification** — does the provider offer IP/copyright indemnity?
9. **Data retention / training-on-input** — does the provider train on inputs by default; is ZDR available?
10. **VERDICT** — one of: CLEARED / BLOCKED / NEEDS COMMERCIAL LICENCE / CONDITIONAL (state clause) / AMBIGUOUS — SEEK COUNSEL.

**Decision rule for the moat:** a model may only be a *managed default or curated swap* if it clears tests 1–4 and 7 cleanly under Restormel's own service-provider terms. Models that are commercial-use-OK but service-ambiguous can only be exposed as a **true customer-BYO** (the customer holds the licence), never as a Restormel-operated default.

---

## (b) Per-Model Licence/ToS Audit (with verdicts)

### Verifiers / entailment / LLM-judge (open-weight)

| Model | Licence (version/clause) | Commercial | Service-to-3P | Verdict |
|---|---|---|---|---|
| **IBM Granite Guardian 3.3 8B / 4.1 8B** | Apache-2.0 (HF model card; IBM Granite docs, "released under the Apache 2.0 license for research and commercial use") | Yes | Yes (Apache imposes no field-of-use limit) | **CLEARED** |
| **Vectara HHEM-2.1-Open** | Apache-2.0 (HF `vectara/hallucination_evaluation_model`, License: apache-2.0) | Yes | Yes | **CLEARED** |
| **Qwen3-Embedding / Qwen3-Reranker (0.6/4/8B)** | Apache-2.0 (HF model cards + arXiv 2506.05176, "publicly available under the Apache 2.0 license") | Yes | Yes | **CLEARED** |
| **Patronus Lynx 8B / 70B** | CC-BY-NC-4.0 (HF model cards, License: cc-by-nc-4.0) | **No (NC)** | No | **BLOCKED** (non-commercial) |
| **Bespoke-MiniCheck-7B** | CC-BY-NC-4.0 + custom "Free for non-commercial; commercial licensing contact company@bespokelabs.ai" (License.md) | **No without paid licence** | No | **BLOCKED unless NEEDS COMMERCIAL LICENCE obtained** |
| **MiniCheck DeBERTa-v3 / Flan-T5 / RoBERTa (lytang)** | Built on microsoft/deberta-v3-large, google/flan-t5-large; checkpoints widely used but licence field not cleanly stated — AMBIGUOUS | Unclear | Unclear | **AMBIGUOUS — SEEK COUNSEL** |
| **Llama-based checkers (e.g. fine-tunes on Llama 3/3.1)** | Llama Community Licence (700M-MAU, "Built with Llama", "Llama" name prefix on derivatives) | Yes (<700M MAU) | Yes with attribution | **CONDITIONAL** (attribution + Llama-3-era output-to-train-other-models restriction) |

### Embedders / rerankers

| Model | Licence | Commercial | Service-to-3P | Verdict |
|---|---|---|---|---|
| **BGE / BGE-M3 / BGE-reranker (BAAI)** | MIT (FlagEmbedding repo "licensed under the MIT License"; bge-m3 model card MIT) | Yes | Yes | **CLEARED** |
| **multilingual-e5 / E5 (intfloat)** | MIT | Yes | Yes | **CLEARED** (verify model-card licence field per checkpoint) |
| **NV-Embed-v2** | CC-BY-NC-4.0; NVIDIA HF model card states "This model should not be used for any commercial purpose"; NVIDIA staff (HF discussion #40): "NV-Embed is a research model which employed the non-commercial datasets for training, so we could not declare it's commercial model" | **No** | No | **BLOCKED** |
| **Jina embeddings v3, v4; all Jina rerankers (v2/v3/m0/colbert-v2)** | CC-BY-NC-4.0 (jina.ai + HF; "licensed under CC BY-NC 4.0… for commercial usage inquiries contact us") | **No via weights** | Only via Jina's own API/commercial licence | **BLOCKED as open weights; NEEDS COMMERCIAL LICENCE via Jina API** |
| **Qwen3-VL-Embedding / Qwen3-VL-Reranker** | Apache-2.0 (HF cards) | Yes | Yes | **CLEARED** |

### Extraction / OCR

| Model | Licence | Commercial | Service-to-3P | Verdict |
|---|---|---|---|---|
| **PaddleOCR-VL / PaddleOCR-VL-1.5 (0.9B)** | Apache-2.0 (HF LICENSE file; arXiv 2510.14528 / 2601.21957) | Yes | Yes | **CLEARED** |
| **PaddleOCR (PP-OCRv5 pipeline)** | Apache-2.0 | Yes | Yes | **CLEARED** |
| **Mistral OCR (OCR 3 `mistral-ocr-2512` / OCR 4) — API** | Proprietary "Premier" model under Mistral commercial API ToS | Yes (API) | Yes (API; verify no-compete) | **CLEARED (API) — verify** |
| **Mistral OCR — self-host/on-prem** | Proprietary commercial Mistral licence, "selectively available" via strategic engagement programmes — **NOT Apache-2.0** | Negotiated | Negotiated | **NEEDS COMMERCIAL LICENCE (contact Mistral)** |
| **Docling (IBM)** | MIT (open framework) | Yes | Yes | **CLEARED** (verify current repo licence) |
| **Surya OCR** | Historically GPL/own licence with revenue-threshold commercial terms — AMBIGUOUS | Conditional | Conditional | **AMBIGUOUS — SEEK COUNSEL** |
| **Baidu "Unlimited-OCR"** | Reported MIT, self-hostable 3B | Yes | Yes | **CLEARED — verify model-card licence** |

### Hosted-API provider terms (for any model Restormel calls/offers)

| Provider | Commercial SaaS on API? | No-compete / output-to-train clause | IP indemnity | Verdict |
|---|---|---|---|---|
| **OpenAI (Service Terms 12 Jun 2026; Services Agreement)** | Yes — you own Output; OpenAI assigns rights | No building "AI models that compete with OpenAI" using Output (§ use restrictions); no reselling API keys | Yes — API/Enterprise IP indemnity for Output infringement (conditions apply) | **CLEARED — verify conditions** |
| **Anthropic (Commercial ToS; Jan 2026 updates)** | Yes — Customer owns Outputs; no training on customer content | "may not access the Services to build a competing product or service, including to train competing AI models or resell the Services" | Yes — defends Customer against IP claims on authorised use/Output | **CLEARED — verify "competing service" scope for a verification product** |
| **Google Gemini / Vertex (Service Specific Terms; indemnified-services list updated 20 Jan 2026)** | Yes | No using Generated Output as material input to train competing models | Yes — generated-output IP indemnity for listed GA Gemini models on Vertex (conditions; not pre-GA) | **CLEARED — use only indemnified GA models** |
| **Cohere (Rerank/Embed/Command; VPC + on-prem)** | Yes | Standard no-compete | Enterprise terms | **CLEARED — verify** |
| **Voyage AI / MongoDB Atlas (Embedding & Reranking API, Preview)** | Yes — usage-based; "open for use with any stack" | Standard | MongoDB enterprise terms | **CLEARED — note Preview status** |
| **Mistral API (la Plateforme)** | Yes; EU data residency | Standard | Verify | **CLEARED — verify** |
| **AWS Bedrock / Azure OpenAI / Azure AI Foundry** | Yes — cloud-marketplace terms; indemnity is the cloud provider's | Per-model serverless terms (Anthropic-on-Bedrock no-compete clause applies) | Cloud provider indemnity frameworks | **CLEARED — per-model + cloud terms** |
| **Gemma-based open models (Gemma 1–3, EmbeddingGemma, ShieldGemma)** | Yes — Gemma Terms of Use (last modified 1 Apr 2026) §1.1(b) expressly contemplates "Hosted Service" via API; no revenue cap | Must flow §3.2 use restrictions into customer terms; Google "reserves the right to restrict (remotely or otherwise) usage" | None from Google | **CLEARED — CONDITIONAL on §3.1 flow-down + §3.2 Prohibited Use Policy; Gemma 4 governed by separate licence (verify)** |

**Gemma plain-language clearance (verified against the 1 Apr 2026 Terms):** A company *can* lawfully use a Gemma-based open model (Gemma 1–3 family / EmbeddingGemma / ShieldGemma) to run a paid multi-tenant SaaS. §1.1(b) defines "Distribution" to *include* "providing or making Gemma or its functionality available as a hosted service via API… ('Hosted Service')". Binding conditions: (i) §3.1(1) flow the §3.2 use restrictions (incl. the incorporated Prohibited Use Policy) into customer terms as an enforceable provision and notify users; (ii) §3.1(2) provide recipients a copy of the Agreement; (iii) §3.1(3) mark modified files. The §3.1(4) "Notice" text-file requirement does **not** apply to pure Hosted-Service delivery. Residual risks: Google's §3.2 remote-restriction right, §4.5 termination-on-breach with mandatory deletion, and the fact this is a custom Google licence (not OSI-approved). **Gemma 4 is governed by a separate licence (ai.google.dev/gemma/apache_2) — verify independently if a Gemma-4-family model is used.**

---

## (c) Value + Quality Assessment of the Current June 2026 Field (per slot)

### Extraction / OCR
- **Mistral OCR 4** (released 23 June 2026) is the quality leader: it scored **85.20 on OlmOCRBench and 93.07 on OmniDocBench (top score on both)** with a 72% win rate in blind human evaluation — per Mistral AI's 23 June 2026 announcement: *"Independent annotators preferred OCR 4 over every system tested, averaging 72% win rates."* It adds paragraph-level bounding boxes + page/word confidence scores (excellent for span-bound provenance and abstention signalling), 170 languages, **$4 per 1,000 pages standard / $2 batch** (API). **Mistral OCR 3** (`mistral-ocr-2512`, released 18 Dec 2025) is *"available at an industry-leading price of $2 per 1,000 pages, with a 50% Batch-API discount, reducing the cost to $1 per 1,000 pages"* (Mistral OCR 3 announcement), with a claimed 74% win rate over OCR 2. Self-host is proprietary/negotiated.
- **PaddleOCR-VL-0.9B / 1.5** (Apache-2.0) is the best **value + self-host** option: SOTA on OmniDocBench-OCR-block, 109 languages, runs on modest GPU, zero licence cost. Best QUALITY-for-self-host and best VALUE overall.
- **Best VALUE:** PaddleOCR-VL (self-host, Apache-2.0, free). **Best QUALITY (managed):** Mistral OCR 4 API (bounding boxes + confidence).

### Embedding
- **Qwen3-Embedding-8B** is the best **quality open-weight that is also service-cleared**: per Qwen's official model card/blog (arXiv 2506.05176), *"The 8B size embedding model ranks No.1 in the MTEB multilingual leaderboard (as of June 5, 2025, score 70.58)"*; the paired Qwen3-Reranker-8B scored 69.02 on multilingual ranking. The 0.6B/4B variants give a value ladder, all Apache-2.0.
- **BGE-M3** (MIT) — multilingual, multi-granularity (dense+sparse+ColBERT), 8,192-token, strong value workhorse, fully cleared.
- Hosted: **Voyage voyage-4** series (shared embedding space, domain models for legal/finance/code), **Cohere Embed v4** (multimodal), **OpenAI text-embedding-3-large**, **Google gemini-embedding** — all API-cleared.
- **Best VALUE:** BGE-M3 (MIT, free, self-host) or voyage-4-lite (hosted, $0.02/1M). **Best QUALITY:** Qwen3-Embedding-8B (open) or a domain Voyage model for regulated verticals.

### Reranking
- **Qwen3-Reranker (0.6/4/8B)**, Apache-2.0 — cleared, strong, self-hostable; the best **moat-preserving** reranker because it is service-cleared and offset-transparent.
- **BGE-reranker** (MIT) — value workhorse.
- Hosted: **Cohere Rerank v3.5** ($0.001–$0.002/search; v3.5 released 5 Apr 2026) and **Voyage rerank-2.5/2.5-lite** — both API-cleared and strong; **all Jina rerankers are BLOCKED as weights (CC-BY-NC).**
- **Best VALUE:** BGE-reranker / Qwen3-Reranker-0.6B (free, self-host). **Best QUALITY:** Cohere Rerank v3.5 (hosted) or Qwen3-Reranker-8B (open).

### Verification / entailment (the moat slot)
- **IBM Granite Guardian 3.3 8B** (Apache-2.0): per the ibm-granite/granite-guardian README (Sept 2025), *"Granite-Guardian-3.3 has secured the 3rd position on the LLM-AggreFact benchmark… Granite Guardian 3.3 8B also holds the #1 position on the REVEAL benchmark… outperforms much larger models such as gpt-4o and Mistral Large 2."* Purpose-built RAG groundedness + function-call hallucination checks. **Best cleared open verifier.** Granite Guardian 4.1 8B (Apr 2026) adds Bring-Your-Own-Criteria.
- **Vectara HHEM-2.1-Open** (Apache-2.0): per Vectara's HF model card, *"HHEM-2.1-Open can be run on consumer-grade hardware, occupying less than 600MB RAM space at 32-bit precision and elapsing around 1.5 second for a 2k-token input on a modern x86 CPU"* (built on FLAN-T5, ~110M params) — an excellent cheap first-stage in a verifier cascade. The hosted HHEM-2.3/FCS is stronger (11 languages, longer context) and is delivered as commercial SaaS.
- **BLOCKED for default/swap:** Patronus Lynx (CC-BY-NC); Bespoke-MiniCheck-7B — per Bespoke Labs, *"this model tops the LLM-AggreFact leaderboard with 77.4% on the benchmark. Vectara's HHEM 2.1… gets only 71.8%… beats the performance of much larger models, such as Claude 3.5 Sonnet,"* but is *"made available on HuggingFace for non-commercial use"* (commercial requires a paid Bespoke licence); lytang MiniCheck (ambiguous).
- **Cross-model independent verifier (frontier tier):** an indemnified API from a **different family** than the extraction/generation model — Claude (Anthropic), GPT-5-class (OpenAI), or Gemini (Vertex). This satisfies invariant (1) cross-model independence with IP indemnity.
- **Best VALUE:** HHEM-2.1-Open (free, CPU) as cascade stage 1 → Granite Guardian as stage 2. **Best QUALITY:** frontier API judge (Claude/Gemini/GPT-5) as the escalation tier, with abstention-to-human on uncertainty.

### Storage
- Vector store choice is licence-light (most are open-source Apache-2.0/MIT: e.g. Postgres+pgvector, Qdrant, Milvus). Quantised storage and hash-keyed verdict caching are infrastructure, not models — no third-party-service licence risk. Verify the specific DB licence (some have BSL/source-available tiers) before defaulting.

### Indicative current prices (inputs to value comparison)
- **OCR:** Mistral OCR 4 $4/1k pages ($2 batch); OCR 3 $2/1k ($1 batch); PaddleOCR-VL self-host (GPU only).
- **Rerank:** Cohere Rerank v3.5 ~$0.001/search; Voyage rerank-2.5 token-based (first 200M tokens free).
- **Embedding (hosted, input-only):** Cohere Embed v4 ~$0.12/1M; Voyage voyage-4-large $0.12/1M, voyage-4 ~$0.06/1M, voyage-4-lite $0.02/1M (first 200M free); OpenAI text-embedding-3-large ~$0.13/1M (⚠ see caveat — OpenAI's live pricing page has shown $0.065/1M; verify directly), 3-small $0.02/1M; Google gemini-embedding-001 $0.15/1M.
- **Mid-tier LLM judge APIs:** Mistral Large 3 $0.50/$1.50 per 1M; Cohere Command R $0.15/$0.60. Frontier judges (GPT-5-class, Claude Opus, Gemini 3 Pro) priced materially higher; use only in the escalation tier.
- **Self-host GPU:** a single A6000 (48GB) runs a 7–8B checker; the cheap→expensive verifier cascade keeps frontier-API calls to the uncertain minority.

---

## (d) The Curated Component Menu (default + 1–3 alternatives per slot)

**Extraction / OCR**
- **Default:** PaddleOCR-VL (Apache-2.0, self-host/managed) — best value, cleared, bounding boxes for span provenance.
- *Highest accuracy:* Mistral OCR 4 API — "when documents are complex/multilingual and you want confidence scores + boxes managed."
- *Cheapest:* PaddleOCR PP-OCRv5 pipeline — "when layouts are simple and volume is high."
- *Regional/self-host:* PaddleOCR-VL on-prem — "when documents can't leave your environment."

**Embedding**
- **Default:** BGE-M3 (MIT) — best value, multilingual, cleared.
- *Highest accuracy:* Qwen3-Embedding-8B (Apache-2.0) — "when retrieval quality is the bottleneck."
- *Cheapest hosted:* voyage-4-lite ($0.02/1M) — "when you want zero infra and low spend."
- *Domain:* Voyage voyage-law/finance or voyage-code — "for legal/finance/code corpora."

**Reranking**
- **Default:** Qwen3-Reranker-4B (Apache-2.0) — cleared, strong, self-hostable.
- *Highest accuracy:* Cohere Rerank v3.5 (hosted) — "when you want managed top-tier precision."
- *Cheapest:* BGE-reranker / Qwen3-Reranker-0.6B — "high volume, tight budget."

**Verification / entailment (moat)**
- **Default:** Granite Guardian 3.3/4.1 8B (Apache-2.0) as the primary checker, **from a different model family than the extractor/generator**, with HHEM-2.1-Open as a cheap cascade pre-filter and frontier-API escalation on uncertainty → abstain-to-human.
- *Highest accuracy:* frontier independent judge (Claude / Gemini GA / GPT-5-class) with IP indemnity — "regulated, high-stakes verification."
- *Cheapest:* HHEM-2.1-Open only (CPU) — "low-risk, high-volume, cost-sensitive."
- *Self-host/air-gapped:* Granite Guardian + Qwen3 + HHEM-2.1-Open, all Apache-2.0 — "no external calls permitted."

**Every menu item above clears tests 1–4 and 7 OR is an indemnified API; each preserves the four invariants: (1) the checker family ≠ generator family; (2) OCR/embedder retain offset/box data for verbatim-span + version-hash binding; (3) uncertain → abstain-to-human; (4) the ≥90%/≤2% bar is validated by the weekly CI gate, never assumed.**

---

## (e) Deployment / Sovereignty Presets

| Preset | Bundle | Jurisdiction fit |
|---|---|---|
| **Fully-managed / best-value (DEFAULT)** | PaddleOCR-VL or Mistral OCR API + BGE-M3/voyage-4-lite + Cohere Rerank v3.5 + Granite Guardian, frontier API escalation | Global; US (note FedRAMP requires the API endpoints themselves be authorised) |
| **Highest-accuracy** | Mistral OCR 4 + Qwen3-Embedding-8B + Cohere Rerank v3.5 + frontier indemnified judge | Global commercial; regulated verticals with human-in-loop |
| **Regional-residency** | EU: Mistral OCR (EU residency) + open weights on EU sovereign cloud; mirror for Gulf/India DPDP/Australia IRAP/Japan/Canada | EU (GDPR/EU AI Act), UK, Gulf, India DPDP, Australia IRAP, Japan, Canada — served by Apache/MIT weights on in-region compute |
| **Self-host / air-gapped** | PaddleOCR-VL + BGE-M3/Qwen3-Embedding + Qwen3-Reranker + Granite Guardian + HHEM-2.1-Open — all Apache-2.0/MIT, zero external calls | US defence (IL4-5), air-gapped, China (avoid US-API dependency; all-open stack) |

All-open-weight stacks (Apache-2.0/MIT) are the enabler for the strict-residency and air-gapped presets because they carry no per-call dependency and no field-of-use restriction. Hosted-API presets deliver the best value/quality for the global default but require the specific endpoint to hold the relevant regional authorisation (e.g. FedRAMP, IRAP).

---

## (f) Cross-Cutting "Who is the Licensee on a Curated Swap?" (for counsel)

When a Restormel customer selects a model from the curated dropdown inside Restormel's managed pipeline, this is **not true BYO** — Restormel still operates the model. Therefore **Restormel is the licensee/operator**, and **Restormel's service-provider terms with that model's vendor must clear the multi-tenant, third-party-service use**. Counsel should:
- For open weights (Apache-2.0/MIT): confirm field-of-use freedom (these impose none) — safe to expose as a curated option.
- For Llama/Gemma custom licences: confirm attribution + flow-down obligations are met in Restormel's customer terms (Gemma §3.1 flow-down + Prohibited Use Policy; Llama "Built with Llama") — exposable with conditions.
- For hosted APIs (OpenAI/Anthropic/Google/Cohere/Voyage/Mistral): confirm Restormel's own commercial agreement permits offering the API-backed capability to Restormel's customers, and that the indemnity flows to the configuration actually used.
- For non-commercial weights (CC-BY-NC) or paid-commercial models (Bespoke): expose **only as true customer-BYO** where the customer holds the licence, or not at all.

A model is **safe to expose as a curated option** when Restormel-as-operator is cleared for multi-tenant third-party service; it is **BYO-only** when clearance depends on the end customer's own licence.

---

## (g) Honest Risks — what must go to counsel before launch
1. **Non-commercial traps already in the field:** NV-Embed-v2, Patronus Lynx, Bespoke-MiniCheck, all Jina embeddings/rerankers — must be kept out of managed defaults/swaps. Bespoke and Jina offer paid/commercial routes (NEEDS COMMERCIAL LICENCE).
2. **MiniCheck (lytang) and Surya OCR licence ambiguity** — AMBIGUOUS, do not ship until counsel confirms.
3. **Mistral OCR self-host** is proprietary/negotiated, not Apache-2.0 — the API is cleared but on-prem requires a Mistral commercial agreement; do not assume open weights.
4. **Hosted-API "no competing service" clauses** (Anthropic, OpenAI, Google) — a *verification* service is plausibly not "competing", but counsel must confirm that using these models as the independent judge inside a paid verification SaaS is within terms, and that the IP indemnity covers the actual configuration (GA models only; not pre-GA/beta).
5. **Gemma's remote-restriction right and mandatory Prohibited-Use flow-down** — acceptable but a residual operational risk; confirm Gemma 4 (separate licence at ai.google.dev/gemma/apache_2) status if used.
6. **The ≥90%/≤2% quality bar is a target to validate, not a verified fact** — the weekly CI gate must measure it on Restormel's own data; vendor benchmark claims (LLM-AggreFact, OlmOCRBench, OmniDocBench, MTEB) are corroborating, not sufficient.
7. **Data-residency + sub-processor obligations** (GDPR DPA, SCCs) when hosted APIs process customer data — required for the managed presets.
8. **Voyage Embedding/Reranking API is in Preview** — terms may change; treat as provisional.
9. **Vectara hosted HHEM/FCS API commercial terms** — intended for customer apps per Vectara docs, but the binding API/subscription clause was not obtained from public text; request Vectara's Master Subscription Agreement before relying on the hosted FCS in a managed preset. (HHEM-2.1-Open weights are separately Apache-2.0 and safe to self-host.)
10. **OpenAI text-embedding-3-large price discrepancy** — third-party trackers show $0.13/1M while OpenAI's live page has shown $0.065/1M; verify the live embeddings table before publishing customer-facing pricing.

---
*Recency note: prioritised June 2026 sources throughout (Mistral OCR 4 of 23 Jun 2026; Cohere Rerank v3.5 of 5 Apr 2026; Gemma Terms of 1 Apr 2026; OpenAI Service Terms of 12 Jun 2026; Google indemnified-services list of 20 Jan 2026). Pre-2026 evidence is flagged inline (e.g. Qwen MTEB ranking "as of June 5, 2025"; Granite Guardian benchmark "Sept 2025"). All licence/price facts should be re-verified at contract signature, as terms and prices in this field change frequently.*
