# Restormel Keys — research-backed answers and implementation plan

## Executive view

The strongest pattern in the market is to treat products like this as an **AI gateway / control plane**, not as a loose collection of key forms, CLI commands, and docs pages. Vercel AI Gateway, OpenRouter, and Portkey all converge on the same core shape: one integration surface, explicit platform authentication, optional BYOK provider credentials, a browsable model/provider layer, routing and fallback controls, and usage/observability as first-class features. Anthropic and OpenAI also show that documentation now needs to serve humans and agents, with `llms.txt`, MCP-oriented docs, and machine-readable surfaces. citeturn671028view1turn671028view3turn896483view0turn671028view8turn202200search1

The most important conclusion is that Restormel should stop thinking of the current dashboard as “project + API key setup” and instead define a clear product contract around: workspace, project, environment, gateway key, provider credential, model catalog, route, policy, analytics, and lifecycle state. That is the abstraction users now expect from serious multi-provider AI tooling. citeturn671028view1turn671028view3turn896483view0turn896483view1

## Answers to the key open questions

### 1) What kind of product is Restormel, really?

Best answer: **Restormel should be an AI gateway and control plane with BYOK support**, not merely an API-key utility and not merely a docs portal. That matches the most successful reference products. Vercel frames AI Gateway as “one endpoint, all your models.” Portkey frames its gateway as a unified interface with observability, fallbacks, retries, and cost controls. OpenRouter similarly positions itself as a unified API with routing and analytics. citeturn671028view3turn896483view1turn977037search25

### 2) What is the current “API key” supposed to be?

Recommended answer: it should be renamed to **Restormel Gateway Key** and defined as the credential used by CLI, SDK, API, and MCP clients to authenticate requests to Restormel. This mirrors Vercel’s separation between gateway authentication and provider credentials, and OpenRouter’s separation between platform/API keys, BYOK provider keys, and management keys. citeturn671028view1turn671028view2turn671028view5turn977037search5

### 3) Should there be multiple workspaces / orgs / projects / environments?

Yes. Best practice is a hierarchy, not a flat product. Portkey’s model catalog already distinguishes organization/workspace control with budgets, rate limits, and allow-lists. Vercel’s observability and gateway model also assumes project-level grouping and API-key-level visibility. For Restormel, the minimum durable hierarchy is: **Workspace → Project → Environment**. citeturn896483view0turn671028view1

### 4) Are users only managing models for themselves, or curating a catalog for their own customers too?

You should support both, but design explicitly for the second case. Portkey’s catalog and OpenRouter’s routing model both point toward a future where customers want to decide which providers and models are available to downstream users, with budgets, rate limits, and allow-lists. That is especially important for a BYOK product because many of your customers will be SaaS vendors, internal platforms, or AI product teams managing access for others. citeturn896483view0turn671028view6

### 5) Should Restormel add its own editorial guidance on models?

Yes, lightly and structurally. Providers already publish guidance on capabilities, speed, and cost, but it is fragmented. Anthropic explicitly tells users to choose models by balancing capabilities, speed, and cost. Google Vertex model pages similarly describe current Gemini models in terms of reasoning, coding, multimodal strength, and context. Restormel should normalize and summarize this into short, opinionated but sourced product guidance rather than trying to write long bespoke essays for every model. citeturn977037search6turn401009search9

### 6) What credential types should exist?

Recommended set:
- **Gateway Keys** for runtime access to Restormel
- **Management Keys / PATs** for administrative automation
- **Provider Credentials** for OpenAI, Anthropic, Google, Bedrock, Azure, etc.
- **OIDC / workload identity** for server-to-server enterprise cases
- optional **service accounts** for org automation later

This mirrors the distinction Vercel makes between API-key auth and OIDC, and the distinction OpenRouter makes between API keys, BYOK provider credentials, and management keys. citeturn671028view1turn977037search16turn977037search5

### 7) How should provider credentials be scoped?

Best default: **workspace-wide secret, project/environment-level binding**. In other words, store credentials centrally, but let projects or routes decide whether they can use them. Portkey’s catalog is a strong precedent here: centrally managed provider integrations, then scoped controls like budgets, rate limits, and model access. citeturn896483view0

### 8) Should users be able to test, rotate, disable, and audit provider credentials?

Yes. This is table stakes. OpenRouter explicitly documents API key rotation and zero-downtime rotation patterns, and enterprise guidance emphasizes rotation without touching provider configs unnecessarily. Restormel should support credential health checks, last-used timestamps, audit logs, disable/re-enable, and rotation workflows. citeturn977037search9turn977037search21

### 9) Should every UI action have an API and CLI equivalent?

Yes. The best answer for your audience mix is a fully isomorphic control plane: UI for discoverability, CLI for speed, API for automation, SDK for integration, and MCP for agentic workflows. OpenAI’s docs MCP, Anthropic’s LLM-ingestion resources, and Portkey’s agentic usage docs all point in the same direction: serious developer platforms should expose the same system through multiple surfaces. citeturn202200search1turn671028view8turn370234search9

### 10) What should the model catalog contain?

At minimum, each model entry should include:
- canonical model id
- provider-specific ids and availability
- modalities and tool/MCP support
- context window and token limits
- pricing fields
- public rate-limit notes
- lifecycle state
- deprecation / retirement dates where applicable
- recommended replacement
- short use-case guidance
- code examples

That is the minimum consistent with Portkey’s model catalog, Vercel’s models/providers layer, OpenAI pricing/rate-limit/deprecation docs, Anthropic’s model choice and deprecations, and Vertex/Azure lifecycle docs. citeturn896483view0turn671028view3turn671028view9turn671028view10turn671028view11turn202200search3turn671028view12turn671028view13

### 11) How should lifecycle states work?

Recommended normalized schema:
- **Active**
- **Legacy**
- **Deprecated**
- **Retired**

Anthropic already uses a clearly articulated deprecation framework; Vertex AI documents lifecycle stages and migration paths; Azure OpenAI publishes explicit retirement dates and recommended successor models. Restormel should normalize provider differences into one lifecycle UX and preserve source metadata underneath. citeturn202200search3turn671028view12turn671028view13

### 12) How should pricing and rate limits be handled?

Not as static documentation. OpenAI pricing and rate-limit policies change over time and include nuances such as containers, tiers, caching, batch/flex tradeoffs, and model-specific behavior. Azure and Google also introduce provider-specific lifecycle and quota differences. Restormel should therefore treat pricing and limit data as **live product data**, with source timestamps and fallbacks when data cannot be scraped or normalized reliably. citeturn671028view9turn671028view10turn671028view12turn671028view13

### 13) Should Restormel support cost calculators?

Yes. This is strongly justified by the complexity of pricing and the fact that users need forward-looking answers, not just retrospective spend charts. OpenAI’s docs push users toward cost optimization strategies and rate-limit awareness. OpenRouter already reports spend, tokens, requests, and estimated BYOK spend. Restormel should therefore support simple monthly estimates, route-comparison estimates, cached-vs-uncached scenarios, and fallback overhead modeling. citeturn977037search15turn671028view10turn671028view7

### 14) Should MCP be first-class?

Yes. OpenAI now hosts a public docs MCP server and documents MCP/connectors directly in the API docs. Anthropic also publishes MCP resources, and Portkey already documents remote MCP support in its gateway. Restormel should treat MCP as a core integration mode, not an appendix. citeturn202200search1turn977037search11turn671028view8turn896483view3

### 15) What should the docs platform look like?

Best answer: multi-surface docs with one source of truth.
- Human docs site
- API reference
- SDK reference
- machine-readable schemas
- `llms.txt` / `llms-full.txt`
- docs MCP or equivalent
- embedded product help

Anthropic’s and OpenAI’s documentation patterns make this the clearest best practice. Portkey also publishes `llms-full.txt`, which reinforces that this is becoming a standard pattern in AI infrastructure tooling. citeturn671028view8turn202200search0turn202200search1turn896483view3

## Product decisions to lock now

These are the decisions I can answer with high confidence from the research.

### Lock 1: Rename the key taxonomy

Do not use the bare phrase “API Key” in the product except where unavoidable. Use:
- **Gateway Key**
- **Management Key**
- **Provider Credential**
- **OIDC / Workload Identity**

That single move will remove a lot of the current conceptual ambiguity. citeturn671028view1turn977037search5

### Lock 2: Adopt the control-plane object model

Use:
- Workspace
- Project
- Environment
- Gateway Key
- Provider Integration
- Model
- Route
- Policy
- Usage / Logs / Traces
- Lifecycle Event

This is the minimum stable product language implied by Vercel, Portkey, and OpenRouter. citeturn671028view3turn896483view0turn896483view1

### Lock 3: Treat model catalog as core product, not a helper feature

Portkey explicitly elevates “Model Catalog” into a first-class governed surface, and Vercel’s AI Gateway similarly treats models/providers/routing as the heart of the product. Restormel should do the same. citeturn896483view0turn671028view3

### Lock 4: Treat pricing, rate limits, and lifecycle as live data

Do not maintain these in handwritten markdown. Provider docs change too often. OpenAI, Anthropic, Vertex, and Azure all publish evolving model/pricing/lifecycle information that would rapidly go stale if managed manually. citeturn671028view9turn671028view10turn202200search3turn671028view12turn671028view13

### Lock 5: Make UI, CLI, API, SDK, and MCP equivalent views over the same system

This is the cleanest way to serve CLI junkies, API-heavy users, and vibe coders without building three products. OpenAI, Anthropic, and Portkey all show variations of this pattern. citeturn202200search1turn671028view8turn370234search9

## Implementation plan document

## Goal

Build Restormel Keys into a world-class AI gateway and control plane for multi-provider model access, BYOK credential management, curated model exposure, lifecycle awareness, and cost/usage intelligence across UI, CLI, API, SDK, and MCP. This direction is well-supported by current market leaders and adjacent products. citeturn671028view3turn896483view1turn896483view0

## Phase 0 — define the product contract (1–2 weeks)

### Outcomes
- agreed terminology
- agreed object model
- agreed auth model
- agreed first-run story

### Deliverables
- glossary of canonical nouns
- key taxonomy
- product narrative: “what Restormel is”
- first-run UX principles
- docs IA skeleton

### Decisions to finalize
- runtime auth methods
- management auth methods
- hierarchy: workspace/project/environment
- billing mode support: Restormel-billed, BYOK, or both

This phase matters because Vercel and OpenRouter are both very explicit about authentication and BYOK, and that clarity is part of why their products feel legible. citeturn671028view1turn671028view2turn671028view5

## Phase 1 — rebuild authentication and credential management (2–4 weeks)

### Outcomes
- clear separation between gateway auth and provider auth
- secure credential storage and rotation
- auditable access model

### Product changes
- rename “API key” to “Gateway Key”
- add “Provider Credentials” section
- add “Management Keys” or PATs
- add OIDC/workload identity support to roadmap
- add test / disable / rotate / audit actions for secrets

### Dashboard surfaces
- Access
- Provider Integrations
- Audit Log

### CLI/API requirements
- create/list/revoke gateway keys
- create/test/rotate provider credentials
- view credential bindings by project/environment

The direction is supported by Vercel’s API key + OIDC model and OpenRouter’s management-key and key-rotation patterns. citeturn671028view1turn977037search16turn977037search5turn977037search21

## Phase 2 — build the model catalog as a first-class surface (3–5 weeks)

### Outcomes
- discoverable provider/model inventory
- normalized model metadata
- lifecycle and pricing visibility
- curated model exposure

### Product changes
- add Models section
- add Providers section
- support provider slugs / bindings
- support org/workspace/project allow-lists
- attach model metadata, code snippets, and guidance

### Required metadata
- model ids, provider ids
- token/context limits
- modalities
- tool / MCP support
- pricing data
- rate-limit notes
- lifecycle state
- migration target
- short editorial guidance

Portkey’s model catalog is the strongest precedent for making this a governed management layer rather than a dropdown. Vercel’s models/providers layer shows the same direction. citeturn896483view0turn671028view3

## Phase 3 — routing, policies, and customer exposure controls (3–5 weeks)

### Outcomes
- visible routing behavior
- resilient fallback
- governance over which models can be used by whom

### Product changes
- add Routes
- add Policies
- add fallback chains
- add preferred provider ordering
- add “expose to downstream users” control
- add spend/rate-limit policies per route or tenant

### Route templates
- cheapest
- fastest
- best reasoning
- coding-focused
- low-latency chat
- private/BYOK only
- fail-closed
- fail-open with controlled fallback

This direction is strongly supported by Vercel’s provider routing and model fallbacks, and by OpenRouter’s explicit provider selection and BYOK prioritization behavior. citeturn671028view3turn671028view6

## Phase 4 — analytics, logs, and cost intelligence (3–5 weeks)

### Outcomes
- usable observability
- spend visibility
- route explainability
- budgeting and forecasting

### Minimum analytics
- requests
- input/output/cached tokens
- spend
- latency
- error rate
- 429s / throttling
- top models
- top providers
- top keys
- route fallback rate
- BYOK vs platform-billed split

### Gold-plated analytics
- “why this route chose this provider”
- savings opportunities
- deprecation exposure
- anomaly detection
- forecasted monthly spend
- route scenario calculator

Vercel, OpenRouter, and Portkey all treat observability and spend visibility as core product value, not secondary reporting. citeturn977037search25turn896483view2turn671028view7

## Phase 5 — documentation platform rebuild (3–6 weeks, can overlap)

### Outcomes
- docs that work for humans and agents
- shared source of truth with product UI
- better onboarding and support

### Documentation architecture
- Get started
- Concepts
- Provider management
- Model catalog
- Routing and policies
- Pricing and limits
- Analytics and debugging
- Security and BYOK
- CLI reference
- SDK reference
- API reference
- MCP / agent docs
- Lifecycle and migration notices

### Machine-readable surfaces
- OpenAPI
- JSON Schemas
- model catalog endpoint
- provider catalog endpoint
- `llms.txt`
- `llms-full.txt`
- docs MCP

Anthropic’s AI-ingestion resources and OpenAI’s Docs MCP are the clearest evidence that this is no longer optional for best-in-class developer tooling. citeturn671028view8turn202200search0turn202200search1

## Phase 6 — lifecycle, pricing, and rate-limit ingestion service (4–6 weeks)

### Outcomes
- model data stays current
- lifecycle warnings are credible
- pricing/cost calculators are trustworthy

### Data sources to ingest
- OpenAI pricing, rate limits, deprecations
- Anthropic model docs and deprecations
- Google Vertex model and lifecycle docs
- Azure OpenAI retirement docs
- provider-specific notes where needed

### Product behavior
- show “last verified”
- show provider source
- show replacement recommendations
- warn inside catalog, routes, and project usage views

This is essential because the provider ecosystem changes frequently and publishes materially important lifecycle and pricing information in separate places. citeturn671028view9turn671028view10turn671028view11turn202200search3turn671028view12turn671028view13

## Phase 7 — isomorphic developer surfaces (ongoing)

### Outcomes
- parity across UI, CLI, API, SDK, MCP
- reduced product fragmentation

### Rule
Every major dashboard action should have:
- a UI flow
- a CLI command
- an API endpoint
- example SDK snippets
- agent/MCP-safe documentation

That is the best way to support your three user types without drifting into separate products. citeturn202200search1turn671028view8turn370234search9

## Recommended dashboard IA

- Overview
- Projects
- Access
- Provider Integrations
- Models
- Routes
- Policies
- Analytics
- Logs & Traces
- Docs
- Lifecycle & Migrations
- Billing / Cost Forecasts

This IA follows the control-plane pattern surfaced by Vercel, OpenRouter, and Portkey. citeturn671028view3turn896483view0turn896483view1

## Recommended first-run flow

1. Create workspace and project  
2. Create Gateway Key  
3. Choose billing mode: BYOK or platform-billed  
4. Connect provider credentials  
5. Pick a starter route  
6. Make a test request via CLI, curl, SDK, or UI  
7. Inspect logs, cost, and routing outcome  
8. Curate which models are available to the project or downstream users

This flow resolves the current ambiguity around the meaning of the key and brings users rapidly to first value. The shape is grounded in the way Vercel and Portkey center gateway access, model/provider selection, and observability. citeturn671028view1turn671028view3turn896483view1

## Highest-priority backlog

1. Rename and split credential types  
2. Add Provider Integrations  
3. Add Model Catalog  
4. Add routing/fallback policies  
5. Add analytics/logging views  
6. Rebuild onboarding around Gateway Key + Provider Credential distinction  
7. Rebuild docs IA and machine-readable docs outputs  
8. Build provider metadata ingestion service  
9. Add lifecycle warnings and migration suggestions  
10. Add cost calculators and budget controls

## What not to do

- Do not polish the current “one project, one API key” model; it is the wrong abstraction.  
- Do not keep using “API key” as an undifferentiated label.  
- Do not present models as a flat dropdown without lifecycle, pricing, and provider context.  
- Do not maintain lifecycle and pricing information manually in prose docs.  
- Do not treat MCP as niche.  
- Do not make the UI the only way to manage the platform.  

All of those failure modes are contradicted by the strongest current product patterns in this category. citeturn671028view1turn671028view3turn896483view0turn202200search1
