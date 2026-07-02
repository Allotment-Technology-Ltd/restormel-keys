---
id: REC-LEG-015
title: "Counsel-Routing Package — Component Licensing Clearance (Report B, Action #1)"
class: legal
owner: founder
status: draft
classification: confidential
control-tier: 1
created: 2026-07-01
last-reviewed: 2026-07-01
review-interval: P6M
retention: P6Y-after-superseded
related: [REC-GOV-022, REC-ADR-023]
---

> **ACTION REQUIRED — founder to send to counsel.** This package routes **Report B (REC-GOV-022)** for legal review. It is **fact-gathering, NOT legal advice**; every "CLEARED" verdict is a research judgement on public licence/ToS text and must be confirmed by counsel. **Counsel sign-off gates production component wiring — nothing ships on a component until confirmed CLEARED.** Cowork cannot send email; the founder forwards this package + the full Report B record to counsel. **Proposed id — reconcile at merge.**

## What to send counsel
1. The full **Report B (REC-GOV-022)** — the per-model licence/ToS clearance framework, tables, and verdicts.
2. This cover memo: (a) the verdict summary; (b) the ten residual risks; (c) the licensee-on-curated-swap question; (d) the harness scope clarification.

## (a) Clearance verdict summary (research judgement — confirm)

- **CLEARED (provisional):** IBM Granite Guardian 3.3/4.1 8B, Vectara HHEM-2.1-Open, Qwen3-Embedding/Reranker (0.6/4/8B), BGE / BGE-M3 / BGE-reranker, multilingual-e5, PaddleOCR-VL / PP-OCRv5, Docling, Baidu Unlimited-OCR (verify), Mistral OCR **API** (verify no-compete). Hosted APIs: OpenAI, Anthropic, Google Gemini/Vertex (GA indemnified only), Cohere, Voyage (Preview), Mistral API, Bedrock/Azure (per-model + cloud terms). Gemma 1–3 family CONDITIONAL on §3.1 flow-down + §3.2 Prohibited-Use.
- **BLOCKED (non-commercial — keep out of managed defaults/swaps):** NV-Embed-v2, Patronus Lynx 8B/70B, Bespoke-MiniCheck-7B, all Jina embeddings/rerankers (CC-BY-NC). Bespoke & Jina offer paid/commercial routes (NEEDS COMMERCIAL LICENCE).
- **AMBIGUOUS (do not ship until resolved):** lytang MiniCheck checkpoints, Surya OCR.
- **NEEDS COMMERCIAL LICENCE:** Mistral OCR **self-host/on-prem** (proprietary, negotiated — not Apache-2.0).

## (b) The ten residual risks (verbatim from Report B §g)

1. Non-commercial traps already in the field (NV-Embed-v2, Patronus Lynx, Bespoke-MiniCheck, all Jina) — keep out of managed defaults/swaps.
2. MiniCheck (lytang) and Surya OCR licence ambiguity — AMBIGUOUS; do not ship until counsel confirms.
3. Mistral OCR self-host is proprietary/negotiated, not Apache-2.0 — API cleared; on-prem needs a Mistral commercial agreement.
4. Hosted-API "no competing service" clauses (Anthropic, OpenAI, Google) — confirm a paid *verification* SaaS using these as the independent judge is within terms, and that IP indemnity covers the actual GA configuration (not pre-GA/beta).
5. Gemma's remote-restriction right and mandatory Prohibited-Use flow-down — acceptable but residual; confirm Gemma 4 (separate licence) status if used.
6. The ≥90%/≤2% quality bar is a target to validate, not a verified fact — the weekly CI gate must measure it on Restormel's own data.
7. Data-residency + sub-processor obligations (GDPR DPA, SCCs) when hosted APIs process customer data — required for the managed presets.
8. Voyage Embedding/Reranking API is in Preview — terms may change; treat as provisional.
9. Vectara hosted HHEM/FCS API commercial terms — request Vectara's Master Subscription Agreement before relying on the hosted FCS (HHEM-2.1-Open weights are separately Apache-2.0 and safe to self-host).
10. OpenAI text-embedding-3-large price discrepancy — verify the live embeddings table before publishing customer-facing pricing.

## (c) Cross-cutting question — "who is the licensee on a curated swap?"

When a customer selects a model from the curated dropdown **inside Restormel's managed pipeline**, this is **not true BYO** — Restormel still operates the model, so **Restormel is the licensee/operator** and Restormel's service-provider terms with that vendor must clear multi-tenant, third-party-service use. Counsel to confirm, per class:
- **Open weights (Apache-2.0/MIT):** confirm field-of-use freedom — safe to expose as a curated option.
- **Llama/Gemma custom licences:** confirm attribution + flow-down in customer terms — exposable with conditions.
- **Hosted APIs:** confirm Restormel's own commercial agreement permits offering the API-backed capability to customers, and that indemnity flows to the configuration used.
- **Non-commercial (CC-BY-NC) / paid-commercial (Bespoke):** expose **only as true customer-BYO** (customer holds the licence), or not at all.

## (d) Scope clarification to flag to counsel — the cascade-validation harness

The cascade-validation **harness** (backlog item 2) is **internal measurement, not a customer-facing service**, and uses **only the provisionally-CLEARED Apache-2.0/MIT set plus indemnified frontier APIs**. Working assumption: **internal evaluation sits outside the service-licensing gate** — **ask counsel to confirm.** Production component wiring remains **GATED** regardless.
