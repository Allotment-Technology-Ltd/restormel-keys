# @restormel/keys

Drop-in BYOK for AI apps. Headless key resolution, cost estimation, provider adapters (OpenAI, Anthropic, Google), and optional server middleware.

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

### 5. Optional: storage and server

- **Storage:** `import { createMemoryStorage } from "@restormel/keys/storage/memory"` or use encrypted localStorage with `@restormel/keys/storage/encrypted-local`.
- **Server:** `import { createMiddleware, createResolveMiddleware, createProxy } from "@restormel/keys/server"` for key management and proxy (standard `Request`/`Response`).
- **Security:** `import { createApiKey, hashApiKey, maskApiKey, createKeyVerifier } from "@restormel/keys/security"` for key hashing and verification.

Never log or store raw API keys; use hashed keys and masked display only.

## License

MIT
