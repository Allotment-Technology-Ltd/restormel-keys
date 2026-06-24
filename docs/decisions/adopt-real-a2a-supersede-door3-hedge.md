---
id: REC-ADR-007
title: "ADR: Adopt/build real A2A (Agent2Agent); supersede Door-3 = hedge deferral"
class: decision
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-23
last-reviewed: 2026-06-23
review-interval: P12M
supersedes: REC-PLAN-007
related: [REC-PLAN-007, REC-PLAN-014, REC-ADR-005, REC-ADR-006, REC-ADR-001]
---

# ADR: Adopt/build real A2A (Agent2Agent); supersede Door-3 = hedge

**Status: draft — awaiting founder review.** No implementation until sign-off.
Companion: REC-PLAN-014 (planning/a2a-protocol-implementation-plan.md). Sits alongside
the verifying-proxy ADR (REC-ADR-005, Door 2) and gateway-migration ADR (REC-ADR-006).
Records the commitment REC-PLAN-014 assumes and pins the protocol spec version. Does NOT
authorise a live endpoint — exposure gated on REC-PLAN-014 Phase 7 review.

## Context
"Three doors": Door 1 = first-party verified retrieval over MCP; Door 2 = verifying MCP
proxy (REC-ADR-005); Door 3 = non-MCP agent-to-agent interop. Door 3 was an explicit
HEDGE, not a v1 commitment — REC-PLAN-007 listed it out of scope; REC-ADR-005 named
"Door 3 (non-MCP AAIF envelope)" as a hedge to keep, not build.

A naming + conformance review (2026-06-16, REC-PLAN-014) established:
1. The in-house "AAIF" envelope is a Restormel-owned, in-process model-execution envelope
   (@restormel/aaif v0.0.19) — `{input, constraints, routing} → {output, provider, cost}`
   with NO wire protocol. The acronym collides with the Agentic AI Foundation.
2. Measured against the A2A spec: 0 conform, 3 diverge, 15 missing — it cannot be
   relabelled "A2A".

So "Door 3 = hedge (relabel the envelope)" is dropped: the envelope is renamed to a
neutral non-protocol name (@restormel/aaif → @restormel/dispatch, AAIF* → Dispatch*),
freeing "A2A" for a genuine spec-conformant peer built greenfield.

## Decision
Adopt and build a real, spec-conformant A2A (Agent2Agent) peer as Door 3, greenfield, and
supersede the REC-PLAN-007 "Door-3 = hedge / out-of-scope" deferral.

- **D-1 Pin the spec:** A2A `1.0.0`, sourced from https://a2a-protocol.org/v1.0.0/specification
  (explicit version URL, not /latest/, so it can't drift). The `capabilities` key set,
  `/.well-known/agent-card.json` path, Agent Card signing, and v0.3→v1.0 negotiation must be
  re-confirmed against v1.0.0 at build time (REC-PLAN-014's table predates 1.0).
- **D-2 Build greenfield:** net-new package (working name @restormel/a2a) exposing the A2A
  server surface (Agent Card, JSON-RPC 2.0, Task/Message/Part/Artifact, securitySchemes).
  The renamed @restormel/dispatch envelope is RETAINED as the internal Keys execution backend
  behind the A2A message/send handler — not deleted, not relabelled "A2A".
- **D-3 Verified context is the payload, not the transport:** carry the *VerifiedClaim*
  envelope over A2A as a DataPart or (preferred) a registered A2A extension in the Agent Card.
  "Verified Context as a first-class A2A peer." Reuses the verifying-proxy EBV engine
  (REC-ADR-005).
- **D-4 Reserve "A2A" for this work; sequence the rename FIRST:** the envelope→@restormel/dispatch
  PR is a hard Phase-0 dependency and must land before any A2A package is created. "AAIF" kept
  only where it genuinely means the Agentic AI Foundation (~0 today).
- **D-5 Flag-gated:** build behind RESTORMEL_A2A / RESTORMEL_A2A_REMOTE; no live route or prod
  exposure until REC-PLAN-014 Phase 7 + high-risk-security review.

## Options considered
1. Keep Door 3 as a hedge / relabel envelope as "A2A" — rejected (0 conformance; misleads).
2. Drop Door 3 entirely (MCP-only) — rejected (forfeits open-standard multi-vendor interop).
3. Adopt a third-party A2A server wholesale — not chosen now (reference SDKs used for Phase-7
   conformance validation; peer must wrap Restormel Keys/Connect + EBV). Revisit if a conformant
   OSS server reduces surface materially.
4. Pin /latest/ — rejected (young, churning spec; pin immutable v1.0.0).
5. Build the A2A client role now — deferred (v1 is the server role; client + gRPC/HTTP+JSON
   bindings are Phase 8).

## Consequences
- Supersedes the REC-PLAN-007 Door-3 deferral; REC-ADR-005's "Door 3 stays as a hedge" updated
  in spirit (Door 3 now active; the "AAIF envelope" is the renamed @restormel/dispatch backend).
- Naming dependency: envelope-rename PR is a hard Phase-0 prerequisite.
- New build surface: stateful protocol peer (Agent Card, JSON-RPC, Task lifecycle, persistence
  on operational Postgres).
- Reuse, not rebuild: Keys runtime, verified-context envelope, EBV engine (REC-ADR-005), Ory
  Hydra resource-server validation (REC-PLAN-011) carry forward.
- Spec-pin maintenance: v1.0.0 reviewed on P12M cadence; a bump is a deliberate ADR amendment.
- Records norm: if @restormel/a2a ships, stage governance/asset-inventory.yaml (and suppliers.yaml
  if it adds an external dependency such as a managed Neon instance).

## Dependencies / blockers
- Naming-correction PR (Phase-0) — HARD prerequisite (frees "A2A").
- A2A v1.0.0 capability/key re-confirmation at build time (D-1) — before Phase 1.
- Ory Hydra (REC-PLAN-011) — backs A2A securitySchemes (Phase 5); not a Phase 1–4 blocker.
- Founder sign-off — no code before approval (review this ADR + REC-PLAN-014 together).

## Next step
Founder review alongside REC-PLAN-014 (esp. the v1.0.0 pin and the REC-PLAN-007 supersession).
On sign-off: land the naming-correction PR (Phase 0), then begin REC-PLAN-014 Phase 1 under flag.
No prod exposure until Phase 7.
