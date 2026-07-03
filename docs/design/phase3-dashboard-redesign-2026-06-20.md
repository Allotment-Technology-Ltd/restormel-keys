---
title: "Phase 3 Dashboard Redesign — Verified Answers at Query Time"
class: decision
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-20
last-reviewed: 2026-06-20
review-interval: P12M
related: [keys-northstar-redesign-2026-06, verified-context-claims-ledger, positioning]
---

# Phase 3 Dashboard Redesign — Verified Answers at Query Time

**Phases 1 & 2 built a beautifully-engineered operations desk for a product whose value moment is a
*query*. Phase 3 re-mounts the (already-built, already-proven) verification engine around its real hero:
a user asks a question and watches a cited, verified, honestly-abstaining answer come back.** This is
overwhelmingly a re-mounting / information-architecture job, not a rebuild — plus one promotion and one
seeding.

Discovery (2026-06-20): product-value analysis + engineering capability map + external UX deep-research,
synthesised against the founder's locked decisions. Read-only; this is the plan to review before building.

---

## 0. Why Phases 1 & 2 went backwards (the core finding)

The product sells *"provenance-traced knowledge an agent can trace back to the exact source span"*
(`docs/product/positioning.md`). But the dashboard was organised around **building and proving the graph**
(Home · Sources · Runs · Claims · Prove · Agents) — the **means** — while the actual product, the
**query → verified-answer runtime**, was buried, gated, and framed as a comparison tool.

**The single most important discovery: the verified-query console already exists.** It is the **Prove tab**
(`keys/dashboard/prove/proof`, `GraphComparisonPanel.svelte`): type a question → COMPARE → two SSE streams
(raw model vs graph-verified) → a cited answer carrying `ProvenanceClaim[]` (`supported`/`weak` + trust
score 0–100), a claim drawer, a quality verdict, and an exportable trace. The verification engine + data
model behind it (`connect_claim_versions`/`_judgments`/`_provenance_traces`, migs 054–057; the public
`connect/v1/graph` contract) are **solid, real, and production-grade.**

But that console is (a) **buried** in the 5th work-nav slot, (b) **gated** behind a fully-built graph
(`prove/proof/+page.server.ts:72` → `hasGraph = graphNodeCount > 0`), and (c) **framed as "compare graph
vs baseline,"** not "ask → verified answer." So a new user can't reach the product's value without first
grinding through the entire ingest pipeline. **The skeleton was built for the wrong hero.**

---

## 1. North Star, hero, metric, user (locked)

- **North Star:** a **verified answer at query time** — ask against your sources, get a cited answer where
  every claim links to its quoted span, with honest **abstention** when the evidence isn't there, over your
  **own keys** and a **second model family**.
- **Hero surface:** the **Answer Console** — ask → cited, verified, abstaining answer → **click a claim →
  see the exact source span**. That screen *is* the brand's falsifiability test made interactive.
- **The one metric Phase 3 optimises:** **% of first-run users who click a claim through to its source
  span** — the falsifiability test *actually performed*. (Instrument this first; it disambiguates every
  trade-off.)
- **Primary user (re-baselined):** a **solo builder who both ingests sources AND wires the API into their
  app.** The documented regulated-team + dedicated-auditor personas become *depth/graduation*, not the
  centre of gravity. (Consistent with the PLG-first GTM.)

---

## 2. Target information architecture

Routing reads top-to-bottom by **what the user does**, not by internal subsystem. Operator surfaces
collapse to depth.

```
① ANSWER CONSOLE        ← default landing & hero (seeded on first run)
     ask → cited answer + VERDICT badge (grounded / uncertain / abstained)
     + numbered citations + source-card sidebar (click a claim → exact span)
     + inline ROUTING STRIP (model-per-stage, defaults shown, override one stage)
     + "Get Code" → production snippet (curl/Node) with key + route filled in
② TRACES                ← the SAME query entity: id, verdict, sources, cost, model-per-stage;
                          filter by API key / route; abstentions flagged ("what my app asked")
③ SOURCES / INDEX HEALTH← ingestion as a WATCHED BACKGROUND SOURCE, not a wizard:
                          per-source cards (docs indexed · failed→exceptions queue · last-synced
                          · auto-re-run); advanced chunk/embed/domain controls collapsed
④ KEYS & ROUTING        ← deep config (defaults already work): BYOK + per-key spend, named routes,
                          fallbacks. "Publish" lives here = deploy the answer-serving config.
  └─ operator depth     ← Runs · Claims/Stamping · Prove-audit · evidence dossiers: opened only when
                          an answer is wrong or an auditor asks. Kept, demoted, not deleted.
```

---

## 3. First-run flow (the make-or-break)

Industry benchmark: **time-to-first-value < 3 minutes**, "show value by step one, demo data before you
connect your own." So:

1. **Land directly in the Answer Console**, pre-seeded with a **demo graph** + a suggested question
   (incl. at least one deliberately *unanswerable* question to **show off abstention**).
2. **Ask** → watch the cited, verified answer render: verdict badge + numbered inline citations + source
   cards.
3. **Click a claim → jump to the exact quoted span.** (This is the metric, the brand, and the aha.)
4. **"Get Code"** → a production snippet with the key + route filled in (the console *is* the start of the
   integration).
5. **Then "use your own sources"** → connect a source; ingest runs in the **background** (health card +
   exceptions queue) while the console stays live and usable.

**Zero wizard. Zero route-building before the first query.** The first verified answer happens before the
user has done any setup of their own.

---

## 4. Reuse vs promote vs rebuild (the engine is already built)

| Disposition | What |
|---|---|
| **REUSE (lean on — real & proven)** | Verification runtime + data model (`connect_claim_versions`/`_judgments`/`_eval_verdicts`/`_provenance_traces`, migs 054–057); the Prove SSE stream + the public `connect/v1/graph` retrieve-verified contract; the **Postgres graph spine** (`use_dashboard_database`, `knowledge_graph_*`) → a self-contained first-run with **zero external SurrealDB**; the Sandbox/Request-tester as a "try it" primitive; the workspace→project→env→route→step tenancy chain; the `models` + `provider_model_variants` catalogue (now variant-aware after #171). |
| **PROMOTE + REFRAME** | `prove/proof` console → **the home Answer Console**. Reframe "compare graph vs baseline" → **"ask → verified answer"** (keep the side-by-side compare as an optional depth toggle). **Ungate it** by seeding a demo graph so it works with no built graph. |
| **REBUILD / REPLACE** | The **3,461-line route builder** (`projects/[id]/routes/[routeId]/+page.svelte`) — replace, not refactor: auto-provision routes for the solo builder. The **ingest wizard** → the "watched source" background flow. Collapse the **model-binding duality** (`route_steps.model_id` vs `project_model_bindings`) onto one canonical path. |
| **DEMOTE TO DEPTH** | Runs, Claims/Stamping Desk, Prove-audit, evidence dossiers → opened on exception/audit, not top-level destinations. |
| **DELETE** | Dead code: the orphaned `ConnectFirstGraphGuide.svelte` (imported nowhere). Trim thin/sprawl pages (agents/wiring, dev-tools/mcp stubs). |

**Net:** the left two columns are most of the product, and they already work. Phase 3's genuinely *new*
build is small: the seeded demo graph, the promoted/ungated console as home + first-run, the trust-UX
polish, and the background-ingest + inline-routing surfaces.

---

## 5. Trust UX — the differentiator, made visible

Two layers, both required (claims-integrity rule applies to every word):

- **Layer 1 — attribution:** numbered **inline citations** + a **source-card sidebar**; cite the **exact
  passage/span**, not the whole doc; **call out broken/missing citations** explicitly (don't hide gaps).
- **Layer 2 — verdict:** a labelled badge, colour-coded — **Grounded** / **Some uncertainty — review** /
  **Insufficient evidence — abstained** — never a bare percentage.
- **Abstention is a designed, first-class state**, not an error toast: *"I won't answer — no supporting
  evidence; here's the closest unverified context, labelled; ingest source X to fix."*
- **Cross-model disclosure** at the answer ("validated by Anthropic vs OpenAI — cross-family ✓").
- The **claim → quoted-span** click-through must be reachable from **anywhere** a claim appears.

---

## 6. Delivery stages (each ≈ one build session; sequenced, deps noted)

> Build only after this plan is approved. Each stage ships behind the existing module flags where possible
> and keeps prod green. Stages 0–2 deliver the hero + first-run (the whole pitch); 3–7 build out around it.

| Stage | Scope | Depends on |
|---|---|---|
| **0 — Foundations** | Seed a **demo graph** on the Postgres spine wired to a default workspace; **auto-provision** default embedding+chat routes from BYOK (break the "publish routes before you can query" gate). Instrument the **claim→span click** metric. | — |
| **1 — The hero** | Promote `prove/proof` → the **Answer Console**; reframe ask→answer; **ungate** (works on the demo graph); ship the Layer-1/Layer-2 trust UX (verdict badge, citations, claim→span, abstention state). | 0 |
| **2 — First-run** | New users land **directly in the seeded console** with a suggested question (incl. an abstention demo); **"Get Code"** snippet; the falsifiability metric live. | 1 |
| **3 — Ingestion as background** | Replace the wizard with the **watched-source** flow (connect → background ingest → health card + **exceptions queue**; advanced collapsed). Retire the validation-gates-on-routes cliff. | 1 |
| **4 — Inline routing + publish** | Per-stage **routing strip** on the console (defaults shown, override one stage, fallbacks visible); retire the 3,461-line route builder for the common case; **publish = deploy the answer-serving config** (MCP/AAIF/REST endpoint + client snippet). | 1, (#171) |
| **5 — Traces** | The **same query entity** in a traces view (filter by key/route; abstentions flagged). | 1 |
| **6 — Collapse the operator desk** | Move Runs/Claims/Prove-audit to depth; delete dead code; consolidate sprawl (~35 route dirs). | 1–5 |
| **7 — Re-baseline copy** | Positioning/onboarding copy to the **solo builder** (claims-integrity rule preserved; falsifiability test reachable everywhere). | 6 |

---

## 7. Guardrails (locked, non-negotiable)

- **Claims-integrity rule:** every quality phrase on any surface cites a `proven` ledger row; if measured
  efficacy drops, the **phrase changes — not the measurement** (`verified-context-pivot-roadmap.md`).
- **Falsifiability test** reachable from any claim, including the new Answer Console.
- **BYOK · BYO graph · EU self-host · cross-model validation** preserved; a verified answer still resolves
  over the user's keys + a second model family.
- **Trust vocabulary fixed:** supported / inferred / unverified / contradicted / excluded; strict
  (supported-only) vs annotated (all-labelled).

## 8. Anti-scope (what Phase 3 is NOT)

- Not throwing away the engine — it's reused wholesale.
- Not another setup wizard — ingestion becomes background work.
- Not the operator/auditor team rituals as the front door — they become depth.

## 9. Open founder decisions (the few genuine ones)

1. **Demo-graph content.** What domain is the seeded first-run graph about — a neutral general corpus, or a
   compelling vertical (e.g. the Philosophy/Surreal corpus already in your screenshots)? It must include
   questions that show off both a strong cited answer **and** a confident abstention.
2. **Route builder fate.** Fully retire the 3,461-line per-stage route builder for the solo builder (routing
   only via the inline strip + advanced page), or keep it as an advanced surface?
3. **App scope boundary.** Carve the product dashboard away from the 200+ `docs/**` pages + marketing now,
   or defer? (Affects the consolidation in Stage 6.)
4. **Existing SurrealDB workspaces.** First-run defaults to the Postgres spine (zero external setup) — what's
   the migration/coexistence story for workspaces already on BYO SurrealDB?

---

## Appendix — discovery sources

- **Mission/value:** `docs/product/{positioning,verified-context-claims-ledger,verified-context-pivot-roadmap,CONNECT-PRODUCT}.md`, `STATUS.md`, `ARCHITECTURE.md`, `planning/planning-context.md`.
- **Capability map:** `lib/nav-config.ts`; `keys/dashboard/{home,sources,runs,claims,prove,agents,projects,models,sandbox}`; the runtime at `keys/dashboard/prove/proof` (`GraphComparisonPanel.svelte` + `prove/api/stream`) and `(marketing)/connect/v1/graph`; migs 054–057 (verification spine), 036/038 (graph targets), 004/020 (binding duality). Prior redesign: `docs/design/keys-northstar-redesign-2026-06.md`.
- **External patterns:** TTFC <3 min benchmark; Stripe/Anthropic/OpenAI console→Get-Code; Helicone one-line traces; Cloudflare AutoRAG background ingest; Perplexity citation+source-card UX; verdict/abstention patterns. (Cited in the deep-research brief.)
- **Founder decisions (rounds 1–3, 2026-06-20):** North Star = verified answers at query time; first-run = first verified query on a **seeded demo corpus**; pipeline = one guided auto-flow (full control collapsed); routing = core, first-class **in service of the query**; primary user = **solo builder who is both**; **operator surfaces collapse to depth**; **metric = claim→source-span click-through**; **publish = routing/config deploy**.
