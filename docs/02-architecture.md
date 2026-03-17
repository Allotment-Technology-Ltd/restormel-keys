# Restormel Keys — Architecture

---

## 1. Framework compatibility strategy

### Priority ranking

| Priority | Framework | Why | Target |
|----------|-----------|-----|--------|
| **P0** | Next.js (App Router) | Dominant AI SaaS framework. Most AI starter templates. Vibe-coding market default. | v1.0 |
| **P0** | React (generic) | Covers Remix, Vite+React, CRA. Same component package as Next.js. | v1.0 |
| **P1** | SvelteKit | Native extraction stack. SOPHIA integration. Internal dogfooding. | v1.0 |
| **P1** | Vanilla JS / Web Components | Catches Astro, static sites, "just give me a script tag." | v1.0 |
| **P2** | Vue / Nuxt | Meaningful market share, especially enterprise and non-US. | v1.1 |
| **P3** | Angular | Lower priority for AI SaaS. | v1.2 or community |

### Four-layer architecture

```
┌─────────────────────────────────────────────────────────┐
│ Framework wrappers (@restormel/keys-react, -vue)        │  ← convenience
│ Thin adapters, hooks, typed props                       │
├─────────────────────────────────────────────────────────┤
│ Web Components (@restormel/keys-elements)               │  ← universal UI
│ Custom elements wrapping the Svelte components          │
├─────────────────────────────────────────────────────────┤
│ Svelte components (@restormel/keys-svelte)              │  ← reference UI
│ Native Svelte 5 components, themeable, accessible       │
├─────────────────────────────────────────────────────────┤
│ Headless core (@restormel/keys)                         │  ← universal logic
│ Zero-dependency TypeScript. Works everywhere.            │
│ Key management, routing, cost, entitlements, storage.   │
└─────────────────────────────────────────────────────────┘
```

The headless core is the product. UI components are a delivery mechanism. Builders who want full rendering control use the headless API.

### Next.js App Router requirements (P0 gate)

1. All UI components `"use client"` or wrapped in client boundary.
2. No hydration mismatch — render nothing server-side, mount on client.
3. Server-side key resolution works in API routes and server actions.
4. `next/dynamic({ ssr: false })` compatibility.
5. Components work in `app/settings/page.tsx` without special configuration.

---

## 2. Package structure

### npm packages

| Package | Contents | Size target |
|---------|----------|-------------|
| `@restormel/keys` | Key management, routing, cost, entitlements, storage, providers, validators. Zero UI deps. | <15KB gz |
| `@restormel/keys-svelte` | KeyManager, ModelSelector, CostEstimator, UsageDashboard. Native Svelte 5. | <25KB gz |
| `@restormel/keys-elements` | Custom element wrappers around Svelte components. Framework-agnostic. | <30KB gz |
| `@restormel/keys-react` | React components, hooks (`useKeys`, `useModels`, `useCost`), context provider. | <5KB gz |
| `@restormel/keys-vue` | Vue components, composables (`useKeys`, `useModels`). | <5KB gz (P2) |
| `@restormel/keys-cli` | CLI for scaffolding, key validation, cost estimation, configuration. | N/A (global) |

### Core package structure

```
@restormel/keys
├── core/
│   ├── providers/         # Provider definitions and adapters
│   │   ├── openai.ts
│   │   ├── anthropic.ts
│   │   ├── google.ts
│   │   └── custom.ts     # User-defined provider support
│   ├── router.ts          # Model routing and fallback chains
│   ├── cost.ts            # Cost estimation and tracking
│   ├── entitlements.ts    # Plan-aware gating logic
│   ├── wallet.ts          # Per-user budget and spend tracking
│   ├── validator.ts       # Key validation (test calls)
│   ├── storage.ts         # Storage adapter interface
│   └── types.ts           # Shared types and interfaces
├── storage/
│   ├── memory.ts          # In-memory (testing, serverless)
│   ├── encrypted-local.ts # Encrypted localStorage (client-side)
│   ├── firestore.ts       # Firestore adapter
│   ├── supabase.ts        # Supabase adapter
│   └── custom.ts          # Bring-your-own storage
├── server/
│   ├── middleware.ts       # Express/SvelteKit middleware for key resolution
│   ├── proxy.ts           # Proxied requests (key never leaves server)
│   └── audit.ts           # Audit log helpers
└── index.ts
```

---

## 3. Core interfaces

```typescript
interface KeyConfig {
  id: string;
  provider: ProviderId;
  encryptedKey: string;
  organisationId?: string;
  status: 'active' | 'invalid' | 'expired' | 'rate_limited';
  lastValidated: string;
  lastUsed?: string;
  totalSpend: number;
  budgetLimit?: number;
  metadata?: Record<string, unknown>;
}

interface ProviderDefinition {
  id: ProviderId;
  name: string;
  models: ModelDefinition[];
  validateKey: (key: string) => Promise<ValidationResult>;
  estimateCost: (model: string, inputTokens: number, outputTokens: number) => CostEstimate;
  createClient: (key: string, options?: ClientOptions) => ProviderClient;
}

interface RoutingConfig {
  strategy: 'user_preferred' | 'cheapest' | 'fastest' | 'fallback_chain';
  fallbackChain?: ProviderId[];
  modelOverrides?: Record<string, { provider: ProviderId; model: string }>;
}

interface RestormelKeys {
  configure(config: KeysConfig): void;
  addKey(userId: string, provider: ProviderId, key: string): Promise<KeyConfig>;
  removeKey(userId: string, keyId: string): Promise<void>;
  listKeys(userId: string): Promise<KeyConfig[]>;
  validateKey(provider: ProviderId, key: string): Promise<ValidationResult>;
  resolveProvider(userId: string, request: AIRequest): Promise<ResolvedRoute>;
  estimateCost(model: string, inputTokens: number, outputTokens: number): CostEstimate;
  trackUsage(userId: string, usage: UsageRecord): Promise<void>;
  getUsage(userId: string, period?: string): Promise<UsageSummary>;
  checkEntitlement(userId: string, plan: string, model: string): EntitlementResult;
  getAvailableModels(userId: string): ModelDefinition[];
}
```

---

## 4. CLI design

Package: `@restormel/keys-cli`. Installed globally or via npx.

| Command | Description |
|---------|-------------|
| `keys init` | Interactive scaffolding. Detects framework, creates config, installs packages. |
| `keys add <provider>` | Add a provider API key interactively. Validates before saving. |
| `keys list` | List configured providers and key status. |
| `restormel-validate` | Re-validate all stored keys. Useful in CI. (`keys validate` is provided by `@restormel/keys-cli` as a wrapper.) |
| `keys test <provider> <model>` | Send test request. Returns latency, tokens, cost. |
| `keys estimate <model> --input <n> --output <n>` | Estimate cost without executing. |
| `restormel-doctor` | Check environment: framework detection, package versions, config validity, key health. (`keys doctor` is provided by `@restormel/keys-cli` as a wrapper.) |

---

## 5. SDK usage examples

### Server SDK

```typescript
import { createKeys, openai, anthropic, google } from '@restormel/keys';
import { firestoreStorage } from '@restormel/keys/storage/firestore';

const keys = createKeys({
  providers: [openai(), anthropic(), google()],
  storage: firestoreStorage({ projectId: 'my-project' }),
  platformKeys: {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
  },
});

const route = await keys.resolve(userId, { task: 'chat', preferredModel: 'gpt-4o' });
```

### React client

```tsx
'use client';
import { KeysProvider, KeyManager, ModelSelector } from '@restormel/keys-react';

export default function SettingsPage() {
  return (
    <KeysProvider apiEndpoint="/api/keys" theme="dark">
      <h1>AI Settings</h1>
      <KeyManager />
      <ModelSelector onSelect={(model) => console.log(model)} />
    </KeysProvider>
  );
}
```

---

## 6. Cloud API (hosted service)

The hosted API runs behind a Zuplo gateway, reusing the pattern from SOPHIA. Zuplo provides: API key issuance and validation, rate limiting, developer portal, usage metering, and request ID propagation.

SOPHIA's existing Zuplo project (`sophia-api-gateway`) serves as the template. Keys gets its own Zuplo project (`restormel-keys-gateway`) with the same policy patterns: `api-key-inbound` → `rate-limit-inbound` → `quota-inbound` → `inject-backend-auth`.

---

## 7. Security model

| Concern | Approach |
|---------|----------|
| Key storage | Encrypted at rest using AES-256-GCM. SOPHIA pattern: HMAC-SHA256 hash stored in Firestore, raw key returned only at creation time. |
| Key display | Masked after save (`sk-...abc`). Full key never returned after initial creation. |
| Key transmission | HTTPS only. Keys in request body, never in URL or query params. |
| Key validation | Lightweight test call (e.g., `models.list()` for OpenAI). Fails fast, no data transmitted. |
| Server-side proxy | Keys resolved server-side for proxied requests. Key never reaches the client. |
| API authentication | Bearer token per builder project (cloud API). Firebase Auth for dashboard. Zuplo consumer keys for external API access. |

### Key lifecycle (from SOPHIA's `apiAuth.ts` pattern)

1. **Creation:** Generate raw key (`sk-rk-{random}`), compute HMAC-SHA256 hash, store hash + metadata in Firestore. Return raw key once.
2. **Validation:** On each request, hash the presented key, look up by hash in Firestore, check `active` flag and daily quota via Firestore transaction.
3. **Rotation:** Create new key, deactivate old key. No downtime — both keys valid during transition window.
4. **Revocation:** Set `active: false`. Immediate effect due to per-request lookup.
