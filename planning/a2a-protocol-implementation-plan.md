---
id: REC-PLAN-014
title: "A2A (Agent2Agent) Protocol — Greenfield Implementation Plan (Door 3)"
class: planning
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-16
last-reviewed: 2026-06-16
review-interval: P6M
retention: review-only
related: [REC-ADR-005, REC-ADR-006]
---

# A2A (Agent2Agent) Protocol — Greenfield Implementation Plan (Door 3)

**Status: draft for founder review.** Plan only — no implementation until sign-off.
A decision record (**REC-ADR-007**, to follow) should formalise the commitment this plan
assumes. Flag-gated build (`RESTORMEL_A2A` / `_REMOTE`); **no live route or prod exposure**
until reviewed, mirroring the verifying-proxy programme (REC-ADR-005 / REC-PLAN-007).

## Decision basis (2026-06-16)

A naming + **conformance review** established two facts:

1. **Naming.** Across the repo, "AAIF" is used for an *"Agent-to-Agent Interaction Format"* —
   a **Restormel-owned model-execution envelope**, not a protocol. The acronym collides with the
   *Agentic AI Foundation*. (875 occurrences; zero refer to the foundation.)
2. **Conformance.** That envelope (`@restormel/aaif` v0.0.19) **is not, and does not interoperate
   with, the A2A protocol**: it is a single-shot in-process `{input, constraints, routing} →
   {output, provider, cost}` call with no wire protocol. Measured against the A2A spec: **0
   conforms, 3 diverge, 15 missing.** "Door 3" was, until now, an explicit *"hedge, not v1"*
   (REC-PLAN-007 §out-of-scope).

**Founder decision:** activate **Door 3 as real A2A** — build a spec-conformant A2A peer
greenfield, rather than rename a non-conformant envelope and claim protocol identity it lacks.
The existing `@restormel/aaif` package is **retained** as an internal Keys execution helper and
**renamed** to a neutral, non-protocol name under the separate naming-correction work (it is *not*
deleted and *not* relabelled "A2A").

## Why (strategic rationale)

- **Door 3 is the non-MCP interop path.** Door 2 (the verifying MCP proxy, REC-ADR-005) covers
  MCP clients; A2A covers agent-to-agent interop for frameworks that speak the emerging open
  **Agent2Agent** standard (now stewarded under the Linux Foundation).
- **The differentiator is verified context, not transport.** Restormel's novel asset — the
  **verified-context envelope** (`*VerifiedClaim*`: span + hash + cross-model entailment +
  abstention) — maps cleanly onto A2A as a **DataPart** or a registered **A2A extension**. The
  position is *"Verified Context as a first-class A2A peer"*: any A2A client can ask Restormel and
  get grounding/faithfulness-verified results over the wire. This is consistent with the company
  positioning (verified-context layer) and reuses the verifying-proxy EBV engine.
- **Standards-aligned, provider-neutral.** A2A is an open multi-vendor spec; conforming keeps
  Restormel interoperable without bespoke lock-in (consistent with the provider-equality
  principle).

## Conformance baseline (what exists vs what A2A requires)

| A2A requirement | Today | Target |
|---|---|---|
| Agent Card at `/.well-known/agent-card.json` | none | Phase 1 |
| JSON-RPC 2.0 over HTTPS transport | in-process function call | Phase 2 |
| Core methods (`message/send`, `tasks/get`, `tasks/cancel`…) | none | Phase 2–3 |
| Task object + lifecycle (8 `TaskState`s, `contextId`, history, artifacts) | stateless single-shot | Phase 3 |
| Message / Part / Artifact data model | `input: string` → `output: string` | Phase 4 |
| `securitySchemes` + transport auth | out-of-band bearer in examples only | Phase 5 |
| SSE streaming, push notifications | none | Phase 6 (optional) |

**Reuse map** (carry forward, don't rebuild):

| Existing asset | A2A role |
|---|---|
| `@restormel/aaif` runtime (Keys routing/cost execution) | backs `message/send` handler |
| Verified-context envelope (`*VerifiedClaim*`) | A2A **DataPart** payload / **extension** |
| `routing` / `cost` metadata | A2A Task & Message `metadata` |
| Ory Hydra resource-server validation (REC-PLAN-011, Phase C) | `securitySchemes` enforcement |
| Verifying-proxy EBV engine (REC-ADR-005) | verification applied to A2A responses |

## Architecture (target)

```
A2A client (any framework)  ──►  Restormel A2A peer  ──►  Keys / Connect (existing)
   Agent Card discovery      ◄──  JSON-RPC 2.0 + Tasks  ◄──   routing · execution · EBV verify
   verified Artifact (DataPart: VerifiedClaim envelope)
```

Net-new package (e.g. `@restormel/a2a`) exposing the A2A server surface; the existing renamed
execution envelope becomes the internal backend. Flag-gated; no live endpoint until reviewed.

## Phased plan (severity-ordered — blocking-interop first)

- **Phase 0 — Decision, spec pin, naming.** Write **REC-ADR-007** (adopt/build real A2A; supersede
  the "Door 3 = hedge" deferral). **Pin a specific A2A spec version** and record it; re-confirm the
  exact `capabilities` key set against that pin. Land the `@restormel/aaif` → neutral-name rename
  (separate naming-correction PR) so "A2A" is reserved for this work. Choose the new package name.
- **Phase 1 — Agent Card + discovery** *(blocks interop #1)*. Author the Agent Card document
  (`name`, `url`, `provider`, `version`, `protocolVersion`, `capabilities`, `skills[]`,
  `securitySchemes`, `security`, `defaultInputModes`/`defaultOutputModes`) and serve it at
  `/.well-known/agent-card.json` (+ legacy `agent.json`). Skills map to Keys/Connect capabilities
  (verified retrieval, routed execution).
- **Phase 2 — JSON-RPC 2.0 transport + core methods** *(blocks interop #2)*. HTTPS JSON-RPC
  endpoint dispatching `message/send` first, then `tasks/get`, `tasks/cancel`. Back `message/send`
  onto the existing Keys execution runtime.
- **Phase 3 — Task model + lifecycle** *(blocks interop #3)*. `Task` (`id`, `contextId`, `status`,
  `history`, `artifacts`) and the 8-state machine (submitted/working/input-required/completed/
  canceled/failed/rejected/auth-required). Persist on the operational Postgres.
- **Phase 4 — Message / Part / Artifact model** *(diverges → rework)*. Replace flat strings with
  `Message{role, parts[]}` (TextPart/FilePart/DataPart) and `Artifact{artifactId, name, parts[]}`.
  **Carry the verified-context envelope as a DataPart or a registered A2A extension** — the
  strategic core of this work.
- **Phase 5 — Security.** Declare `securitySchemes` (bearer/oauth2 via Ory Hydra + Keys); enforce
  transport auth, fail-closed, reusing the Phase C token-validation path (require `exp`, enforce
  `iss`).
- **Phase 6 — Optional capabilities** *(advertised via `capabilities`; non-blocking)*. SSE
  streaming (`message/stream`, `tasks/resubscribe`, `TaskStatusUpdateEvent` /
  `TaskArtifactUpdateEvent`); push notifications (`PushNotificationConfig` +
  `tasks/pushNotificationConfig/*`); `agent/getAuthenticatedExtendedCard`, `tasks/list`.
- **Phase 7 — Conformance + interop validation.** Validate against a reference A2A client/SDK
  (e.g. `a2a-python` / `a2a-js` sample agents) and the A2A TCK if available; publish a conformance
  statement. Then consider lifting the flag for a reviewed, scoped exposure.
- **Phase 8 — Later.** A2A **client** role (consuming other agents); additional transport bindings
  (gRPC, HTTP+JSON REST) only if a consumer needs them.

## Definition of done (v1 = "A2A-conformant verifying peer")

An external A2A client can: (1) fetch our Agent Card at the well-known URI; (2) `message/send` and
receive a `Task`; (3) poll `tasks/get` to a terminal state; (4) receive an `Artifact`; (5) with the
**verified-context envelope present as a DataPart/extension** — all validated against a reference
A2A client. Auth enforced via declared `securitySchemes`.

## Risks / open questions (for review)

- **Spec churn.** A2A is young; pin a version at Phase 0 and re-confirm capability keys at build
  time (the conformance review flagged `stateTransitionHistory` vs `extendedAgentCard` drift).
- **Statefulness.** A2A Tasks are stateful — adds persistence + a state machine the current
  envelope lacks; sizing/retention on the operational Postgres to confirm.
- **Verified-context mapping.** DataPart (simplest) vs a **registered A2A extension** (more
  correct, advertisable in the Agent Card) — recommend the extension route; needs a short design.
- **Auth alignment.** Reuse Ory Hydra (Phase C) vs A2A's Agent-Card-declared schemes — confirm the
  mapping.
- **Scope discipline.** v1 is the **server** (we answer A2A); client role + extra bindings deferred.
  Flag-gated, no prod exposure until Phase 7 review.
- **Effort.** Greenfield protocol surface — materially larger than the existing envelope; sequence
  after / alongside the verifying-proxy (Door 2) programme.

## Sequencing

Parallel to or following Door 2 (verifying MCP proxy). Independent, flag-gated, net-new package;
does not change the behaviour of the existing (renamed) execution envelope. Naming-correction PR is
a Phase-0 dependency so the `A2A` name is free.
