---
id: REC-PLAN-023
title: "Re-Architecting Restormel's Ingestion Pipeline — Cost Architecture (Report A)"
class: planning
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-07-01
last-reviewed: 2026-07-01
review-interval: P6M
retention: review-only
related: [REC-PLAN-022, REC-GOV-022, REC-ADR-008]
---

> **Filing caveat (per handover brief).** This report's cost **architecture** — the cheap->expensive verifier cascade, hash-keyed verdict caching, and verify-at-ingest ("the moat is the cost-mechanism") — **stands, and is now extended to dual-mode by the ingest-connector ADR (REC-ADR-008).** Its component **picks are superseded by the licensing/component-menu report (REC-GOV-022)**, were EU/UK-self-host-biased, and contained a non-commercial licensing error (NV-Embed-v2 is CC-BY-NC, not commercial). Read the architecture as current; do not treat the specific component selections here as cleared. **Proposed id/status — reconcile at merge.**

# Re-Architecting Restormel's Ingestion Pipeline: Cutting Cost-to-User While Preserving the Verification Moat

*Extended research report · June 2026 · UK spelling · Note on status: this report's cost **architecture** (cascade + verdict caching + verify-at-ingest) stands and has been extended to dual-mode by the ingest-connector ADR; its component **picks** are superseded by the later licensing/component-menu report (report B) and were EU/UK-self-host-biased, including one non-commercial error (NV-Embed-v2). File with this caveat attached.*

## TL;DR
- **The biggest cost lever is the moat itself, not the substrate.** Restormel can move commodity extraction, embedding and storage to BYO/OSS/self-host today at near-zero quality loss, but the durable win is replacing frontier LLM-as-judge entailment with a small, *independent*, *permissively-licensed* self-hostable checker. The cleanest candidate is **IBM Granite Guardian 3.3 8B** (Apache 2.0; per IBM's official repo, github.com/ibm-granite/granite-guardian, Sept 2025: "secured the 3rd position on the LLM-AggreFact benchmark… it outperforms much larger models such as gpt-4o and Mistral Large 2" and holds "the #1 position on the REVEAL benchmark"; a different model family from GPT/Claude/Gemini/Llama/Mistral/Qwen) used inside a cheap→expensive cascade with hash-keyed verdict caching.
- **Two of the most famous verifiers are licence-blocked.** Patronus Lynx (8B/70B, CC-BY-NC-4.0) and Bespoke-MiniCheck-7B (custom non-commercial licence) cannot be commercially self-hosted as-is; Lynx also fails cross-model independence if Restormel's customers generate with Llama. Recommend Granite Guardian + HHEM-2.1-Open + DeBERTa/Flan-T5 MiniCheck (all Apache-2.0/MIT) instead.
- **A leaner architecture creates real headroom.** Self-hosted OSS extraction/embedding runs at roughly $0.001/page and ~$0.005/1M embedding tokens versus $2–4/1k pages (Mistral OCR 4) and $0.12/1M tokens (Cohere Embed v4); caching plus a cascade can cut moat-core entailment COGS by an order of magnitude. But every cheaper component must be validated against the published ≥90% supported / ≤2% unsupported bar on representative legal/pharma/finance corpora before replacement — the small-checker quality gap on hard, ambiguous spans is the principal risk.

## Key Findings

1. **Specialised small verifiers now rival frontier LLM-judges on the narrow "does this span support this claim?" task — but with caveats.** On LLM-AggreFact (11 datasets; figures confirmed against the public leaderboard and reproduced in HalluGuard, arXiv 2510.00880, Table 1), Bespoke-MiniCheck-7B leads at 77.4% average, *ahead of* Claude-3.5 Sonnet (77.2%) and GPT-4o (75.9%), with Granite Guardian 3.3 8B at 76.5%, FactCG-DeBERTa-L (0.4B) at 75.6% and MiniCheck-Flan-T5-L (0.8B) at 75.0%. The absolute numbers (~77%) show no checker is "solved" — and on the adversarial FaithBench (Bao et al., NAACL 2025, arXiv 2410.13210), "even the best hallucination detection models have near 50% accuracies," with 62.31% the highest balanced accuracy any detector achieved (random guess = 50%).

2. **Licence and model-family independence disqualify the two best-known names.** Patronus Lynx is CC-BY-NC-4.0 (non-commercial) and built on Llama-3/3.1; Bespoke-MiniCheck-7B carries a custom non-commercial licence ("free for non-commercial purposes; commercial licensing requires contacting Bespoke Labs"). The permissively-licensed, family-independent options are Granite Guardian 3.3 8B (Apache 2.0, IBM Granite), HHEM-2.1-Open (Apache 2.0, FLAN-T5), FactCG-DeBERTa-L and MiniCheck-DeBERTa/RoBERTa/Flan-T5 (MIT).

3. **Caching is the cheapest, lowest-risk lever and maps perfectly onto Restormel's source-version hashing.** Exact-match verdict caching keyed by (claim-hash, source-span-hash, source-version-hash) carries zero correctness risk and invalidates precisely when a source changes. Semantic caching tools report 60–80% hit rates but carry a 1–15% false-positive risk that is unacceptable for the moat-core verdict without a shadow-eval loop.

4. **The substrate is genuinely commoditised in 2026.** Mistral OCR 4 (released 23 June 2026) emits paragraph-level bounding boxes + per-word confidence and self-hosts in one container — ideal for span provenance and ingest-time abstention. Open-weight embedders (Qwen3-Embedding-8B, BGE-M3) now match or beat commercial APIs on MTEB and self-host on a single GPU. pgvector + pgvectorscale with binary quantisation cuts storage 8–32× while holding recall.

5. **Cross-model independence is a structural constraint, not a tuning knob.** Whatever generates/extracts content, the checker must be a different family. Granite (IBM) and DeBERTa/T5-based checkers are independent of all common generation/extraction families; Lynx (Llama) is not.

## Details

### (a) The cheap / independent / self-hostable verification-checker landscape + recommendation

**The task.** Restormel's moat-core inference is claim-to-source entailment / groundedness scoring — formally textual entailment / NLI. This is exactly the task that specialised sub-10B and even sub-1B models now do near frontier quality, at a fraction of the cost.

**2026 field (independent benchmark: LLM-AggreFact leaderboard, MiniCheck/EMNLP 2024; licence/architecture facts from official HuggingFace model cards and vendor repos, retrieved June 2026):**

| Model | Size | Licence (commercial self-host?) | Base family (independence) | LLM-AggreFact avg | Self-host hardware |
|---|---|---|---|---|---|
| Bespoke-MiniCheck-7B | 7B | Custom **non-commercial** (contact Bespoke for commercial) | InternLM2.5 (independent) | **77.4** | A6000 48GB, >500 docs/min, ~200ms (vendor) |
| Granite Guardian 3.3 8B (IBM) | 8B | **Apache 2.0** | IBM Granite (independent) | 76.5 | single ~16–20GB GPU |
| FactCG-DeBERTa-L | 0.4B | **MIT** | DeBERTa (independent) | 75.6 | CPU-capable |
| MiniCheck-Flan-T5-L | 0.8B | **MIT** | FLAN-T5 (independent) | 75.0 | <2GB, CPU-capable |
| Patronus Lynx 8B | 8B | **CC-BY-NC-4.0 (non-commercial)** | Llama-3/3.1 (**not** independent of Llama) | (HaluBench-focused) | ~16GB VRAM |
| Patronus Lynx 70B | 70B | **CC-BY-NC-4.0** | Llama-3 (**not** independent) | 87.4% HaluBench | ~140GB fp16 / ~40GB Q4 |
| Vectara HHEM-2.1-Open | ~110M | **Apache 2.0** | FLAN-T5-base (independent) | ~67% (RAG faithfulness avg) | CPU, <600MB RAM, ~1.5s/2k tokens |
| Vectara HHEM-2.3 | n/a | Commercial, **API-only** | proprietary | — | hosted only |
| Galileo Luna-2 | 3B/8B | Commercial (enterprise) | Llama/Mistral/Qwen backbones | "matches frontier judges" (vendor) | single GPU, <200ms |

Vendor-claim flags: Galileo Luna-2 figures ("over 80× lower inference cost, over 20× lower latency, matches SOTA LLM evaluators", arXiv 2602.18583, Feb 2026) are self-reported and the paper has no verified maintained reproduction. Bespoke's headline ("tops the LLM-AggreFact leaderboard with 77.4%… Vectara's HHEM 2.1… gets only 71.8%… responds in about 200 milliseconds on modern GPUs", bespokelabs.ai/bespoke-minicheck) is its own blog. The LLM-AggreFact leaderboard itself is an independent academic aggregation.

**The quality gap, honestly stated.** On the *narrow* span-entailment task, the gap between a small checker and a frontier judge is small — sub-1B FactCG (75.6) is within ~2 points of GPT-4o (75.9) and Claude-3.5 Sonnet (77.2). But three caveats matter for a ≥90%/≤2% bar: (1) the absolute ceiling on hard datasets is ~77%, far below 90% — meaning the bar is only reachable *with abstention* routing the ambiguous tail to humans; (2) on adversarial FaithBench even the best detectors approach 50% (62.31% ceiling); (3) ExpertQA (~59% across all models on LLM-AggreFact) shows expert-domain claims are the hardest, and the Stanford RegLab study (Journal of Empirical Legal Studies, 2025) found production legal RAG still hallucinated — LexisNexis Lexis+ AI on 17% and Thomson Reuters Westlaw AI-Assisted Research on roughly 33% of queries. So "good enough to hold the bar" is plausible **only** as: cheap independent checker + calibrated abstention + human review of the uncertain tail — not as a standalone verdict.

**Cheapening entailment without losing rigour — cascade/triage.** The literature is mature: FrugalGPT-style cascades, RouteLLM, "Cost-Saving LLM Cascades with Early Abstention" (arXiv 2502.09054, which trades +4.1% abstention for −13.0% cost and −5.0% error), and UCCI calibrated cascade routing (arXiv 2605.18796, 2026). Recommended design: a cheap pre-filter (DeBERTa/Flan-T5 MiniCheck, CPU) produces a calibrated score; high-confidence supported/unsupported verdicts are accepted; only the ambiguous band escalates to the 8B Granite Guardian check; residual uncertainty abstains to human. This preserves cross-model independence (both stages independent of the generation family), preserves abstention, and is validated against the bar.

**Recommendation.** Ship a **self-hostable entailment checker built on Granite Guardian 3.3 8B (Apache 2.0)** as the moat-core default, with a CPU-tier DeBERTa/Flan-T5 MiniCheck pre-filter, and offer it as a licensed component that runs in customer infra — moving inference COGS to the customer (near-zero marginal COGS for Restormel, licence-based pricing). **Do not** ship Lynx or Bespoke-MiniCheck-7B in a commercial product without separate licences, and never pair Lynx with a Llama generator (independence breach). HHEM-2.1-Open (CPU, <600MB RAM, Apache 2.0) is an excellent ultra-cheap pre-filter or fallback where a tiny footprint matters.

### (b) Caching / verification-reuse techniques + expected cost impact

Restormel already hashes source versions, which is the exact key needed for safe verdict reuse. Three layers:

- **Exact-match verdict cache (recommended, zero risk).** Key = hash(claim_text + source_span + source_version_hash + checker_model_version). On a cache hit the verdict is deterministically valid; on source change the hash changes and the verdict invalidates automatically. This is the memoised-evaluation / self-adjusting-computation pattern: when a source document changes, only chunks whose span-hash changed need re-verification, and staleness propagates to dependent claims via the version field (the "stable ids + versioning + tombstones" invariant from incremental-indexing practice — Unstructured.io, 2026).
- **Provider prompt caching** (if any API judge is retained for spot checks): Anthropic 90% off cache reads, OpenAI automatic ~50%+ at ≥1,024 tokens. Stacking caching + 50% batch discounts can drop a complex call to ~25% of standard.
- **Semantic cache (use with caution).** GPTCache/Redis LangCache report 60–80% hit rates and up to 73% cost reduction, but semantic matching carries 1–15% false-positive risk depending on threshold. For the moat-core verdict, a false cache hit is a silent unsupported claim — disqualified unless gated by a shadow-eval loop and a conservative (≥0.97) threshold.

**Expected impact.** For slowly-changing corpora (legal/regulatory/pharma reference docs), exact-match verdict reuse on re-ingest or re-query should reach very high hit rates because the same spans recur across queries and document versions; for rapidly-changing corpora the hit rate falls and incremental re-verification dominates. Net: caching is the single cheapest way to cut the entailment bill, fully preserves all four invariants, and should be built first.

### (c) Extraction connector options (OSS vs commercial vs self-host)

| Tool | Licence / self-host | Bounding boxes + confidence? | Quality (2026) | Sovereignty |
|---|---|---|---|---|
| **Mistral OCR 4** (23 Jun 2026) | Commercial; **single-container self-host** (enterprise) | **Yes** — paragraph bbox + per-word confidence + block types | OlmOCRBench 85.20 (vendor; ~3rd on public board behind Infinity-Parser2-Pro 87.6 and Chandra-2 85.9); OmniDocBench 93.07; 170 languages | EU (Paris); self-host keeps data in customer infra |
| PaddleOCR-VL (0.9B + PP-DocLayoutV2) | Open-weight | Layout model emits bbox + element types | OmniDocBench v1.6 96.3 (vendor self-reported, not independently reproduced) | Self-host anywhere |
| Baidu Unlimited-OCR | **MIT**, open-weight | layout/box output | OmniDocBench v1.6 ~93.9; 40+ page one-pass | Self-host; no SLA |
| Surya OCR 2 (Datalab, 650M) | Open-weight | yes | olmOCR-Bench ~83 | Self-host, runs anywhere |
| IBM Docling | OSS | structured layout output | OmniDocBench ~0.75 edit (weaker on tables) | Self-host |
| Google Document AI / Amazon Textract / Azure DI | Commercial API | yes | strong | **US-jurisdiction SaaS** (sovereignty risk) |
| Unstructured.io / LlamaParse | OSS / hosted | varies; LlamaParse publishes no standard bench | RAG-ingestion oriented | mixed |

**Key for the moat:** span-bound provenance requires the extractor to emit offsets/bounding boxes so chunk-to-source-span anchoring is deterministic, and confidence scores so ingest-level abstention can route low-confidence pages to humans. Mistral OCR 4 and the PaddleOCR-VL/Baidu/Surya open-weight line all satisfy this; plain text-dump OCR (legacy Tesseract-style) and opaque auto-chunking that discards offsets must be flagged as provenance risks. For the EU-sovereign path, Mistral OCR 4 self-host or PaddleOCR-VL/Baidu self-host keep documents out of US jurisdiction. Cost: Mistral OCR 4 is $4/1k pages ($2 batch, $5 for Document AI structured output); open self-host is ~$0.001/page in compute but ops costs flip the math below ~50k pages/month.

### (d) Embedding / retrieval connector options

**API leaders:** Voyage voyage-4-large (MoE, top of Voyage's own RTEB; +8.2% over Cohere Embed v4 and +14% over OpenAI text-embedding-3-large on NDCG@10 per Voyage; $0.12/1M, nano is free Apache 2.0), Cohere Embed v4 ($0.12/1M, 128K context, multimodal, binary quantisation), Gemini Embedding (English MTEB #1 ~68.3). **Voyage is API/Atlas-only and MongoDB-owned (US jurisdiction)** — a sovereignty constraint for EU self-host.

**Best self-hostable (sovereign path):** Qwen3-Embedding-8B (Apache 2.0, MTEB multilingual 70.58, 32K context, dims 32–4096, first-class vLLM/SGLang support; ~5GB at Q4) is the first-choice open embedder and beats OpenAI/Gemini on multilingual MTEB. BGE-M3 (MIT) is the production workhorse (dense+sparse+ColBERT multi-vector in one model, 100+ languages). NV-Embed-v2 leads English MTEB-legacy (72.31). *(Superseding note: NV-Embed-v2 is CC-BY-NC — non-commercial — and is BLOCKED for verification-as-a-service; see report B.)* On a single A100 (~$1.04–2/hr) self-hosted embedding runs ~$0.005/1M tokens — roughly 1/20th of API cost at scale; break-even vs API is ~10–50M embeddings/month.

**Rerankers:** Cohere Rerank 4 (API, $0.001–0.0025/search), and for self-host: Jina-Reranker-v3 (0.6B, built on Qwen3-0.6B, BEIR 61.94 nDCG@10, FEVER 93.95), BGE-reranker-v2-m3 (Apache 2.0), Qwen3-Reranker (Apache 2.0, 4B/8B). Note Jina v2 weights are CC-BY-NC; verify per-version licence. *(Superseding note: report B found ALL Jina weights CC-BY-NC — blocked.)*

**Provenance note:** late-chunking / contextualised-chunk embedding (Jina, voyage-context) improves retrieval but any auto-chunking that does not return character offsets obscures the span mapping — flag and require offset-returning chunking. Matryoshka dimensionality (Qwen3, Cohere, OpenAI, Gemini, Jina, Nomic) lets storage shrink to 256–512 dims with ~2–3% quality loss.

### (e) Storage / graph cost

A 1,536-dim fp32 vector = 6KiB; 1M vectors ≈ 5.7GB unindexed. Levers:
- **Binary quantisation** (Cohere reports 1536-dim → ~75GB at 100M docs vs 600GB fp32 — ~8× via binary, up to 32× claimed) and **scalar/halfvec** (pgvector 0.7+ supports halfvec and bit vectors).
- **pgvectorscale StreamingDiskANN + Statistical Binary Quantisation** (OSS, Postgres-licensed): on a Timescale/Tiger Data vendor benchmark of 50M × 768-dim Cohere embeddings, "28× lower p95 latency and 16× higher query throughput compared to Pinecone's storage-optimized (s1) index… at 99% recall, all at 75% less cost when self-hosted on AWS EC2" (471 QPS at 28ms p95 vs Pinecone 784ms) — *flag: vendor-produced, not independently replicated.* DiskANN stores compressed vectors on SSD, handling 16,000 dims where HNSW tops out at 2,000.
- **Matryoshka truncation** to 256–512 dims cuts storage ~4× at ~2–3% recall loss.

**Provenance preservation:** quantisation and dimensionality reduction affect only the *vector* used for ANN search; the span offsets, source-version hash and verbatim text are stored as adjacent metadata columns and are untouched — so storage optimisation does **not** breach span-bound provenance. Recommended substrate: Postgres + pgvector + pgvectorscale (Restormel already runs Neon Postgres as the verification spine), with BYO SurrealDB/Neo4j/Apache AGE for graph relations. Note pgvectorscale is not available on managed Amazon RDS as of mid-2026, so >10M-vector deployments needing DiskANN must self-manage Postgres on EC2/Coolify. Rough storage: 1M chunks at 768-dim binary ≈ <0.1GB index; cost is dominated by compute, not storage.

### (f) End-to-end cost models + market-pricing target

Order-of-magnitude, per 1,000 pages (assume ~10 claims/page → ~10,000 verified claims):

**Config A — All-OSS-self-host (customer-borne BYO):**
- Extraction: PaddleOCR-VL/Baidu self-host ≈ $1/1k pages compute.
- Embedding: Qwen3-8B self-host ≈ negligible (<$0.05/1k pages).
- Storage: negligible.
- Entailment: Granite Guardian 8B on a shared A100 ($1.04–2/hr); at >500 docs/min-class throughput, 10k claims ≈ minutes of GPU ≈ <$1.
- **Restormel COGS ≈ near-zero (licence model); customer-borne compute ≈ $2–3/1k pages.**

**Config B — Commercial-flagship (Restormel-resold):**
- Mistral OCR 4: $4/1k pages ($2 batch).
- Cohere Embed v4: ~$0.12/1M tokens (~$0.10–0.30/1k pages).
- Frontier LLM-judge entailment (e.g. GPT/Claude as cross-checker): the dominant cost — at ~$2–3/1M input tokens and ~10k claims × ~1k context tokens = ~10M tokens ≈ $20–60/1k pages before caching.
- **Restormel COGS dominated by entailment LLM tokens, ~$25–65/1k pages.**

**Config C — Hybrid (recommended):** BYO/self-host extraction+embedding+storage (customer-borne, ~$2–3/1k pages) + Restormel moat-core = cascade (CPU pre-filter + Granite 8B) + hash-keyed cache. With caching cutting repeat verdicts and the cascade keeping ~80–90% of checks on the cheap tier, **Restormel-borne entailment COGS falls roughly an order of magnitude vs Config B**, to low single-digit $/1k pages, or to ~zero in the self-hostable-checker licence model.

**Market pricing target (to set cost-to-user):** Mistral OCR 4 $2–4/1k pages; Google Document AI ~$1.50–5/1k pages; Contextual AI's Grounded Language Model is usage-based with platform access from $50/mo self-serve; Cohere Embed v4 $0.12/1M, Rerank $0.001–0.0025/search; Vectara/Contextual/Onyx enterprise RAG priced per-seat/usage. Per MarketsandMarkets (14 Nov 2025), the RAG market "is estimated to be USD 1.94 billion in 2025 and is projected to reach USD 9.86 billion by 2030 at a CAGR of 38.4%." **Implication:** if Restormel offloads substrate to BYO and runs a near-zero-COGS self-hostable checker, it can price the verification layer well under the blended cost of a flagship grounded-LLM stack and still hold healthy margin — the leaner architecture creates double-digit-$/1k-pages of headroom versus Config B.

### (g) Recommended target architecture

**Substrate (offload to BYO/OSS/self-host — Restormel does not resell/mark up):**
- Extraction: Mistral OCR 4 self-host (sovereign) or PaddleOCR-VL/Baidu open-weight; must emit offsets + confidence.
- Embedding: Qwen3-Embedding-8B or BGE-M3 self-host (sovereign); Voyage/Cohere as opt-in API for non-sovereign customers.
- Reranking: Jina-Reranker-v3 / BGE-reranker-v2-m3 self-host. *(Superseding note: Jina blocked per report B; use BGE/Qwen3 rerankers.)*
- Storage: Postgres + pgvector + pgvectorscale (binary quantisation, DiskANN), span-offsets + source-version hash + verbatim text as adjacent metadata; BYO graph store.

**Moat-core (own and optimise):**
- Cross-model entailment via a **cascade**: CPU-tier DeBERTa/Flan-T5 MiniCheck (or HHEM-2.1-Open) pre-filter → 8B Granite Guardian 3.3 (Apache 2.0, family-independent) for the ambiguous band → abstain-to-human for residual uncertainty.
- **Hash-keyed exact-match verdict cache** (claim+span+source-version+checker-version) for safe reuse and automatic invalidation; incremental re-verification on source change.
- **Batch/ingest-time verification** (async) rather than interactive where latency permits, to exploit batch discounts and GPU utilisation. *(Superseding note: extended to dual-mode — batch-at-ingest + in-path cache-first — by the ingest-connector ADR v2.)*
- Optional **self-hostable checker licence**: ship the cascade as a container the customer runs, moving inference COGS entirely to the customer (near-zero marginal COGS for Restormel; licence-based pricing).

This preserves all four invariants: cross-model independence (Granite/DeBERTa/T5 are different families from GPT/Claude/Gemini/Llama/Mistral/Qwen generators); span-bound provenance (offset-returning extraction + metadata columns untouched by quantisation); abstention-to-human (cascade's uncertain band routes to review); and the published bar (validated, not assumed — see (h)).

### (h) Honest risks and the specific validations required before committing

**Validations required BEFORE any pipeline replacement:**
1. **Hold-out efficacy gate on representative corpora.** Run the candidate cheap checker (Granite Guardian 8B; MiniCheck pre-filter) against the *existing* frontier-judge verdicts on representative legal, pharma and finance corpora, measuring supported/unsupported rates against human-labelled ground truth. Confirm ≥90% supported / ≤2% unsupported is achievable *after* abstention routing — not on the raw classifier. Wire this into the existing weekly CI efficacy gate.
2. **Calibrate the cascade thresholds and abstention band** per domain (ExpertQA and the Stanford RegLab legal findings show expert-domain claims are hardest; thresholds that work on one corpus fail on another — see UCCI/calibration literature).
3. **Cross-model independence audit:** confirm the chosen checker family differs from each customer's generation/extraction family; explicitly block Lynx-on-Llama configurations.
4. **Span-anchoring regression test:** confirm the chosen extractor returns deterministic offsets and that quantised storage round-trips the exact verbatim span + version hash.
5. **Semantic-cache shadow eval** (if used): measure false-positive rate per segment before lowering the similarity threshold below 0.97.

**Risks where cost-cutting threatens an invariant or the bar:**
- **Small-checker ceiling.** ~77% LLM-AggreFact and ~50% (62.31% ceiling) on adversarial FaithBench means a cheap checker *cannot* hold ≥90%/≤2% without abstention; if abstention rates spike, human-review cost rises and the cost saving erodes. Quantify the abstention/cost trade-off per corpus.
- **Licence traps.** Lynx (CC-BY-NC-4.0) and Bespoke-MiniCheck-7B (custom non-commercial) are non-commercial; using them in a commercial product is a legal breach, not just a quality choice. Granite Guardian / HHEM-2.1-Open / FactCG / Flan-T5-MiniCheck are clear (Apache-2.0/MIT).
- **Semantic-cache false hits** silently emit unsupported claims — disqualified for moat-core unless gated.
- **Voyage/US-API sovereignty:** API-only US-jurisdiction embedders break the EU self-host promise; restrict to non-sovereign customers. *(Superseding note: sovereignty since reframed as a global preset, not an EU/UK constraint — see report B and the decisions log.)*
- **Vendor benchmark inflation:** OCR (PaddleOCR-VL 96.3, Mistral 85.2) and Galileo Luna-2 figures are self-reported; OmniDocBench is near-saturated and small relative to real document variety — run private evals. The pgvectorscale 28×/16×/75% figures are a Timescale vendor benchmark, not independently replicated.
- **"One cheap model for everything" temptation** collapses the cross-check and is disqualified outright; the cascade must keep both tiers independent of the generation family.

---

*Source-quality note: LLM-AggreFact, FaithBench, RAGTruth, the cascade/selective-prediction papers, and the MarketsandMarkets market figure are independent/academic/analyst sources. Mistral OCR 4, PaddleOCR-VL, Galileo Luna-2, Bespoke, Voyage and the Timescale pgvectorscale benchmark are vendor/self-interested and flagged as such. Patronus Lynx's HaluBench scores predate 2026 and are from the vendor. Restormel's ≥90%/≤2% bar is treated throughout as a target to validate, not as independently verified.*
