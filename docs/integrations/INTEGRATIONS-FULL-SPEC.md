# Restormel Integrations — Full Product, UX, and Implementation Spec

## 0. Purpose

Restormel Integrations is the developer enablement layer for Restormel.

It exists to:

- accelerate adoption of Restormel Keys
- embed Restormel into developer workflows
- provide agent-native and dev-native access surfaces

## 1. Product Model

```
Restormel Keys        → Core (BYOK, routing, cost, entitlements)
Restormel Integrations → Developer surfaces (CLI, MCP, AAIF)
Future Restormel      → Graph / evaluation / reasoning
```

## 2. Architecture Placement

```
apps/
  dashboard/
    src/routes/
      integrations/

packages/
  aaif/
  mcp/

docs/
  integrations/
```

## 3. Navigation

Add to global nav:

```
Home
Docs
Pricing
Dashboard
Integrations
```

## 4. Integrations Landing Page (UX + Layout)

**Route:** `/integrations`

### 4.1 Hero

**Headline:** Restormel, wherever your agents run

**Body:** Connect your app, terminal, and agent workflows to Restormel using developer-first tools.

**CTAs:**

- Get started with Keys
- Explore integrations

### 4.2 Integration Cards

Grid (3 columns)

**CLI**

- Title: CLI
- Description: Debug, validate, and inspect from your terminal
- Status: Available
- CTA: View CLI docs

**MCP**

- Title: MCP
- Description: Use Restormel inside agent workflows and IDEs
- Status: Early
- CTA: Set up MCP

**AAIF**

- Title: AAIF
- Description: Structured contract for predictable AI interactions
- Status: Advanced
- CTA: Learn more

### 4.3 Day 0.1 Setup

**Title:** Start in minutes

Steps:

1. Install Keys
2. Add provider keys
3. Choose your workflow:
   - SDK
   - CLI
   - MCP

### 4.4 Philosophy

> Restormel doesn't replace your stack.
> It makes it intelligible, controllable, and portable.

### 4.5 Docs Links

- CLI Quickstart
- MCP Setup
- AAIF Overview

## 5. Component-Level Design Spec (Figma-ready)

### 5.1 Integration Card Component

Props:

```typescript
type IntegrationCard = {
  title: string;
  description: string;
  status: "available" | "early" | "advanced";
  cta: string;
};
```

States: default, hover, active

Style: dark background, soft border, rounded (2xl), subtle glow on hover

### 5.2 Status Badge

Variants:

- green → available
- yellow → early
- purple → advanced

### 5.3 Code Block

- monospace font
- dark surface
- copy button
- optional label (CLI / MCP)

### 5.4 Section Container

Spacing: padding large, max width 1200px, centered

### 5.5 CTA Button

Variants: primary (filled), secondary (outline)

## 6. Dashboard — Integrations

**Route:** `/dashboard/integrations`

### Layout

**Sidebar Entry:** Add Integrations

### Overview Page

Cards: CLI, MCP, AAIF

Each card: status, setup CTA, last activity

### MCP Tab

Display: connection status, available tools, last calls, errors

### CLI Tab

Display: install status, config validation, recent commands

### AAIF Tab

Display: request logs, routing explanations, cost outputs

**Do NOT market AAIF.**

## 7. Onboarding Flow (Full Copy)

### Step: Usage Path

**Title:** How do you want to use Restormel?

**Options:**

- In my app
- In my terminal
- In my agent or IDE

### CLI Path

Install the CLI to validate configuration and inspect routing.

### MCP Path

Connect Restormel to your agent workflow.

### Success Screen

- Restormel is ready
- Routing configured
- Provider access active

## 8. AAIF Spec (Implementation)

Implementation workflow runbook: [runbooks/aaif-implementation-workflow.md](../runbooks/aaif-implementation-workflow.md)

### Request

```typescript
type AAIFRequest = {
  input: string;
  task?: "chat" | "completion" | "embedding";
  constraints?: {
    maxCost?: number;
    latency?: "low" | "balanced" | "high";
    tokens?: {
      inputTokensM?: number;
      outputTokensM?: number;
    };
  };
  user?: {
    id: string;
    plan?: string;
  };
  routing?: {
    model?: string;
    provider?: string;
  };
};
```

### Response

```typescript
type AAIFResponse = {
  output: string;
  provider: string;
  model: string;
  cost: number;
  routing: {
    reason: string;
  };
};
```

## 9. MCP Tool Surface

MCP implementation workflow runbook: [runbooks/mcp-implementation-workflow.md](../runbooks/mcp-implementation-workflow.md)

**Runtime:** `@restormel/mcp` ships a stdio MCP server (`restormel-mcp`) and `createRestormelMcpServer()` for custom transports. See `packages/mcp/README.md`.

Tools:

- `models.list`
- `providers.validate`
- `cost.estimate`
- `routing.explain`
- `entitlements.check`
- `integration.generate`
- `integration.bootstrap_nextjs`
- `routes.list/create/update/delete`
- `policies.list/create/update/delete`
- `fallback_chain.set`
- `byok.schema.generate`
- `byok.api_contract.generate`
- `policy.simulate`
- `catalog.sync_check`
- `catalog.deprecation_alerts`
- `readiness.check`
- `docs.search`

## 10. CLI Commands

```
restormel doctor
restormel models list
restormel cost estimate
restormel routing explain
restormel init
```

## 11. Docs IA

```
Docs
  Getting Started
  Keys

  Integrations
    CLI
    MCP
    AAIF
```

## 12. UX Principles

- fast onboarding
- developer-first
- optional but visible
- no confusion vs Keys

## 13. Design Principles

- reuse tokens
- no fragmentation
- code-first UI
- subtle developer aesthetic

## 14. Build Plan

1. Add /integrations route
2. Add navigation
3. Build landing page
4. Add onboarding step
5. Build dashboard section
6. Add docs
7. Scaffold AAIF + MCP

## 15. Guardrails

**DO:**

- keep Integrations thin
- support Keys

**DO NOT:**

- build platform
- create orchestration engine
- duplicate core logic

## 16. Future Expansion

- webhooks
- event streams
- automation
- evaluation integrations
- graph layer

## 17. One-Line Summary

Restormel Integrations connects Restormel Keys to real developer workflows — without expanding the core product.
