---
id: REC-PLAN-001
title: Restormel — planning context pack
class: planning
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-14
last-reviewed: 2026-06-14
review-interval: P6M
approved-by: founder
approved-on: 2026-06-14
retention: review-only
related: [REC-PLAN-002, REC-ADR-001]
---

# Restormel — planning context pack

> **Purpose:** portable context for a Claude project, to support **planning conversations**
> about Restormel without needing repo or website access. Self-contained snapshot as of
> **2026-06-14**. Everything here is inlined — no links need to be followed.
>
> **How Claude should use this doc:** treat it as the current source of truth for *what
> Restormel is, where it is, and what we're planning*. When planning, reason from the
> "Strategy" and "Programme plan" sections. Respect the "Guardrails" section (especially: only
> state quality claims that are marked proven; Forgejo is the primary host, not GitHub). If
> asked for something this doc doesn't cover, say so rather than inventing detail.

---

## 1. What Restormel is (USP)

**Restormel is the verified-context layer for AI products** — provenance-traced,
quality-gated knowledge that an agent (or its auditor) can trace back to the exact source
span it came from.

Supporting line: *One AI product layer for your stack — route requests, ingest and verify
knowledge, and serve agents context you can prove.*

**The category bet — "Verified Context":**
- Routing is a commodity (LiteLLM, OpenRouter, Portkey).
- Graph/memory building is crowded (Mem0, Zep, Cognee, MS GraphRAG).
- Output evals are taken (Braintrust, DeepEval, Promptfoo).
- **Provably trustworthy *context* is an empty category** — that's the wedge, with a
  digital-provenance regulatory tailwind.

**The falsifiability test that defines the product:** a skeptical user can click any
"verified" claim through to the quoted span in the source and check it themselves. If measured
efficacy doesn't support a phrase, the phrase changes — not the measurement.

## 2. The suite (one signed-in workspace at restormel.dev — "Route · Ingest · Verify")

| Product | Capability | MVP status | What it is |
|---|---|---|---|
| **Keys** | Route | **Live** | Control plane for verified context: BYOK custody, model→provider routing with fallback chains, policies, budgets, entitlements. Routing/BYOK are *supporting*, not the headline. |
| **Connect** | Ingest · Retrieve · Verify | **Live** | The knowledge pipeline carrying the verification spine. Ingest corpora → retrieve curated/ranked/citable context → verify claims against source. BYO Surreal/Postgres graph store. |
| **Testing** | Assure | **Flag-off** | CI quality gates for AI behaviour. Real product, not in MVP marketing default. |
| **Graph** | Visualise | **Flag-off** | Reasoning-graph UI. Behind a flag. |

MVP production defaults: **Keys + Connect on**; Testing, Graph, and several other modules off
(re-enabled later by flipping flags, not code deletion).

## 3. Who it's for

- **Teams shipping AI in regulated/high-stakes domains** (legal, pharma, finance, gov) — ground
  agents in knowledge they can defend to an auditor; every answer carries a citation +
  provenance trace; uncertainty routes to human review, never into the graph.
- **AI product engineers** — add control (BYOK, routing, budgets, entitlements) without running
  gateway infra; Keys sits above existing providers, no rip-and-replace.
- **Platform/ops teams** — stand up agent-ready knowledge infra without a platform group.
- **Agent/IDE builders** — retrieval that returns citable, verified context over MCP/AAIF.

## 4. Current state (2026-06-14)

- **Phase:** 01 — Implementation.
- **Verification spine:** live and proven end-to-end (evidence-bound verification, span-scoped
  cross-model entailment with abstention, trust scorecard, provenance traces, published quality
  bar ≥90% supported / ≤2% unsupported, weekly CI efficacy gate). All public quality claims
  currently marked proven (as of 2026-06-13).
- **Stack (current truth):** UK/EU self-host on **Coolify**; **Forgejo-native CI** (migrated off
  GitHub Actions + Vercel, cutover 2026-06-13); **Neon Postgres** (spine) + **BYO SurrealDB**
  (graph); **PostHog EU** analytics; **Zuplo** gateway for the Cloud API; **Paddle** billing.
- **Single app:** everything in one SvelteKit app (`apps/dashboard`) — marketing, docs,
  dashboard, Cloud API surfaces.
- **Distribution:** MCP-native (verified-retrieval tool + catalog listings) + AAIF envelope for
  non-MCP frameworks.
- **GTM:** invite-only Founders Circle while learning; PLG/self-serve before heavy enterprise;
  sovereignty angle (UK/EU self-host, BYOK custody, BYO graph, EU analytics) for regulated buyers.

## 5. Glossary (so planning chats stay precise)

- **Verified Context / EBV (evidence-bound verification):** every claim bound to a verbatim
  quoted span + source-version hash, deterministically re-checkable; a different model family
  checks the extraction (cross-model entailment); uncertain claims abstain (go to human review).
- **Keys:** the routing/control plane (BYOK, routes, policies, budgets).
- **Connect:** ingest → retrieve → verify pipeline over a knowledge graph.
- **BYO graph:** customer brings their own graph store (SurrealDB today); Restormel hosts the
  orchestration + job metadata + encrypted connection secrets, not the graph data.
- **MCP (Model Context Protocol):** open standard for exposing tools/context to LLM clients
  (Claude, IDEs, agents). Restormel ships `@restormel/mcp` with ~50 tools incl. `connect.*`
  verified-retrieval.
- **AAIF:** Restormel's verification envelope/contract for frameworks that don't speak MCP.
- **Gateway key (`rk_…`):** programmatic project credential. **Server token:** server-only
  bearer for control-plane calls. Keep both server-side; never log.
- **Trust states:** supported / inferred / unverified / contradicted / excluded. "Strict"
  retrieval returns supported-only; "annotated" returns all, labelled.

## 6. The current initiative (why this pack exists)

Trigger: an AI couldn't "access the site" and the README looked out of date. Investigation
(2026-06-14) covered repo docs, search/AI discoverability, and the MCP serving question, and
turned into a strategy + plan for making the MCP a **remote verification layer** and improving
open-source credentials.

**Audit findings:**
- **Discoverability:** the site *is* crawlable (robots.txt allows ClaudeBot; sitemap exists),
  but there is **no `llms.txt`** — the machine-readable manifest LLMs use as an entry point.
  That's the real cause of "Claude can't access the site." The on-site docs search is a
  hardcoded ~60-entry list drifting from ~65 real pages.
- **Docs freshness:** mostly fresh (a big audit on 2026-06-13 archived old material). The one
  systemic staleness: README + several runbooks still present **GitHub Actions as primary** when
  **Forgejo is now primary**. Top-level docs lack "last reviewed" date stamps.
- **MCP:** the server is **stdio-only** and single-tenant (credentials read from process env).
  To serve remote contexts (claude.ai connectors, hosted agents) it needs **Streamable-HTTP
  transport + per-request OAuth + a read-only tool profile**.

## 7. Strategy (the bet)

**Market read (mid-2026):** MCP has stabilised — transport = **Streamable HTTP**; auth =
**OAuth 2.1 + PKCE** (CIMD now the default client-registration method). Serving is commoditised
(many OSS frameworks/gateways/registries). The spec still has **no multi-tenant model** — an
opening.

**The reframe that matters most:** exposing a knowledge graph over MCP is **table stakes** —
Neo4j, Zep/Graphiti, Cognee, and Mem0 all ship MCP servers. So "easy way to connect your KG to
LLM tooling" describes the whole category, not Restormel. **The empty niche is verification:**
existing MCP gateways/proxies do security/guardrails, **not** fact-checking or trust-scoring of
the context that flows through. That gap is exactly the Verified Context bet, extended from
*our own graph* to *the whole agent-context supply chain*.

**Positioning (market the wide door, defend with the deep moat):**
- **Marketed (widest appeal):** *"The trust layer for AI context — works with the knowledge
  bases, graphs and MCP servers you already use."* We verify, cite, and trust-score the context
  your agents retrieve, wherever it comes from. Meets users on their existing stack rather than
  forcing a Restormel-only graph.
- **Moat (defended, not headlined):** the evidence-bound verification engine. Hard to
  replicate; the reason the marketed promise is credible. (Principle: the moat need not be the
  thing we market.)

**Three doors, one engine:**
1. **First-party verified-retrieval MCP** — the Connect graph you ingest, served over MCP.
2. **Verifying MCP proxy (the wide-appeal play)** — Restormel sits in front of *third-party* MCP
   servers / KBs, intercepts responses, returns Restormel-verified envelopes. Adaptable to
   existing setups.
3. **AAIF envelope** — the non-MCP path.

**Build vs adopt for serving:** the gap is transport + auth, not the tool framework. Build only
the glue (a Streamable-HTTP `/mcp` route in the dashboard + read-only profile + per-request
scoping); **adopt** the rest (official SDK transport — already a dependency; an OSS/standard
OAuth layer — never hand-roll; registry + Claude connector-directory for discovery). Defer
gateways until serving many servers.

**Sovereignty / Zuplo:** Zuplo is a US edge-SaaS gateway (offers EU residency + self-host, but
its default is global edge and a US control plane). Recommendation: **keep Zuplo off the
verification path now**; serve `/mcp` from the dashboard on Coolify; plan a **self-hosted OSS
gateway** (Gravitee for EU roots; Tyk / Apache APISIX as alternatives) as the
sovereignty/anti-big-tech endgame; promote to an ADR before acting.

## 8. Programme plan (multi-stage)

Ordered by dependency, not calendar. **Stage 1 is independent and can ship now.** Stages 3–5 are
gated on the Stage 0 decisions.

- **Stage 0 — prerequisites (not code):**
  - **P0** — Forgejo access from cloud coding sessions (so work lands on the primary host).
  - **D1** — auth provider for remote MCP: self-hosted OSS (Ory Hydra/Keycloak) vs Zuplo vs
    managed (WorkOS/Stytch). Sovereignty vs speed.
  - **D2** — Zuplo endgame (keep off verification path now → OSS-gateway migration later) → ADR.
  - **D3** — positioning sign-off (adopt the "trust layer that works with your stack" line).
- **Stage 1 — discoverability + freshness quick wins (ship now):** add `/llms.txt` +
  `/llms-full.txt`; fix the GitHub→Forgejo CI staleness in README + runbooks; sync the
  docs-search index to the real page set; date-stamp top-level docs. *Fixes the original
  symptom; depends on nothing.*
- **Stage 2 — docs/README polish for open-sourcing (parallel):** README pass for an external
  reader; sitemap covers all docs pages; per-page meta descriptions.
- **Stage 3 — MCP remote-readiness (gated on D1, D2):** Streamable-HTTP `/mcp` route in the
  dashboard; per-request OAuth + workspace scoping; a `connect-readonly` tool profile (no
  key-create / route-delete on a public connector); registry/directory prep.
- **Stage 4 — dog-food demo (gated on Stage 3):** ingest the repo's own docs into a Connect
  graph (BYO SurrealDB) → register `/mcp` as a Claude project connector → validate verified
  retrieval (citations + provenance traces).
- **Stage 5 — verifying-proxy spike (gated on Stage 3):** prototype verifying a *third-party*
  MCP's responses; measure added latency/cost; go/no-go on productising door #2.

**Sequencing:** Stage 0 unblocks → Stage 1 + Stage 2 run now/in parallel → D1,D2 → Stage 3 →
Stage 4 (demo) and Stage 5 (spike) → D3 go/no-go.

## 9. Open decisions to drive in planning

| # | Decision | Trade-off |
|---|----------|-----------|
| P0 | Forgejo access for cloud sessions | needed so work lands on primary host (in progress) |
| D1 | Remote-MCP auth provider | self-host OSS (sovereign, more ops) vs managed (fast, US) |
| D2 | Zuplo endgame | keep-but-isolate now vs migrate to OSS gateway (cleaner story, migration cost) |
| D3 | Marketed positioning | "trust layer for your existing stack" (wide) vs narrower verified-KG framing |

## 10. Risks to keep in view

- **Commoditisation:** a *generic* connector is me-too; verification framing is what avoids it.
- **Auth complexity:** OAuth 2.1 multi-tenancy is the hardest build; adopt, don't hand-roll.
- **Sovereignty drift:** don't put the verification path behind US-edge SaaS.
- **Verifying-proxy latency/cost:** entailment over third-party responses adds latency; needs
  abstention/caching (measure in Stage 5).
- **Ingest quality on own corpus:** the dog-food demo depends on Connect ingesting our docs well.

## 11. Guardrails for accurate planning (read me)

- **Forgejo is the primary host/CI**, GitHub is a mirror. Don't plan around GitHub Actions as
  primary.
- **Only state quality claims that are proven** (the ledger discipline). If unsure whether a
  metric is proven, hedge or ask.
- **BYOK / BYO graph / EU self-host** are core to the value prop and the sovereignty story —
  don't propose architectures that route credentials or the verification path through
  third-party US SaaS without flagging the trade-off.
- **Routing/BYOK are supporting capabilities**, not the headline — the headline is verified
  context.
- This pack is a **2026-06-14 snapshot**; if a date-sensitive detail matters, note it may have
  moved.

## 12. Useful planning prompts (examples to ask Claude with this context)

- "Draft the messaging hierarchy for the 'trust layer for your existing stack' positioning,
  with the verification moat held back."
- "Compare Ory Hydra vs Keycloak vs WorkOS for D1, weighted for EU sovereignty and ops load."
- "Design the Stage 5 verifying-proxy spike: architecture, what to measure, and the go/no-go
  bar."
- "Sequence Stages 1–5 into a 6-week calendar assuming Forgejo access lands this week."
- "Write the ADR for D2 (Zuplo endgame), with options, recommendation, and migration risks."
- "What would the `connect-readonly` MCP tool profile expose vs hide, and why?"
</content>
