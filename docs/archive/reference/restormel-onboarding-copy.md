# Restormel Keys — screen-by-screen onboarding copy

## Purpose

This document provides draft copy for the onboarding journey. It is written to remove ambiguity, teach the product model in the right order, and get users to a successful first request quickly.

The copy assumes the product is being positioned as an **AI gateway and control plane** with optional BYOK provider integrations.

---

# 1. Welcome screen

## Screen goal
Set expectations and frame Restormel correctly.

## Headline
Control your AI access from one place.

## Body copy
Restormel lets you connect providers, manage models, define routing rules, and monitor usage across your apps, teams, and customers.

Use it to:
- authenticate your apps through Restormel
- connect your OpenAI, Anthropic, Google, or other provider accounts
- control which models are available where
- add routing, fallbacks, and policies
- track usage, cost, and lifecycle risk

## Primary CTA
Get started

## Secondary CTA
Read quickstart

## Tertiary link
What is Restormel?

---

# 2. Use-case selection screen

## Screen goal
Segment users lightly so the experience can adapt.

## Headline
What are you setting up Restormel for?

## Option cards

### Option 1
**My own app or prototype**  
I want to make requests through Restormel quickly and compare providers or models without too much setup.

### Option 2
**A team or platform**  
I need projects, environments, policies, logging, and reliable controls for production use.

### Option 3
**A product with my own customers**  
I want to control which providers and models my users can access, and track usage by tenant or customer.

## Helper text
You can change these defaults later. This just helps us tailor setup and examples.

## CTA
Continue

---

# 3. Workspace creation screen

## Screen goal
Create the account boundary.

## Headline
Create your workspace

## Body copy
A workspace is your top-level account boundary. It holds your projects, provider integrations, keys, policies, and shared settings.

## Fields
- Workspace name
- Team size
- Country/region optional
- Default billing preference

## Helper copy
Most teams need one workspace for their company or product group.

## CTA
Create workspace

---

# 4. Project creation screen

## Screen goal
Create the first app or product boundary.

## Headline
Create your first project

## Body copy
Projects keep your apps, environments, routes, and usage separate. Most teams create one project per product or major application.

## Fields
- Project name
- Description optional
- Default environments:
  - Development
  - Staging optional
  - Production

## Helper copy
You can always add more projects later.

## CTA
Create project

---

# 5. Key model explanation screen

## Screen goal
Explain the difference between Restormel authentication and provider credentials before the user creates anything sensitive.

## Headline
Before you continue, here’s how access works

## Body copy
Restormel uses two different kinds of credentials:

### Block 1
**Gateway Key**  
A Gateway Key authenticates your app, CLI, SDK, or agent to Restormel.

### Block 2
**Provider Credential**  
A Provider Credential connects your OpenAI, Anthropic, Google, or other provider account so Restormel can route requests on your behalf.

## Supporting copy
You may use one or both depending on how you want billing and routing to work.

## Inline callout
Your current setup only becomes clear once these two concepts are separated. We’ll set them up one at a time.

## CTA
Continue

## Secondary link
Learn more about keys and providers

---

# 6. Billing mode selection screen

## Screen goal
Explain the money flow simply.

## Headline
How do you want to pay for model usage?

## Options

### Option 1
**Bring your own provider keys**  
Connect your own provider accounts. Requests still go through Restormel, but usage is billed by the provider.

### Option 2
**Restormel-managed billing**  
Use Restormel as the billing layer for supported providers and routes.

### Option 3
**Hybrid**  
Use your own provider credentials for some routes and Restormel-managed billing for others.

## Helper copy
You can change this per route later if your plan supports it.

## CTA
Continue

---

# 7. Gateway Key creation screen

## Screen goal
Create the credential used to call Restormel.

## Headline
Create your first Gateway Key

## Body copy
This key is used by your app, CLI, SDK, or agent to authenticate requests to Restormel.

## Fields
- Key name
- Scope
  - Workspace
  - Project
  - Environment
- Expiry optional
- Description optional

## Helper copy
Use narrow scopes for production. You can create separate keys for development and production environments.

## CTA
Create Gateway Key

---

# 8. Gateway Key success screen

## Screen goal
Reveal the key once and explain how to use it.

## Headline
Your Gateway Key is ready

## Body copy
Copy this key now. For security reasons, you will only see the full secret once.

## Secret panel
- key prefix
- full secret reveal
- copy button

## Example tabs

### CLI tab label
CLI

### CLI tab copy
Use this key to authenticate the Restormel CLI.

### curl tab label
curl

### curl tab copy
Use this key in the Authorization header when making REST requests through Restormel.

### TypeScript tab label
TypeScript

### TypeScript tab copy
Use this key in your SDK client configuration.

### Python tab label
Python

### Python tab copy
Use this key in your Python client configuration.

### MCP tab label
MCP / agent

### MCP tab copy
Use this key when connecting an agent or MCP-compatible client to Restormel.

## CTA
Continue to provider setup

## Secondary CTA
Skip for now

---

# 9. Provider setup introduction screen

## Screen goal
Frame provider integrations clearly.

## Headline
Now connect a provider

## Body copy
Provider Integrations make models available inside Restormel.

Connect your OpenAI, Anthropic, Google, or other provider account to:
- use your own billing
- control which models are available to each project
- compare providers behind the same Restormel route
- apply fallbacks and policies

## CTA
Connect provider

## Secondary CTA
Skip for now

---

# 10. Provider chooser screen

## Screen goal
Let the user pick a provider.

## Headline
Choose a provider to connect

## Provider cards
- OpenAI
- Anthropic
- Google / Vertex
- Azure OpenAI
- AWS Bedrock
- Other / later

## Helper copy
You can connect more than one provider and use them behind the same route.

## CTA
Continue

---

# 11. Provider credential entry screen

## Screen goal
Collect the credential and explain what it does.

## Headline
Add your provider credential

## Body copy
This credential stays with the provider account you control. Restormel uses it to route requests on your behalf when a route selects this provider.

## Fields
- Credential name
- API key / token / provider auth input
- Region or endpoint if needed
- Notes optional

## Security note
Credentials are stored securely and can be rotated or disabled later.

## CTA
Test connection

---

# 12. Provider verification screen

## Screen goal
Confirm connectivity and reduce uncertainty.

## Headline
Testing your provider connection

## Loading copy
We’re verifying your credential and checking which models are available.

## Success state headline
Provider connected successfully

## Success body copy
Your credential is working and Restormel can now discover models from this provider.

## Success details
- provider name
- last verified time
- number of models discovered
- any provider-specific notes

## Failure state headline
We couldn’t verify this credential

## Failure body copy
Check the credential value, region, and provider account settings, then try again.

## CTA
Continue

---

# 13. Provider binding screen

## Screen goal
Decide where the provider can be used.

## Headline
Choose where this provider can be used

## Body copy
You can store provider credentials centrally and decide which projects or environments are allowed to use them.

## Controls
- Project selector
- Environment selector
- Bind to all environments toggle
- Default for new routes toggle

## Helper copy
Most teams bind providers at the project or environment level so development and production can stay separate.

## CTA
Save bindings

---

# 14. Model availability screen

## Screen goal
Show immediate value and begin introducing the catalog concept.

## Headline
Your models are now available

## Body copy
Restormel found the following models from this provider. You can compare them now or let a route choose for you later.

## Main content
- searchable model list
- recommended tags
- lifecycle badges
- pricing summary
- compare action

## CTA
Continue to route setup

## Secondary CTA
Review models first

---

# 15. Route introduction screen

## Screen goal
Introduce the route concept before asking users to configure one.

## Headline
Next, create a route

## Body copy
A route is a named set of rules that decides which provider or model should handle a request and what should happen if that option is unavailable, too expensive, restricted, or deprecated.

## Supporting bullets
Routes let you:
- prefer one provider over another
- add fallback chains
- enforce policies
- switch models without rewriting your app
- expose safe defaults to your users

## CTA
Create route

## Secondary CTA
Skip and choose later

---

# 16. Route template chooser screen

## Screen goal
Reduce setup friction by offering sensible defaults.

## Headline
Choose a starting route

## Template cards

### Cheapest
Prefer lower-cost models and providers where possible.

### Fastest
Prefer lower-latency options for interactive workloads.

### Best reasoning
Prefer stronger reasoning models for higher-quality outputs.

### Coding assistant
Prefer models suited to code generation and code explanation.

### Multimodal
Prefer models that can handle text plus image or mixed inputs.

### BYOK only
Use only your connected provider credentials.

### Safe starter
A balanced default with simple fallbacks and conservative settings.

## Helper copy
You can edit every part of the route later.

## CTA
Continue

---

# 17. Route setup screen

## Screen goal
Let the user define a first route without overwhelming them.

## Headline
Configure your route

## Section 1
**Route name**  
Give this route a name your app or team will recognise.

## Section 2
**Primary target**  
Choose the first model or provider Restormel should prefer.

## Section 3
**Fallback behaviour**  
Decide what should happen if the first choice is unavailable or blocked.

Options:
- no fallback
- fallback to same provider family
- fallback to approved alternative
- fail closed

## Section 4
**Billing mode**  
Choose whether this route uses BYOK, Restormel-managed billing, or whichever is available.

## CTA
Create route

---

# 18. First request screen

## Screen goal
Get the user to success as fast as possible.

## Headline
Make your first request

## Body copy
Your route is ready. Choose how you want to try it.

## Tabs
- CLI
- curl
- TypeScript
- Python
- MCP / agent

## Helper copy
All examples below already point to your Gateway Key and route.

## CTA
Run test request

## Secondary CTA
Copy code

---

# 19. First result screen

## Screen goal
Make Restormel feel intelligent and inspectable.

## Headline
Your first request worked

## Body copy
Here’s what Restormel did with your request.

## Result summary card
- route used
- provider selected
- model selected
- billing mode
- latency
- input/output tokens
- estimated cost

## Optional explanation panel
**Why this route chose this provider**  
Explain the main reason in plain English:
- preferred by route
- lower cost
- fallback triggered
- lifecycle restriction applied
- provider unavailable
- policy prevented another choice

## CTA
Open analytics

## Secondary CTA
Inspect request log

---

# 20. Next steps screen

## Screen goal
Guide the user toward meaningful activation.

## Headline
You’re ready to build on this

## Suggested next actions
- connect another provider
- compare models
- create a production key
- add a budget policy
- enable a deprecated-model warning
- invite your team
- expose approved models to downstream users
- explore the docs

## CTA
Go to dashboard

---

# 21. Optional onboarding checklist panel

## Title
Setup progress

## Checklist items
- Workspace created
- Project created
- Gateway Key created
- Provider connected
- Models discovered
- Route created
- First request completed
- Analytics opened
- Policy added

## Completion message
Your core setup is complete. You can now expand into governance, comparison, and production controls.

---

# 22. Contextual helper copy library

## 22.1 Gateway Key helper
A Gateway Key authenticates your app, CLI, SDK, or agent to Restormel.

## 22.2 Provider Credential helper
A Provider Credential connects your OpenAI, Anthropic, Google, or other provider account so Restormel can route requests on your behalf.

## 22.3 Route helper
A route is a named policy that decides which model or provider should handle a request and what should happen if conditions change.

## 22.4 Lifecycle helper
Lifecycle state shows whether a model is active, legacy, deprecated, or retired so you can avoid disruptions and migrate safely.

## 22.5 Billing mode helper
Billing mode decides whether usage for a route is charged through your own provider account, through Restormel, or through a hybrid policy.

---

# 23. Empty-state copy after onboarding

## No analytics yet
Make a few requests through your route and Restormel will show usage, cost, latency, and fallback behaviour here.

## No second provider yet
Connect another provider to compare models, improve resilience, and add better fallback options.

## No policies yet
Add policies to control budgets, restrict models, and protect production environments.

## No downstream tenants yet
If you want to expose AI capabilities to your own customers, create tenants and define which models or routes they can use.

---

# 24. Tone rules for onboarding copy

- always define the noun before asking the user to configure it
- never say “API key” on its own when “Gateway Key” is more precise
- explain provider credentials as distinct from Restormel access
- explain routes before showing route configuration
- explain billing mode before asking for provider setup assumptions
- keep the product feeling powerful but legible
- use plain English first, technical precision second
- always tell the user what happens next
