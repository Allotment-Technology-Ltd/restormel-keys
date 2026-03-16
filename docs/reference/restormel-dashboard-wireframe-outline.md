# Restormel Keys — dashboard wireframe outline

## Purpose

This document translates the recommended dashboard IA into a practical wireframe outline. It is not visual design. It is a page-by-page structural blueprint showing what each screen should contain, the hierarchy of information, the primary user actions, and the core states the UI needs to support.

The dashboard should feel like a **control plane** for AI access, not a collection of disconnected admin forms.

---

# 1. Global shell

## 1.1 App frame

### Top bar
- Restormel wordmark
- workspace switcher
- global search
- environment shortcut / recent projects
- notifications
- help / docs
- user menu

### Left navigation
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

### Right utility rail or slide-over system
Used for:
- inline docs
- audit details
- compare drawer
- route explanation
- model details preview
- command palette results

---

## 1.2 Global components

### Global search
Should search across:
- projects
- routes
- keys
- providers
- models
- policies
- docs
- logs

### Command palette
Should support actions like:
- create project
- create gateway key
- connect provider
- create route
- compare models
- jump to logs
- open docs
- show CLI equivalent
- show API equivalent

### Compare drawer
Reusable side-by-side comparison for:
- models
- providers
- routes

### Audit drawer
Reusable action history panel for sensitive objects.

### Context action strip
Persistent per-object quick actions, such as:
- copy CLI command
- view API payload
- rotate key
- test provider
- compare model
- migrate route

---

# 2. Overview page

## 2.1 Purpose
Give a high-signal cross-workspace summary of system health, usage, cost, and risk.

## 2.2 Layout

### Row 1 — summary cards
- requests today
- spend month to date
- active projects
- active providers
- active models in use
- alerts requiring attention

### Row 2 — charts
- spend over time
- requests over time
- latency over time
- errors / rate-limit incidents over time

### Row 3 — operational highlights
Left column:
- top projects by spend
- top models by usage
- top providers by usage

Right column:
- recent lifecycle warnings
- budget alerts
- failed provider verifications
- recent policy changes

### Row 4 — next actions
Cards:
- connect another provider
- create production route
- review deprecated models
- add budget policy
- invite team member

## 2.3 Primary actions
- create project
- create gateway key
- connect provider
- inspect logs
- acknowledge warning

## 2.4 States
- empty state for new workspace
- healthy state
- warning-heavy state
- degraded incident state

---

# 3. Projects list page

## 3.1 Purpose
Let users manage application boundaries and jump into project-specific control surfaces.

## 3.2 Layout

### Header
- page title
- create project button
- filters
- search

### Main table / card list
Columns:
- project name
- environments
- providers enabled
- active routes
- spend this month
- last activity
- lifecycle risk indicator
- owner

### Bulk actions
- archive
- export config
- add policy
- assign owner

## 3.3 States
- no projects
- one project
- many projects

---

# 4. Project detail page

## 4.1 Header
- project name
- description
- owner/team
- tags
- spend summary
- environment switcher
- quick actions

Quick actions:
- create environment
- create route
- create project-scoped key
- bind provider
- view logs

## 4.2 Tabs
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

## 4.3 Project overview tab

### Top row
- spend
- requests
- routes count
- providers connected
- lifecycle warnings

### Middle row
- recent activity timeline
- top routes
- top models

### Bottom row
- recommended next actions
- latest errors
- docs links relevant to this project

---

## 4.4 Project environments tab

### Environment cards/table
Each environment shows:
- name
- type
- enabled providers
- routes
- keys bound
- spend
- status
- last config change

### Actions
- create environment
- duplicate environment config
- compare environments

---

## 4.5 Project access tab

### Sections
- gateway keys bound to project
- management keys with project scope
- service accounts
- audit history

### Key table
- name
- scope
- environment
- created by
- last used
- status
- actions menu

Actions:
- reveal prefix only
- rotate
- disable
- copy sample usage
- view audit trail

---

## 4.6 Project routes tab

### Route list
- route name
- default target
- fallback chain summary
- billing mode
- health
- spend
- requests
- last changed

### Actions
- create route
- duplicate route
- compare routes
- export route config

---

## 4.7 Project policies tab

### Policy bindings list
- policy name
- type
- target
- status
- last modified

### Actions
- attach policy
- create policy
- view effective policy

---

## 4.8 Project models tab

### Views
- models enabled for project
- disallowed models
- lifecycle warnings
- recommended models

### Actions
- enable model
- disable model
- compare model
- set approved list

---

## 4.9 Project usage tab

### Charts and tables
- requests over time
- spend over time
- top routes
- top models
- top providers
- top downstream tenants if enabled

---

## 4.10 Project logs tab

Embedded filtered logs view scoped to project.

---

## 4.11 Project settings tab

Settings:
- rename
- ownership
- default billing mode
- default route
- project status
- delete/archive controls

---

# 5. Access section

# 5.1 Gateway Keys list page

## Header
- create gateway key
- filters
- search

## Table
- name
- workspace/project/environment scope
- created by
- created at
- last used
- expiry
- status

## Actions
- rotate
- disable
- delete
- copy CLI snippet
- copy API snippet
- view audit history

## Empty state copy
“You use Gateway Keys to authenticate your app, CLI, SDK, or agent to Restormel.”

---

## 5.2 Create Gateway Key modal/page

### Step 1
- key name
- scope
- binding target
- expiry
- description optional

### Step 2 confirmation
Show:
- secret once
- CLI example
- curl example
- SDK example
- MCP example

### Step 3 next actions
- test key now
- create route
- connect provider

---

## 5.3 Management Keys page
Similar structure to Gateway Keys, but clearly labeled for administrative automation only.

---

## 5.4 Service Accounts page
Enterprise/advanced view for automation actors.

---

## 5.5 Audit Log page
Filterable audit trail for:
- key creation
- rotation
- disable
- provider changes
- route changes
- policy changes

---

# 6. Provider Integrations section

## 6.1 Provider list page

### Header
- connect provider
- provider filters

### Provider cards
Each card shows:
- provider name
- status
- number of credentials or connections
- models available
- last verified
- projects using it
- warning state

### Quick actions
- connect
- verify
- rotate
- view models
- view bindings

---

## 6.2 Connect provider flow

### Step 1
Choose provider

### Step 2
Enter credential details

### Step 3
Test and verify connection

### Step 4
Select project/environment bindings

### Step 5
Confirm available models and defaults

### Success screen
- provider connected
- X models discovered
- bindings summary
- next actions

---

## 6.3 Provider detail page

### Header
- provider name
- verification status
- last verified
- rotate credential
- disable provider

### Tabs
- Overview
- Credentials
- Models
- Bindings
- Limits
- Audit

### Overview tab
- connected credentials summary
- projects/environments using provider
- active models
- recent failures
- provider-specific notes

### Credentials tab
- credential objects
- health status
- last tested
- rotation actions

### Models tab
- models available through this provider
- lifecycle warnings
- price notes

### Bindings tab
- where provider is enabled

### Limits tab
- rate/quota notes
- source last verified

---

# 7. Models section

## 7.1 Model catalog page

### Header
- search
- filters
- compare action

### Filter bar
- provider
- use case
- lifecycle
- modality
- pricing
- tool support
- structured output
- context length

### Main list/card grid
Each model entry:
- canonical name
- provider options
- lifecycle badge
- price summary
- context summary
- short editorial tag
- compare checkbox
- quick actions

Quick actions:
- open details
- compare
- add to approved list
- view routes using this model

---

## 7.2 Model detail page

### Header
- model name
- lifecycle badge
- compare
- approve/disallow
- migration target if relevant

### Sections
1. Summary
2. Providers and variants
3. Pricing
4. Rate limits
5. Capabilities
6. Strengths / weaknesses
7. Recommended uses
8. Avoid when
9. Lifecycle and migration
10. Projects / routes using this model
11. Code examples
12. Source timestamps

### Right rail
- quick facts
- docs links
- compare panel trigger

---

## 7.3 Compare models page/drawer
Rows:
- price
- input/output cost
- context
- tool support
- structured output
- MCP friendliness
- lifecycle state
- recommended use cases
- routes currently using each

---

# 8. Routes section

## 8.1 Routes list page

### Header
- create route
- filters
- route templates

### Table
- route name
- project/environment
- target summary
- fallback summary
- billing mode
- health
- requests
- spend
- last edited

### Quick actions
- edit
- duplicate
- compare
- disable
- export config

---

## 8.2 Create route flow

### Step 1
Name and scope
- route name
- project
- environment
- description

### Step 2
Choose template or start blank
Templates:
- cheapest
- fastest
- best reasoning
- coding
- multimodal
- BYOK only
- fail closed
- fail open

### Step 3
Default target
- choose model
- choose provider preference
- choose billing mode

### Step 4
Fallback and constraints
- fallback order
- timeout
- allow/disallow models
- privacy rules
- lifecycle restrictions

### Step 5
Review and create

---

## 8.3 Route detail page

### Header
- route name
- health badge
- requests
- spend
- edit
- duplicate
- test route

### Tabs
- Definition
- Provider order
- Fallbacks
- Constraints
- Exposure
- Analytics
- Logs

### Definition tab
- route summary
- primary target
- billing mode
- effective policies

### Provider order tab
- ranked provider list
- conditions
- reorder control

### Fallbacks tab
- fallback chain
- trigger conditions
- route behavior preview

### Constraints tab
- allow/deny models
- privacy / residency flags
- deprecated model rules
- budget guardrails

### Exposure tab
- downstream availability
- allowed tenants
- hidden models
- end-customer safe label

### Analytics tab
- route-specific usage
- spend
- latency
- fallback frequency
- failure rate

### Logs tab
- filtered request logs
- route decision explanation

---

# 9. Policies section

## 9.1 Policies list page

### Table
- name
- type
- target count
- status
- last modified

### Actions
- create policy
- duplicate
- disable
- attach to target

---

## 9.2 Policy detail page

### Header
- name
- type
- status
- edit
- attach target

### Sections
- policy summary
- rule definition
- effective targets
- impacted objects
- audit timeline

### Rule-preview component
Plain English explanation of machine rules.

---

# 10. Analytics section

## 10.1 Analytics overview page

### Summary cards
- requests
- spend
- avg latency
- error rate
- fallback rate
- budget variance

### Chart area
- time series charts

### Breakdown panels
- by project
- by model
- by provider
- by route
- by key
- by tenant

### Insights panel
- spend spike
- model drift
- provider concentration
- deprecation exposure
- likely savings opportunities

---

## 10.2 Comparison views
Separate tab or subnav:
- compare models
- compare routes
- compare providers
- compare time periods

---

## 10.3 Forecast page
- projected monthly spend
- projected by project
- scenario modeling
- calculator launch

---

# 11. Logs & Traces section

## 11.1 Logs page

### Filter bar
- date range
- project
- environment
- route
- provider
- model
- key
- tenant
- status

### Results table
- timestamp
- request id
- project
- route
- provider
- model
- status
- latency
- tokens
- estimated cost

### Row click opens detail drawer

---

## 11.2 Request detail drawer/page

Sections:
- request summary
- route chosen
- provider chosen
- fallback chain taken
- latency breakdown
- tokens and cost
- errors
- audit / replay references
- related docs links

This page should explain what happened, not just show raw data.

---

# 12. Lifecycle & Migrations section

## 12.1 Lifecycle dashboard

### Summary cards
- models deprecated in use
- projects impacted
- routes impacted
- retirement deadlines upcoming

### Main list
- model
- lifecycle state
- deadline
- replacement
- impacted routes
- owner
- status

### Actions
- compare replacement
- bulk migrate
- notify owner
- acknowledge risk

---

## 12.2 Migration detail page
- impacted objects
- recommended replacements
- route changes required
- timeline
- notes
- checklist

---

# 13. Billing & Forecasting section

## 13.1 Billing overview
- current cycle spend
- by project
- by model
- by provider
- by tenant
- by billing mode

## 13.2 Budget page
- budgets list
- thresholds
- alerts
- owners

## 13.3 Calculator page
Inputs:
- requests/day
- avg input tokens
- avg output tokens
- model or route
- cached prompt %
- fallback rate assumption

Outputs:
- daily/monthly cost
- best/worst case
- comparison view

---

# 14. Documentation section

## 14.1 In-product docs hub
- quickstarts
- concept docs
- provider setup
- model docs
- route guides
- troubleshooting

## 14.2 Contextual docs blocks
Every key page should have:
- “What is this?”
- “When should I use this?”
- “CLI equivalent”
- “API equivalent”
- link to full docs

---

# 15. Empty states and first-run states

## 15.1 Empty workspace
Show:
- intro panel
- key concepts
- create first project
- create gateway key
- connect provider

## 15.2 No provider connected
Show:
- explanation of provider integrations
- connect provider CTA
- docs links

## 15.3 No routes created
Show:
- explanation of routes
- starter templates
- create route CTA

## 15.4 No analytics yet
Show:
- prompt to make first request
- sample CLI and curl snippet

---

# 16. Cross-screen UX requirements

- every sensitive action must have audit visibility
- every object should expose CLI and API equivalents
- every object should show source-of-truth status timestamps where relevant
- every route and request view should explain decision logic
- every lifecycle warning should be tied to a concrete date and replacement path
- every model page should have a consistent structured template
- every key page should explain key type in plain English
- every provider page should clearly separate provider credential from gateway key
