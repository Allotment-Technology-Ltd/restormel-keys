# Restormel Keys — Cursor-specific development implementation prompt pack

## Purpose

This pack is for **Cursor implementation work**, not product strategy or design exploration.

It assumes the following documents already exist and should be treated as reference material:
- dashboard IA
- docs IA
- data model
- onboarding flow
- dashboard wireframe outline
- onboarding copy
- general implementation plan
- design-oriented prompt pack

These documents should be used by Cursor as **constraints and reference context**, but the prompts below are focused on **shipping the product**.

Use these prompts to:
- inspect the repo
- identify the current architecture
- map gaps between current code and target product shape
- implement features incrementally
- refactor safely
- add backend objects and frontend surfaces
- wire up APIs, storage, auth, logging, and catalog ingestion
- produce production-ready code, migrations, tests, and docs updates

---

# 0. How to use this pack in Cursor

## Working method

For each prompt:
1. give Cursor the prompt
2. attach or paste the relevant reference docs
3. tell Cursor to inspect the repo before making assumptions
4. require it to identify the exact files it will change
5. require it to explain the implementation plan before editing
6. require it to produce code, tests, and docs updates together where relevant

## Global instruction to prepend in Cursor

Use this before any of the implementation prompts:

You are working in the Restormel Keys codebase.

Before making changes:
- inspect the existing repo structure thoroughly
- identify the current frontend, backend, database, auth, and docs architecture
- do not assume the codebase already matches the target product model
- map current implementation to the target concepts before editing anything
- preserve working behaviour unless explicitly replacing it
- prefer incremental refactors over destructive rewrites
- list the files you plan to inspect
- then list the files you plan to change
- explain risks, dependencies, and migration needs before writing code

Critical product rules:
- Restormel Keys is an AI gateway and control plane, not a simple API-key page
- Gateway Keys and Provider Credentials must remain conceptually and technically separate
- Models must be implemented as a governed catalog, not a flat dropdown
- Routes must be first-class runtime objects with visible fallback behaviour
- Pricing, rate limits, and lifecycle should be treated as structured data
- UI, API, CLI, SDK, and docs should share the same canonical nouns

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

Implementation rules:
- prefer small, reviewable commits
- keep type safety strong
- add tests for new behaviour
- add migrations for data model changes
- update docs where behaviour changes
- avoid introducing ambiguous naming like plain “API key” where a more precise term is available
- do not give me only a plan; implement the change unless blocked by missing repo context

When done:
- summarize what changed
- list follow-up tasks
- list any technical debt or shortcuts introduced

---

# 1. Repo audit and implementation gap prompts

## Prompt 1 — audit the current repo against the target product model

Inspect this repo and compare the existing implementation against the target Restormel Keys product model.

I want you to:
1. identify the current architecture
2. identify the current auth/key model
3. identify current project/workspace/environment concepts if any
4. identify how provider integrations are currently handled
5. identify whether models are currently treated as a dropdown, config blob, or structured object
6. identify whether routes, policies, lifecycle, analytics, and logs already exist
7. identify the current dashboard/navigation structure
8. identify the top architectural mismatches against the target control-plane model

Then produce:
- a repo map
- a gap analysis
- a recommended implementation order grounded in the actual codebase
- a file-level change plan

Do not write code yet. First inspect the repo and tell me exactly how the current implementation differs from the target.

Reference documents to use as constraints:
- dashboard IA
- docs IA
- data model
- onboarding flow
- wireframe outline
- onboarding copy

---

## Prompt 2 — identify the minimum viable refactor path

Based on your repo audit, propose the smallest safe sequence of implementation steps that moves the codebase from its current state toward the target Restormel Keys architecture.

I want:
- the minimum viable refactor path
- what can remain as-is temporarily
- what must be renamed immediately
- what backend/data changes are unavoidable
- what frontend/nav changes are unavoidable
- what can be feature-flagged
- where backward compatibility matters
- the recommended order of migrations

Output:
1. architectural constraints found in repo
2. proposed phases
3. per-phase code areas affected
4. risk notes
5. first implementation task to execute

Do not be generic. Base your answer on the actual repo.

---

# 2. Foundational refactor prompts

## Prompt 3 — implement key taxonomy refactor

Inspect the current repo and implement the first safe refactor needed to separate:
- Gateway Keys
- Management Keys / PATs
- Provider Credentials / Provider Integrations

Tasks:
1. find where the current code uses ambiguous terms like “API key”
2. identify which usages refer to runtime access to Restormel
3. identify which usages refer to upstream provider secrets
4. introduce precise types, names, and labels
5. refactor UI labels, backend models, API contracts, and any docs strings where appropriate
6. preserve backwards compatibility where necessary, with migration shims if needed

Requirements:
- do not break existing flows unnecessarily
- add or update tests
- update user-facing copy where ambiguity exists
- add TODOs only where absolutely necessary
- provide a migration note if stored data or API fields are affected

Before coding:
- list all files to change
- explain the renaming strategy
- explain any compatibility risks

Then implement it.

---

## Prompt 4 — introduce canonical domain models in code

Using the target data model as reference, inspect the codebase and introduce or normalize the core domain models required for Restormel Keys.

Target models:
- Workspace
- Project
- Environment
- GatewayKey
- ManagementKey
- ProviderIntegration
- ProviderBinding
- Model
- ProviderModelVariant
- Route
- Policy
- RequestLog
- UsageAggregate
- AuditEvent

Tasks:
1. inspect existing types/entities/schemas
2. map which of these already exist
3. create or refactor missing core types
4. align naming across backend and frontend shared types if applicable
5. avoid over-implementing entities not yet wired to behaviour, but establish the structure cleanly

Requirements:
- use the existing stack conventions in the repo
- keep types coherent across layers
- add migrations if persistence schema changes
- document temporary placeholders where a full implementation is deferred

Implement the changes, not just the plan.

---

## Prompt 5 — implement workspace / project / environment hierarchy

Inspect the current repo and implement the hierarchy:
- Workspace
- Project
- Environment

This should replace or extend the current flatter “single project” model safely.

Tasks:
1. inspect current data model and routing of “project”
2. introduce workspace and environment concepts where missing
3. update backend schema, services, API handlers, and frontend state as needed
4. update the dashboard navigation and selection logic to support this hierarchy
5. preserve current single-project flows via defaults or migration fallbacks where possible

Requirements:
- keep the first rollout simple: dev/prod environments are enough if the codebase is not ready for more
- add seed/default behaviour for existing users
- update tests
- update onboarding-related code if it exists

Before editing:
- explain how current data maps into the new hierarchy

Then implement.

---

# 3. Backend and schema prompts

## Prompt 6 — implement the database/schema changes for the control-plane model

Inspect the current persistence layer and implement the next safe set of schema changes needed to support the target Restormel Keys control-plane model.

Focus on:
- Gateway Keys
- Provider Integrations
- Provider Bindings
- Models / Provider Model Variants
- Routes
- Policies
- Audit Events
- Request Logs / Usage Aggregates if feasible in current phase

Tasks:
1. inspect current ORM/schema/migrations
2. propose exact schema changes
3. create the migrations
4. update models/entities
5. update repository/service code
6. keep backward compatibility where practical

Requirements:
- do not create dead schema without corresponding service usage unless clearly marked as phased groundwork
- add indexes where obviously needed
- call out secrets-handling considerations explicitly
- include rollback considerations in your notes

Implement the changes.

---

## Prompt 7 — implement auth and secret handling foundations

Inspect the current auth and secret-management implementation and extend it to support:
- Gateway Keys for runtime auth
- Management Keys for admin automation
- Provider Credentials stored separately
- key rotation
- last-used tracking
- audit events
- scoped access

Tasks:
1. inspect existing auth middleware, token/key verification, secret storage, and audit hooks
2. identify what is reusable
3. implement the missing separation and storage model
4. add safe secret reveal/create flows where appropriate
5. add last-used updates and audit events
6. wire this into the existing backend surface

Requirements:
- never conflate provider secrets with Restormel runtime access
- do not expose secrets after creation unless the current design already does so intentionally and safely
- use hashing/encryption patterns already present in the repo where suitable
- add tests for auth behaviour

Implement the changes.

---

## Prompt 8 — implement Provider Integrations backend

Inspect the current provider-related code and implement a proper Provider Integrations backend surface.

It should support:
- provider records
- secure credential storage
- verification state
- project/environment bindings
- enable/disable state
- audit events
- discovered model metadata placeholder or hook

Tasks:
1. inspect current provider config handling
2. refactor ad hoc provider config into Provider Integrations where needed
3. create backend service methods and API endpoints
4. add validation and verification hooks
5. expose provider bindings to the frontend

Requirements:
- keep provider-specific logic isolated where practical
- design so additional providers can be added cleanly
- add tests around provider creation, verification, and binding

Implement the changes.

---

## Prompt 9 — implement the model catalog backend foundation

Inspect the repo and implement the backend foundation for a structured model catalog.

The immediate goal is not to build the full ingestion engine yet, but to stop treating models as an unstructured dropdown or config string.

Tasks:
1. inspect how models are currently represented
2. introduce Model and ProviderModelVariant structures
3. create read/query APIs for model listing and model detail
4. support lifecycle, pricing, and capability fields even if partially populated at first
5. ensure the frontend can consume a real catalog object rather than a flat list

Requirements:
- do not overcomplicate the first pass
- keep it compatible with future ingestion work
- add tests for catalog listing and filtering

Implement the changes.

---

## Prompt 10 — implement routes as first-class backend objects

Inspect how the current system chooses providers/models and implement Routes as first-class backend objects.

A Route should support:
- name
- project/environment scope
- primary target
- fallback behaviour
- billing mode
- policy hooks
- status
- explanation metadata for logging

Tasks:
1. inspect any current routing or config logic
2. extract or wrap it into a Route model/service
3. add persistence
4. add CRUD backend surface
5. define route-step structures if needed
6. make room for fallback behaviour even if only partially implemented in v1

Requirements:
- avoid breaking current request execution flows
- add tests for route creation and resolution
- document any temporary bridging logic

Implement the changes.

---

## Prompt 11 — implement policy foundations

Inspect the current repo and implement the first usable version of Policies.

Policies should support at least:
- model allowlist / denylist
- provider allowlist / denylist
- deprecated-model restriction
- budget or usage placeholder hooks

Tasks:
1. inspect current config/guardrail logic
2. introduce a Policy model and PolicyBinding structure
3. wire policy evaluation hooks into route selection or request validation where feasible
4. expose APIs for policy CRUD and binding
5. add tests for policy enforcement

Requirements:
- keep the initial policy engine simple and explicit
- prioritize readable rule shapes over clever abstraction
- document what is enforced now vs later

Implement the changes.

---

# 4. Frontend implementation prompts

## Prompt 12 — implement the dashboard nav refactor

Inspect the current frontend and implement the left-nav/dashboard information architecture refactor toward:

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

Tasks:
1. inspect current routing/navigation/layout components
2. map old nav items to new structure
3. implement the new nav and route skeleton
4. preserve existing pages where possible under the new structure
5. add placeholders where a full page is not implemented yet, but do so clearly

Requirements:
- do not fake completed functionality
- keep the app navigable after the refactor
- use canonical nouns in the UI
- add or update tests if the frontend stack supports them

Implement the changes.

---

## Prompt 13 — implement the Access section frontend

Build the frontend for the Access section using the new key taxonomy.

It should include:
- Gateway Keys list
- Create Gateway Key flow
- Management Keys list or placeholder
- Audit Log entry point
- clear explanatory copy

Tasks:
1. inspect current key-management UI
2. refactor it into Access
3. update labels and actions
4. connect to backend APIs if already present
5. add loading/empty/error/success states

Requirements:
- plain English explanations of key types
- never blur Gateway Key with Provider Credential
- prioritize functional clarity over visual polish
- reuse existing design system/components where possible

Implement the changes.

---

## Prompt 14 — implement Provider Integrations frontend

Build the frontend for Provider Integrations.

It should include:
- provider list page
- connect provider flow
- provider detail page
- verification state
- bindings UI
- model discovery summary placeholder if full discovery is not wired yet

Tasks:
1. inspect current provider UI/config pages
2. refactor or replace them with a Provider Integrations section
3. connect to backend endpoints
4. implement appropriate states and guardrails

Requirements:
- show provider credential concepts clearly
- include “last verified” and status where backend supports it
- do not over-design; ship a usable control surface

Implement the changes.

---

## Prompt 15 — implement the Models catalog frontend

Build the first usable frontend for the Models catalog.

It should include:
- model list page
- filtering
- provider variant visibility
- lifecycle badge
- pricing/capability summary fields where available
- model detail page or drawer

Tasks:
1. inspect how models are currently selected in the UI
2. refactor away from flat dropdown-driven model management
3. implement the catalog/list/detail experience
4. wire to backend model catalog APIs
5. support empty and partial-data states gracefully

Requirements:
- do not require the full ingestion engine to exist first
- use structured model objects
- make the catalog useful even if some metadata is placeholder-driven at first

Implement the changes.

---

## Prompt 16 — implement Routes frontend

Build the first usable Routes frontend.

It should include:
- routes list
- create route flow
- route detail page
- simple fallback configuration
- billing mode selection
- route status
- link to logs if available

Tasks:
1. inspect any current route/config screens
2. build Routes as a distinct section
3. wire to backend CRUD
4. preserve current runtime behaviour where bridging is needed

Requirements:
- routes should feel like first-class objects
- explain in plain English what a route is
- do not hide fallback behaviour in obscure config forms

Implement the changes.

---

## Prompt 17 — implement Policies and Lifecycle frontend placeholders or v1 surfaces

Build the first frontend surfaces for:
- Policies
- Lifecycle & Migrations

If the backend is only partial, create honest v1 pages that are ready to connect.

Tasks:
1. inspect current support for policies/lifecycle if any
2. implement list/detail shells or functional v1 where supported
3. show impacted objects / warnings where available
4. connect to backend where possible

Requirements:
- do not fabricate lifecycle accuracy if the ingestion system is not built yet
- clearly label placeholder or preview states
- align copy to canonical nouns

Implement the changes.

---

# 5. Request execution, logging, and analytics prompts

## Prompt 18 — wire request execution to Routes and logging

Inspect the current request execution path and refactor it so requests flow through:
- Gateway Key auth
- project/environment context
- route resolution
- provider/model selection
- logging / audit hooks

Tasks:
1. inspect current execution path end-to-end
2. identify where provider/model selection happens now
3. wrap or refactor selection behind a route-resolution layer
4. add request logging with route/provider/model outcome fields
5. record explanation metadata where feasible
6. preserve current successful request behaviour

Requirements:
- keep the implementation incremental
- do not break existing integrations unnecessarily
- add tests for the new execution flow

Implement the changes.

---

## Prompt 19 — implement Request Logs and Usage Aggregates foundations

Inspect the current logging and analytics implementation and add the first structured versions of:
- Request Logs
- Usage Aggregates

Request Logs should capture at least:
- timestamp
- project/environment
- route
- gateway key if available
- provider
- model
- status
- latency
- token usage if available
- estimated cost placeholder if needed

Usage Aggregates should support grouped summaries by:
- project
- route
- provider
- model
- key

Tasks:
1. inspect current telemetry/logging/storage
2. implement the schema and write path
3. add read APIs for frontend consumption
4. keep it simple but extensible

Implement the changes.

---

## Prompt 20 — implement Analytics v1

Build the first usable analytics backend + frontend integration using the structured Request Logs / Usage Aggregates.

v1 should include:
- request count
- latency
- error rate
- provider mix
- model mix
- route mix
- spend placeholder or estimate if possible

Tasks:
1. inspect current analytics/dashboard code
2. wire the new aggregate model into analytics views
3. implement at least an overview surface and one drill-down path
4. add loading, empty, and error states

Requirements:
- make it useful, not decorative
- cross-link to routes and logs where possible

Implement the changes.

---

# 6. Lifecycle and catalog ingestion prompts

## Prompt 21 — implement lifecycle fields and warning plumbing

Inspect the current model/provider handling and implement lifecycle-aware plumbing.

Tasks:
1. add lifecycle fields to model structures
2. add backend support for lifecycle state and dates
3. expose lifecycle badges to frontend surfaces
4. add warnings where deprecated/retiring models are in use
5. create migration placeholders or recommendations hooks

Requirements:
- keep lifecycle data honest
- show source timestamps or “not yet verified” if necessary
- do not hardcode fake confidence

Implement the changes.

---

## Prompt 22 — build the first model metadata ingestion pipeline

Inspect the repo and implement the first practical version of a model metadata ingestion/update pipeline.

The goal is to populate structured model catalog data for supported providers.

Tasks:
1. inspect any existing provider metadata scripts or config
2. design the simplest pipeline compatible with the current stack
3. ingest or seed:
   - model ids
   - provider variants
   - lifecycle fields
   - pricing placeholders or real values where practical
   - capability flags
4. write the data into the structured catalog
5. add a way to refresh or reseed the catalog

Requirements:
- prefer a maintainable seed/update path over fragile one-off hacks
- document what is static seed data vs dynamically refreshed
- add tests or validation checks where practical

Implement the changes.

---

# 7. Onboarding and docs implementation prompts

## Prompt 23 — implement onboarding refactor

Inspect the current onboarding or setup flow and refactor it to teach the system in this order:
1. workspace
2. project
3. key model explanation
4. billing mode
5. Gateway Key creation
6. provider connection
7. route creation
8. first request
9. analytics / next actions

Tasks:
1. inspect existing onboarding/setup screens
2. reuse what is salvageable
3. insert the missing explanatory steps
4. fix key ambiguity
5. align copy with canonical nouns
6. connect steps to real backend data creation where possible

Requirements:
- do not over-design
- prioritize conceptual clarity
- keep the path shippable

Implement the changes.

---

## Prompt 24 — update docs in repo to match implemented behaviour

Inspect the repo docs and update them to match the implemented Restormel Keys behaviour.

Focus on:
- Gateway Key vs Provider Credential
- workspace/project/environment
- Provider Integrations
- Models catalog
- Routes
- Policies if implemented
- analytics/logging if implemented
- onboarding / first request

Tasks:
1. inspect current docs structure
2. identify stale terminology
3. update docs to reflect actual implemented behaviour, not aspirational future-only behaviour
4. add migration notes where user-facing behaviour changed

Requirements:
- do not leave docs contradicting the product
- keep docs concise and concrete
- preserve consistency with UI copy

Implement the changes.

---

# 8. End-to-end and stabilization prompts

## Prompt 25 — add end-to-end tests for the new control-plane flow

Inspect the current test setup and add end-to-end or integration coverage for the new core flow:

- create workspace/project/environment
- create Gateway Key
- connect provider
- create route
- make request
- verify request log
- verify route/provider/model outcome is visible

Tasks:
1. inspect current test framework
2. add the highest-value realistic coverage possible
3. prefer one reliable full-path test over many shallow ones if time is limited

Implement the tests.

---

## Prompt 26 — perform a repo-wide terminology and consistency cleanup

Inspect the entire repo for terminology drift and clean it up.

Focus on:
- API key vs Gateway Key
- provider key vs provider credential
- project-only assumptions where workspace/environment now exist
- model dropdown language vs model catalog language
- config language where route language is more precise

Tasks:
1. search the repo thoroughly
2. identify inconsistent terms
3. update code comments, UI copy, docs, and types where appropriate
4. preserve backwards compatibility for external APIs where necessary, but annotate legacy terms clearly

Implement the cleanup.

---

## Prompt 27 — produce a practical remaining backlog after implementation pass

After completing the current implementation task, inspect what remains and produce a practical next backlog grounded in the actual repo state.

I want:
- completed capabilities
- partial capabilities
- missing capabilities
- technical debt introduced
- highest-value next implementation tasks
- sequencing recommendations

This should reflect the real repo after your changes, not the ideal product spec.

---

# 9. Suggested Cursor execution sequence

A sensible order for these implementation prompts is:

1. Prompt 1 — repo audit  
2. Prompt 2 — minimum viable refactor path  
3. Prompt 3 — key taxonomy refactor  
4. Prompt 4 — canonical domain models  
5. Prompt 5 — workspace/project/environment  
6. Prompt 6 — schema changes  
7. Prompt 7 — auth and secret handling  
8. Prompt 8 — Provider Integrations backend  
9. Prompt 9 — model catalog backend  
10. Prompt 10 — routes backend  
11. Prompt 12 — dashboard nav refactor  
12. Prompt 13 — Access frontend  
13. Prompt 14 — Provider Integrations frontend  
14. Prompt 15 — Models frontend  
15. Prompt 16 — Routes frontend  
16. Prompt 18 — execution path wiring  
17. Prompt 19 — logs and aggregates  
18. Prompt 20 — analytics v1  
19. Prompt 21 — lifecycle plumbing  
20. Prompt 22 — model metadata ingestion  
21. Prompt 23 — onboarding refactor  
22. Prompt 24 — docs update  
23. Prompt 25 — end-to-end tests  
24. Prompt 26 — terminology cleanup  
25. Prompt 27 — remaining backlog

---

# 10. Single-shot Cursor implementation kickoff prompt

Use this if you want Cursor to start with one strong implementation task rather than the whole pack.

You are working in the Restormel Keys repo.

Treat the attached reference documents as product constraints, but focus on implementation, not design discussion.

First inspect the repo and identify:
- current architecture
- current auth/key model
- current provider integration model
- current model-selection implementation
- current request execution path
- current dashboard/navigation structure

Then map the repo to the target Restormel Keys control-plane model:
- Workspace
- Project
- Environment
- Gateway Key
- Management Key
- Provider Integration
- Model Catalog
- Route
- Policy
- Request Log
- Usage Aggregate
- Lifecycle State

Then choose the **smallest high-value implementation step** that moves the repo materially toward that model.

For that step:
1. explain the exact files you will change
2. explain why this is the right first step
3. implement the change
4. add tests
5. update docs/copy where needed
6. summarize follow-up work

Critical rules:
- do not assume the repo already matches the target architecture
- do not blur Gateway Keys and Provider Credentials
- do not keep models as a flat dropdown if you are touching model management
- keep changes incremental and reviewable
- prefer real implementation over generic planning
