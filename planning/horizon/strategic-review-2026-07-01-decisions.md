---
id: REC-DEC-002
title: "Strategic Review Decisions Log — 2026-07-01"
class: decision
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-07-01
last-reviewed: 2026-07-01
review-interval: P12M
approved-by: founder
approved-on: 2026-07-01
retention: permanent
related: [REC-ADR-008, REC-PLAN-022, REC-GOV-022, REC-PLAN-024]
---

> **Filed via Cowork horizon handover, 2026-07-01.** Decisions log from handover payload §3. The four review decisions below carry **founder approval (2026-07-01)**; the two deliberate reopenings (dual-mode verification; Stage-5 measurement decoupling) are founder-approved and additive to settled `/planning` and ADR items. **Proposed id — reconcile at merge.**

## Founder-approved, 2026-07-01 (strategic review)

- **D-2026-07-01-1 — Dual-mode verification engine.** Batch-at-ingest for first-party corpora (door 1) + in-path, cache-first, latency-budgeted verification for the proxy (door 2). One engine, two modes; on budget exhaustion or residual uncertainty a claim is returned labelled-unverified (annotated mode) or withheld (strict mode) — abstention doubles as the answer to latency. Supersedes the batch-only framing of ADR v1; embodied in **ADR v2 (REC-ADR-008).**
- **D-2026-07-01-2 — Stage-5 economic measurement decoupled from Stage 3.** The proxy go/no-go economics (added latency + cost per verified third-party response) are produced by the cascade-validation harness now, without waiting for remote serving / D1 / D2. The Stage-3 gate governed *serving* (transport, auth); measurement builds on its intent rather than re-deciding it.
- **D-2026-07-01-3 — P1/P2 proxy-tier product framing.** Tier P1 = response-groundedness (any source; grounding-vendor-comparable; explicitly not the moat). Tier P2 = full span + source-version-hash depth where sources are ingested/hashed (the moat over third-party context). Honest tier-labelling is mandatory — never imply P2 depth on a P1 check. Feeds D3 positioning.
- **D-2026-07-01-4 — Extraction confirmed as connector instance #1.** Embedding/retrieval is instance #2, reusing the same contract; voyage-context-4 (HS-015) is the lead candidate.

## Carried decisions (from the June 2026 sessions; recorded here if not already captured elsewhere)

- **GTM: stay invite-only / learning-mode — do NOT open self-serve yet.** Rationale: high-value demand is regulated/sovereign and won't convert via signup; category-capture risk; the falsifiable promise shouldn't be exposed on arbitrary corpora; remote multi-tenant MCP is gated on D1/D2. **Flip conditions:** a competitor opens a *verifying* proxy; the in-domain bar holds on diverse out-of-domain corpora; verification re-overtakes retrieval as top priority.
- **Product principle: relentless simplicity.** Opinionated managed defaults; pluggable by exception. Three UX tiers: Default (zero choices) → Presets (one-click vetted bundles) → curated Plug-points (short per-slot dropdown + optional BYO). Every menu option is pre-vetted to preserve the four invariants; the system enforces them (e.g. blocks a checker sharing the generator's model family). *(One-page write-up offered, not yet produced.)*
- **Sovereignty reframed as a global, configurable product dimension** — deployment (managed / self-host / air-gapped) and region are presets, not filters; licensing is the gate for any model used in verification-as-a-service.
- **HS-014 reframe:** Mistral OCR 4 is a connector + distribution opportunity + competitive hedge, not a COGS line.
- **Positioning (D3) inputs:** "verified ≠ fresh/governed"; "Mistral extracts, we prove it" / "verified ≠ extracted"; "supply-chain provenance, for AI context" (SLSA/Sigstore analogy, HS-012); plus the P1/P2 framing (D-2026-07-01-3).

## Open decisions (status: OPEN — founder to rule; keep visible)

- **D1 — remote-MCP auth provider** (self-host OSS vs managed). Gates Stage 3 (remote serving). *Does not gate the harness* (per D-2026-07-01-2).
- **D2 — Zuplo endgame** → needs its own ADR. Gates Stage 3; same harness note.
- **Programme rename** — "Founders Circle" retired; candidates **Proving Ground** vs **Design Partners**. Choose before it surfaces in D3 copy.
- **D3 — positioning sign-off** — pending; inputs above.
