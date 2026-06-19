---
title: "Wrap your MCP server — verifying proxy quickstart (W2-2)"
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-19
last-reviewed: 2026-06-19
review-interval: P6M
related: [REC-PLAN-009, REC-PLAN-007, REC-ADR-005]
---

# Wrap your MCP server — verifying proxy quickstart

**Audience:** Integrators who operate their own MCP server and want Restormel to return
faithfulness-verified envelopes over its answers. You bring the MCP server; Restormel proxies it
and verifies each claim against the sources your server already cited.

**What this verifies (D-0):** grounding and faithfulness — whether each claim is entailed by a
verbatim span in the sources your server returned. It does _not_ detect misattribution across
multiple independent sources; that is a multi-source ingestion property outside v1 scope.

**What's available today:** the proxy core is live on `main` — the MCP client leg, the
verification engine, and a reproducible reference runner you can point at any Mode-1 server right
now. The hosted multi-tenant route (`/mcp` with OAuth) is Wave-2 and is noted below as "coming".

---

## 1. The Mode-1 contract your server must satisfy

The verifying proxy is a Mode-1 proxy. That means your MCP server must expose at least one tool
whose result is a JSON object with this shape, serialised as a text content block:

```json
{
  "answer": "A synthesised answer to the query.",
  "claims": [
    "Claim one, as a discrete, checkable sentence.",
    "Claim two."
  ],
  "sources": [
    {
      "id": "source-1",
      "text": "The full verbatim passage that grounded this answer.",
      "uri": "https://example.com/doc#section"
    }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `answer` | Yes | The synthesised answer. Used as a single implicit claim if `claims` is absent. |
| `claims` | Recommended | Explicit decomposed claims. Each is verified independently. |
| `sources[].id` | Yes | Stable identifier for this source within the response. |
| `sources[].text` | Yes | The verbatim passage the claim is grounded against. The proxy binds claim spans to this text. |
| `sources[].uri` | Optional | A URL for the original document. Included in the envelope for provenance display. |

The MCP tool must return this payload as the `text` field of a `content[0]` block with `"type":
"text"`. Tools that return structured/binary content instead of a text block are out of v1 scope
(`R-nontext`) and will route every claim to review.

This is the same shape as a GraphRAG-style tool that retrieves from a knowledge graph and returns
both a synthesised answer and the passages it drew from. If your server already does this, it
satisfies the contract with no modification.

A local reference fixture at
`packages/mcp/src/proxy/fixtures/mode1-upstream.ts` exposes exactly this shape over a small
bundled corpus. The `MODE1_TOOL_NAME` exported from that module (`graph_answer`) is the tool
name the fixture registers.

---

## 2. Point the verifying proxy at your server

The reference runner at `scripts/reviews/verifying-proxy-reference.ts` is the reproducible entry
point. It spins up the proxy client, calls your upstream, and runs verification.

### Run the bundled fixture (no server needed, no keys)

```sh
pnpm exec tsx scripts/reviews/verifying-proxy-reference.ts
```

This links the proxy client to the local Mode-1 fixture over the MCP SDK's in-memory transport
and runs two queries through the verification pipeline. No credentials are required; the stub
validator produces deterministic results. Use this to confirm your local checkout works before
pointing at a real server.

### Point at your own MCP server via stdio

If your server speaks MCP over stdio:

```sh
pnpm exec tsx scripts/reviews/verifying-proxy-reference.ts \
  --upstream stdio:node,/path/to/your-server.js \
  --validator openai:gpt-4o-mini
```

`--upstream stdio:<command>[,<arg>...]` spawns your server as a subprocess and connects over the
SDK's `StdioClientTransport`. This maps to `connectUpstreamStdio` in `packages/mcp/src/proxy/client.ts`.

### Choose a validator that is independent of your answer author

`--validator <family>:<model>` selects the cross-model entailment judge. The validator family
must differ from the family of the model that produced the upstream answers (D-c independence
assertion). If the same family is detected, the proxy fails closed — all claims abstain and route
to review.

Supported families and example models:

| Family | Example | Key env var |
|---|---|---|
| `openai` | `openai:gpt-4o-mini` | `OPENAI_API_KEY` |
| `anthropic` | `anthropic:claude-haiku-4-5-20251001` | `ANTHROPIC_API_KEY` |
| `together` | `together:meta-llama/Llama-3.3-70B-Instruct-Turbo` | `TOGETHER_API_KEY` |
| `google` | `google:gemini-2.0-flash` | `GOOGLE_API_KEY` or `GEMINI_API_KEY` |

If you used an OpenAI-family model to generate your upstream answers, choose `anthropic`,
`together`, or `google` as the validator. Independence is the property that makes entailment
meaningful: a model judging its own outputs is not a useful faithfulness check.

Omitting `--validator` uses the deterministic stub, which is only useful for smoke-testing the
pipeline.

---

## 3. Read the verified envelope

Each query produces a `VerifiedEnvelope`. The runner prints one block per claim:

```
── Query: Who built the first Eddystone lighthouse and when?
   legs_ms: callTool=12 quote_retrieval=820 judge_entailment=1210 layer1_bind=2
   validator=openai:gpt-4o-mini restormel_cost={calls:4, chars:3820}

   [SUPPORTED  ] entailed     bound(exact) hash=a3f8c1d2e5b7…
      claim: The first lighthouse on the Eddystone Rocks was completed in 1698 by Henry Winstanley.

   [ABSTAIN    ] not_entailed no_evidence
      claim: Henry Winstanley's lighthouse still stands on the Eddystone Rocks today.
```

### Envelope fields

Each claim in `VerifiedEnvelope.claims` is an `EnvelopeClaim`:

| Field | Meaning |
|---|---|
| `claim` | The text of the claim being verified. |
| `status` | `supported`, `unverified`, or `abstain` — see the status table below. |
| `binding.status` | `bound` (a verbatim span was located in the source text) or `unbound` / `no_evidence`. |
| `binding.span.quote` | When bound: the verbatim quote located in the source. |
| `binding.span.match` | Match quality: `exact`, `normalized`, or `fuzzy`. |
| `source_ref.source_hash` | SHA-256 of the source text at verification time (reference-by-hash; no source bytes are stored). |
| `source_ref.uri` | The source URI your server provided, if any. |
| `entailment.verdict` | `entailed`, `not_entailed`, or `abstain`. |
| `entailment.confidence` | Confidence in [0,1] from the validator, or `null` on the abstain path. |
| `meta.validator_model` | Resolved model string, e.g. `openai:gpt-4o-mini`. |
| `meta.legs_ms` | Per-leg latency breakdown (see section 4). |
| `meta.restormel_cost` | `{calls, chars}` — the proxy's own validator spend. |

### Status table (fail-safe)

| Binding | Entailment | Status | Meaning |
|---|---|---|---|
| `bound` | `entailed` (confidence ≥ threshold) | `supported` | Claim is grounded in a verbatim source span. |
| `bound` | `not_entailed` | `unverified` | A span was found but the claim is not entailed by it. |
| Anything else | Any | `abstain` | No span, validator error, timeout, low-confidence, or missing verdict. |

`abstain` is the fail-safe outcome. An error, a timeout, or a missing verdict is **never** mapped
to `supported`. Claims that abstain or are unverified route to review — they are not silently
passed through.

Low-confidence `entailed` verdicts (below the EBV low-confidence floor) also route to `abstain`
rather than `supported`. This is inherited from the EBV engine semantics.

---

## 4. Latency and cost

The verification pipeline adds two LLM round-trips over a bare upstream call: one for quote
retrieval and one for entailment. These dominate the added latency and are roughly independent of
how fast your upstream is.

The runner reports four legs in `meta.legs_ms`:

| Leg | What it measures |
|---|---|
| `callTool` | Proxy client → upstream MCP server (your server's round-trip). |
| `quote_retrieval` | Validator call to retrieve verbatim candidate quotes from the cited source text. Zero when your server already supplies quotes. |
| `judge_entailment` | Validator call to judge entailment of each claim against its bound span. |
| `layer1_bind` | Layer-1 deterministic bind/hash (string ops — effectively free). |

**Measured targets (REC-PLAN-007):** end-to-end p50 ≈ 1.5 s added overhead / p95 ≈ 4 s added
overhead over a bare passthrough, with a small fast validator (e.g. `gpt-4o-mini` or
`claude-haiku`). These targets are placeholders to be ratified against the first real
measurement; they are a claim to be earned, not a guarantee. Run the reference runner against your
own server and validator to get numbers for your setup.

**Cost:** the proxy's own validator spend (`restormel_cost`) covers quote retrieval and
entailment. In stub mode this is zero. With a real validator it is typically a few thousand
characters per query at temperature 0. Your upstream's own model spend is not measured here.

Mitigations if latency is a concern: cache on `(claim, span, source_hash, validator)`; raise the
abstention threshold to skip low-stakes claims; use a fast small validator for quote retrieval.
These are optimisations — do not apply them before measuring.

---

## 5. Hosted multi-tenant proxy (coming — Wave 2)

The hosted `/mcp` route — where you register your upstream endpoint, and Restormel proxies it
over OAuth 2.1/PKCE with per-tenant isolation — is **Wave-2 (Phase C)** and is not yet available.
It is hard-gated on D1 (auth provider decision) and covers:

- Registration of upstream MCP targets per workspace.
- Egress allow-list and SSRF guard for user-supplied upstream URLs.
- Request-scoped BYO-key validator with independence enforcement.
- Multi-tenant isolation: tenant A's token can never resolve tenant B's upstream.

Until the hosted route ships, the integration path is the reference runner described above:
clone the repo, point `--upstream` at your server, and consume the printed envelopes or adapt
the runner for your own harness. The verification engine and the MCP client leg are on `main` and
stable.

---

## Engineering reference

| Artefact | Path |
|---|---|
| MCP client leg | `packages/mcp/src/proxy/client.ts` |
| Mode-1 upstream fixture | `packages/mcp/src/proxy/fixtures/mode1-upstream.ts` |
| Verification façade | `packages/connect-core/src/proxy/verify-envelope.ts` |
| Types | `packages/connect-core/src/proxy/types.ts` |
| Reference runner | `scripts/reviews/verifying-proxy-reference.ts` |
| Phase A build spec | `planning/w2-1-phase-a-reference-integration.md` (REC-PLAN-009) |
| Phased implementation plan | `planning/w2-0-verifying-proxy-implementation-plan.md` (REC-PLAN-007) |
| Decision record | `docs/decisions/verifying-proxy-over-user-mcp.md` (REC-ADR-005) |
