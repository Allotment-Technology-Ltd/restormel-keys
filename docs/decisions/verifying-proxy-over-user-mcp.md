---
id: REC-ADR-005
title: "ADR: Verifying proxy over users' own MCP servers (Door 1 → Door 2)"
class: decision
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-15
last-reviewed: 2026-06-15
review-interval: P12M
related: [REC-PLAN-007, REC-ADR-001]
---

# ADR: Verifying proxy over users' own MCP servers (Door 1 → Door 2)

**Status: draft — awaiting founder review.** No implementation until sign-off
(`00-bootstrap-gate`). Companion: the phased plan **REC-PLAN-007**
(`planning/w2-0-verifying-proxy-implementation-plan.md`). Builds on the EBV ADR
(`docs/decisions/evidence-bound-verification.md`) and the W2-0 reconciliation + gap analysis in the
operator pack (`restormel-ops`: `gtm/RECONCILIATION.md`, `gtm/W2-0-gap-analysis.md`, reconciled
2026-06-15). **This draft has been red-teamed (Opus) — see "Verification semantic" (D-0), which
narrows what "verified" can mean for a proxy.**

## Context

Today Restormel ships **Door 1**: a first-party knowledge-graph-over-MCP server (`packages/mcp`
stdio + `apps/mcp-server` over a Surreal/Neo4j graph). This is **table stakes** — the KG/vector
vendors all ship MCP servers that return raw data. The wedge (**Door 2**) is a **verifying proxy**:
it sits between a user's own MCP server (their graph) and their MCP client (Claude), returning
**verified envelopes** over the upstream's responses. Planning frames this as the Stage-5
"verifying-proxy spike," gated on Stage-3 remote-readiness, gated in turn on **D1** (remote-MCP auth
provider) and **D2** (Zuplo endgame).

Repo-grounded facts from the gap analysis that shape this decision:

1. The **EBV engine is pure/store-free/model-injected** (`connect-core/ingest/evidence-binding.ts`,
   `entailment.ts`); the efficacy harness runs the bind→hash→entail loop over in-memory text with no
   DB.
2. **Two pipelines exist; the obvious one is wrong.** `/connect/v1/verify` is the *Knowledge-Verify*
   pipeline (`reasoning-core`: claim-extraction + reasoning-quality + constitution scoring) — it does
   not emit span+hash+entailment envelopes. The proxy must wrap the EBV functions, not this endpoint.
3. **No MCP client code exists** — the proxy must be both MCP server (to the client) and MCP client
   (to the upstream). SDK client classes are present (`@modelcontextprotocol/sdk@1.29.0`).
4. **Tenancy is federated by connection** (`knowledge_graph_targets UNIQUE(workspace_id)` →
   `buildWorkspaceGraphStore`); the graph has no `workspace_id` column; isolation is a single
   resolver lookup behind the `authorizeKnowledgeWorkspaceRequest` chokepoint — **no defence in
   depth**.
5. **D1 is a hard blocker for remote**: there is no path today from an OAuth token to a tenant.

## Decision

**Reposition (widen) from Door 1 to a verifying proxy over users' own MCP servers/graphs (Door 2).**
This is a *widening*, not an abandonment: the EBV engine, the server shell, and the first-party
integration all remain. What changes is that Restormel can verify a user's *own* upstream, not only
its own graph. Door 1 (first-party verified retrieval) and Door 3 (non-MCP AAIF envelope) stay as
hedges.

### D-0 — What "verified" means for a proxy (the load-bearing definition)

A proxy sees **one upstream tool result**, not a multi-source corpus. Therefore:

> **The proxy delivers FAITHFULNESS / GROUNDING verification, not misattribution detection.** Given
> an answer/assertion and the supporting context returned *alongside it*, the proxy verifies that
> each claim binds to a verbatim, hashed span in that context (Layer 1) and is entailed by it under a
> Restormel-independent validator (Layer 2), **abstaining to review** when it is not. The
> **misattribution structural-catch — EBV's flagship — is a property of multi-source *ingestion*** (a
> claim checked against its *cited* source vs. where it is actually true) and **does not transfer to a
> single-upstream proxy.**

This narrows the public claim from "we catch misattribution in your KB" to "re-checkable, hash-bound,
cross-model-entailed, abstaining **grounding** over your own stack." Span provenance, source-version
hashing, cross-model entailment, deterministic re-check, and abstention all **do** transfer; the
misattribution tier does not. (No public surface currently claims misattribution-catch — it is an
internal EBV efficacy tier — so messaging is largely unaffected, but the moat description must be
honest about this.)

Verification modes:
- **Mode 1 (v1 target):** the upstream tool returns an **answer/claims with supporting sources**
  (GraphRAG-style query tools). Claim ⊥ source by the upstream's own structure → full bind+hash+entail
  applies. **The reference integration must target a Mode-1 tool.**
- **Mode 2 (future):** verify the *agent's* answer against retrieved context — requires the proxy to
  see the answer leg (a verification tool or answer-visible topology). Not in v1 pass-through.
- **Mode 0 (weak — avoid):** raw passage/vector/row stores (bare Neo4j/Pinecone/Weaviate retrieval)
  return context with no internal claim/source split; the proxy can only Layer-1-stamp integrity.
  Not the reference-integration pick.

### D-a — Reuse the EBV engine via a stateless `verifyEnvelope()` façade

Assemble `bindEvidenceSpan` → `contentHash` → `judgeEntailment` (reuse `evidence-binding.ts` /
`entailment.ts` as-is), applied per D-0 Mode 1. **Honest scope:** the façade is assembly; the real
net-new work is (i) extracting the claim/answer + its cited spans from the upstream's *structured*
result, and (ii) the request-scoped validator (D-e). Do **not** route through `/connect/v1/verify`.

### D-b — Net-new MCP client + dispatch layer

`Client` + a client transport from the SDK: receive tool call → forward to the registered upstream →
capture `CallToolResult` → verify → return verified envelope as MCP `structuredContent`.

### D-c — Validator independence as an enforced, honestly-defined control

The control is: **the Layer-2 validator is Restormel-selected and independent of whatever produced
the content under check.** In a proxy the content author is often unknown or non-LLM, so we do **not**
rely on "validator family ≠ author family." We enforce that the validator is a Restormel-chosen
independent family and **fail closed to a Restormel-side validator** when a BYO key would otherwise
make the validator the same family as the answer's author. *(This corrects an earlier framing that
cited `plan.ts` as the independence convention — that code is a Gemini-preference heuristic, not an
independence assertion.)*

### D-d — Tenancy: row-isolated control plane + federated per-tenant data plane

Model the upstream MCP like `knowledge_graph_targets` (per-workspace, encrypted secret,
connection-as-boundary). The concrete isolation control beyond the chokepoint is a **cross-row
uniqueness guard on `(endpoint, namespace, database)` for the new `upstream_mcp_targets`** so two
workspaces cannot resolve the same physical upstream. **Honest limit:** a BYO upstream carries no
independent tenant-tag, so isolation = correct resolution + this collision guard + the chokepoint;
there is no generic "second source of truth" to cross-check against. Do not retrofit row-isolation
onto the BYO data plane (the customer's store is theirs).

### D-e — BYO-key for entailment is net-new and D1-gated

The existing route path decrypts a **stored, workspace-bound** credential (keyed on
`projectId`+`workspaceId`, which themselves come from auth) — it is **not** request-scoped customer-key
injection, and it cannot be exercised before D1. Request-scoped BYO key is net-new. Until it lands
(and only with D-c enforced), the validator runs Restormel-side and per-verification cost is
**metered, not assumed customer-borne**.

### D-f — Spec baseline: target ratified MCP (`2025-11-25`), design stateless

Streamable HTTP (ratified) for transport; OAuth 2.1/PKCE + CIMD (ratified; CIMD a SHOULD) for the
remote path. **Do not depend on** Server Cards `.well-known` (draft SEP-2127) or the `2026-07-28` RC
(target ship, not ratified). Spec dates are sourced from the gap analysis / external tracking and
**must be re-checked at build time** (some are future-dated). Server statelessness ≠ client-leg
conformance — the client leg is net-new and unproven.

### D-g — Source provenance in the envelope: open product decision (not decided here)

EBV indexes offsets into a *stored* source + hash. For a proxy over content we do not store, either
(a) reference the upstream + hash, or (b) embed the verified bytes (a **new envelope field** with
size/PII/DPIA implications — echoing customer content through Restormel is a data-handling event under
the records norm). Flagged as plan **R5**; decide before the "deterministically re-checkable by
anyone" claim is made.

### D-h — Egress safety (SSRF)

The proxy dials a **user-supplied upstream URL** → SSRF risk (localhost, cloud IMDS, internal hosts).
Require URL allow-listing / egress restrictions and the high-risk-security review gate before any
non-local upstream.

## Options considered

1. **Stay Door 1 only** — rejected: table stakes; abandons the wedge.
2. **Rebuild a proxy verifier from scratch** — rejected: the EBV core is reusable.
3. **Verify via `/connect/v1/verify`** — rejected: wrong pipeline (Knowledge-Verify).
4. **Misattribution-catch over the proxy** — rejected: needs multiple distinct cited sources; a
   single-upstream proxy structurally cannot. Chose **faithfulness/grounding** (D-0).
5. **Row-isolated shared data plane** — rejected: incompatible with BYO-graph.
6. **Remote/multi-tenant first** — rejected: D1/D2-blocked and depends on unsolved controls; prove
   the wedge **locally** first.
7. **Push entailment cost to the customer's key now** — deferred: net-new and unsafe until D-c is
   enforced (a single-family customer key would collapse verification into self-grading).

## Consequences

- **Reuse, not rebuild** for the verify core; net-new = MCP client/dispatch, claim/source extraction
  from upstream results, the independence control, registration, and (remote) auth + tenancy.
- **Narrower, honest claim:** faithfulness/grounding + cross-model entailment + abstention — not
  misattribution detection (D-0). Update the moat description accordingly.
- **New release gate:** validator independence (D-c) before any BYO-key entailment.
- **New security gate:** SSRF/egress controls (D-h) + tenancy collision guard (D-d) before remote
  exposure; routes through the high-risk-security review.
- **Measurement:** latency budget **and** Restormel-side cost measured from Phase A; customer-key cost
  is not measurable until D-e/D1.
- **Claims integrity:** the "works with the MCP servers you already use" promise publishes only once
  the reference integration is live (build-first / publish-when-live).
- **Records norm:** four existing ADRs are unnumbered. Recommended backfill (chronological,
  architecture only): `aaif-envelope-placement` → REC-ADR-002, `evidence-bound-verification` →
  REC-ADR-003, `verified-memory-incremental-ingest` → REC-ADR-004; this ADR takes **REC-ADR-005**.
  `restormel-keys-pricing-conversion-ux-v2` is a *business* decision → it should be **REC-DEC-001**,
  not an ADR id. Flagged, not fixed here (those files are out of this change's scope).

## Dependencies — D1 and D2 (explicit blockers)

- **D1 (remote-MCP auth provider)** — **HARD blocker** for the remote/connect-to-Claude path:
  OAuth resource-server validation, CIMD, and the token→`workspace_id` resolver cannot be built
  correctly until D1 picks the provider and the tenant-mapping model.
- **D2 (Zuplo endgame)** — **routing/ops only, not a logic blocker.** Keep Zuplo off the verification
  path; serve `/mcp` from the dashboard on Coolify; D2 settles the OSS-gateway endgame (→ its own ADR).

Phase A (the local reference integration) needs **neither** D1 nor D2.

## Next step

Founder review of this ADR + REC-PLAN-007 — in particular the D-0 narrowing. On sign-off: build
Phase A under the plan; D1/D2 are taken up in parallel as the remote path approaches. No code before
sign-off.
