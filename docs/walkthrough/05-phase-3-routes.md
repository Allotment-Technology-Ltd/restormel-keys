# Phase 3 — Add Routes and Fallbacks

> **Time:** ~20 minutes
> **Prerequisites:** [Phase 2](/keys/docs/walkthrough/phase-2-resolve) complete (resolve client works, feature flag wired)
> **You'll need:** Access to the [Dashboard](/keys/dashboard), your project and environment from Phase 1

This phase moves your routing decisions from "Restormel picks the default provider" to "Restormel evaluates a named route with multiple steps and fails over automatically." By the end, you have a fallback chain configured in the dashboard, and your resolve call returns results shaped by that chain.

---

## Step 3.1 — Understand routes and steps

A **route** is a named routing configuration inside your project. It contains one or more **steps**, evaluated in order. Each step specifies a provider preference and an optional model. The **route mode** controls how steps are evaluated.

```text
Route: "ingestion"
Mode:  fallback_chain

  Step 1 → OpenAI   (gpt-4o)       → try first
  Step 2 → Anthropic (claude-sonnet) → if step 1 fails
  Step 3 → Google    (gemini-2.5-pro) → if step 2 fails
```

When your backend calls resolve with `routeId: "ingestion"`, Restormel walks **enabled** steps in order. The first step that passes **policies** (Phase 4) is returned; blocked steps are skipped. There is no separate “provider health” probe in resolve today—proving fallback is usually **disable the first step** or **block it via policy**. Resolve returns **`vertex`** as `providerType` when the step uses Google internally (policies still use `google`).

Route modes available:

| Mode | Behaviour |
|------|-----------|
| `fallback_chain` | Try steps in order; return the first that resolves successfully |
| `user_preferred` | Use the user's preferred provider if a BYOK key exists, then fall back to the chain |

You can create multiple routes per project — for example, `ingestion` for background jobs and `interactive` for user-facing requests with different fallback priorities.

**Canonical routing contract (SOPHIA-class):** Resolve returns a **`stepChain`** (ordered tiers), optional **`fallbackCandidates`**, and a **`contractVersion`** (currently **`2026-04-14`**) with per-step metadata such as **`timeoutMs`**, **`retryPolicy`**, **`costPolicy`**, and **`switchCriteria`**. Ingestion pipelines can attach **`workload: "ingestion"`** and a **`stage`** (for example `ingestion_embedding`) on the route so resolve discovers the right rule without baking in internal UUIDs; use **`attemptNumber`** plus **`previousFailure`** so Keys advances past exhausted tiers. Full semantics: [docs/keys-routing-contract.md](../keys-routing-contract.md) — in-product mirror: [/keys/docs/guides/routing-contract](https://restormel.dev/keys/docs/guides/routing-contract).

---

## Step 3.2 — Create your first route in the Dashboard

> **Dashboard**
> Your project → **Routes** → **Create route**.

1. **Name:** Give the route a descriptive name (e.g. `ingestion`, `chat`, `interactive`). This becomes the `routeId` you pass to resolve.
2. **Route mode:** Select `fallback_chain`.
3. **Save** the route.

On the route detail page, use **Add step** to create ordered tiers (provider, model catalog id, fallback trigger, timeout). Expand a step to edit **label**, **switch criteria**, **retry policy**, and **cost policy** as JSON objects (validated as objects server-side; see **`docs/schemas/route-step-rich.schema.json`** for a reference shape). Optional **Ingestion workload** / **Ingestion stage** fields map the rule to SOPHIA-style resolve discovery.

You can still create or tweak steps with the Steps HTTP API (Step 3.4a) when automating from CI or scripts.

Adjust provider order and models to match your actual preferences. The example above is illustrative.

### You'll see

The route detail page in the dashboard showing your named route, mode, and the steps in order. Each step shows the provider, model, and fallback condition.

### How to test

No code change yet. Confirm the route appears in the dashboard and the steps are in the correct order.

---

## Step 3.3 — Resolve with the route ID

Update your resolve call to specify the route. This tells Restormel to evaluate that route's fallback chain instead of the project default.

**curl test:**

```bash
curl -X POST \
  "https://restormel.dev/keys/dashboard/api/projects/${RESTORMEL_PROJECT_ID}/resolve" \
  -H "Authorization: Bearer ${RESTORMEL_GATEWAY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "environmentId": "production", "routeId": "ingestion" }'
```

**In your resolve client (update the call site):**

```ts
// src/lib/server/resolve-provider.ts — updated
const result = await restormelResolve({
  environmentId: process.env.RESTORMEL_ENVIRONMENT_ID ?? 'production',
  routeId: 'ingestion',  // ← specify the route
});
```

> **Tip**
> You can make the `routeId` configurable per call site. For example, your ingestion pipeline passes `routeId: 'ingestion'` while your chat handler passes `routeId: 'interactive'`. This lets different parts of your app have different fallback strategies.

### You'll see

The resolve response now reflects the route's first available step:

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

The `data.routeId` matches the route you created. The `data.providerType` and `data.modelId` match the first enabled step.

### How to test

```bash
# Should return the first step's provider
curl -s -X POST \
  "https://restormel.dev/keys/dashboard/api/projects/${RESTORMEL_PROJECT_ID}/resolve" \
  -H "Authorization: Bearer ${RESTORMEL_GATEWAY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "environmentId": "production", "routeId": "ingestion" }' \
  | jq '.data.providerType, .data.modelId'
```

Expected output: `"openai"` and `"gpt-4o"` (or whatever your first step is).

Inspect the full chain in one response:

```bash
curl -s -X POST \
  "https://restormel.dev/keys/dashboard/api/projects/${RESTORMEL_PROJECT_ID}/resolve" \
  -H "Authorization: Bearer ${RESTORMEL_GATEWAY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "environmentId": "production", "routeId": "ingestion" }' \
  | jq '.data.contractVersion, .data.stepChain'
```

---

## Step 3.3a — Optional: resolve by ingestion workload and stage

If you created a route with **`workload`** `ingestion` and a non-null **`stage`** (for example `ingestion_extraction`), you can call resolve **without** `routeId` and let Keys pick the dedicated stage route, then fall back to a shared ingestion route whose **`stage`** is null:

```bash
curl -s -X POST \
  "https://restormel.dev/keys/dashboard/api/projects/${RESTORMEL_PROJECT_ID}/resolve" \
  -H "Authorization: Bearer ${RESTORMEL_GATEWAY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "production",
    "workload": "ingestion",
    "stage": "ingestion_extraction"
  }' | jq '.data.routeId, .data.stepChain[0].providerType'
```

Use the canonical doc for the full stage list and trust boundary vs your worker.

---

## Step 3.3b — Optional: simulate (dry-run diagnostics)

Dry-run one route’s selection and per-step policy hints (no upstream LLM execution in Keys):

```bash
ROUTE_ID="route_123"  # UUID from dashboard URL

curl -s -X POST \
  "https://restormel.dev/keys/dashboard/api/projects/${RESTORMEL_PROJECT_ID}/routes/${ROUTE_ID}/simulate" \
  -H "Authorization: Bearer ${RESTORMEL_GATEWAY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "environmentId": "production", "includeStepDiagnostics": true }' \
  | jq '.data.contractVersion, .data.stepDiagnostics'
```

Set **`includeStepDiagnostics`** to **`false`** when you only need cost-style hints.

**Optional `routingAttempts`:** set **`includeRoutingAttempts`** to **`true`** on the same POST to receive a per–enabled-step list of hypothetical outcomes (`selected`, `blocked_by_policy`, `not_executable`, `not_selected`) for forensics—still no LLM execution in Keys.

**GitOps export:** **`GET …/routes/{routeId}/export`** returns a portable JSON bundle (`schemaVersion` **1.0.0**) of the route and ordered steps (see **`docs/schemas/route-graph-bundle.schema.json`**). MCP tool **`routing.export`** wraps the same GET.

**GitOps import:** **`POST …/routes/import`** applies that bundle (create, or body **`replaceRouteId`** to replace an existing route). MCP **`routing.import`** wraps the same POST.

**Agent explain chain:** **`GET …/routes/{routeId}/explain-chain`** returns route + ordered steps + policy bindings at workspace/project/environment/route (read-only). MCP **`routing.explain_chain`**.

---

## Step 3.4 — Test fallback behaviour

To confirm the fallback chain works, make the first step unusable and confirm resolve returns the next enabled step. Prefer **PATCH** on **`…/steps/{stepId}`** (disable the step or change order in the dashboard) instead of deleting rows when you want a reversible test.

### Step 3.4a — Create steps via the Steps API

You need the route's internal ID (from the dashboard URL when viewing the route). Then create steps:

```bash
ROUTE_ID="route_123"  # copy from dashboard route detail URL

# Step 1: OpenAI gpt-4o
curl -s -X POST \
  "https://restormel.dev/keys/dashboard/api/projects/${RESTORMEL_PROJECT_ID}/routes/${ROUTE_ID}/steps" \
  -H "Authorization: Bearer ${RESTORMEL_GATEWAY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "orderIndex": 0, "providerPreference": "openai", "modelId": "gpt-4o", "fallbackOn": "error", "enabled": true }'

# Step 2: Anthropic
curl -s -X POST \
  "https://restormel.dev/keys/dashboard/api/projects/${RESTORMEL_PROJECT_ID}/routes/${ROUTE_ID}/steps" \
  -H "Authorization: Bearer ${RESTORMEL_GATEWAY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "orderIndex": 1, "providerPreference": "anthropic", "modelId": "claude-sonnet-4-20250514", "fallbackOn": "error", "enabled": true }'
```

### Step 3.4b — Disable the first step and re-resolve

Temporarily disable (or delete) the first step so resolve returns the second step. Then call resolve again with the same route.

> **Tip**
> Use **PATCH** `…/routes/{routeId}/steps/{stepId}` with `{ "enabled": false }` to force the fallback path, then re-enable the step when finished.

### You'll see

The resolve response now returns the **second** step's provider:

```json
{
  "data": {
    "routeId": "route_123",
    "providerType": "anthropic",
    "modelId": "claude-sonnet-4-20250514",
    "explanation": "route=route_123 step=1 provider=anthropic model=claude-sonnet-4-20250514"
  }
}
```

Restormel skipped the first step (no valid OpenAI key) and fell through to Anthropic.

### How to test

```bash
# After removing the OpenAI credential
curl -s -X POST \
  "https://restormel.dev/keys/dashboard/api/projects/${RESTORMEL_PROJECT_ID}/resolve" \
  -H "Authorization: Bearer ${RESTORMEL_GATEWAY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "environmentId": "production", "routeId": "ingestion" }' \
  | jq '.data.providerType'
```

Expected: `"anthropic"` (or your second step's provider).

Re-enable (or re-create) the first step after testing.

> **Pitfall**
> If you want route resolution to depend on which platform keys are present in your app’s environment, use local resolve (Phase 2, Step 2.6) and implement `getPlatformKey`. Under **Connections** (`/keys/dashboard/integrations`), you can store a **hosted API key** (encrypted at rest when the deployment is configured) or a **non-secret credential reference** (vault label). The dashboard never echoes a full secret after save; see [keys-testing-onboarding.md](../keys-testing-onboarding.md) for the Keys + Testing path.


---

## Step 3.5 — Wire route IDs into your application

Now that routes work, make the route ID configurable in your resolve wrapper so different parts of your app can use different routes.

```ts
// src/lib/server/resolve-provider.ts — updated signature

export async function resolveProvider(
  options?: {
    routeId?: string;
    model?: string;
  }
): Promise<ProviderDecision> {
  if (USE_RESTORMEL_KEYS) {
    try {
      const result = await restormelResolve({
        environmentId: process.env.RESTORMEL_ENVIRONMENT_ID ?? 'production',
        routeId: options?.routeId,
      });
      return {
        provider: result.data.providerType ?? (process.env.DEFAULT_AI_PROVIDER ?? 'openai'),
        model: result.data.modelId ?? options?.model ?? null,
        source: 'restormel',
      };
    } catch (err) {
      console.error('[restormel] Resolve failed, falling back to legacy:', err);
    }
  }

  return legacyResolve(options?.model);
}
```

Call sites become:

```ts
// Ingestion pipeline
const decision = await resolveProvider({ routeId: 'ingestion' });

// Chat handler
const decision = await resolveProvider({ routeId: 'interactive', model: userSelectedModel });
```

### You'll see

No visible change yet (the flag is still off by default). When you test with the flag on, different call sites resolve through different routes.

### How to test

```bash
USE_RESTORMEL_KEYS=true pnpm dev
# Trigger an ingestion job — should resolve via the 'ingestion' route
# Trigger a chat request — should resolve via the 'interactive' route (if you created one)
```

### Build-agent prompt: wire-route-ids

**Context docs** (adapt paths for your project): this page; Phase 2 (resolve client and feature flag wrapper).

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Update the resolve wrapper to accept a `routeId` parameter so different parts of your app use different routes, then update all call sites.
>
> **Steps:**
>
> 1. Open `src/lib/server/resolve-provider.ts` (or equivalent — the file with the `resolveProvider` function from Phase 2).
> 2. Update the function signature to accept `options?: { routeId?: string; model?: string }` instead of (or in addition to) a bare `preferredModel` parameter.
> 3. Pass `options.routeId` through to `restormelResolve({ environmentId, routeId: options.routeId, model: options.model })`.
> 4. Read the routing inventory (`docs/restormel-integration/00-routing-inventory.md`) to identify every call site that resolves a provider.
> 5. Update each call site to pass an appropriate `routeId`:
>    - Background jobs / ingestion → `{ routeId: 'ingestion' }`
>    - User-facing chat / interactive → `{ routeId: 'interactive' }` (or `'chat'`, matching your dashboard route name)
>    - If only one route exists, all call sites can pass the same `routeId` or omit it (project default).
> 6. If different call sites need different routes, create the additional routes in the Dashboard (Routes → Create route) with appropriate steps.
> 7. Verify: with `USE_RESTORMEL_KEYS=true`, each call site resolves through its intended route.
>
> **DO NOT:**
> - Change the legacy path. It should still work when the flag is off.
> - Hardcode route IDs that don't exist in the dashboard. Create the route first, then reference it.
> - Remove the error handling / legacy fallback from Phase 2.
> - Commit real API keys or secrets.

**Gate:** Each call site passes a `routeId`. With the flag on, resolve returns the correct route's provider/model. With the flag off, the app behaves identically to before. Fallback works (remove a provider credential → resolve returns the next step's provider).

---

## Step 3.6 — (Optional) Create a second route for different use cases

If your app has distinct AI call patterns — for example, fast-and-cheap for autocomplete vs. powerful-and-expensive for analysis — create separate routes with different step orders and models.

**Example: `autocomplete` route**

| Step | Provider | Model | Fallback on |
|------|----------|-------|-------------|
| 1 | OpenAI | `gpt-4o-mini` | error |
| 2 | Google | `gemini-2.0-flash` | error |

**Example: `analysis` route**

| Step | Provider | Model | Fallback on |
|------|----------|-------|-------------|
| 1 | Anthropic | `claude-sonnet-4-20250514` | error |
| 2 | OpenAI | `gpt-4o` | error |
| 3 | Google | `gemini-2.5-pro` | error |

Create both in the Dashboard, then use the appropriate `routeId` in each call site.

### You'll see

Two (or more) routes in the dashboard, each with their own step order. Resolve calls with different `routeId` values return different providers.

### How to test

```bash
# Resolve with autocomplete route
curl -s -X POST \
  "https://restormel.dev/keys/dashboard/api/projects/${RESTORMEL_PROJECT_ID}/resolve" \
  -H "Authorization: Bearer ${RESTORMEL_GATEWAY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "environmentId": "production", "routeId": "autocomplete" }' \
  | jq '.data.providerType, .data.modelId'
# Expected: "openai", "gpt-4o-mini"

# Resolve with analysis route
curl -s -X POST \
  "https://restormel.dev/keys/dashboard/api/projects/${RESTORMEL_PROJECT_ID}/resolve" \
  -H "Authorization: Bearer ${RESTORMEL_GATEWAY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "environmentId": "production", "routeId": "analysis" }' \
  | jq '.data.providerType, .data.modelId'
# Expected: "anthropic", "claude-sonnet-4-20250514"
```

---

## Checkpoint

You now have:

- At least one named route in the Restormel Dashboard with multiple steps (fallback chain).
- Your resolve client passes a `routeId` so different parts of your app use different routing strategies.
- Fallback verified: removing a provider credential causes Restormel to return the next step's provider.
- (Optional) Multiple routes for different use cases (fast/cheap vs. powerful/expensive).

The feature flag is still off by default. When on, your app resolves through Restormel routes.

**Next:** [Phase 4 — Apply policies](/keys/docs/walkthrough/phase-4-policies) — add guardrails that constrain resolution (model allowlists, deprecation blocks, budget caps).
