---
id: REC-PLAN-017
title: Verified Context market positioning & prioritisation (mid-2026)
class: planning
owner: adam
status: approved
classification: internal
control-tier: 2
created: 2026-06-26
last-reviewed: 2026-06-26
review-interval: P6M
approved-by: adam
approved-on: 2026-06-26
retention: P6Y-after-superseded
related: [REC-PLAN-012]
---

# Verified Context — market positioning & prioritisation (mid-2026)

> **Purpose.** Capture the mid-2026 external competitive/market research plus the repo
> strategy synthesis that fixed the product thesis and re-ranked the roadmap. This record
> drove the **2026-06-26 RES (Huly) backlog reprioritisation** (96 issues, RICE). It is the
> source-of-record for *why* the backlog is ordered the way it is, so later re-litigation
> starts from the evidence rather than from memory.
>
> **Scope note.** External market figures below are point-in-time (mid-2026) and directional —
> they are decision inputs, not audited facts. Re-validate at the next review (P6M).

---

## 1. Thesis

**"Verified Context" sits in the one large, well-funded category that still has no horizontal
leader: span-level citation / grounding verification + audit-grade sovereign provenance.**

Every adjacent category — LLM gateways, memory/graph, eval, provenance/grounding — is either
commoditising, fragmenting, or consolidating into incumbents. The gap that no one owns
horizontally is *proving that a generated answer is faithful to a cited source span, and
exporting that proof as audit-grade, sovereign-custody evidence.* That is the wedge.

The corroborating pain signal: **~57% of RAG citations are post-hoc rationalisation** — the
model cites a source it did not actually ground on. Behaviour-level eval does not catch this;
claim-to-source verification does.

---

## 2. Competitive landscape

Four adjacent categories, each crowded or consolidating, none owning verified context.

### 2.1 LLM gateways — commoditised / consolidating

Routing and BYOK key-brokering are now table stakes, and the independents are being absorbed
or zero-margined:

- **Portkey → Palo Alto Networks** (acquired Apr–May 2026).
- **Helicone → Mintlify.**
- **OpenRouter** raised at a **$1.3B** valuation.
- **Vercel** and **Cloudflare** ship **0-markup BYOK** gateways.

**Implication:** the gateway *as a gateway* is a commodity. Defensibility has to come from what
sits on top (verification, custody, governance), not from routing.

### 2.2 Memory / graph — funded but fragmented, no provenance

Well-funded and active, but **none offer provenance or span-level verification**:

- **Mem0** — $24M, AWS-aligned.
- **Cognee** — $7.5M, self-host.
- **Letta**, **Zep / Graphiti**.
- **Microsoft LazyGraphRAG** — cuts retrieval cost materially.

**Implication:** memory store/retrieve is not a place to lead. The differentiator is to add
provenance/verification *on top of* memory — integrate (e.g. Cognee), don't rebuild.

### 2.3 Eval — crowded, consolidating, wrong axis

Large and fast-consolidating, but it **tests behaviour, not citation faithfulness**:

- **Braintrust** — $80M at an ~$800M valuation.
- **Promptfoo → OpenAI.**
- **Humanloop → Anthropic.**
- **Langfuse → ClickHouse.**
- **LangChain** raised at **$1.25B**.

**Implication:** generic eval/observability is not a wedge. A *grounding-regression CI gate*
(does this change make citations less faithful?) is the differentiated slice.

### 2.4 Provenance / grounding — HOT, no unified leader

The category most aligned to the thesis. Hot, but **assets are split across point tools** and
the hardest part is still research-stage:

- **Vectara HHEM** (hallucination eval), **Patronus Lynx / HaluBench**, **Cleanlab TLM**,
  **Contextual GLM**, **Galileo Luna-2**.
- **Source-span / claim-level** verification is still research-stage (e.g. **LongCite**,
  **VeriCite**).

**Implication:** this is the land to take. No one offers unified span-level claim-to-source
verification + exportable evidence as a horizontal product.

### 2.5 MCP-security gateway niche — crowded + funded

A separate adjacent niche (securing MCP traffic), already crowded and partly free-bundled:

- Independents: **Lasso**, **Runlayer**, **Operant**, **Helmet**.
- Bundled-for-free by **Cloudflare**, **Kong**, **Tyk**.

**Implication:** do not lead with MCP *security*. A first-party MCP server should lead with
*verified retrieval*, not with being a security proxy.

---

## 3. Regulatory + sovereignty tailwinds

The demand-side case is structural, not a fad.

### 3.1 EU AI Act + provenance standards

- **Art. 12** — lifecycle **event-logging** obligations (audit trail of system activity).
- **Art. 50** — **text-marking / transparency** obligations, mandatory from **Aug 2026**.
- **Digital Omnibus** deferred high-risk **Annex III** obligations to **Dec 2027** — this is a
  *postponement, not a weakening*. The obligations still land; the runway is longer.
- **C2PA v2.3** (Dec 2025) added **text manifests** — content provenance now extends to text,
  not just images.

### 3.2 Sovereignty is structural

- **61% of EU CIOs** prefer local/in-region hosting.
- **CLOUD Act ≠ data residency** — physical residency does not defeat extraterritorial access;
  buyers know this.
- **BYOK is now a procurement requirement** and a recognised **Schrems II remedy** — customer-held
  keys are an asked-for control, not a nice-to-have.

### 3.3 Regulated-RAG-trust pain is acute

- **Legal:** hallucinated-citation cases — **1,227 in early 2026, growing 5–6/day.**
- **Finance:** model-risk governance under **SR 11-7**.
- **Pharma:** **21 CFR Part 11** + draft **EU Annex 22**.

**Implication:** regulated verticals feel the citation-faithfulness pain *first and hardest* —
they are the wedge buyers and they pay a compliance premium (see §5).

---

## 4. MCP / A2A ecosystem

- **MCP is dominant and standardised.** Governed by the **Linux Foundation Agentic AI Foundation**
  (Dec 2025); **~97M monthly SDK downloads**; **~1,300–2,000 production servers**.
- **A2A is real but secondary** — **150+ orgs**, but largely logo-adoption, not deep production.

**Implication:** **lead with MCP; add A2A only on demonstrated buyer pull.** Build A2A as a thin
slice held in reserve, not a parallel investment.

---

## 5. Pricing

- **BYOK is monetised as a control-plane / % fee, not token markup** — e.g. **OpenRouter ~5%**,
  **Vercel 0%**. The money is in the control plane, not the spread.
- **Seat-pressure** in dev-infra pricing, **but regulated verticals pay big** — e.g.
  **Harvey ~$1,200 / lawyer / month.**
- **The enterprise premium is compliance + sovereignty + air-gap** — e.g.
  **Langfuse Enterprise ~$2,499/mo**, **LiteLLM ~$30k/yr.**

**Implication:** price Keys as a **BYOK-custody / sovereignty / governance control plane** (control-plane
fee), and reserve the high-margin premium for the compliance/sovereignty/air-gap tier sold into
regulated verticals.

---

## 6. Prioritisation implications

The ranking that drove the **2026-06-26 RES backlog reprioritisation**.

### 6.1 UP — prioritise

1. **Connect `verify` — span-level / claim-to-source citation verification.** The spearhead. No
   horizontal leader; directly answers the 57%-post-hoc-rationalisation pain.
2. **Audit-grade exportable grounding-evidence.** Maps to EU AI Act Art. 12 (event-logging),
   C2PA text manifests, SR 11-7, 21 CFR Part 11.
3. **Sovereignty / self-host / BYOK-custody as a first-class *marketed* capability** — not a
   buried feature. It is the procurement requirement and the Schrems II remedy.
4. **Testing — grounding-regression CI gate.** The differentiated slice of eval: does this change
   degrade citation faithfulness?
5. **Door-1 — first-party *verified-retrieval* MCP.** Lead with verified retrieval, not security.

### 6.2 DIFFERENTIATE-ONLY / DOWN

- **Keys-as-standalone-gateway** — routing is a commodity; keep it, but differentiate on custody /
  governance, don't lead with routing.
- **Door-2 — verifying-MCP-proxy** — crowded niche; **sequence AFTER Door-1**, and lead with
  *verification*, not security.
- **Generic eval / observability** — crowded and consolidating; not a wedge.
- **Basic memory store/retrieve** — **integrate Cognee** and add provenance; do not rebuild.

### 6.3 HOLD

- **Door-3 — A2A** — thin slice held until a buyer pulls.
- **Model-catalogue advisory** — **bundle into Keys**; do not lead with it.

### 6.4 Sequencing

| When | Workstream |
|------|------------|
| **Q1** | **Spearhead:** Connect `verify` span-level + provenance export (self-hostable). Land **one regulated design partner** — the **legal wedge.** |
| **Q1–Q2** | **Door-1 MCP** (verified retrieval) + **Keys repositioned** as the BYOK-custody / sovereignty / governance control plane. |
| **Q2** | **Testing — grounding gate.** |
| **Q2–Q3** | **Door-2** as an *extension of the Door-1 engine* (not a separate product). |
| **Ongoing** | **Graph** = evidence / provenance visualisation. |
| **Hold** | **A2A** until buyer pull. |

---

## 7. Sources

External figures are mid-2026 point-in-time and were supplied as competitive/market research
inputs; they are directional decision inputs, not audited facts. No specific source URLs were
provided with this research package. Re-validate the figures (funding rounds, acquisitions,
adoption counts, pricing, regulatory dates) at the next scheduled review.

Key claims to re-verify at review:

- Acquisitions/raises: Portkey→Palo Alto, Helicone→Mintlify, OpenRouter $1.3B, Promptfoo→OpenAI,
  Humanloop→Anthropic, Langfuse→ClickHouse, Braintrust $80M/$800M, LangChain $1.25B,
  Mem0 $24M, Cognee $7.5M.
- Regulatory dates: EU AI Act Art. 12 / Art. 50 (Aug 2026), Digital Omnibus Annex III deferral
  (Dec 2027), C2PA v2.3 text manifests (Dec 2025).
- Ecosystem: MCP ~97M monthly SDK downloads, ~1,300–2,000 production servers, Linux Foundation
  Agentic AI Foundation (Dec 2025); A2A 150+ orgs.
- Pricing: OpenRouter ~5%, Vercel 0%, Harvey ~$1,200/lawyer/mo, Langfuse Ent ~$2,499/mo,
  LiteLLM ~$30k/yr.

---

## 8. Maintenance

- This is a planning record. `records/register.yaml` is **generated** by
  `scripts/records/register.mjs` — regenerate it after this file lands; do **not** hand-edit the
  register.
- On any material market shift (a new horizontal provenance leader emerging, a regulatory date
  moving, the spearhead shipping), supersede this record rather than silently editing it, and
  re-run the RES reprioritisation.
