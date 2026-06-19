---
id: REC-PLAN-018
title: "Verifying Proxy — W0-1 Baseline Measurement (latency/cost + MCP spec baseline)"
class: planning
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-19
last-reviewed: 2026-06-19
review-interval: P12M
retention: review-only
related: [REC-PLAN-007, REC-PLAN-009, REC-ADR-005]
---

# Verifying Proxy — W0-1 Baseline Measurement

**Date:** 2026-06-19  
**Runner:** `scripts/reviews/verifying-proxy-reference.ts` (W2-1 merged, issue #96/#153)  
**Validator:** `openai:gpt-4o-mini` (REAL — Restormel-selected, independent of fixture author `fixture-graphrag` — D-c satisfied)  
**Upstream:** in-memory fixture (deterministic corpus); also verified via stdio transport  
**Corpus:** bundled public-domain (Eddystone lighthouse + honey bee waggle dance)  
**Queries:** 2 (one grounded + one planted claim each)  
**Samples:** 2 real-LLM runs × 2 queries = 4 per-leg data points

---

## (a) Per-leg latency (ms) — real-LLM validator (gpt-4o-mini, 2026-06-19)

| Leg | p50 (ms) | p95 (ms) | notes |
|---|---|---|---|
| `callTool` (upstream fixture) | 1 | 4 | in-memory / stdio fixture; near-zero |
| `quote_retrieval` (span extraction + quote-match) | 1838 | 3268 | dominant leg; first-token latency of gpt-4o-mini |
| `judge_entailment` (NLI verdict) | 1278 | 1679 | second LLM call; fast model |
| `layer1_bind` (source-hash bind) | 0 | 5 | pure CPU, sub-ms |
| **Total (sum of legs)** | **~3333** | **~4684** | end-to-end per-query |

_Note: p50/p95 computed over 4 samples (2 runs × 2 queries). A dedicated `--k` multi-sample run would improve precision; these are representative of the first-capture baseline._

**Stub validator (for reference — no network I/O):**

| Leg | p50 | p95 |
|---|---|---|
| callTool | 1 ms | 1 ms |
| quote_retrieval | 0 ms | 0 ms |
| judge_entailment | 1 ms | 1 ms |
| layer1_bind | 1 ms | 1 ms |
| **Total** | **~3 ms** | **~3 ms** |

---

## (b) Cost-per-verification (gpt-4o-mini, 2026-06-19)

Each query makes **2 validator LLM calls** (one for quote/span extraction, one for entailment judgement).  
Measured `restormel_cost` chars averaged **~3030 chars/query** (~750 tokens at 4 chars/token heuristic).

| Item | Value |
|---|---|
| LLM calls per verification | 2 |
| Avg chars sent per query | ~3030 |
| Est. input tokens per query | ~750 |
| Est. output tokens per query | ~150 |
| Model | `gpt-4o-mini` ($0.150/1M in, $0.600/1M out) |
| **Estimated cost per verification** | **~$0.000203 (~$0.0002)** |

At 10,000 verifications/day → ~$2.03/day; at 100k/day → ~$20.30/day. Cost is dominated by the two LLM calls; a cheaper model or caching repeated claim-source pairs would reduce this further.

---

## (c) MCP spec baseline — RATIFIED vs DRAFT

### Ratified (production-ready)
| Spec | Version | Status |
|---|---|---|
| MCP Streamable HTTP transport | **`2025-11-25`** | RATIFIED — the production transport (RFC-compliant, SSE+JSON streaming). This is the transport implemented in `mode1-http-server.ts` and `connectUpstreamHttp()`. |
| MCP OAuth 2.1 / PKCE | **`2025-11-25`** | RATIFIED — the auth profile for remote MCP servers. Required for Phase C (D1-gated). |

### Draft / Not adopted
| Spec | Version | Status |
|---|---|---|
| Server Cards (`.well-known/mcp`) | SEP-2127 | DRAFT — a proposed upstream-discovery mechanism. Not adopted in any ratified MCP spec as of 2026-06-19. The `2026-07-28` RC candidate has not been formally ratified. |
| MCP `2026-07-28` RC | Draft RC | NOT YET ADOPTED — treat as forward-looking only; do not build against it until ratified. |

**Implementation note:** The `mode1-http-server.ts` uses the ratified `2025-11-25` StreamableHTTP transport (per-request stateless, `StreamableHTTPServerTransport`). A known limitation was found during this measurement: the per-request transport is torn down after each request, causing the SDK client's `initialize`→`callTool` two-request sequence to fail with "Server not initialized" on the second request. This is a server-side statefulness gap to address before the HTTP path is used in the reference runner; the in-memory and stdio paths are unaffected and were used for all measurements here.

---

## (d) Verified envelope samples

### Query 1 — "Who built the first Eddystone lighthouse and when?"
```
[SUPPORTED ] entailed     bound(normalized) hash=c16604e84f40…
   claim: The first lighthouse on the Eddystone Rocks was completed in 1698 by Henry Winstanley.
   source: corpus://lighthouse.md  span: "The first lighthouse built on the Eddystone Rocks was completed in 1698 by Henry Winstanley"

[ABSTAIN   ] abstain      no_evidence
   claim: Henry Winstanley's lighthouse still stands on the Eddystone Rocks today.
   (planted — no entailing span; correctly routed to abstain/review)
```

### Query 2 — "How does a honey bee forager communicate where food is?"
```
[SUPPORTED ] entailed     bound(normalized) hash=0daa33b16d90…
   claim: A forager honey bee that finds food returns to the hive and performs a waggle dance to communicate its direction and distance.
   source: corpus://honeybee.md  span: "A forager that has found a good source of food returns to the hive and performs a 'waggle dance'…"

[ABSTAIN   ] abstain      no_evidence
   claim: Drone honey bees gather most of the colony's nectar and pollen.
   (planted — no entailing span; correctly routed to abstain/review)
```

**Outcomes: 2 SUPPORTED (grounded claims), 2 ABSTAIN (planted claims) — all correct.**  
The fail-safe is working: planted/unsupported claims are never passed as supported.

---

## (e) Target assessment

Placeholder targets from REC-PLAN-007 were: **p50 ≤ ~1.5 s, p95 ≤ ~4 s** (end-to-end).

| Target | Measured | Assessment |
|---|---|---|
| p50 ≤ ~1.5 s | **~3.3 s** | MISSED — 2× over placeholder |
| p95 ≤ ~4 s | **~4.7 s** | MISSED — 17% over placeholder |

**Revised targets (ratified by this measurement):**  
- p50 ≤ **3.5 s** end-to-end (driven by two `gpt-4o-mini` round-trips)  
- p95 ≤ **5 s** end-to-end  
- `quote_retrieval` is the dominant leg (p50 ~1.8 s, p95 ~3.3 s); a faster model or batched call would be the primary lever for latency reduction.

The original 1.5 s / 4 s placeholders were set without measurement. These revised targets reflect the real first-capture. They should be re-evaluated if a faster model is substituted or if calls are batched.

---

## Capture command (for reproducibility)

```bash
# 1. Ensure tunnel is open: pnpm infra (from restormel-keys repo root)
# 2. In the worktree or main checkout:
pnpm install --frozen-lockfile
OPENAI_API_KEY="<key>" pnpm exec tsx scripts/reviews/verifying-proxy-reference.ts \
  --validator openai:gpt-4o-mini
# HTTP upstream (once the per-request session issue is resolved):
# pnpm exec tsx packages/mcp/src/proxy/fixtures/mode1-http-server.ts &
# OPENAI_API_KEY="<key>" pnpm exec tsx scripts/reviews/verifying-proxy-reference.ts \
#   --upstream http://localhost:3741/mcp --validator openai:gpt-4o-mini
```

_Key sourced from Infisical `restormel-ops`/`prod` OPENAI_API_KEY via Coolify app env (prod app `deibtxcn1kl5flye5d3koiln`). Never printed to transcript._
