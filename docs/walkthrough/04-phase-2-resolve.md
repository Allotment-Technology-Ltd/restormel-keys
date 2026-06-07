# Phase 2 — Resolve Your First Model

> **Time:** ~15 minutes
> **Prerequisites:** [Phase 1](/keys/docs/walkthrough/phase-1-install) complete (packages installed, project created, Gateway Key in `.env`, `keys doctor` passes)
> **You'll need:** Terminal access, a running dev server (or `curl`/`httpie`), your Gateway Key and Project ID from the dashboard

This phase wires a single resolve call into your backend. By the end, your app can ask Restormel "which provider and model should I use for this request?" and get a concrete answer. You'll verify the response shape, then plug it into the feature-flag branch from Phase 0.

---

## Step 2.1 — Understand the resolve flow

Before writing code, understand what happens when your backend calls resolve:

1. Your backend sends a `POST` to the resolve endpoint with your project ID and environment.
2. Restormel evaluates the project's routes (fallback chain) and policies (allowlists, budgets, etc.).
3. Restormel returns a JSON object telling you which provider, model, and key source to use.
4. Your backend calls the AI provider directly using that information.

Restormel does **not** proxy the AI request. It tells you _where_ to send it; you send it yourself. This keeps latency low and means your provider API keys never transit through Restormel (unless you've stored provider credentials in the dashboard and want Restormel to supply them).

---

## Step 2.2 — Test resolve with curl

Before writing any application code, confirm the resolve endpoint works with a raw HTTP call. This isolates Restormel from your app so you can verify the plumbing.

```bash
curl -X POST \
  "https://restormel.dev/keys/dashboard/api/projects/${RESTORMEL_PROJECT_ID}/resolve" \
  -H "Authorization: Bearer ${RESTORMEL_GATEWAY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "environmentId": "production" }'
```

> **Tip**
> If you use the Cloud API through the Zuplo gateway, the URL is your gateway URL instead of the dashboard URL, and you authenticate with your consumer key (`zpka_…`). For this walkthrough, we use the dashboard API directly with the Gateway Key. See [Cloud API](/keys/docs/cloud-api/) for the gateway path.

### You'll see

A JSON response wrapped under `data`:

```json
{
  "data": {
    "routeId": "route_123",
    "providerType": "openai",
    "modelId": "gpt-4o",
    "explanation": "route=route_123 step=0 provider=openai model=gpt-4o"
  }
}
```

**Reading the response:**

| Field | Meaning |
|-------|---------|
| `data.routeId` | The matched route ID (created in the dashboard in Phase 3) |
| `data.providerType` | The AI provider to call (e.g. `openai`, `anthropic`, `google`) |
| `data.modelId` | The model to use (from the first enabled step, or the route default); may be `null` if none configured |
| `data.explanation` | A human-readable trace of the resolution path (useful for debugging) |

If you have not created a route for this `environmentId` yet, resolve returns **404** with `{ error: "no_route" }`. That is expected — you create your first route in Phase 3.

### How to test

The curl command returns HTTP 200 and a JSON body with `data.providerType`. If you get:

- **401 Unauthorized** — your Gateway Key is wrong or missing. Check `$RESTORMEL_GATEWAY_KEY`.
- **404 Not Found** — your project ID is wrong. Check `$RESTORMEL_PROJECT_ID` against the dashboard.
- **404 no_route** — your project has no active route for the `environmentId` you sent. Create a route for that environment in Phase 3.

> **Resolve error codes (machine-readable)**  
> Successful resolves use `contractVersion` `2026-03-26` and include a `route` object (`id`, `environmentId`, `workload`, `stage`, `enabled`, `version`, `publishedVersion`), non-null `providerType` / `modelId`, and `stepChain`. On failure, read JSON `error`: `unauthorized` (401), `no_route` (404), `route_unpublished` (409), `route_disabled` (403), `policy_blocked` (403, with `violations`), `no_key_available` (422), `resolve_incomplete` (422). See [From resolve to execution](/keys/docs/guides/resolve-to-execution-contract) for SOPHIA-style discovery (`GET .../routes` + `workload`/`stage` without hardcoded route IDs).

> **If you see "no_key_available"**
> Your route matched but has no enabled step to select (for example: you have not configured steps yet or all steps are disabled). Create a route with at least one enabled step (Phase 3) and publish it. If you only want Restormel to choose a route while you supply provider credentials in your own app, use local resolve (Step 2.6) instead of the dashboard resolve endpoint.

---

## Step 2.3 — Create a typed resolve client

Add a small server-side module that calls the resolve endpoint. This becomes the single place your app asks Restormel for routing decisions.

**Next.js / generic Node (TypeScript):**

```ts
// src/lib/server/restormel.ts

interface ResolveRequest {
  environmentId: string;
  routeId?: string;
}

interface ResolveResponse {
  data: {
    routeId: string;
    providerType: string | null;
    modelId: string | null;
    explanation: string;
  };
}

const RESTORMEL_BASE_URL = process.env.RESTORMEL_BASE_URL
  ?? 'https://restormel.dev/keys/dashboard';
const RESTORMEL_GATEWAY_KEY = process.env.RESTORMEL_GATEWAY_KEY ?? '';
const RESTORMEL_PROJECT_ID = process.env.RESTORMEL_PROJECT_ID ?? '';

export async function restormelResolve(
  request: ResolveRequest
): Promise<ResolveResponse> {
  const url = `${RESTORMEL_BASE_URL}/api/projects/${RESTORMEL_PROJECT_ID}/resolve`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESTORMEL_GATEWAY_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Restormel resolve failed (${res.status}): ${body.slice(0, 200)}`
    );
  }

  return res.json() as Promise<ResolveResponse>;
}
```

**SvelteKit:**

```ts
// src/lib/server/restormel.ts
// Same implementation as above — SvelteKit server modules use the same Node/fetch APIs.
// Import with: import { restormelResolve } from '$lib/server/restormel';
```

### You'll see

A new file at `src/lib/server/restormel.ts` (or equivalent). No UI changes. No behaviour changes yet.

### How to test

Import the function in a test or scratch script and call it:

```ts
// scripts/test-resolve.ts (run with tsx or ts-node)
import { restormelResolve } from '../src/lib/server/restormel';

const result = await restormelResolve({ environmentId: 'production' });
console.log('Resolved:', JSON.stringify(result, null, 2));
```

```bash
npx tsx scripts/test-resolve.ts
```

You should see the same JSON structure as the curl response from Step 2.2.

---

## Step 2.4 — Wire resolve into the feature flag

Connect the resolve client to the feature-flag branch you created in Phase 0 (Step 0.5). This is the moment your app can optionally route through Restormel — but still defaults to the old path.

```ts
// src/lib/server/resolve-provider.ts
import { USE_RESTORMEL_KEYS } from '../feature-flags';
import { restormelResolve } from './restormel';

interface ProviderDecision {
  provider: string;
  model: string | null;
  source: 'restormel' | 'legacy';
}

export async function resolveProvider(
  preferredModel?: string
): Promise<ProviderDecision> {
  if (USE_RESTORMEL_KEYS) {
    const result = await restormelResolve({
      environmentId: process.env.RESTORMEL_ENVIRONMENT_ID ?? 'production',
    });
    return {
      provider: result.data.providerType ?? (process.env.DEFAULT_AI_PROVIDER ?? 'openai'),
      model: result.data.modelId ?? preferredModel ?? null,
      source: 'restormel',
    };
  }

  // Legacy path — your existing routing logic
  return legacyResolve(preferredModel);
}

function legacyResolve(preferredModel?: string): ProviderDecision {
  // Your existing provider selection logic goes here.
  // This is a placeholder — replace with your actual legacy code.
  return {
    provider: process.env.DEFAULT_AI_PROVIDER ?? 'openai',
    model: preferredModel ?? process.env.DEFAULT_AI_MODEL ?? null,
    source: 'legacy',
  };
}
```

### You'll see

Your existing routing code still runs (the flag is `false`). The new path exists but is not active.

### How to test

**Test the legacy path (flag off — default):**

```bash
# Start your app normally
pnpm dev
# Make a request that triggers an AI call — it should behave identically to before
```

**Test the Restormel path (flag on — temporary):**

```bash
# Start with the flag enabled
USE_RESTORMEL_KEYS=true pnpm dev
# Make the same request — it should now resolve via Restormel
# Check your terminal/logs for the resolved provider
```

Turn the flag back off after testing. Production cutover happens in Phase 6.

> **Pitfall**
> If the Restormel path returns `no_key_available` and your app crashes, add error handling: catch the resolve error and fall back to the legacy path. This is your safety net during the parallel-run period.

---

## Step 2.5 — Add error handling and local fallback

The resolve call is a network request. It can fail (network error, Restormel downtime, misconfiguration). Your app should handle this gracefully.

```ts
// src/lib/server/resolve-provider.ts — updated resolveProvider

export async function resolveProvider(
  preferredModel?: string
): Promise<ProviderDecision> {
  if (USE_RESTORMEL_KEYS) {
    try {
      const result = await restormelResolve({
        environmentId: process.env.RESTORMEL_ENVIRONMENT_ID ?? 'production',
      });
      return {
        provider: result.data.providerType ?? (process.env.DEFAULT_AI_PROVIDER ?? 'openai'),
        model: result.data.modelId ?? preferredModel ?? null,
        source: 'restormel',
      };
    } catch (err) {
      console.error('[restormel] Resolve failed, falling back to legacy:', err);
      // Fall through to legacy path
    }
  }

  return legacyResolve(preferredModel);
}
```

### You'll see

If Restormel is unreachable or returns an error, your app logs the error and continues with the legacy routing path. No user-facing impact.

### How to test

Temporarily set an invalid Gateway Key and enable the flag:

```bash
RESTORMEL_GATEWAY_KEY=rk_invalid USE_RESTORMEL_KEYS=true pnpm dev
```

Make a request that triggers an AI call. You should see a console error like `[restormel] Resolve failed, falling back to legacy: Error: Restormel resolve failed (401)` and the request should succeed via the legacy path.

Restore your real Gateway Key after testing.

### Build-agent prompt: create-resolve-client

**Context docs** (adapt paths for your project): this page; Phase 0 (routing inventory, feature flag).

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Create a typed Restormel resolve client, wire it into the feature flag from Phase 0, and add error handling with legacy fallback.
>
> **Steps:**
>
> 1. Identify the legacy function that currently resolves which provider to call (from your routing inventory).
> 2. Create `src/lib/server/restormel.ts` (or equivalent) with:
>    - `ResolveRequest`: `{ environmentId: string; routeId?: string }`.
>    - `ResolveResponse`: `{ data: { routeId: string; providerType: string | null; modelId: string | null; explanation: string } }`.
>    - `restormelResolve(request)`: POST to `${RESTORMEL_BASE_URL}/api/projects/${RESTORMEL_PROJECT_ID}/resolve` with `Authorization: Bearer ${RESTORMEL_GATEWAY_KEY}` and JSON body. Throw on non-2xx with status and truncated body.
> 3. Create or update `src/lib/server/resolve-provider.ts`: if `USE_RESTORMEL_KEYS` is true, call `restormelResolve` in try/catch; on failure, log and fall through to legacy. Map `result.data.providerType` and `result.data.modelId` to your provider decision. If the flag is false or resolve failed, call legacy logic.
> 4. Add `RESTORMEL_BASE_URL=https://restormel.dev/keys/dashboard` to `.env.example`.
> 5. Create `scripts/test-resolve.ts`: call `restormelResolve({ environmentId: 'production' })` and log the result. Run with `npx tsx scripts/test-resolve.ts`.
> 6. Verify: flag off → app unchanged; flag on → resolves via Restormel; flag on + invalid key → fallback to legacy and log error.
>
> **DO NOT:** Set `USE_RESTORMEL_KEYS=true` as default. Log the Gateway Key or raw keys. Modify legacy logic. Commit real API keys or secrets.

**Gate:** Test script prints a valid resolve response with `data.providerType`. Flag off → unchanged behaviour. Flag on → Restormel path or legacy fallback. No secrets committed.

---

## Step 2.6 — (Optional) Use the npm package resolve middleware instead of HTTP

> **Deprecated path (2026-06):** `@restormel/keys` in-process resolve is maintenance-only until 2026-12-01. New integrations should use the Keys REST endpoint from Step 2.2–2.4. This section is kept for reference for existing apps already on `@restormel/keys`.

If your backend is Node/TypeScript and you are on an existing `@restormel/keys` integration and prefer to resolve locally (no HTTP call to the dashboard), you can use `createResolveMiddleware` from `@restormel/keys/server` directly. This uses the same routing engine but runs in-process.

This approach is useful if:
- You want zero added latency from a network call.
- You manage provider keys entirely in your own env vars (not in the dashboard).
- You don't need dashboard-configured routes and policies yet (you'll add them later via the API or manually).

```ts
// src/lib/server/restormel-local.ts
import { createKeys, openaiProvider, anthropicProvider, googleProvider } from '@restormel/keys';
import { createResolveMiddleware } from '@restormel/keys/server';
import type { ResolveContext } from '@restormel/keys/server';

const keys = createKeys(
  {
    keys: [],
    routing: {
      defaultProvider: 'openai',
      rules: ['openai', 'anthropic', 'google'], // fallback order
    },
  },
  {
    providers: [openaiProvider, anthropicProvider, googleProvider],
    getPlatformKey: (provider) => {
      // Look up provider keys from your own env vars
      const map: Record<string, string | undefined> = {
        openai: process.env.OPENAI_API_KEY,
        anthropic: process.env.ANTHROPIC_API_KEY,
        google: process.env.GOOGLE_AI_API_KEY,
      };
      return map[provider] ?? null;
    },
  }
);

export { keys };
```

This gives you the routing engine (BYOK → fallback chain → platform key) without a network call. You can migrate to the HTTP resolve path later when you want dashboard-managed routes and policies.

### You'll see

The same `ResolveResult` shape (`{ provider, model, source, keyId }`) but resolved locally.

### How to test

```ts
const result = await keys.resolve('openai', 'gpt-4o');
console.log(result);
// { provider: 'openai', model: 'gpt-4o', source: 'platform' }
```

> **Tip**
> You can start with local resolve (this step) and switch to HTTP resolve (Step 2.3) later when you're ready to use dashboard-managed routes and policies. The `resolveProvider` wrapper from Step 2.4 makes this a one-line change.

### Build-agent prompt: create-local-resolve

**Context docs** (adapt for your project): this page §2.6; `@restormel/keys` package (createKeys, provider definitions).

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Create a local Restormel Keys instance for in-process resolve (no HTTP call), as an alternative or precursor to the HTTP resolve client.
>
> **Steps:**
>
> 1. Create `src/lib/server/restormel-local.ts` (or equivalent).
> 2. Import `createKeys` and the provider definitions you need (`openaiProvider`, `anthropicProvider`, `googleProvider`) from `@restormel/keys`.
> 3. Configure `createKeys` with:
>    - `routing.defaultProvider` set to your primary provider.
>    - `routing.rules` set to your fallback order (array of provider IDs).
>    - `getPlatformKey` that reads provider API keys from your existing env vars (e.g. `process.env.OPENAI_API_KEY`).
> 4. Export the `keys` instance.
> 5. In `src/lib/server/resolve-provider.ts`, add the local resolve as a third option:
>    - If `USE_RESTORMEL_KEYS` and `USE_RESTORMEL_HTTP` (or similar flag): call HTTP resolve.
>    - If `USE_RESTORMEL_KEYS` only: call `keys.resolve(provider, model)` locally.
>    - Otherwise: legacy path.
> 6. Verify: `keys.resolve('openai', 'gpt-4o')` returns `{ provider: 'openai', model: 'gpt-4o', source: 'platform' }` when `OPENAI_API_KEY` is set.
>
> **DO NOT:**
> - Remove the HTTP resolve client from Step 2.3 — both paths should coexist.
> - Hardcode real API keys. Read from env vars.
> - Import UI packages (`@restormel/keys-svelte`, `@restormel/keys-react`) in server code.
> - Commit real API keys or secrets.

**Gate:** `keys.resolve()` returns a valid result with the correct provider and source. The feature flag still defaults to off. Both local and HTTP resolve paths are available.

---

## Checkpoint

You now have:

- A typed resolve client that calls the Restormel API (`src/lib/server/restormel.ts`).
- (Optional) A local resolve instance using the `@restormel/keys` core (`src/lib/server/restormel-local.ts`).
- A `resolveProvider` function that branches on the feature flag: Restormel path (with error fallback) or legacy path.
- A test script (`scripts/test-resolve.ts`) that confirms the resolve endpoint works.
- Error handling that falls back to legacy routing if Restormel is unreachable.

Your app still defaults to the legacy routing path. You've confirmed the Restormel path works when the flag is on.

**Next:** [Phase 3 — Add routes and fallbacks](/keys/docs/walkthrough/phase-3-routes) — configure multi-step routing in the dashboard so Restormel can fail over between providers automatically.
