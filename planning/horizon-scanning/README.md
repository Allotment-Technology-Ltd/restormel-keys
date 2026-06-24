---
id: REC-PLAN-020
title: Horizon-scanning register
class: planning
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-24
last-reviewed: 2026-06-24
review-interval: P3M
approved-by: founder
approved-on: 2026-06-24
retention: review-only
related: [REC-PLAN-001, REC-GOV-001, REC-ADR-001]
---

# /planning/horizon-scanning — signal register

The canonical home for **horizon-scanning signals**: external items (articles, vendor moves,
research, regulatory shifts) triaged for relevance to Restormel's wedge, plus the standing
**watch-list triggers** that act as durable tripwires.

**What this is and isn't.** Signals are **planning inputs** — not ISMS/governance records, and not
yet backlog items. They live here in the planning/strategy space (sibling in altitude to
`planning/planning-context.md`, `REC-PLAN-001`). When a signal warrants action it becomes a
product-ops backlog item; when it changes a *managed fact* it updates the relevant register per the
SCHEMA maintenance norm. This register itself is the shelf and the audit trail of what was
considered (kept *and* dropped).

> **Placement decision (2026-06-24, for founder confirmation).** Per `records/SCHEMA.md`, signals
> are tier-1 `planning` material, so they are filed here under `/planning/horizon-scanning/` rather
> than in `governance/` (not ISMS controls) or `evidence/` (not dated proof of an ISMS event). The
> watch-list triggers are kept in this same record as the standing monitoring criteria for the
> horizon-scanning function — the SCHEMA defines no separate "monitoring-criteria" type. Override
> here if a different home is preferred.

## Provenance & claims guardrails (carry through on any external use)

- **Verify before external use.** Most signals cite vendor or secondary sources; treat figures and
  vendor claims as *unverified* until checked. Do not present them as settled externally.
- **Proven-claims-only.** The only proven Restormel efficacy claim is the published bar
  (**≥90% supported / ≤2% unsupported**); attribute or hedge everything else.
- **Framing.** Verified context is the headline; routing/BYOK are supporting capabilities — preserve
  that framing in any summary drawn from these signals.

## ID model

Each shelved signal gets a canonical, stable ID **`HS-2026-NNN`** (zero-padded, never reused). The
chat-local `SIG-NNN` handles from the source triage are **working labels only** and are retired on
filing — the mapping below is the record of correspondence. *(IDs proposed by Cowork against the
best-available register view; confirm next-free numbering against the live register at merge — the
sent-bundle mirror shows some `REC-PLAN` reuse, so Cowork cannot see canonical numbering
authoritatively. `REC-PLAN-020` for this record is likewise provisional pending that check.)*

### SIG → canonical-ID mapping (all 13 triaged)

| Working label | Canonical ID | Verdict | Disposition |
|---|---|---|---|
| SIG-001 | HS-2026-001 | Keep (watch) | Shelved — full entry below |
| SIG-002 | — | Drop | Logged (audit trail), not shelved |
| SIG-003 | — | Drop | Logged, not shelved |
| SIG-004 | HS-2026-002 | Park | Shelved — full entry below |
| SIG-005 | HS-2026-003 | Keep (watch) | Shelved — full entry below |
| SIG-006 | HS-2026-004 | Keep (watch) | Shelved — full entry below |
| SIG-007 | HS-2026-005 | Keep (watch) | Shelved — full entry below |
| SIG-008 | — | Drop | Logged, not shelved |
| SIG-009 | — | Drop (ops) | Logged, not shelved |
| SIG-010 | HS-2026-006 | Park (ops) | Shelved — full entry below |
| SIG-011 | HS-2026-007 | Park (dist) | Shelved — full entry below |
| SIG-012 | HS-2026-008 | Park (actionable) | Shelved — full entry below |
| SIG-013 | — | Drop | Logged, not shelved |

Keepers: 8 (SIG-001, 004, 005, 006, 007, 010, 011, 012). Drops: 5 (SIG-002, 003, 008, 009, 013).

## Kept signals (full)

### HS-2026-001 — SpaceX buys Cursor ($60B)
- **Source:** Kilo / HackerNoon · **Date:** 2026-06-17 · **Verdict:** Keep (watch)
- **Tags:** CATEGORY/GTM, MCP-ECOSYSTEM
- **Relevance:** Real AI-stack consolidation; thin for the wedge, but yields two lines —
  "model-freedom/sovereignty" GTM ammo, and "they benchmark MCP invocation; we verify the return."

### HS-2026-002 — The AI Clarity Gap
- **Source:** INSEAD Knowledge · **Date:** 2026-02-17 · **Verdict:** Park
- **Tags:** CUSTOMER/DEMAND, CATEGORY/GTM
- **Relevance:** Credible "AI stalls on data/clarity" framing; data-hygiene layer, not span-level
  verification. MARKETING yes-and setup. *(Part of the converging demand narrative — see Emergent
  pattern.)*

### HS-2026-003 — Context quality beats context size + Redis Iris
- **Source:** Redis · **Date:** 2026-06-07 · **Verdict:** Keep (watch)
- **Tags:** COMPETITOR, MCP-ECOSYSTEM, CATEGORY/GTM, TECH/RESEARCH
- **Relevance:** Substrate vendor crowding "context quality" language; Iris is MCP-native, returns
  **unverified** context, "trust" = freshness. Validates the wedge + **Stage-5 wrap candidate**
  (see backlog candidate: log Redis Iris as the reference MCP server to wrap and measure).

### HS-2026-004 — Why Validation Will Define HPC & AI
- **Source:** Data Center Knowledge · **Date:** 2026-06-17 · **Verdict:** Keep (watch)
- **Tags:** CATEGORY/GTM, CUSTOMER/DEMAND
- **Relevance:** Validation/verification of AI outputs framed as a buying differentiator in regulated
  verticals; theme not mechanism (HPC output-assurance ≠ context provenance). *(Converging demand
  narrative — see Emergent pattern.)*

### HS-2026-005 — Beyond Verification (Responsible AI)
- **Source:** MIT SMR × BCG · **Date:** 2026-05-12 · **Verdict:** Keep (watch)
- **Tags:** CATEGORY/GTM, CUSTOMER/DEMAND
- **Relevance:** 84% of expert panel: RAI fails without humans who can verify; prescribes a combined
  human+automated system → endorses **abstention-to-human + click-through-to-span**. Boundary: claim
  only the automatable slice. *(Figure is secondary — verify before external use.)*

### HS-2026-006 — Monorepo vs Multi-Repo: AI agents tip the scale
- **Source:** Dortort · **Date:** 2026-05-20 · **Verdict:** Park (ops)
- **Tags:** TECH/RESEARCH
- **Relevance:** Agents favour monorepo; its "multi-repo still wins" carve-outs (compliance/security
  isolation) validate keeping `restormel-keys` separate. Repo-architecture input, not strategy.

### HS-2026-007 — Introduction to Swarms
- **Source:** docs.swarms.world · **Date:** 2026 · **Verdict:** Park (dist)
- **Tags:** MCP-ECOSYSTEM, CATEGORY/GTM
- **Relevance:** MCP-supporting multi-agent framework + marketplace; candidate Door-1/Door-3 surface;
  agent-framework protocol fragmentation (MCP/AOP/X402) note.

### HS-2026-008 — OpenSSF
- **Source:** openssf.org · **Date:** n/a · **Verdict:** Park (actionable)
- **Tags:** SOVEREIGNTY, CATEGORY/GTM, TECH/RESEARCH
- **Relevance:** Software supply-chain provenance (SLSA / Sigstore / Scorecard / Best Practices
  Badge). Use: framing analogy ("provenance for the AI-context supply chain") + OSS-credentials for
  the trust centre. *(Actionable — see backlog candidates: Scorecard, Badge, SLSA build provenance.)*

## Dropped signals (one-line audit trail)

- **SIG-002** — *The AI knowledge gap challenge* (FM Magazine, 2025-10-13): workforce AI-training
  survey; "trust" = human confidence, not context verification. **Dropped.**
- **SIG-003** — *AI & the institutional knowledge gap* (TechNative, 2025-12-22): vendor SAP
  change-mgmt piece; names the pain + trust caveat, not the verification mechanism. **Dropped.**
- **SIG-008** — *Solving AI Amnesia at Scale* (Aditi, HackerNoon, AI-assisted, 2026-06-21):
  memory/context-pipeline how-to; substrate already covered; no verification angle. **Dropped.**
- **SIG-009** — *github-multi-repo skill* (Claude marketplace, 2026-06-11): GitHub-bound; not usable
  on Forgejo-primary; ecosystem colour only. **Dropped (ops).**
- **SIG-013** — *Open Source Software Trends* (InMotion Hosting, 2026): bot-blocked hosting-vendor
  SEO listicle; low evidential value — prefer Octoverse / Linux Foundation / OpenSSF. **Dropped.**

## Emergent pattern (recorded here; full treatment in the synthesis record)

SIG-002 / 003 / 004 / 006 (HS-2026-002, -004 + the two drops) form a **converging demand narrative**
— production AI stalls on the *trust/clarity/validation of inputs and outputs*, not model quality —
and **none of them names verification as the answer.** That convergence is the GTM opening. Full
treatment belongs in the market-&-buyer-narrative **synthesis record** (planning/strategy,
*pending — see register note*), not as a separate signal.

## Standing watch-list triggers (durable tripwires)

Monitor continuously; a crossing is an immediate flag (the Phase-6 Forgejo cron evidence agent is
the safety-net reminder, not Cowork `/schedule`). Several map to existing GTM-roadmap triggers.

1. **Contextual AI** ships an MCP proxy/gateway, or a deterministic, re-checkable span-level
   attribution product.
2. **Any gateway** (Portkey / Prisma AIRS, Kong, IBM ContextForge, AWS AgentCore…) adds a native
   groundedness/factuality guardrail (beyond bolt-on output scoring).
3. **A context-engine incumbent** (Redis Iris, Atlan…) bolts a groundedness / provenance /
   factuality layer onto its context layer.
4. **MCP adds a native multi-tenant model.**
5. **A well-funded incumbent** bolts evidence-bound, re-checkable verification onto a context layer.
6. **Consolidation in the grounding cluster** (cf. Cleanlab → Handshake).
7. **Material movement in EU AI Act / provenance regulatory dates** — track Official Journal
   publication of the Digital Omnibus; **2 Aug 2026 stays live until then.**
8. **Verification/evaluation re-overtakes retrieval** as the top infra investment priority.

## Sources & related

- Source triage: Restormel horizon-scanning chat (Claude strategy surface, no repo access),
  handed to Cowork 2026-06-24. `SIG-NNN` labels were chat-local.
- Companion records (planning/strategy, **pending content at time of filing**): the market &
  buyer-narrative **synthesis** ("Verified Context in 2026") and the **adjacencies deep-dive**
  ("Verified-Context Adjacencies"). File as siblings once their text is provided; check the live
  register first to avoid duplicating the adjacencies doc.
- Convention: `records/SCHEMA.md` (`REC-GOV-001`); architecture ADR `REC-ADR-001`.
