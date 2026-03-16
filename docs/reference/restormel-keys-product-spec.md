# Restormel Keys --- Product Specification and Strategic Pivot

Version: Draft v1\
Purpose: Align the Restormel Keys product plan with improved
documentation, dashboard UX, provider/model intelligence, and developer
experience while remaining compatible with the existing build pack.

------------------------------------------------------------------------

## Executive Overview

Restormel Keys is a **library-first BYOK and multi-provider routing
layer for AI-powered applications**.

It enables SaaS builders to ship:

-   production-grade key management
-   provider routing
-   cost controls
-   model selection logic

without building infrastructure themselves.

The existing architecture and roadmap remain valid. However, the product
should elevate:

-   documentation
-   dashboard UX
-   model catalogue
-   provider intelligence
-   cost planning tools

These surfaces are now critical parts of modern AI developer tooling.

The pivot does **not change the core product**. Instead it reframes Keys
as:

> A BYOK and model intelligence layer that helps builders choose,
> manage, and route AI providers safely and economically.

------------------------------------------------------------------------

## What the Product Already Is

Restormel Keys solves two core builder problems:

1.  Multi-provider AI routing
2.  End-user BYOK key management

It does this through:

-   headless TypeScript core library
-   optional UI components
-   CLI tooling
-   hosted dashboard
-   optional cloud services

The architecture remains:

Framework wrappers\
Web Components\
Svelte UI components\
Headless core logic

The **headless core remains the product**.

------------------------------------------------------------------------

## Strategic Pivot

### Previous framing

Keys emphasised:

-   key storage
-   routing logic
-   cost estimation
-   entitlement gating

While correct, this underemphasises **developer decision support**.

Builders struggle with:

-   model selection
-   provider differences
-   pricing complexity
-   rate limits
-   deprecations
-   fallback strategies

Keys already contains the routing logic needed to help with these
problems.

The pivot therefore elevates **model intelligence and provider
management** into a first‑class product surface.

------------------------------------------------------------------------

## New Product Positioning

Restormel Keys becomes:

> The model management and BYOK layer for AI applications.

Builders use Keys to:

-   connect providers
-   manage platform and user keys
-   expose models to their users
-   route requests across providers
-   monitor usage and cost
-   plan usage economically
-   migrate safely when models change

This expands Keys from:

"key storage library"

to

"model routing and provider intelligence layer."

------------------------------------------------------------------------

## Core Product Modes

### Builder routing

Builders use Keys to route requests across providers.

Capabilities:

-   unified provider interface
-   fallback chains
-   model selection
-   cost estimation
-   provider health checks

### End‑user BYOK

Users add their own provider API keys.

Capabilities:

-   embedded key management UI
-   secure encrypted key storage
-   per‑user configuration
-   validation
-   cost tracking

### Combined mode

Platform keys and user keys coexist.

Example:

Free tier → platform key\
Pro tier → user BYOK

------------------------------------------------------------------------

## Canonical System Model

To unify CLI, dashboard, docs, and APIs the system introduces:

Provider Registry\
Model Registry

These registries contain the canonical data for:

-   providers
-   models
-   lifecycle state
-   pricing
-   rate limits
-   capabilities
-   routing compatibility

------------------------------------------------------------------------

## Provider Registry

Each provider entry includes:

-   id
-   display name
-   auth type
-   key validation method
-   available models
-   regional availability
-   rate limit structure
-   pricing sources

Example:

Provider: OpenAI\
Models: gpt‑4o, gpt‑4o‑mini, o1

------------------------------------------------------------------------

## Model Registry

Each model entry includes:

-   id
-   provider
-   lifecycle state
-   context window
-   pricing (input/output)
-   rate limits
-   capabilities
-   strengths
-   weaknesses
-   recommended use cases
-   recommended replacements

Lifecycle states:

active\
preview\
legacy\
deprecated\
removal scheduled

------------------------------------------------------------------------

## Dashboard Redesign

The dashboard should expose the system model clearly.

### Proposed navigation

Overview\
Projects\
Access\
Providers\
Models\
Routing\
End‑user BYOK\
Usage\
Billing\
Settings

------------------------------------------------------------------------

## Key Distinction Between Key Types

The product must clearly separate:

### Platform Access Keys

Used by builders to authenticate with the Keys API.

### Provider Credentials

API keys for providers such as:

OpenAI\
Anthropic\
Google

### End‑User BYOK Keys

Keys supplied by the builder's customers.

------------------------------------------------------------------------

## Provider Management UX

Providers appear as cards showing:

-   connection status
-   number of models enabled
-   monthly spend
-   last validation

Actions:

-   add key
-   rotate key
-   validate
-   view models
-   disable provider

------------------------------------------------------------------------

## Model Catalogue UX

Model catalogue table columns:

-   model
-   provider
-   lifecycle
-   context window
-   price
-   rate limits
-   recommended use
-   availability

Badges:

preview\
stable\
deprecated\
platform only\
user enabled

------------------------------------------------------------------------

## Routing Configuration

Routing configuration defines:

-   default models
-   fallback chains
-   task‑specific routing
-   cost‑first routing
-   quality‑first routing
-   budget caps

Example:

chat\
→ gpt‑4o\
→ claude‑sonnet fallback\
→ gemini fallback

------------------------------------------------------------------------

## Usage Analytics

Analytics should display:

-   requests
-   token usage
-   cost
-   provider distribution
-   model distribution
-   fallback frequency
-   error rates

------------------------------------------------------------------------

## Cost Planning Tools

Planning tools include:

### Cost calculator

Inputs:

-   requests/day
-   average tokens
-   selected model

Outputs:

-   estimated monthly cost

### Routing simulator

Simulates routing policies to estimate:

-   cost
-   latency
-   fallback rates

### Model comparison

Side‑by‑side comparison of:

-   price
-   latency
-   capabilities

------------------------------------------------------------------------

## Documentation Strategy

Documentation must support:

-   humans
-   AI agents
-   MCP tools

Structure:

Start\
Guides\
Concepts\
Reference\
Provider catalogue\
Model catalogue\
Operations

------------------------------------------------------------------------

## Machine‑Readable Documentation

The docs site should also generate:

-   llms.txt
-   OpenAPI spec
-   model registry JSON
-   provider registry JSON
-   pricing feeds
-   deprecation feeds

------------------------------------------------------------------------

## CLI Parity

CLI commands mirror dashboard functionality.

Examples:

keys provider add\
keys provider validate\
keys models list\
keys models inspect\
keys route simulate\
keys cost estimate\
keys usage report

------------------------------------------------------------------------

## Strategic Role in Restormel

Keys remains the **first revenue product** in the Restormel ecosystem.

It introduces developers to the platform before they adopt later
products such as Restormel Graph.

------------------------------------------------------------------------

## Summary

Restormel Keys remains:

A library‑first BYOK and provider routing layer.

But evolves into:

A **model management platform for builders**.

New additions include:

-   provider registry
-   model registry
-   lifecycle intelligence
-   cost planning tools
-   improved dashboard UX
-   structured documentation
