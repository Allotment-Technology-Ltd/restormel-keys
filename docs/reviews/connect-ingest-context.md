---
title: Connect Ingestion — Reviewer Context Pack
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-09
last-reviewed: 2026-06-09
review-interval: P12M
---

# Connect Ingestion — Reviewer Context Pack

**Purpose.** This pack front-loads orientation so an advanced-model review agent spends
its budget on *judgment*, not on rediscovering structure. Read this first, then run the
review prompts in [`connect-ingest-review-prompts.md`](./connect-ingest-review-prompts.md).

**What this subsystem does.** Restormel Connect turns source documents into a knowledge
graph through a multi-stage LLM pipeline (`@restormel/connect-core`). The quality concern
under review is the faithfulness and structural soundness of the **created** and
**remediated** graph.

> This pack states *candidate findings to validate or refute* (§6). They are a prior pass,
> not gospel — confirm each against the code, and look for what it missed.

---

## 1. Stage flow

```
fetch → extraction → relations → grouping → embedding → validation → remediation → storing
                     └─ json_repair (fallback, any stage that emits malformed JSON)
```

- **extraction** — pull `units` (claims) + `relations` from chunk text.
- **relations** — relation extraction / metadata (confidence, evidence, review_state).
- **grouping** — cluster units into named groups with per-member roles.
- **validation** — judge each unit against source: `ok | weak | unsupported` (the quality gate).
- **remediation** — self-heal flagged units: `repair | drop | keep`.
- **embedding** — vectorize claim text.
- **json_repair** — re-ask a model to fix malformed JSON.

Stage order is defined in `stage-gate.ts` (`CONNECT_STAGE_ORDER`) and
`resume-stage.ts` (`INGEST_PIPELINE_STAGES_ORDER`).

---

## 2. File inventory (`packages/connect-core/src`)

Scope for a quality review is the **in-scope** rows. `lines` are approximate.

| File | lines | purpose | in scope |
|---|--:|---|:--:|
| `ingest/extract.ts` | 213 | extraction parse + ontology quality analysis (`analyzeExtraction`) | ✅ |
| `ingest/validation.ts` | 196 | unit faithfulness verdicts; batch + coverage finalize | ✅ |
| `ingest/remediation.ts` | 186 | repair/drop/keep; batch + coverage finalize | ✅ |
| `ingest/grouping.ts` | 102 | cluster units into groups | ✅ |
| `ingest/prompt-compose.ts` | 260 | central stage prompt composer + output contracts | ✅ |
| `ingest/chunking.ts` | 132 | structure-aware chunking | ✅ |
| `ingest/extraction-gates.ts` | 36 | persist gate on extraction warnings | ✅ |
| `ingest/quality-preset.ts` | 83 | production/starter presets, stop-after logic | ✅ |
| `ingest/golden-eval.ts` | 86 | G2 metrics + targets, golden fixtures | ✅ |
| `kg-audit/trust-score.ts` | 105 | trust score formula | ✅ |
| `stages/model-call.ts` | 352 | shared LLM call: retries, temperature, json_repair | ✅ |
| `stages/relations-helpers.ts` | 169 | relation metadata, batching, dedupe, integrity | ✅ |
| `ingest/plan.ts` | 598 | per-stage routing/model selection (latency, pass, pins) | context |
| `ingest/extraction-prompt.ts` | 28 | extraction prompt wrapper | context |
| `ingest/generate-text-temperature.ts` | 43 | per-provider temperature-omit policy | context |
| `ingest/prompt-templates/index.ts` | — | archetype stage intros, template version | context |
| `ingest/pre-scan.ts` | 122 | source pre-scan blockers | context |
| `ingest/llm-token-usd-rates.ts` | 101 | $/token estimates | context |
| `ingest/worker-stub.ts`, `ingest/job-record.ts`, `ingest/resume-stage.ts`, `ingest/pipeline-focus.ts` | — | orchestration bookkeeping | context |
| `ingest/*-parser.ts`, `ingest/crawl.ts`, `ingest/source-metadata.ts`, `ingest/ingest-ports.ts` | — | fetch/parse I/O | out |

Orchestration that *wires* these stages and applies thresholds (e.g. remediation
confidence gating) lives in the dashboard app:
`apps/dashboard/src/lib/server/connect/**`. When a finding depends on caller behavior,
label it `[verify: dashboard orchestrator]`.

---

## 3. Data contracts (stage JSON shapes)

All stages parse model output with a **loose-JSON** strategy (`JSON.parse`, else brace-slice
`indexOf("{") … lastIndexOf("}")`). All use **short refs** per batch (`u1`/`v1`/`r1`) remapped
to real ids after parse.

- **extraction** (`EXTRACTION_OUTPUT_CONTRACT`, prompt-compose.ts):
  `{ units: [{ id, text, type?, domain?, evidence? }], relations: [{ from, relation, to }] }`
- **grouping**: `{ groups: [{ name, summary?, members: [{ ref, role? }] }] }`
- **validation**: `{ results: [{ ref, status: "ok|weak|unsupported", note? }] }`
- **remediation**: `{ results: [{ ref, action: "repair|drop|keep", text?, confidence? }] }`
- **relations (rich path, relations-helpers.ts)**:
  `{ from_position, to_position, relation_type, strength?, relation_confidence?,
     relation_inference_mode?, evidence_passage_ids?, review_state?, verification_state? }`

> Note the **two divergent relation models**: extraction emits id-based `{from,relation,to}`
> with no confidence/evidence; relations-helpers carries the rich position-based model.

---

## 4. Quality bars & where they are computed

- **G2 targets** (`golden-eval.ts`): `ok_pct ≥ 90`, `unsupported_pct ≤ 2`.
  Denominator = `ok + weak + unsupported` (only returned verdicts).
- **Trust score** (`trust-score.ts`): weighted sum — embedding coverage 25, verification
  coverage 25, low-orphan 15, vector index 15, relation balance 10, minus high-severity
  issue density 10.
- **Quality presets** (`quality-preset.ts`): `production` runs through remediation and
  requires cross-model validation; `starter` is a reduced-coverage demo.
- **Cross-model validation**: `plan.ts` deliberately routes validation to a *different*
  model family (Gemini) than extraction.

---

## 5. How to run things (no live LLM keys required for the repro)

```bash
# typecheck + unit tests for the package under review
pnpm --filter @restormel/connect-core typecheck
pnpm --filter @restormel/connect-core test

# fail-open / truncation repro — proves §6 findings with pure functions, no keys
pnpm tsx scripts/reviews/connect-ingest-failopen-repro.ts
```

The repro exercises the exported pure functions (`finalizeValidationCoverage`,
`parseValidationResponse`, `finalizeRemediationCoverage`, `computeG2Metrics`,
`chunkDocument`) to demonstrate behavior on incomplete/garbled model output without
calling any provider. Extend it to ground new findings.

Golden fixtures: `packages/connect-core/src/ingest/golden/fixtures/philosophy-starter.json`
(SEP articles — dense academic prose, the corpus this pipeline is tuned for).

---

## 6. Candidate findings to validate or refute

These came from a prior static read. **Confirm each against the code with a file:line
quote, then look for what this list missed.** Do not treat them as settled.

| # | severity | file:line | claim |
|---|---|---|---|
| C1 | critical | `validation.ts:104-109` | omitted units default to `ok` ("assumed supported") — fail-open into the graph |
| C2 | critical | `remediation.ts:101-105` | omitted units default to `keep` — fail-open |
| C3 | critical | `golden-eval.ts:32` | `ok_pct` computed over returned verdicts only; with C1 it is biased upward |
| H1 | high | `validation.ts:119-126` (+ extract/grouping/remediation parsers) | brace-slice silently returns an incomplete (often empty) result set on malformed/truncated output → feeds C1/C2 |
| H2 | high | `validation.ts:61`, `remediation.ts:53` | source truncated to 12k chars; per-unit `sourceTextByRef` path exists but is optional |
| H3 | high | `extraction-gates.ts:21-23` + `extract.ts:120-145` | orphan/dangling warnings detected but never gate or trigger a recovery pass |
| H4 | high | `chunking.ts:14,67` | `structure_aware` ignores `overlap_chars` (only `fixedChunks` uses it) → cross-boundary relations lost |
| M1 | medium | `extract.ts:85-93` vs `relations-helpers.ts` | two divergent relation models; id-based path loses confidence/evidence/review_state |
| M2 | medium | `remediation.ts:134-137` | confidence parsed but threshold gating not applied here — `[verify: dashboard orchestrator]` |
| M3 | medium | `chunking.ts:31` | naive sentence splitter fragments citations/abbreviations in academic prose |
| M4 | medium | `model-call.ts:276-277` | truncation (`finishReason==='length'`) fails the stage instead of re-batching smaller |
| L1 | low | `trust-score.ts:64-70` | `relationHealth` scores a no-contradiction graph 0.4 — may under-score faithful single-source graphs |
| L2 | low | `validation.ts:139` vs `:104` | inconsistent fail direction (unknown status → `weak`, but omission → `ok`) |

**Highest-leverage theme:** the pipeline fails *open* (incomplete output silently
admitted as good) rather than fail-*safe*. C1–C3 + H1 are one cluster; H2–H4 are quality
ceilings independent of model choice.
