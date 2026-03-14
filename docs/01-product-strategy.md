# Restormel Keys — Product Strategy

---

## 1. Vision

Restormel Keys is the drop-in BYOK layer for AI-powered applications. It solves two problems that every AI SaaS builder faces: routing requests to multiple AI providers through a consistent interface, and letting end-users bring their own API keys. No existing product packages both cleanly.

## 2. Mission

Enable any AI-powered application to ship production-grade key management, provider routing, and cost controls in hours instead of weeks — for the builder's own infrastructure and for their end-users' keys.

## 3. Strategic objectives

**O1 — Revenue generation.** Ship a product that generates recurring revenue within 10 weeks of development start, funding continued Restormel platform work.

**O2 — Top-of-funnel for Restormel.** Introduce the Restormel brand to a broad developer audience. Every builder who adopts Restormel Keys encounters Restormel Graph when they need reasoning debugging.

**O3 — Extraction proof.** Demonstrate that SOPHIA's production infrastructure can be extracted into reusable, independently valuable packages.

**O4 — Ecosystem presence.** Establish Restormel as a credible name in AI developer tooling before launching the reasoning workspace.

---

## 4. Problem statement

### What builders face today

Every team building an AI-powered product eventually needs:

1. **Their own multi-provider routing** — calling OpenAI, Anthropic, Google, Cohere, Mistral, or open-source models through a consistent interface, with fallbacks, cost tracking, and model selection logic.
2. **BYOK for their end-users** — letting customers bring their own API keys to avoid vendor lock-in, reduce costs, maintain data sovereignty, or use models the builder doesn't directly support.

### How it's solved today (badly)

- **For builder infrastructure:** LiteLLM (heavy — requires Docker, PostgreSQL, Redis), Portkey (enterprise-priced, gateway-first), or weeks of custom implementation.
- **For end-user BYOK:** Almost nothing exists. Builders store keys in localStorage, roll their own settings pages, and hope for the best. There is no embeddable, production-grade BYOK component.

### The specific whitespace

No product provides an embeddable BYOK UI component + provider routing + cost/entitlement logic as a library that SaaS builders can drop into their applications. LiteLLM and Portkey are infrastructure-grade gateways for platform teams managing 50+ engineers and billions of tokens. They are overkill for a SaaS builder who needs a settings page where users can paste their OpenAI key and a routing layer that picks the right provider.

---

## 5. Product modes

### Mode 1: Builder-side ("my app needs AI")

The builder integrates Restormel Keys into their server to route AI requests through a consistent interface.

**Provides:** Unified API across providers. Model selection and fallback chains. Cost estimation before execution. Cost tracking after execution. Rate limiting and budget controls. Streaming support. Provider health checks. Request/response normalisation.

**Who uses this:** Solo founders building AI-powered products. Small teams that need multi-provider support without running LiteLLM infrastructure. SaaS builders who want provider flexibility without vendor lock-in.

### Mode 2: End-user BYOK ("my users bring their own keys")

The builder embeds Restormel Keys components into their application UI so end-users can manage their own API keys.

**Provides:** Embeddable settings UI (Svelte component, Web Component, or headless API). Secure key storage (encrypted at rest, never logged). Per-user provider configuration. Per-user cost tracking and budget limits. Key validation on entry. Provider status indicators. Model availability based on user's keys. Graceful fallback when user's key fails.

### Mode 3: Combined ("my app uses AI and my users can too")

Both modes share the same routing, cost tracking, and entitlement layer. This is SOPHIA's exact pattern: platform keys for the reasoning engine, user keys for deeper/more expensive analysis modes.

---

## 6. Target users

### Primary: AI SaaS builders (individual and small team)

Building AI-powered products (writing tools, coding assistants, research tools, chatbots, content generators). Using 1–3 AI providers. Need provider routing and BYOK but cannot justify running LiteLLM/Portkey infrastructure. TypeScript/JavaScript stack (SvelteKit, Next.js, Nuxt, Remix, Express). Cost-conscious, prefer library over managed service.

### Secondary: Open-source project maintainers

Projects that need users to supply their own API keys. Cannot bundle API costs into the project. Need a clean, trustworthy key management component.

### Tertiary: Enterprise product teams

Building internal AI tools where different departments have different provider agreements. Need per-team key management, budget controls, and audit trails.

---

## 7. Use cases

**UC1 — AI writing tool with user BYOK.** Free users use the platform's GPT-4o-mini allocation. Pro users paste their own OpenAI or Anthropic key. Keys handles key storage, validation, model availability, and routing.

**UC2 — Coding assistant with provider choice.** Users choose their preferred provider in settings. The editor calls Keys to route completions. If the user's key fails, the editor falls back to a default model with a notification.

**UC3 — Internal enterprise tool with departmental keys.** Engineering team has an Anthropic agreement. Marketing team has an OpenAI agreement. Keys manages per-team configuration and routes requests based on the requesting user's team.

**UC4 — Open-source project with zero API cost.** Users install the tool and configure their own keys through the embedded Keys settings panel. The project maintainer pays nothing for AI API costs.

**UC5 — SaaS with tiered model access.** Free (GPT-4o-mini, platform key), Pro (GPT-4o, platform key), Enterprise (BYOK, any model). Keys manages the entitlement logic.

**UC6 — Solo founder building fast.** Adds `@restormel/keys` to their SvelteKit project and has provider routing, cost estimation, and a settings page working in an afternoon.

---

## 8. Competitive positioning

### What Restormel Keys is NOT

- Not an AI gateway. It does not proxy traffic through a central server by default. It is a library.
- Not an observability tool. It tracks cost and usage for key management, not for debugging.
- Not a model marketplace. It routes to providers the builder and user configure.

### What Restormel Keys IS

- The embeddable BYOK layer that LiteLLM and Portkey forgot to build.
- The business logic every AI SaaS builder reimplements from scratch: entitlements, wallets, cost estimation, plan gating.
- A library-first product that works without Docker, PostgreSQL, Redis, or a proxy server.

### Competitive gap matrix

| Need | LiteLLM | Portkey | Cloudflare AI GW | Zuplo | Custom | **Keys** |
|------|---------|---------|-------------------|-------|--------|----------|
| Unified provider routing | Yes | Yes | Partial | N/A | DIY | **Yes** |
| End-user BYOK UI | No | No | No | No | DIY | **Yes** |
| Embeddable settings component | No | No | No | No | DIY | **Yes** |
| Cost estimation pre-request | Partial | Partial | No | No | DIY | **Yes** |
| Per-user budget/wallet | Enterprise | Enterprise | No | No | DIY | **Yes** |
| Plan-aware entitlement gating | No | No | No | No | DIY | **Yes** |
| Works as a library (no infra) | SDK only | No | No | No | — | **Yes** |
| TypeScript-first | No | Yes | Yes | Yes | — | **Yes** |
| Lightweight (<50KB) | No | No | Yes | N/A | — | **Yes** |

### Proof point

Restormel Keys is extracted from SOPHIA, a production AI application with multi-provider routing, BYOK credential handling, wallet logic, entitlement checks, and billing — all battle-tested in a real product.
