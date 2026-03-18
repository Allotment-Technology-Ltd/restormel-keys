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

## License

MIT
