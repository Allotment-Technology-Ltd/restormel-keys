---
title: Connect — agent memory write API (Stage 3.4)
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-11
last-reviewed: 2026-06-13
review-interval: P12M
---

# Connect — agent memory write API (Stage 3.4)

**Status:** Reference (integrator)
**Canonical product:** [docs/product/CONNECT-PRODUCT.md](../product/CONNECT-PRODUCT.md)

`POST /connect/v1/memory` lets an agent submit observations into a workspace knowledge graph as **verified memory**. Every observation runs the **same EBV quality gate as document ingest** (no parallel pipeline) before it is persisted as a claim — nothing reaches retrieval unverified.

## What "evidence" means for an observation

Document ingest binds claims against a crawled/uploaded source. An agent observation has no Restormel-fetched source, so the caller supplies the evidence itself:

| Field | Meaning |
| --- | --- |
| `evidence.quote` (≤2000 chars) | The **exact verbatim text** the agent saw. It is bound character-for-character (exact → normalized → bounded fuzzy) — never paraphrased. |
| `evidence.context` (≤8000 chars, optional, recommended) | The surrounding passage the quote appears in. Stored verbatim as the observation's source version, so accepted spans stay deterministically re-checkable. The quote **must appear inside it** or the observation lands `unbound` → review. |
| `evidence.source_ref` (≤500 chars, optional) | Where the agent saw it (URL, document title, tool name). Audit metadata only — Restormel does not fetch it. |

This evidence is **agent-attested**: the trust root is the submitting agent, not a Restormel-crawled document. Provenance makes that explicit — the submission is registered as a source of kind `agent_observation` carrying the submitting key id (never raw key material). Under EBV:

- **bound + entailed → `supported`** (reaches strict verified retrieval),
- **no evidence → local abstention → `unverified`** (review queue) — an observation with no verifiable evidence span can be at best inferred/unverified, **never supported**,
- **quote not found in its own context → `unbound` → `unverified`** (review queue),
- **bound but not entailed → remediation** (same core + strictness policy as ingest): repaired text is re-judged span-scoped; no-basis observations are **soft-excluded** (`rejected`, reversible, never retrievable).

Every observation comes back with its final `verification_state`, `evidence_binding`, `outcome` (`accepted` / `review` / `rejected`), and transparent `reasons`.

## Claim identity and temporal validity

Accepted observations become claim versions through the same Stage 3.2 machinery as ingest (`claim_key` identity, `connect_claim_versions`). Each submission uses a unique source key (`agent:<request-id>`), so memory writes never supersede earlier memory; versions open with `valid_from = now()` and `valid_to = NULL`, participating in Stage 3.3 temporal validity (`as_of` queries, version blocks) automatically.

## Request shape and size limits

```jsonc
POST /connect/v1/memory
Authorization: Bearer rk_…            // Gateway key (workspace-scoped)
{
  "workspace_id": "…",                // required (project_id optional per key scope)
  "observations": [                   // 1–10 per request (one entailment batch)
    {
      "text": "Paris is the capital of France.",        // ≤2000 chars
      "evidence": {
        "quote": "Paris is the capital of France",       // ≤2000 chars
        "context": "The handbook notes that Paris …",    // ≤8000 chars
        "source_ref": "https://example.com/geo"          // ≤500 chars
      }
    }
  ]
}
```

- Max **10 observations** per request (`CONNECT_MEMORY_MAX_OBSERVATIONS`) — sized to one span-scoped entailment judge batch. Memory writes are a small, bounded validation pass, never a bulk-ingest channel (use ingest jobs for documents).
- Hard request-body ceiling: **256 KB** (rejected `413` before JSON parsing).
- Fail-closed dependencies: if no validation route/provider credentials are configured the request is refused `503` — observations are **never persisted "to verify later"**.

## Rate limit (documented per-key window)

The repo has no shared route rate-limit middleware, so the route applies a simple documented fixed window (`apps/dashboard/src/lib/server/connect-v1/memory-rate-limit.ts`):

- **Budget:** `CONNECT_MEMORY_RATE_LIMIT` requests (default **10**) per `CONNECT_MEMORY_RATE_WINDOW_MS` (default **60s**) per key identity — i.e. ~100 observations/minute per key by default, each still individually judged.
- **Identity:** the authenticated key id (gateway/management); session auth falls back to `authType:userId:projectId`. Never derived from raw key material.
- **Ordering:** auth runs **first** — unauthenticated traffic cannot consume or probe a key's budget.
- **Scope:** in-memory, per Node process. The dashboard deploys as a single instance (Coolify, Stage 2 infra); horizontal scaling multiplies the budget by instance count — acceptable for an abuse guard; revisit with shared storage (Postgres/Redis) if that changes.
- On limit: `429` with `Retry-After` header and `retry_after_seconds` in the body.

## MCP tool

`connect.memory.write` on `@restormel/mcp` (pairs with `connect.retrieve_verified`):

- Env: `RESTORMEL_CONNECT_API_BASE`, `RESTORMEL_GATEWAY_KEY`, `RESTORMEL_WORKSPACE_ID`
- Validates the payload against the contract schema locally before any network call; surfaces upstream `429`/`503` transparently (`RST_CONNECT_RATE_LIMITED` with `retry_after_seconds`, `RST_CONNECT_MEMORY_WRITE`).
- Gated by the `connect` module flag like every `connect.*` suite tool.

## Response

`200` with per-observation results plus a summary:

```jsonc
{
  "contract_version": "1.0",
  "request_id": "…",
  "source_id": "…",                       // source row registering this submission
  "provenance": { "kind": "agent_observation", "key_id": "…", "auth_type": "gateway_key" },
  "results": [
    {
      "index": 0,
      "unit_id": "…",
      "claim_key": "…",                   // deterministic Stage 3.2 identity
      "text": "…",                        // final stored text (remediation may repair it)
      "verification_state": "supported",  // supported|inferred|unverified|contradicted|excluded
      "evidence_binding": "bound",        // bound|unbound|no_evidence
      "outcome": "accepted",              // accepted|review|rejected
      "repaired": false,
      "reasons": ["entailment_entailed"]
    }
  ],
  "summary": { "supported": 1, "inferred": 0, "unverified": 0, "excluded": 0, "embedded": 1 },
  "warnings": []                          // partial-write/embedding degradation — reported, never hidden
}
```
