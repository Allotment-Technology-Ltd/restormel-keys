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

### 7. Custom provider definitions

Restormel ships first-party definitions for OpenAI, Anthropic, Google, Mistral, Groq, Together, DeepSeek, Fireworks, Cohere, Perplexity, Azure OpenAI, OpenRouter, and Portkey. If your app uses a provider not in that list (or needs stricter custody), define your own:

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

**Provider aliases:** Use the `aliases` field for normalisation (e.g. `google` has aliases `["vertex", "gemini"]`). The `resolveProviderId(id, providers)` helper finds a provider by id or alias.

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

**KeyRecord metadata:** Pass keys as `KeyRecord[]` (extends `KeyConfig` with `id`, `status`, `validatedAt`, `lastError`, `fingerprint`, `metadata`) to display richer status in the list view. Supported statuses: `active`, `pending_validation`, `invalid`, `revoked`.

## License

MIT
