---
id: REC-PLAN-009
title: "Verifying Proxy — Phase A Reference Integration (W2-1) — Build Spec"
class: planning
owner: founder
status: building
classification: internal
control-tier: 1
created: 2026-06-15
last-reviewed: 2026-06-15
review-interval: P6M
retention: review-only
related: [REC-PLAN-007, REC-ADR-005]
---

# Verifying Proxy — Phase A Reference Integration (W2-1) — Build Spec

**Status: building (overnight 2026-06-15, founder pre-authorized).** This is the "Prompt 3"
scope-then-build slice of **REC-PLAN-007** Phase A. **D-0 is accepted** (REC-ADR-005): v1 verifies
**faithfulness/grounding, not misattribution**. Local, single-tenant, no auth on ingress, no egress —
this is the first real verification slice + latency/cost proof, **not** a multi-tenant or secured
product.

## Goal

Prove **one real faithfulness-verification slice** end-to-end: an MCP **client** (the proxy) calls a
**Mode-1** MCP **upstream** (returns `{answer/claims, supporting sources}`), and the proxy returns a
**verified envelope** (span + source-hash + cross-model entailment + abstention) over that result —
reusing the EBV engine, hosting no graph.

## Locked decisions (do not re-litigate — see [[overnight-w2-run-2026-06-15]])

| # | Decision |
|---|---|
| Semantic | Faithfulness/grounding only (D-0). Mode-1 upstream. No misattribution. |
| Upstream | **Local reference Mode-1 MCP fixture** (GraphRAG-style), bundled sample corpus. Hermetic; no third-party creds; **no egress** (sidesteps R8/SSRF — that's a remote-only gate). |
| Validator | Injected `ExtractionGenerate`. **Stub** validator for deterministic CI tests; **real-LLM** path behind an env flag (skipped when no key). Restormel-selected, independent (D-c); **fail closed** to a Restormel-side validator. |
| Provenance | **Reference-by-hash** only (source ref + `source_hash`). Embed-bytes deferred (R5 — PII/DPIA call is the founder's). |
| Exposure | Ships as **package code + reproducible script + tests**. **NO live `/mcp` route**, no unauthenticated ingress, no prod runtime change. Phase C (remote) is D1-gated. |
| Fail-safe | Uncertainty / upstream timeout / quote-retrieval failure / unbound span / validator-unreachable → `unverified`/abstain (**review**), **never** a silent pass. Inherit EBV fail-safe. |

## Architecture

```
 reference runner / test
        │  query
        ▼
  proxy MCP CLIENT ──stdio──►  local Mode-1 upstream FIXTURE  (returns {answer, sources[]})
        │  CallToolResult
        ▼
  verifyEnvelope()  ── reuse ingest/{evidence-binding, entailment} ──►  VerifiedEnvelope
        │
        ▼  reference-by-hash envelope (no graph, no stored source)
```

Two layers, cleanly split so the **verify core is hermetic** (no MCP, no keys):

- **Verify core** — `packages/connect-core/src/proxy/` (pure; reuses `ingest/evidence-binding.ts` +
  `ingest/entailment.ts`; **no SDK dependency**).
- **MCP leg + fixture** — `packages/mcp/` (already depends on `@modelcontextprotocol/sdk@^1.29.0`):
  the client/dispatch wrapper + the local fixture upstream server.

## File plan (net-new unless noted)

**Verify core — `packages/connect-core/src/proxy/`**
- `types.ts` — `Mode1Result`, `ClaimWithSources`, `VerifiedEnvelope`, `EnvelopeClaim`, `EnvelopeStatus`.
- `extract-claims.ts` — parse a Mode-1 `CallToolResult` into `ClaimWithSources[]`; quote-retrieval
  contract (use upstream-provided verbatim quotes when present; else an injected `ExtractionGenerate`
  retrieves candidate quotes from the cited source — this is the real net-new verification work, not
  the façade).
- `verify-envelope.ts` — `verifyEnvelope()` façade: for each claim, `contentHash` the cited source →
  `bindEvidenceSpan({quote, sourceText, sourceHash})` → `judgeEntailment({inputs, generate})` →
  compose `EnvelopeClaim`. Applies the fail-safe table. **No `/connect/v1/verify`.**
- `validator.ts` — validator-independence control (D-c): selects a Restormel-side validator family;
  asserts validator family ≠ the (known) answer author; **fails closed** to Restormel-side. Exposes a
  `makeStubValidator(fixtureVerdicts)` for tests and a `makeRestormelValidator(spec)` real path.
- `index.ts` (connect-core) — re-export the proxy surface.

**MCP leg + fixture — `packages/mcp/src/proxy/`**
- `client.ts` — `connectUpstream({command,args}|{url})` → `Client` + `StdioClientTransport`
  (`StreamableHTTPClientTransport` stubbed for Phase C); `callTool(name,args)` → `CallToolResult`;
  timeouts + circuit-break on the egress leg; close/lifecycle.
- `fixtures/mode1-upstream.ts` — a real stdio MCP server exposing one Mode-1 tool
  `graph_answer(query)` → `{ answer, claims[], sources:[{id,text,uri?}] }` over a small bundled corpus
  (`fixtures/corpus/*.md`, public-domain text). Includes a **grounded** sample and a planted
  **unsupported** claim for acceptance.

**Reference runner — `scripts/reviews/`**
- `verifying-proxy-reference.ts` — spins up the fixture upstream, connects the proxy client, runs the
  query, prints envelopes + per-leg latency + Restormel-side cost. Mirrors `verifier-efficacy.ts`
  (env keys optional; stub validator by default, real behind `--validator <family:model>`).

**Tests**
- `packages/connect-core/src/__tests__/proxy-verify-envelope.test.ts` — hermetic, stub validator:
  grounded claim → `supported` (span+hash+verdict shown); planted unsupported → `unverified`/abstain →
  review (never passed); fail-safe cases (timeout, unbound, validator-unreachable) → abstain.
- `packages/mcp/src/proxy/__tests__/client-fixture.test.ts` — proxy client ↔ fixture stdio round-trip
  returns a `CallToolResult`; text-only (R-nontext: structured/binary upstream results are out of v1).

## Core contracts (reuse, don't reinvent)

```ts
// inputs
type Mode1Result = { answer: string; claims?: string[]; sources: { id: string; text: string; uri?: string }[] };

// output
type EnvelopeStatus = "supported" | "unverified" | "abstain";
type EnvelopeClaim = {
  claim: string;
  status: EnvelopeStatus;
  binding: import("../ingest/evidence-binding").EvidenceBinding;   // span + source_hash + match, OR unbound/no_evidence
  entailment: { verdict: "entailed" | "not_entailed" | "abstain"; confidence: number | null; note?: string };
  source_ref: { id: string; uri?: string; source_hash: string };   // reference-by-hash (R5: no embed-bytes)
};
type VerifiedEnvelope = { claims: EnvelopeClaim[]; meta: { validator_model: string | null; judged_at: string; legs_ms: Record<string,number>; restormel_cost: { calls: number; chars: number } } };

// assembly (reused engine — exact signatures)
//   contentHash(text): Promise<string>
//   bindEvidenceSpan({ quote, sourceText, sourceHash }): EvidenceBinding
//   judgeEntailment({ inputs: {ref, claim, spans:string[]}[], generate: ExtractionGenerate, kSamples? }): Promise<{results: UnitEntailment[], meta}>
//   ExtractionGenerate = async ({ system, user }) => string   // the injected validator
```

**Status mapping (fail-safe):** `bound` + `entailed` → `supported`; `bound` + `not_entailed` →
`unverified`; everything else (`unbound`/`no_evidence`/`abstain`/error/timeout) → `abstain` → review.
**Never** map an error or a missing verdict to `supported`.

## Latency & cost (measure, don't optimise — NFD-1)

Capture four legs separately into `legs_ms`: (a) proxy→upstream `callTool`, (b) quote/claim retrieval
[LLM, 0 when upstream supplies quotes], (c) `judgeEntailment` [LLM], (d) Layer-1 bind/hash (~free).
Count Restormel-side `{calls, chars}`. Report p50/p95 on a fixed sample in the runner. Targets are
**placeholders ratified against the first real measurement** (REC-PLAN-007): added p50 ≤ ~1.5 s / p95 ≤
~4 s over passthrough — a claim to be earned, not asserted.

## Acceptance

1. Grounded claim (entailed by a returned source span) → `supported`, with span + `source_hash` +
   verdict in the envelope.
2. Planted unsupported claim (no entailing span) → `unverified`/abstain → review (not passed).
3. Runs reproducibly: `pnpm exec tsx scripts/reviews/verifying-proxy-reference.ts` (stub validator, no
   keys) emits envelopes; `--validator anthropic:…` exercises the real leg when a key is present.
4. `pnpm --filter @restormel/connect-core test` and `pnpm --filter @restormel/mcp test` green.
5. Typecheck green; OSV security gate green.

## Out of scope (Phase A)

Misattribution (D-0); Mode-2 answer-leg; Mode-0 raw stores beyond Layer-1 stamping; non-text/structured
upstream results (R-nontext); any remote/multi-tenant serving, auth, or live route (Phase C/D1);
request-scoped BYO-key entailment (D-e); SSRF/egress to real upstreams (R8 — fixture is local);
embed-bytes provenance (R5). Hosting the user's graph or ingesting upstream content.
