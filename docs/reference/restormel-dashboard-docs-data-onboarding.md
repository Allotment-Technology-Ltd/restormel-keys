# Restormel Keys — dashboard IA, docs IA, data model, and onboarding flow

## 1. Dashboard IA

### Design principle

The dashboard should not be organised around technical implementation details or the current incomplete setup flow. It should be organised around the user’s real control tasks:

- access the platform
- connect providers
- choose and govern models
- define routing behaviour
- monitor usage, cost, and failures
- manage lifecycle risk
- expose approved capabilities to downstream users

That implies a control-plane information architecture, not a settings-page architecture.

---

### Top-level navigation

#### 1. Overview
Purpose: a cross-project summary of health, spend, risk, and activity.

Key content:
- spend today / month to date
- requests today / month to date
- active projects
- top models and providers
- recent errors / rate-limit incidents
- lifecycle warnings
- budget alerts
- recent credential or policy changes

Primary actions:
- create project
- connect provider
- create gateway key
- review alert
- inspect logs

---

#### 2. Projects
Purpose: manage product/application boundaries.

Key content:
- project list
- environments per project: dev, staging, prod
- project owner / team
- usage summary by project
- active routes
- enabled providers
- exposed models
- recent deploy or config changes

Project detail tabs:
- Overview
- Environments
- Access
- Routes
- Policies
- Models
- Usage
- Logs
- Settings

---

#### 3. Access
Purpose: manage authentication into Restormel itself.

Subsections:
- Gateway Keys
- Management Keys / PATs
- Service Accounts
- OIDC / Workload Identity
- Audit Log

Gateway Key fields:
- name
- scope
- workspace / project / environment binding
- last used
- created by
- created at
- status
- rotation controls

This section must answer, very clearly: “What key is used to call Restormel?”

---

#### 4. Provider Integrations
Purpose: manage upstream credentials and provider connectivity.

Provider cards:
- OpenAI
- Anthropic
- Google / Vertex
- Azure OpenAI
- AWS Bedrock
- other future providers

Each provider detail page should include:
- connection status
- credential owner
- credential scope
- last verified
- projects/environments bound to it
- available models
- quota / rate-limit notes
- rotation / disable / test controls
- audit history

Important distinction:
This is where provider credentials live. Not in Access.

---

#### 5. Models
Purpose: provide a governed, searchable model catalog.

Views:
- All models
- By provider
- Recommended
- Lifecycle warnings
- Internal approved list
- Hidden / disallowed

Filters:
- provider
- modality
- use case
- price band
- latency band
- lifecycle state
- tool support
- structured output support
- context length

Each model detail page:
- summary
- provider availability
- pricing
- rate limits
- lifecycle state
- strengths
- weaknesses
- recommended use cases
- avoid when
- migration target
- code examples
- route usage
- downstream exposure status

---

#### 6. Routes
Purpose: define runtime behaviour between app requests and model/provider selection.

What a route is:
A named policy-driven path that decides which provider/model combination should be used under defined conditions.

Route list fields:
- route name
- project/environment
- default model
- fallback chain
- billing mode
- policy status
- usage
- average cost
- health

Route detail tabs:
- Definition
- Provider order
- Fallbacks
- Constraints
- Exposure
- Analytics
- Logs

Common route templates:
- cheapest
- fastest
- best reasoning
- best coding
- multimodal
- BYOK only
- fail closed
- fail open
- downstream safe list

---

#### 7. Policies
Purpose: govern who can use what, how, and under which constraints.

Policy types:
- model allow / deny
- provider allow / deny
- spending budgets
- token caps
- rate-limit protections
- environment restrictions
- downstream exposure rules
- data residency / privacy constraints
- approval requirements for deprecated models

This section is where governance becomes visible.

---

#### 8. Analytics
Purpose: give a clean operational and financial view of how the system is performing.

Core views:
- requests
- spend
- tokens
- latency
- errors
- rate-limit events
- fallback rate
- provider mix
- model mix
- BYOK vs platform-billed split
- per project / route / key / customer usage

Comparison views:
- model comparison
- route comparison
- provider comparison
- budget vs actual
- month-over-month change

---

#### 9. Logs & Traces
Purpose: request-level debugging and operational confidence.

Capabilities:
- inspect request
- see route decision
- see provider used
- see model used
- see fallback events
- see latency breakdown
- see token usage
- see cost estimate
- see error details
- search and filter logs

This area is critical for API-heavy teams and support workflows.

---

#### 10. Lifecycle & Migrations
Purpose: make model risk visible and actionable.

Views:
- deprecated models in use
- models nearing retirement
- migration recommendations
- impacted projects
- impacted routes
- upcoming provider changes
- acknowledgement status

Actions:
- bulk swap route target
- notify owners
- compare replacement model
- create migration checklist

---

#### 11. Billing & Forecasting
Purpose: budgeting, unit economics, and planning.

Views:
- actual spend
- forecasted spend
- cost by project
- cost by route
- cost by model
- cost by provider
- cost by downstream customer
- budget alerts
- scenario calculator

Calculator modes:
- monthly estimate
- compare models
- compare routes
- cached vs uncached
- fallback overhead
- downstream tenant estimate

---

#### 12. Documentation
Purpose: keep the docs discoverable inside the product.

Subsections:
- quickstarts
- concepts
- API reference
- CLI reference
- SDK reference
- model catalog docs
- provider setup guides
- routing guides
- pricing and lifecycle notes
- MCP / agent docs
- troubleshooting

This should be linked to the external docs site and pull from the same source of truth.

---

### Recommended nav order

For most users, the cleanest left-nav order is:

1. Overview  
2. Projects  
3. Access  
4. Provider Integrations  
5. Models  
6. Routes  
7. Policies  
8. Analytics  
9. Logs & Traces  
10. Lifecycle & Migrations  
11. Billing & Forecasting  
12. Documentation

---

### Secondary UX patterns to include everywhere

- global search across projects, routes, keys, providers, models, and docs
- environment switcher
- command palette
- “view as CLI” and “view as API” actions on key objects
- inline help definitions for every core noun
- visible last-updated / last-verified timestamps for pricing and lifecycle data
- compare action for models, providers, and routes
- copy-ready code snippets
- audit trail on every sensitive action

---

## 2. Docs IA

### Docs design principle

The docs should be one knowledge system with multiple surfaces:
- readable by humans
- usable by developers
- parsable by agents
- compatible with MCP workflows

This means the docs IA should reflect how users think and work, not how the repo happens to be organised.

---

### Top-level docs structure

#### 1. Get started
Purpose: reduce time to first successful request.

Pages:
- What is Restormel Keys?
- Gateway Key vs Provider Credential
- Your first request
- Quickstart: CLI
- Quickstart: TypeScript
- Quickstart: Python
- Quickstart: REST API
- Quickstart: MCP / agent client
- Choose your billing mode
- Connect your first provider

---

#### 2. Core concepts
Purpose: define the product vocabulary.

Pages:
- Workspaces
- Projects
- Environments
- Gateway Keys
- Management Keys
- Provider Integrations
- Models
- Routes
- Policies
- Usage and logs
- Lifecycle states
- Billing modes
- Downstream exposure / customer curation

This is the most important docs section for fixing current ambiguity.

---

#### 3. Provider setup
Purpose: teach users how to connect and manage upstream providers.

Pages:
- OpenAI setup
- Anthropic setup
- Google / Vertex setup
- Azure OpenAI setup
- Bedrock setup
- Credential testing
- Rotation and revocation
- Provider scopes and bindings
- Troubleshooting provider auth

---

#### 4. Model catalog
Purpose: explain model discovery and model governance.

Pages:
- Browse the catalog
- Compare models
- Lifecycle states
- Recommended use cases
- Deprecated models
- Migration guidance
- Pricing and limits
- Provider differences for the same model
- Internal allow-lists and exposure rules

---

#### 5. Routing and policies
Purpose: explain runtime control.

Pages:
- What is a route?
- How routing works
- Provider ordering
- Fallbacks
- Fail open vs fail closed
- BYOK priority
- Route templates
- Policies and guardrails
- Exposure to downstream users
- Budget and usage constraints

---

#### 6. Analytics and cost
Purpose: help users understand what happened and what it cost.

Pages:
- Usage analytics overview
- Cost tracking
- Rate-limit events
- Logs and traces
- Budget alerts
- Forecasting and cost calculators
- Compare routes and models
- BYOK reporting
- Understanding token and cost fields

---

#### 7. Security and governance
Purpose: make the trust model explicit.

Pages:
- Secret storage
- Gateway auth model
- Provider credential model
- Key rotation
- Service accounts
- OIDC / workload identity
- Audit logs
- Access control
- Sensitive actions
- Best practices for production

---

#### 8. Interfaces
Purpose: keep UI, CLI, API, SDK, and MCP aligned.

Subsections:
- CLI reference
- REST API reference
- SDK reference: TypeScript
- SDK reference: Python
- Webhooks / events
- MCP interface
- OpenAPI
- JSON schemas
- Error taxonomy

---

#### 9. Guides
Purpose: help users complete real jobs.

Guides:
- Set up a project for development and production
- Connect multiple providers
- Create a route with fallbacks
- Expose a safe set of models to your users
- Migrate away from a deprecated model
- Estimate monthly spend
- Rotate keys with no downtime
- Debug a failing route
- Add agent / MCP access
- Lock down model access for a regulated environment

---

#### 10. Troubleshooting
Purpose: support self-serve diagnosis.

Pages:
- Authentication errors
- Provider credential failures
- Model unavailable
- Route fallback triggered
- Rate limited
- Deprecated model in use
- Billing discrepancy
- Unexpected latency
- MCP connection issues
- CLI login issues

---

#### 11. Changelog and lifecycle
Purpose: publish moving system facts.

Pages:
- product changelog
- provider/model changes
- lifecycle notices
- pricing updates
- migration notices
- breaking changes

---

### Machine-readable docs surfaces

These should be published alongside the main docs:

- OpenAPI spec
- JSON Schemas for core objects
- model catalog endpoint
- provider catalog endpoint
- route schema
- error schema
- `llms.txt`
- `llms-full.txt`
- docs MCP server or equivalent docs index for agents

---

### Writing rules for the docs

- every core noun has one canonical definition
- every guide assumes the noun definitions already exist
- every UI page links to its canonical concept doc
- every CLI command maps to API objects and docs concepts
- every API object name matches UI wording
- every model page uses a common template
- every lifecycle page includes date, impact, and migration path
- every page says who it is for where relevant: human operator, developer, platform admin, agent user

---

## 3. Data model

### Design principle

The data model should match the control-plane abstraction, not leak internal implementation details into the user mental model.

---

### Core entities

#### Workspace
Represents an organisation or top-level account boundary.

Fields:
- id
- name
- slug
- plan
- billing_mode_defaults
- created_at
- owner_user_id
- settings
- status

Relationships:
- has many projects
- has many members
- has many provider integrations
- has many gateway keys
- has many policies
- has many usage records

---

#### Project
Represents an application or product boundary.

Fields:
- id
- workspace_id
- name
- slug
- description
- default_billing_mode
- owner_team_id
- status
- created_at

Relationships:
- belongs to workspace
- has many environments
- has many routes
- has many project policies
- has many logs / usage aggregates

---

#### Environment
Represents deployment or operational separation.

Fields:
- id
- project_id
- name
- type
- status
- settings
- created_at

Examples:
- dev
- staging
- prod

Relationships:
- belongs to project
- has many gateway key bindings
- has many provider bindings
- has many routes

---

#### GatewayKey
Credential used to authenticate requests into Restormel.

Fields:
- id
- workspace_id
- project_id nullable
- environment_id nullable
- name
- hashed_secret
- prefix
- scope
- status
- created_by
- created_at
- last_used_at
- expires_at nullable
- rotation_version

Relationships:
- belongs to workspace
- optionally bound to project/environment
- has many usage records
- has many audit events

---

#### ManagementKey
Credential for management API or automation.

Fields:
- id
- workspace_id
- name
- hashed_secret
- prefix
- role
- scopes
- status
- created_by
- created_at
- last_used_at
- expires_at nullable

Relationships:
- belongs to workspace
- has many audit events

---

#### ProviderIntegration
Represents a connected upstream provider account.

Fields:
- id
- workspace_id
- provider_type
- display_name
- status
- verification_status
- credential_ref
- created_by
- created_at
- last_verified_at
- metadata
- region nullable

Relationships:
- belongs to workspace
- has many provider bindings
- has many available models
- has many audit events

---

#### ProviderBinding
Controls where a provider integration may be used.

Fields:
- id
- provider_integration_id
- project_id
- environment_id nullable
- status
- usage_mode
- created_at

Relationships:
- belongs to provider integration
- belongs to project/environment

This lets credentials be centrally stored but selectively exposed.

---

#### Model
Canonical model record.

Fields:
- id
- canonical_name
- family
- lifecycle_state
- description
- modalities
- capabilities
- context_window
- max_output_tokens nullable
- supports_tools
- supports_structured_output
- supports_mcp
- editorial_summary
- strengths
- weaknesses
- recommended_for
- avoid_for
- deprecation_date nullable
- retirement_date nullable
- replacement_model_id nullable
- source_last_verified_at

Relationships:
- has many provider model variants
- has many route usages
- has many lifecycle events

---

#### ProviderModelVariant
Provider-specific view of a model.

Fields:
- id
- model_id
- provider_integration_type
- provider_model_id
- availability_status
- pricing_ref
- rate_limit_ref
- metadata
- source_last_verified_at

Relationships:
- belongs to model

This is important because “the same” model may differ across providers.

---

#### PricingRecord
Normalized price data.

Fields:
- id
- provider_model_variant_id
- currency
- input_per_million
- output_per_million
- cached_input_per_million nullable
- image_pricing nullable
- tool_pricing nullable
- effective_from
- source_url
- source_last_verified_at

Relationships:
- belongs to provider model variant

---

#### RateLimitRecord
Normalized rate and quota guidance.

Fields:
- id
- provider_model_variant_id
- limit_type
- value
- unit
- notes
- source_url
- source_last_verified_at

Relationships:
- belongs to provider model variant

---

#### LifecycleEvent
Tracks lifecycle changes.

Fields:
- id
- model_id
- event_type
- effective_date
- source_url
- summary
- replacement_model_id nullable
- created_at

Event types:
- active
- legacy
- deprecated
- retired
- migration_notice

---

#### Route
Defines runtime model/provider selection behaviour.

Fields:
- id
- project_id
- environment_id
- name
- description
- default_model_id nullable
- billing_mode
- route_mode
- status
- created_by
- created_at
- updated_at

Relationships:
- belongs to project/environment
- has many route steps
- has many route policies
- has many requests
- has many logs

---

#### RouteStep
Defines ordered routing logic.

Fields:
- id
- route_id
- order_index
- provider_preference nullable
- model_id nullable
- condition_block
- fallback_on
- timeout_ms nullable
- enabled

Relationships:
- belongs to route

---

#### Policy
Reusable governance rule.

Fields:
- id
- workspace_id
- name
- type
- status
- rule_definition
- created_by
- created_at

Policy types:
- model_allowlist
- provider_allowlist
- budget_cap
- token_cap
- environment_restriction
- deprecated_model_block
- privacy_constraint
- downstream_exposure

---

#### PolicyBinding
Attaches policy to objects.

Fields:
- id
- policy_id
- target_type
- target_id
- created_at

Targets:
- workspace
- project
- environment
- route
- customer_tenant

---

#### CustomerTenant
Optional but highly recommended if users expose models to their own customers.

Fields:
- id
- workspace_id
- project_id
- name
- slug
- status
- billing_reference nullable
- created_at

Relationships:
- can have policies
- can have exposure rules
- can have usage aggregates

---

#### ExposureRule
Controls what downstream customers can see or use.

Fields:
- id
- target_tenant_id
- route_id nullable
- model_id nullable
- provider_type nullable
- status
- created_at

---

#### RequestLog
Request-level runtime record.

Fields:
- id
- workspace_id
- project_id
- environment_id
- route_id nullable
- gateway_key_id nullable
- customer_tenant_id nullable
- provider_type
- provider_model_variant_id
- final_model_id
- request_status
- latency_ms
- ttft_ms nullable
- input_tokens nullable
- output_tokens nullable
- cached_tokens nullable
- estimated_cost nullable
- fallback_count
- error_code nullable
- created_at
- metadata

Relationships:
- belongs to many top-level dimensions for analytics

---

#### UsageAggregate
Precomputed analytics record.

Fields:
- id
- granularity
- period_start
- period_end
- workspace_id nullable
- project_id nullable
- environment_id nullable
- route_id nullable
- gateway_key_id nullable
- customer_tenant_id nullable
- provider_type nullable
- model_id nullable
- request_count
- input_tokens
- output_tokens
- cached_tokens
- estimated_cost
- avg_latency_ms
- error_rate
- fallback_rate

---

#### AuditEvent
Security and config change trail.

Fields:
- id
- workspace_id
- actor_id
- actor_type
- event_type
- target_type
- target_id
- summary
- created_at
- metadata

Examples:
- gateway key created
- provider credential rotated
- route updated
- policy changed
- deprecated model acknowledged

---

### Key model relationships summary

Workspace  
→ Projects  
→ Environments  
→ Routes  
→ RequestLogs / UsageAggregates

Workspace  
→ GatewayKeys / ManagementKeys  
→ ProviderIntegrations  
→ Policies  
→ AuditEvents

Model  
→ ProviderModelVariants  
→ PricingRecords / RateLimitRecords / LifecycleEvents

CustomerTenant  
→ ExposureRules  
→ UsageAggregates

---

### Recommended naming rules

Use these exact nouns consistently across UI, docs, API, and CLI:
- workspace
- project
- environment
- gateway key
- management key
- provider integration
- model
- route
- policy
- lifecycle state
- request log
- usage aggregate
- customer tenant
- exposure rule

Avoid generic labels like:
- API key
- secret
- config
- endpoint settings
- model settings

unless they are contextual sublabels under a canonical noun.

---

## 4. Onboarding flow

### Design principle

The onboarding flow should remove ambiguity immediately and get the user to a successful first request while teaching the product model in the right order.

The current likely problem is that the product teaches “create a project and API key” before the user understands:
- what the key authenticates
- whether they need provider credentials
- how models become available
- where routing happens
- how billing works

The new onboarding should fix that.

---

### Primary onboarding path

#### Step 1: Create workspace
Goal:
establish account boundary

Fields:
- workspace name
- intended use
- team size
- likely usage mode

Optional segmentation prompt:
- building my own app
- managing AI for a team
- exposing models to my own customers
- experimenting / prototyping

This helps tailor setup language.

---

#### Step 2: Create project
Goal:
create the app/product boundary

Fields:
- project name
- environment defaults
- preferred stack
- intended deployment pattern

Default environments:
- dev
- prod

Optional:
- staging

---

#### Step 3: Explain the key model before creating anything sensitive
This screen should be plain English.

Message:
- A **Gateway Key** authenticates your app, CLI, SDK, or agent to Restormel.
- A **Provider Credential** connects your OpenAI, Anthropic, Google, or other provider account to Restormel.
- You may use one or both depending on your billing and routing setup.

This step is essential.

---

#### Step 4: Choose billing mode
Options:
- Bring your own provider keys
- Restormel-managed billing
- Hybrid / decide later

Each option needs a short explanation.

BYOK explanation:
You connect your provider accounts. Requests route through Restormel, but provider usage is billed upstream.

Platform-billed explanation:
Restormel manages upstream provider billing and charges you through Restormel.

Hybrid explanation:
Use BYOK for some routes and platform billing for others.

---

#### Step 5: Create Gateway Key
Goal:
enable first successful request

Fields:
- key name
- scope
- project/environment binding
- expiry optional

After creation:
- show secret once
- explain how to use it in CLI, curl, SDK, and MCP client
- provide copy actions

---

#### Step 6: Connect provider
Goal:
make models available

Flow:
- choose provider
- enter credential
- test connection
- confirm available models
- select allowed projects/environments
- optionally set default policies

This should end with a success message like:
“Anthropic connected. 8 models available to Project X / dev and prod.”

---

#### Step 7: Choose starter route
Goal:
abstract away complexity without hiding it

Starter route templates:
- cheapest
- fastest
- best reasoning
- coding assistant
- multimodal
- BYOK only
- safe starter

The user can accept one template or skip.

---

#### Step 8: Make first request
The product should now show tabs with:
- CLI
- curl
- TypeScript
- Python
- MCP / agent example

Each example should already include:
- gateway key placeholder
- route name
- example model selection behaviour

---

#### Step 9: Show first result with explanation
After the first request, show:
- route used
- provider used
- model used
- latency
- tokens
- estimated cost
- whether fallback occurred

This is where the product starts to feel like a control plane rather than a proxy.

---

#### Step 10: Guide next actions
Recommended next actions:
- connect another provider
- compare models
- create a production key
- add a budget policy
- expose approved models to downstream users
- invite team members
- enable logs
- read the docs

---

### Alternative onboarding modes

#### Mode A: vibe coder / solo builder
Bias toward:
- speed
- templates
- copy/paste snippets
- one-click provider connection
- simple cost estimate
- minimal governance upfront

#### Mode B: platform engineer / serious API team
Bias toward:
- env separation
- scopes
- auditability
- routing control
- logs
- policy setup
- CLI/API parity

#### Mode C: SaaS vendor exposing AI to customers
Bias toward:
- tenant separation
- model curation
- exposure rules
- budgets
- downstream analytics
- lifecycle warnings

---

### Onboarding checklist object

It may help to represent onboarding as a tracked checklist:

- workspace created
- project created
- gateway key created
- provider connected
- models available
- starter route configured
- first request completed
- analytics viewed
- policy added
- docs opened

This can power dashboard nudges later.

---

### In-product copy that should exist

Critical copy examples:

**What is a Gateway Key?**  
A Gateway Key authenticates your app, CLI, SDK, or agent to Restormel.

**What is a Provider Credential?**  
A Provider Credential connects your OpenAI, Anthropic, Google, or other provider account so Restormel can route requests on your behalf.

**What is a Route?**  
A Route is a named policy that decides which model or provider should handle a request and what should happen if that choice is unavailable or restricted.

**What is lifecycle state?**  
Lifecycle state shows whether a model is active, legacy, deprecated, or retired, so you can avoid disruptions and migrate safely.

---

## Immediate next design outputs to produce after this

1. dashboard wireframe outline
2. docs sitemap
3. ERD / schema diagram
4. onboarding screen-by-screen copy deck
5. route object schema
6. model catalog template
7. access and provider credential UI specs
