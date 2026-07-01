---
id: REC-TECH-014
title: "Spike — Ingest-Connector Abstraction (instance #1: extraction) [v3, routed as-is to Claude Code]"
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-07-01
last-reviewed: 2026-07-01
review-interval: P12M
retention: review-only
related: [REC-ADR-008, REC-GOV-022]
---

> **Routed AS-IS to Claude Code as the build instruction (build step 1A of REC-ADR-008).** Body verbatim, unedited per the handover brief. Component wiring is **GATED** on counsel clearance of REC-GOV-022 (the brief carries its own gate). **Proposed id — reconcile at merge.**

# Hand to Claude Code — Spike: the ingest-connector abstraction (instance #1: extraction)

**Revision: v3 — 2026-07-01, trimmed and sharpened after strategic review. Supersedes v2 (internal-first) and v1 (BYO-first).**
Changes from v2: corpus validation cut to *indicative* scale so the spike stays time-boxed; the swap test is now provable, not asserted; the Stage-4 demo and proxy-Tier-P2 linkages are explicit; the ADR this spike serves now exists (v2, dual-mode) and this brief inherits it.

## What this is
A **time-boxed spike**. It answers one question:

> Can we build an **internal ingest-connector abstraction** — so Restormel runs **cleared managed defaults** for each ingest stage, *and* can expose a **short curated swap** (and, for the few who need it, true BYO) — with a single contract whose **span/offset model is the provenance through-line**, starting with extraction as **instance #1**?

Restormel makes the cheap, complex choices internally; the connector abstraction is the *internal enabler* that lets us (a) swap our **own** managed default cheaply, and (b) offer a small, vetted menu — without re-engineering. Extraction is the first instance; embedding/retrieval is the next (voyage-context-4 is the lead candidate), reusing the same contract.

**Sequencing:** this spike is **build step 1A** in the ingest-connector ADR (v2) and runs **in parallel with step 1B** (the verifier cascade + cache + instrumentation). Neither blocks the other; they meet at the cascade-validation harness (step 2).

## HARD GATE — legal clearance before any component is wired
Do **not** wire any specific model until counsel confirms it CLEARED (see the report *"Restormel Component Menu: Licensing Clearance…"*). Per that report's research (pending counsel):
- **Managed default extractor:** **PaddleOCR-VL (Apache-2.0)** — cleared for commercial service, self-host/managed, emits bounding boxes for span provenance.
- **Curated alternative:** **Mistral OCR 4 (API)** — cleared via API; richer boxes + confidence; **self-host is proprietary/negotiated, not Apache** — do not assume open weights.
- **BLOCKED — do not use:** anything CC-BY-NC or non-commercial.
Build the abstraction against the **contract**, not against a specific model, so the cleared default can be set once counsel signs off.

## The connector contract (core deliverable — define first; model-agnostic)
The interface the verification spine consumes from *any* extractor (and, later, any ingest-stage component):

```
extract(source_document) -> {
  document: { source_id, version_hash_inputs, language, page_count,
              capability_tier },          # "spatial" | "textual"
  text_units: [{
    text,                                 # verbatim, faithful — no LLM reshaping
    source_locator:                       # the provenance anchor:
        { kind: "spatial", page, bbox }   # rich (e.g. PaddleOCR-VL, Mistral OCR)
      | { kind: "textual", offset, length, path? },
    confidence,                           # per-unit -> ingest-level abstention
    block_type?, reading_order?
  }]
}
```

- **Verbatim text** (no transformation) is the material for span-binding.
- **`source_locator`** is the through-line: it must survive extraction → chunking → embedding → retrieval → verification so a verified claim traces to the exact source span. **Design it as instance #1 of a general ingest-connector pattern**, not an extraction one-off — the embedding/retrieval connector (next instance) must reuse it.
- **The contract is door-agnostic.** `source_locator` + `version_hash_inputs` are also what makes **proxy Tier P2** (full span + source-version-hash verification over *third-party* sources, per the ADR) possible. This spike serves both doors, not just the first-party pipeline.
- **`confidence`** feeds ingest-level abstention.
- If using Mistral OCR, use **pure-extraction mode**, not the Document AI schema tier (that pipes output through an LLM to reshape it — ungrounded transformation upstream of verification).

## Two provenance tiers (graceful degradation)
- **Tier A — spatial** (bounding boxes): full visual click-through-to-span.
- **Tier B — textual** (offsets only): text-anchored provenance, no visual highlight.
The system must be **transparent about which tier it's in** — never imply richer provenance than the component supports.

## Scope of the spike
1. The **contract** (above), designed for reuse across ingest stages.
2. The **managed default** extractor wired behind it (the cleared PaddleOCR-VL, once counsel confirms), proving Tier A.
3. **One curated alternative** (Mistral OCR 4 API, Tier A) and **one Tier-B path**, proving the swap works and graceful degradation holds.
4. The **swap test — provable, not asserted:** run the *same indicative corpus* through the managed default and the curated alternative; assert (a) zero changes to verification-spine code between runs (diff the spine), (b) both outputs consumed through the identical contract, and (c) span-anchoring and verification outcomes compared across connectors, with deltas documented.
5. **Indicative validation** on a *small representative sample* (a handful of documents each from legal / pharma / finance — complex layouts, tables, scans): extraction fidelity, span-anchoring quality, confidence-as-abstention signal, degradation behaviour, indicative throughput and per-page cost. **The full ≥90%/≤2% benchmark on representative corpora is NOT this spike's job** — it belongs to the cascade-validation harness and the weekly CI gate (ADR build step 2). That boundary is what keeps this time-boxed.

## Guardrails
- **Managed default is the product;** the curated swap and BYO are the exception, not the entry point.
- **Don't hardcode any vendor** — the contract is the abstraction; the default is set by config once cleared.
- **Pure-extraction only** — no LLM content-reshaping upstream of verification.
- **Keep extraction modular and distinct from the cross-model entailment checker** (independence is a spine concern; extraction is upstream — don't couple them).
- **Deployment/region are presets, not filters** — the abstraction must support managed, self-host and air-gapped equally; don't bias to any one.
- **Verified context is the headline;** extraction is supporting plumbing.

## The honest risk
For the **managed default**, provenance quality is Restormel's own cleared choice — controlled. The variable-quality risk applies only to the **curated-swap / BYO** path: there, provenance quality rides on what's plugged in. The contract + graceful degradation + transparent tier-labelling is the mitigation; getting the degradation behaviour right (honest, labelled, lower-fidelity provenance on thinner components) is the success criterion.

## Out of scope
Production-hardening, UI, billing, multi-tenant connector management; adopting Mistral as a paid internal default; any component beyond the default + one alternative + one Tier-B stub; the embedding/retrieval connector (the *next* instance, post-spike); the verifier cascade, cache and harness (parallel workstream — ADR steps 1B and 2); full-corpus benchmark validation (harness/CI gate, as above).

## Definition of done
- A documented, reusable **ingest-connector contract** (instance #1: extraction).
- The **cleared managed default** wired behind it (Tier A), plus one curated alternative and one Tier-B path (degradation proven and honestly labelled).
- **Swap test passed as specified in Scope §4** — spine diff clean, identical contract consumption, cross-connector outcome comparison documented.
- An **indicative validation report** on the sample (fidelity, span-anchoring, confidence-as-abstention, degradation, indicative throughput/cost), explicitly marked *indicative — full benchmark deferred to the harness/CI gate*.
- The **ingest-connector ADR (v2, already drafted)** updated with the spike's findings and proposed for acceptance; findings landed as records per SCHEMA; spike tracked in Forgejo.
- Explicit confirmation that **no un-cleared component was wired** (legal gate respected).

## Linkage
- **ADR (v2):** this spike is build step 1A; the cascade (1B) runs in parallel; both feed the cascade-validation harness (2).
- **Stage 4 / demo:** the Tier-A extraction instance is the substrate of the **click-through-to-span demo** and the dog-food demo design partners will actually see — this spike is GTM-relevant, not just plumbing.
- **Proxy Tier P2:** the contract's span + version-hash through-line is what extends full-depth verification over third-party sources (door 2).
- **SIG-014** (Mistral OCR 4): the curated alternative + a distribution/co-opetition signal — not a COGS line.
- **SIG-015** (voyage-context-4): the lead candidate for the **next** instance (embedding/retrieval connector), reusing this contract.
- **Licensing report:** the source of cleared defaults/alternatives — **gates this spike's component wiring.**
- **D3 positioning:** "Mistral extracts; we prove it" / "verified ≠ extracted."
