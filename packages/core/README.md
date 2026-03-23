# @restormel/keys

Drop-in BYOK for AI apps. Headless key resolution, cost estimation, and optional server helpers.

## Install

```bash
npm install @restormel/keys
# or
pnpm add @restormel/keys
# or
yarn add @restormel/keys
```

**Requirements:** Node 18+, ESM.

## Quick start

### 1. Create a Keys instance

```ts
import { createKeys, openaiProvider, anthropicProvider } from "@restormel/keys";

const keys = createKeys(
  {
    routing: { defaultProvider: "openai" },
    plans: [{ id: "default", entitlements: { allowedModels: ["*"] } }],
  },
  { providers: [openaiProvider, anthropicProvider] }
);
```

### 2. Resolve which key to use

```ts
const resolved = await keys.resolve("openai", "gpt-4o");
// { provider: "openai", model: "gpt-4o", source: "byok" | "platform", keyId?: string }
```

### 3. Estimate cost

```ts
const cost = keys.estimateCost("gpt-4o-mini");
// { modelId, providerId, inputPerMillion, outputPerMillion, unit }
```

### 4. Check entitlements

```ts
const allowed = keys.entitlements.check("gpt-4o").allowed;
const available = keys.entitlements.getAvailableModels(keys.getAllModelIds());
```

### 5. Optional: storage and server helpers

- **Storage:** `import { createMemoryStorage } from "@restormel/keys/storage/memory"` or use encrypted localStorage with `@restormel/keys/storage/encrypted-local`.
- **Server:** `import { createMiddleware, createResolveMiddleware } from "@restormel/keys/server"` for BYOK and resolve flows (standard `Request`/`Response`). If you already use a gateway (OpenRouter/Portkey/Vercel AI Gateway) or call providers directly, you keep that execution layer.
- **Optional execution helper:** `createProxy` exists for edge cases where you explicitly want a Request/Response forwarder in your own app. It is not required and is not the default product shape.
- **Security:** `import { createApiKey, hashApiKey, maskApiKey, createKeyVerifier } from "@restormel/keys/security"` for key hashing and verification.

Never log or store raw API keys; use hashed keys and masked display only.

### 6. Dashboard API client (resolve and evaluate)

If your app calls the Restormel **dashboard** REST API (route resolve, policy evaluate), use the typed client so you get structured errors instead of parsing JSON by hand:

```ts
import {
  resolve,
  evaluatePolicies,
  isPolicyBlocked,
  isNoRoute,
} from "@restormel/keys/dashboard";

// Resolve: returns { ok: true, data } or { ok: false, status, error, violations? }
const result = await resolve({
  projectId: "proj-1",
  environmentId: "prod",
  auth: { type: "bearer", token: process.env.RESTORMEL_GATEWAY_KEY! },
});
if (result.ok) {
  console.log(result.data.providerType, result.data.modelId);
} else if (isPolicyBlocked(result)) {
  console.error("Blocked:", result.violations);
} else if (isNoRoute(result)) {
  console.error("No route");
}

// Evaluate: returns { allowed, violations }; throws on HTTP error
const { allowed, violations } = await evaluatePolicies({
  projectId: "proj-1",
  environmentId: "prod",
  modelId: "gpt-4o",
  providerType: "openai",
  auth: { type: "bearer", token: process.env.RESTORMEL_GATEWAY_KEY! },
});
```

**Security:** Use the dashboard client **only on the server**. Never send the Gateway Key to the browser or expose it in client-side code. Pass the token from environment variables or a secure server session.

**Canonical provider/model feed (for existing integrations):** replace local provider presets with `fetchCanonicalCatalog` from `@restormel/keys/dashboard`.

```ts
import {
  fetchCanonicalCatalogWithFallback,
  filterCanonicalCatalogForViability,
  type CanonicalCatalogResponse,
} from "@restormel/keys/dashboard";

const localFallback: CanonicalCatalogResponse = {
  contractVersion: "local-fallback.v1",
  source: "restormel-keys",
  generatedAt: new Date().toISOString(),
  providers: [],
  data: [],
  paging: { limit: 0, offset: 0, count: 0 },
};

const { catalog, source, degradedReason } = await fetchCanonicalCatalogWithFallback({
  baseUrl: process.env.RESTORMEL_KEYS_BASE, // optional; defaults to env / restormel.dev
  fallback: () => localFallback,
});

const viableCatalog = filterCanonicalCatalogForViability(catalog, {
  knownRetiredModelIds: ["claude-3-5-haiku-20241022"], // optional emergency override
});

// source === "restormel" when canonical feed is live
// source === "fallback" when feed is unavailable
// degradedReason explains the fallback trigger
```

The endpoint is `GET /keys/dashboard/api/catalog` and returns a versioned contract (`contractVersion`), provider validation metadata (including optional `validation.defaultApiBaseUrl` when `mode === "openai_compatible"` and `requiresBaseUrl === false`), and model variants. This is the canonical path for downstream BYOK UIs.

For a low-touch upgrade across existing apps, run:

```bash
npx @restormel/keys-cli@0.1.3 patch
```

**Batch policy filter (server-side allowed-models):** Use `filterModelsByPolicy` to evaluate many `(providerType, modelId)` pairs in parallel and get per-model status: `allowed`, `blocked_by_policy`, `restormel_degraded`, or `unknown_or_unavailable`. Helpers for UI:

- `candidatesFromProviderDefinitions(providers)` — flatten `defaultProviders` (or a subset) into candidates.
- `groupedModelsForModelSelector(sourceProviders, entries)` — grouped provider + model rows with status metadata for custom pickers.
- `policyAvailabilityMapFromEntries(entries)` — map keyed `providerId:modelId` for `@restormel/keys-svelte` **ModelSelector** `policyAvailability` prop. Rows include `enforcement` (`hard` for policy blocks, `soft` for degraded/unknown checks) so transient failures do not permanently suppress resolve retries.
- `filterProviderDefinitionsByAllowedPolicy(sourceProviders, entries)` — strict allowlist: full `ProviderDefinition[]` with only policy-allowed models.

### 7. Custom provider definitions

Restormel ships first-party definitions for **15 providers**, each with an expanded model list so users get a **click-and-select** experience with minimal setup:

- **OpenAI** — gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo, o1, o3-mini, etc.
- **Anthropic** — Claude 3.5 Sonnet/Haiku, Claude 3 Opus/Sonnet/Haiku, Claude 4 family
- **Google** — Gemini 2.5/2.0/1.5 Pro and Flash variants
- **xAI (Grok)** — grok-3, grok-2, vision models
- **Mistral** — mistral-large/medium/small, codestral, pixtral, minstral
- **Groq** — Llama 3.3/3.2/3.1, Mixtral, Gemma2, Llama Guard
- **DeepSeek** — deepseek-chat, reasoner, coder, r1
- **Cohere** — Command R+, R, R7B, Command Light/A, Aya 23
- **Perplexity** — sonar-pro, sonar, sonar-deep-research, sonar-reasoning-pro, sonar-small/medium-chat
- **Together** — Llama 3.3/3.2/3.1, Mixtral, Qwen 2.5, DeepSeek V3/R1, Gemma 2, Hermes 3
- **Fireworks** — Llama v3, Mixtral, Qwen 2.5, DeepSeek R1 distill, Code Llama, Falcon 2
- **Voyage AI** — voyage-3, voyage-large-2, voyage-code-2 (embeddings)
- **Azure OpenAI** — gpt-4o, gpt-4-turbo, gpt-35-turbo, o1, embeddings
- **OpenRouter** — Curated list (openai/gpt-4o, anthropic/claude-3.5-sonnet, google/gemini-2.0-flash-exp, etc.)
- **Portkey** — Common gateway-routed model ids

**One import for all:** Use **`defaultProviders`** so you don’t have to list each provider manually:

```ts
import { createKeys, defaultProviders } from "@restormel/keys";

const keys = createKeys(config, { providers: defaultProviders });
```

KeyManager and ModelSelector can then use `providers={defaultProviders}` (or the same array) for a full click-and-select UI. If your app uses a provider not in that list (or needs stricter custody), define your own:

```ts
import { defineProvider } from "@restormel/keys";
import type { ProviderDefinition } from "@restormel/keys";

const myProvider: ProviderDefinition = defineProvider({
  id: "my-provider",
  name: "My Provider",
  models: ["my-model-1", "my-model-2"],
  aliases: ["my-alias"],
  icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">...</svg>',
  async validateKey(credential, fetchFn = fetch) {
    const res = await fetchFn("https://api.my-provider.com/v1/models", {
      headers: { Authorization: `Bearer ${credential}` },
    });
    if (!res.ok) return { valid: false, errors: [`${res.status}`] };
    return { valid: true };
  },
  estimateCost(modelId) {
    return { id: modelId, inputPerMillion: 1, outputPerMillion: 3, unit: "USD" };
  },
  createClient(credential) {
    return { provider: "my-provider", baseUrl: "https://api.my-provider.com" };
  },
});
```

Pass custom providers alongside built-ins to `createKeys` and to UI components:

```ts
const keys = createKeys(config, {
  providers: [openaiProvider, anthropicProvider, myProvider],
});
```

**Provider aliases:** Use the `aliases` field for normalisation (e.g. `google` has aliases `["vertex", "gemini"]`). The `resolveProviderId(id, providers)` helper finds a provider by id or alias. Use **`canonicalizeProviderId(id, providers)`** when persisting key records so that alias-based ids (e.g. `"vertex"`) are stored as the definition's canonical id (e.g. `"google"`); this avoids host-specific id mismatch when the UI shows one id and storage uses another.

**Storage canonicalization when migrating from alias ids:** If your app historically stored provider ids under an alias (e.g. `vertex` for Google), you can (a) **persist canonical id from now on** — when saving new keys or updating, use `canonicalizeProviderId(providerId, providers)` and store that (e.g. `google`); (b) **keep a thin translation layer for legacy data** — when loading keys from storage, if your store still has `vertex`, map it to `google` for the UI (e.g. `provider: storedProvider === "vertex" ? "google" : storedProvider`) so KeyManager and ModelSelector see a known provider id; (c) **optional one-time migration** — backfill existing key records to canonical ids so save/revalidate/remove paths can assume canonical id in storage and you can remove the translation layer.

**Custom icons:** Set `icon` on your `ProviderDefinition` to an inline SVG string. UI components (`KeyManager`, `ModelSelector`) will render it instead of the built-in generic icon.

### 8. Server-side validation and KeyManager integration

For apps where raw credentials should not go directly from the browser to providers, use the `onValidate` prop on KeyManager:

```tsx
// Next.js / React example
<KeyManager
  keys={keys}
  userId={userId}
  providers={providers}
  onValidate={async (provider, rawCredential) => {
    const res = await fetch("/api/validate-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, credential: rawCredential }),
    });
    return res.json(); // { valid: boolean, errors?: string[] }
  }}
  onKeyAdded={async (key, rawCredential) => {
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: key.provider, credential: rawCredential }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? "Save failed" };
    return { ok: true, savedKey: data.key };
  }}
  onKeyRemoved={async (keyId) => {
    const res = await fetch(`/api/keys/${keyId}`, { method: "DELETE" });
    if (!res.ok) return { ok: false, error: "Remove failed" };
    return { ok: true };
  }}
/>
```

The component awaits each host callback. On `{ ok: false, error }`, the error is shown inline and the form stays open. On `{ ok: true }`, the entry closes and the list refreshes.

**Revalidate:** Provide **`onRevalidate(keyId, provider)`** so the key detail view can re-check an existing key server-side. The component passes **keyId** and **provider**; prefer **key-id-centric** revalidate endpoints that accept **keyId**, look up the stored credential by keyId (server-side), then validate against the provider. That way revalidation is scoped to the specific key and you avoid provider-only endpoints that don't know which key to revalidate. Prefer this over overloading `onValidate` with an empty-credential sentinel.

**Validate-then-persist (avoid double validation):** If you use `onValidate`, the component validates before calling `onKeyAdded`. Your save endpoint can **skip a second validation** and trust the client already validated, so the add flow does not hit the provider twice. For example, have the client send `preValidated: true` in the save body when it used `onValidate`; the server then persists without calling the provider again. If you prefer defence-in-depth, validate again on persist and return `{ ok: false, error }` (and optionally delete the just-saved key) on failure; that keeps UI consistent but duplicates the provider call.

**KeyRecord metadata:** Pass keys as `KeyRecord[]` (extends `KeyConfig` with `id`, `status`, `validatedAt`, `updatedAt`, `lastError`, `fingerprint`, `metadata`) to display richer status in the list view. Supported statuses: `active`, `pending_validation`, `invalid`, `revoked`. Set `updatedAt` (ISO 8601) when the record was last updated so hosts don't need to tuck it into `metadata`.

## License

MIT
