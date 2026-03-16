# Restormel Keys — implementation prompt pack

## Purpose

This prompt pack is designed to help a coding agent or implementation-focused chat turn the strategy and product architecture into actual deliverables.

It is structured in layers:
1. foundation prompts
2. dashboard and UI prompts
3. docs prompts
4. data model and backend prompts
5. onboarding prompts
6. analytics and lifecycle prompts
7. QA / review prompts

These prompts assume the product direction is:

- Restormel Keys is an **AI gateway and control plane**
- it supports **Gateway Keys**, **Provider Integrations**, **Model Catalog**, **Routes**, **Policies**, **Analytics**, **Lifecycle**, and **Docs**
- it serves **UI users, CLI users, API users, SDK users, and MCP/agent users**
- it should feel coherent, modern, explicit, and trustworthy

---

# 1. Project instruction prompt

Use this at the top of a new implementation chat to establish the frame.

## Prompt 1 — master project instruction

You are working on the Restormel Keys product.

Restormel Keys should be treated as an **AI gateway and control plane**, not merely an API key page or a simple credentials manager.

The product must support:
- authentication into Restormel via **Gateway Keys**
- management access via **Management Keys / PATs**
- upstream **Provider Integrations** for OpenAI, Anthropic, Google/Vertex, Azure OpenAI, Bedrock, and future providers
- a governed **Model Catalog**
- **Routes** that decide model/provider selection and fallback behaviour
- **Policies** for governance, allow/deny rules, budgets, lifecycle restrictions, and downstream exposure rules
- **Analytics**, **Logs & Traces**, **Billing & Forecasting**
- **Lifecycle & Migration** visibility for models
- first-class support for **UI**, **CLI**, **API**, **SDK**, and **MCP/agent** users

Important product principles:
- Never use the term “API Key” on its own if “Gateway Key” or “Provider Credential” is more precise.
- Always keep **Gateway Key** and **Provider Credential** conceptually separate.
- Always prefer the control-plane abstraction over loose settings-page patterns.
- The system should be usable by solo builders, platform engineers, and SaaS vendors exposing models to downstream customers.
- The UI, docs, CLI, API, SDK, and MCP surfaces should use the same canonical nouns.
- Models must not be treated as a flat dropdown. They need pricing, lifecycle, provider, and capability context.
- Pricing, rate limits, and lifecycle data should be treated as live structured data, not static prose.
- Routing and fallback behaviour should be visible and explainable.
- The product should feel modern, legible, and operationally trustworthy.

Canonical nouns to use consistently:
- Workspace
- Project
- Environment
- Gateway Key
- Management Key
- Provider Integration
- Model
- Route
- Policy
- Lifecycle State
- Request Log
- Usage Aggregate
- Customer Tenant
- Exposure Rule

When designing or implementing:
- preserve conceptual clarity
- reduce ambiguity
- show, not hide, system behaviour
- default to explicitness over magic
- make advanced functionality accessible without making the product confusing

Use these principles for every subsequent task in this chat.

---

# 2. Dashboard and UI prompts

## Prompt 2 — build the dashboard IA into implementation-ready screens

Using the following product direction, turn the dashboard IA into an implementation-ready screen specification.

I need:
- a page-by-page screen list
- route hierarchy / nav structure
- key components required on each page
- repeated component patterns
- key states and empty states
- main user actions per page
- suggested permission-sensitive actions
- the likely order of implementation

Important constraints:
- The dashboard is a control plane, not a settings collection.
- The IA must include:
  - Overview
  - Projects
  - Access
  - Provider Integrations
  - Models
  - Routes
  - Policies
  - Analytics
  - Logs & Traces
  - Lifecycle & Migrations
  - Billing & Forecasting
  - Documentation
- Distinguish clearly between Gateway Keys and Provider Credentials.
- Treat Models as a governed catalog, not a dropdown.
- Treat Routes as named runtime behaviour objects, not a hidden config detail.
- Include support for downstream customer exposure / tenancy where appropriate.

Output format:
1. top-level nav
2. route tree
3. screen inventory
4. per-screen structure
5. common reusable components
6. empty states
7. implementation order

Do not write code yet. Produce a crisp product/UX implementation spec.

---

## Prompt 3 — create wireframes for the Access and Provider Integrations areas

Design the **Access** and **Provider Integrations** areas of Restormel Keys in detail.

I need:
- the full screen structure
- table/card layouts
- create/edit flows
- contextual help copy
- empty states
- error states
- success states
- key actions and safeguards
- audit / rotation / verification surfaces

Access must cover:
- Gateway Keys
- Management Keys / PATs
- Service Accounts (if appropriate)
- OIDC / workload identity placeholder if not implemented yet
- Audit Log

Provider Integrations must cover:
- provider list
- connect provider flow
- credential verification flow
- provider bindings to projects/environments
- provider detail page
- provider model discovery
- rotation / disable / test controls

Critical constraints:
- Never blur Gateway Keys and Provider Credentials.
- Every page must explain in plain English what kind of credential is being managed.
- The design should feel suitable for developers and platform teams, but still approachable.

Output as a structured UX spec with headings and bullet points.

---

## Prompt 4 — create wireframes for Models, Routes, Policies, and Lifecycle

Design the detailed product UX for the following Restormel Keys areas:
- Models
- Routes
- Policies
- Lifecycle & Migrations

The output should include:
- screen purposes
- page layouts
- list/detail views
- compare flows
- creation flows
- edit flows
- migration flows
- common states
- suggested interaction patterns

Critical product rules:
- Models must include provider variants, pricing, lifecycle, and editorial guidance.
- Routes must make runtime selection and fallback behaviour visible.
- Policies must express governance in plain English as well as machine rules.
- Lifecycle must show concrete dates, impacted routes/projects, and suggested replacements.

Output format:
1. Models UX
2. Routes UX
3. Policies UX
4. Lifecycle UX
5. shared components

---

## Prompt 5 — convert the dashboard IA into a component architecture for the frontend

Using the Restormel Keys dashboard IA, create a frontend component architecture.

I need:
- page-level components
- layout components
- reusable table/list components
- detail panels
- compare drawers
- audit drawers
- empty-state components
- form primitives
- route visualisation components
- lifecycle warning components
- code snippet components

Assume a modern TypeScript frontend stack.

Output format:
1. component tree
2. shared primitives
3. domain-specific components
4. component naming suggestions
5. notes on state ownership

Do not write full production code yet unless explicitly necessary.

---

# 3. Docs prompts

## Prompt 6 — create the docs information architecture and content map

Create a full documentation architecture for Restormel Keys.

The docs must work for:
- human readers
- developers
- platform teams
- agent users
- MCP users

The docs system should include:
- Get started
- Core concepts
- Provider setup
- Model catalog
- Routing and policies
- Analytics and cost
- Security and governance
- Interfaces (CLI, API, SDK, MCP)
- Guides
- Troubleshooting
- Changelog and lifecycle

I need:
- full sitemap
- page titles
- page purposes
- suggested audience for each page
- dependencies between pages
- what should be concept docs vs guide docs vs reference docs
- machine-readable surfaces needed alongside the docs

Important constraints:
- Keep canonical nouns consistent with the product.
- Explicitly separate Gateway Key from Provider Credential.
- Include `llms.txt`, `llms-full.txt`, OpenAPI, JSON Schemas, and docs MCP considerations.
- Treat lifecycle and pricing as living data-backed content.

Output format:
1. sitemap
2. page inventory
3. content types
4. machine-readable layers
5. editorial rules

---

## Prompt 7 — draft the core concept docs

Write the first draft of the core concept docs for Restormel Keys.

Create concise but clear concept pages for:
- Workspace
- Project
- Environment
- Gateway Key
- Management Key
- Provider Integration
- Model
- Route
- Policy
- Lifecycle State
- Request Log
- Usage Aggregate
- Customer Tenant
- Exposure Rule

Rules:
- Each page should define the concept in plain English first.
- Then explain why it exists.
- Then explain how it relates to other concepts.
- Then include a short “common mistakes / confusion” section.
- Use one consistent voice.
- Keep them implementation-aware but not overly technical.
- Avoid vague marketing language.

Output each concept as a clearly separated markdown section.

---

## Prompt 8 — draft the first-run docs set

Write the initial “Get started” documentation set for Restormel Keys.

I need first drafts for:
- What is Restormel Keys?
- Gateway Key vs Provider Credential
- Your first request
- Quickstart: CLI
- Quickstart: TypeScript
- Quickstart: Python
- Quickstart: REST API
- Quickstart: MCP / agent
- Connect your first provider
- Create your first route

Constraints:
- These pages must reduce ambiguity immediately.
- They must be consistent with the onboarding copy.
- They must explain the system in the order a new user needs to learn it.
- Each quickstart should be short, direct, and concrete.
- Use the term Gateway Key consistently.
- Never assume the user already understands the relationship between Restormel and upstream providers.

Output as separate markdown pages.

---

## Prompt 9 — generate the agent-ready docs layer

Design the agent-readable documentation layer for Restormel Keys.

I need:
- a proposed `llms.txt`
- a proposed `llms-full.txt` structure
- a docs MCP surface proposal
- the machine-readable object definitions agents will need
- suggestions for which docs pages should have structured summaries
- guidance on how to expose model catalog, route schema, and auth concepts in agent-friendly form

Constraints:
- Make the system maximally usable by agents without duplicating the whole docs site unnecessarily.
- Assume agents need explicit schemas, stable object names, predictable examples, and operational caveats.
- Keep human docs and agent docs aligned via one source of truth where possible.

Output format:
1. design principles
2. file/interface inventory
3. sample structures
4. recommendations

---

# 4. Data model and backend prompts

## Prompt 10 — turn the conceptual data model into an implementation-ready schema

Using the Restormel Keys conceptual data model, produce an implementation-ready backend schema proposal.

Core entities to include:
- Workspace
- Project
- Environment
- GatewayKey
- ManagementKey
- ProviderIntegration
- ProviderBinding
- Model
- ProviderModelVariant
- PricingRecord
- RateLimitRecord
- LifecycleEvent
- Route
- RouteStep
- Policy
- PolicyBinding
- CustomerTenant
- ExposureRule
- RequestLog
- UsageAggregate
- AuditEvent

I need:
- field lists
- relationships
- likely constraints
- nullable vs non-nullable reasoning
- indexing suggestions
- lifecycle / audit considerations
- secrets-handling considerations
- places where denormalization may be useful

Output format:
1. entity-by-entity schema notes
2. relationship summary
3. indexing suggestions
4. security considerations
5. migration notes

Do not generate code yet unless asked.

---

## Prompt 11 — design the auth and credential-management backend

Design the backend architecture for authentication and credential management in Restormel Keys.

It must support:
- Gateway Keys for runtime access
- Management Keys / PATs for admin automation
- Provider Credentials for upstream integrations
- future support for OIDC / workload identity
- rotation
- revocation
- last-used tracking
- audit logging
- scoped access

I need:
- auth model
- trust boundaries
- secret storage approach
- rotation model
- scoping model
- API surface suggestions
- audit event design
- failure mode analysis

Critical rule:
Gateway Keys and Provider Credentials must remain separate in both data model and product behaviour.

Output as a backend architecture spec.

---

## Prompt 12 — design the model catalog ingestion system

Design the backend system that powers the Restormel Keys model catalog.

The system must ingest and normalize:
- provider model listings
- pricing
- rate limits / quota notes
- lifecycle / deprecation / retirement data
- provider-specific model metadata
- short editorial guidance fields

I need:
- ingestion architecture
- source-of-truth strategy
- normalization approach
- refresh strategy
- conflict resolution rules
- source timestamping
- handling for incomplete or inconsistent provider data
- internal data shapes
- operational safeguards

Important constraint:
Pricing, rate limits, and lifecycle must be treated as live structured data, not manually maintained prose.

Output format:
1. system overview
2. data inputs
3. normalization rules
4. refresh / verification approach
5. fallback behaviour
6. implementation notes

---

## Prompt 13 — design the route engine conceptually

Create a conceptual design for the Restormel Keys route engine.

A Route is a named runtime object that decides:
- which model/provider should be preferred
- when fallbacks should trigger
- how billing mode is applied
- what constraints or policies are enforced
- what explanation should be logged after selection

I need:
- route object design
- route-step design
- fallback logic design
- policy interaction model
- lifecycle restriction handling
- explanation / trace output design
- common route templates

The design must support:
- cheapest
- fastest
- best reasoning
- coding assistant
- multimodal
- BYOK only
- fail closed
- fail open

Output as a clear design spec, not code.

---

# 5. Onboarding prompts

## Prompt 14 — turn the onboarding copy into full screen specs

Using the screen-by-screen onboarding copy, create full onboarding screen specifications.

I need:
- each screen’s purpose
- content hierarchy
- fields and controls
- inline helper copy
- validation rules
- CTA logic
- alternative states
- what data is created at each step
- how the onboarding adapts for different user segments

User segments:
- solo builder / vibe coder
- platform engineer / production team
- SaaS vendor exposing models to downstream customers

Output format:
1. screen inventory
2. per-screen specs
3. segment variations
4. validation and data-creation notes

---

## Prompt 15 — design the first-run activation flow after onboarding

Design the post-onboarding activation flow for Restormel Keys.

After a user completes the initial setup, I want the product to guide them toward deeper activation.

I need:
- recommended activation milestones
- dashboard nudges
- in-product checklist
- contextual upsell or education moments
- sequence of “next best actions”
- role-sensitive variations

The activation flow should help users:
- connect more providers
- compare models
- create production-scoped keys
- add routes
- add policies
- inspect analytics
- handle lifecycle warnings
- expose approved models to downstream users if relevant

Output as an activation strategy and product UX spec.

---

# 6. Analytics, lifecycle, and forecasting prompts

## Prompt 16 — design the analytics UX and metrics model

Design the analytics experience for Restormel Keys.

It must cover:
- requests
- spend
- tokens
- latency
- error rate
- fallback rate
- by project
- by route
- by provider
- by model
- by gateway key
- by customer tenant where relevant

I need:
- metrics definitions
- recommended charts and tables
- summary cards
- comparison views
- useful derived insights
- key filters
- drill-down behaviour
- cross-links into logs and routes

Important:
The analytics should be operational, not vanity reporting.

Output format:
1. metrics model
2. UI structure
3. insight layer
4. drill-down design

---

## Prompt 17 — design lifecycle and migration UX

Design the lifecycle and migration system for Restormel Keys.

The product needs to make model lifecycle risk visible and actionable.

I need:
- lifecycle state model
- warning thresholds
- where lifecycle warnings appear in the product
- lifecycle dashboard design
- impacted objects views
- migration suggestion flows
- bulk migration actions
- acknowledgement model
- audit trail requirements

Lifecycle states should include:
- Active
- Legacy
- Deprecated
- Retired

Output as a product and UX specification.

---

## Prompt 18 — design the billing and forecasting calculator

Design the billing and forecasting experience for Restormel Keys.

I need:
- calculator IA
- input model
- output model
- simple estimate mode
- route comparison mode
- provider comparison mode
- cached vs uncached scenarios
- fallback overhead modeling
- downstream tenant estimate mode
- budget alert integration

The goal is to help users answer:
- what will this likely cost?
- what is driving current cost?
- what would be cheaper?
- what happens if fallback usage increases?

Output as a product/UX spec with suggested formulas and caveats.

---

# 7. Review and QA prompts

## Prompt 19 — critique the product structure for ambiguity and inconsistency

Review the current Restormel Keys product spec for ambiguity, inconsistency, and conceptual drift.

I want you to look for:
- places where Gateway Key and Provider Credential are blurred
- places where models are treated as a dropdown rather than a governed catalog
- places where routes are under-defined
- places where policies are too abstract
- places where lifecycle is not operationally visible
- places where UI, docs, API, and onboarding use inconsistent language
- places where the control-plane concept collapses back into settings-page thinking

Output format:
1. issue
2. why it matters
3. recommended correction
4. severity

Be blunt and precise.

---

## Prompt 20 — convert the product spec into an implementation backlog

Using the current Restormel Keys product spec, convert it into a phased implementation backlog.

I need:
- epics
- capabilities
- user stories
- dependencies
- recommended phase order
- definition of done suggestions
- what can be mocked first
- what needs real backend support first

Output format:
1. phases
2. epics
3. stories
4. dependencies
5. sequencing notes

---

## Prompt 21 — produce a design-review checklist

Create a design-review checklist for Restormel Keys.

The checklist should help review:
- IA clarity
- credential clarity
- onboarding clarity
- model catalog usability
- route explainability
- lifecycle visibility
- policy legibility
- analytics usefulness
- docs alignment
- consistency across UI / CLI / API / SDK / MCP

Output a practical checklist a product/design/engineering team could use in reviews.

---

# 8. Suggested prompt sequence

If you want to use this pack in order, use prompts in roughly this sequence:

1. Prompt 1 — master project instruction  
2. Prompt 2 — dashboard IA to implementation spec  
3. Prompt 3 — Access and Provider Integrations UX  
4. Prompt 4 — Models, Routes, Policies, Lifecycle UX  
5. Prompt 10 — data model to schema  
6. Prompt 11 — auth and credential backend  
7. Prompt 12 — model catalog ingestion  
8. Prompt 13 — route engine design  
9. Prompt 6 — docs IA  
10. Prompt 7 — core concept docs  
11. Prompt 8 — first-run docs  
12. Prompt 14 — onboarding screen specs  
13. Prompt 15 — activation flow  
14. Prompt 16 — analytics UX  
15. Prompt 17 — lifecycle and migration UX  
16. Prompt 18 — billing and forecasting calculator  
17. Prompt 19 — critique pass  
18. Prompt 20 — implementation backlog  
19. Prompt 21 — design-review checklist

---

# 9. Optional “single-shot” prompt

If you want one bigger prompt to kick off a serious implementation planning chat, use this:

You are helping me implement Restormel Keys.

Restormel Keys is an AI gateway and control plane, not just a key-settings page.

It must support:
- Gateway Keys
- Management Keys
- Provider Integrations
- governed Model Catalog
- Routes and Fallbacks
- Policies
- Analytics
- Logs & Traces
- Lifecycle & Migrations
- Billing & Forecasting
- Docs for human, developer, agent, and MCP users

Canonical nouns:
- Workspace
- Project
- Environment
- Gateway Key
- Management Key
- Provider Integration
- Model
- Route
- Policy
- Lifecycle State
- Request Log
- Usage Aggregate
- Customer Tenant
- Exposure Rule

Critical rules:
- never blur Gateway Key and Provider Credential
- never reduce Models to a flat dropdown
- make Routes visible and explainable
- make lifecycle operationally visible
- align UI, docs, API, CLI, SDK, and MCP vocabulary
- treat pricing / rate limits / lifecycle as live structured data

I need you to produce:
1. an implementation-ready dashboard/product spec
2. a docs IA and content plan
3. a backend/data model architecture
4. onboarding and activation specs
5. analytics, lifecycle, and billing UX
6. a phased implementation backlog

Be structured, direct, and implementation-oriented.
