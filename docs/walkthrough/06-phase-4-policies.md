# Phase 4 — Apply Policies

> **Time:** ~15 minutes
> **Prerequisites:** [Phase 3](/keys/docs/walkthrough/phase-3-routes) complete (at least one route with steps configured, resolve returns route-aware results)
> **You'll need:** Access to the [Dashboard](/keys/dashboard), your project from Phase 1

This phase adds guardrails around resolution. Policies constrain which models and providers can be returned, block deprecated models, and cap spend. By the end, your resolve calls are filtered through policies before returning a result, and you can test that policy violations are correctly rejected.

---

## Step 4.1 — Understand policy types

Policies are rules attached at the workspace, project, or environment level. They are evaluated during every resolve call. If a policy blocks the resolved model or provider, Restormel falls through to the next step in the route (or returns an error if no step passes).

| Policy type | What it does | Example |
|-------------|-------------|---------|
| `model_allowlist` | Only these models can be resolved | Allow `gpt-4o`, `claude-sonnet-4-20250514`, block everything else |
| `model_denylist` | These specific models are blocked | Block `gpt-3.5-turbo` (too old for your use case) |
| `provider_allowlist` | Only these providers can be resolved | Allow `openai` and `anthropic`, block `google` |
| `provider_denylist` | These specific providers are blocked | Block a provider with a compliance issue |
| `deprecated_model_block` | Block models marked as deprecated in the Restormel model catalog | Prevent resolution to models approaching end-of-life |
| `budget_cap` | Cap total spend per period | Max $500/month per environment |
| `token_cap` | Cap total tokens per period | Max 10M tokens/month |

Policies stack. If you have both a `model_allowlist` and a `budget_cap`, both must pass for a model to be resolved.

---

## Step 4.2 — Create a model allowlist

Start with the most common policy: restricting which models your app can use.

> **Dashboard**
> Your project → **Policies** → **Create policy**.

1. **Type:** `model_allowlist`
2. **Scope:** Project (applies to all environments and routes in this project)
3. **Models:** Add the models you want to allow. For example:
   - `gpt-4o`
   - `gpt-4o-mini`
   - `claude-sonnet-4-20250514`
   - `gemini-2.5-pro`
4. **Save** the policy.

### You'll see

The policy listed on the project's Policies page with the type, scope, and allowed models.

### How to test

Call resolve requesting a model that is **not** on the allowlist:

```bash
curl -s -X POST \
  "https://restormel.dev/keys/dashboard/api/projects/${RESTORMEL_PROJECT_ID}/resolve" \
  -H "Authorization: Bearer ${RESTORMEL_GATEWAY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "environmentId": "production", "routeId": "ingestion" }' \
  | jq '.'
```

**Expected:** The resolve returns `data.modelId` from the first enabled step that passes policies. If your route steps include a blocked model, resolve skips that step and returns the next allowed step.

> **Tip**
> The resolve endpoint does not take an arbitrary `model` override today. To test allowlisting deterministically, set a route step’s `modelId` to a blocked model, then confirm resolve skips it.


Call resolve with an allowed model:

```bash
curl -s -X POST \
  "https://restormel.dev/keys/dashboard/api/projects/${RESTORMEL_PROJECT_ID}/resolve" \
  -H "Authorization: Bearer ${RESTORMEL_GATEWAY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "environmentId": "production", "routeId": "ingestion" }' \
  | jq '.data.modelId'
```

**Expected:** One of your allowed models (e.g. `"gpt-4o"`).

---

## Step 4.3 — Add a deprecated-model block

This policy prevents your app from resolving to models that the Restormel model catalog has marked as approaching end-of-life. It's a safety net: even if a route step specifies a deprecated model, this policy blocks it and forces a fallback.

> **Dashboard**
> Your project → **Policies** → **Create policy**.

1. **Type:** `deprecated_model_block`
2. **Scope:** Project
3. **Save.** No additional configuration needed — the policy reads deprecation status from the model catalog automatically.

### You'll see

The policy listed on the Policies page. Its effect depends on whether any models in your routes are actually deprecated in the catalog.

### How to test

If you have a route step that specifies a model currently marked as deprecated, resolve should skip that step. If none of your models are deprecated, this policy has no visible effect yet — but it protects you when providers deprecate models in the future.

To verify the policy is active, use the **evaluate** endpoint:

> **Security**
> `/api/policies/*` endpoints are workspace-scoped and do **not** accept a project Gateway Key. Use a **Management Key** for server-to-server checks, or test from the dashboard UI (session cookie).

```bash
curl -s -X POST \
  "https://restormel.dev/keys/dashboard/api/policies/evaluate" \
  -H "Authorization: Bearer ${RESTORMEL_MANAGEMENT_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "'${RESTORMEL_PROJECT_ID}'",
    "environmentId": "production",
    "modelId": "gpt-4-0314",
    "providerType": "openai"
  }' \
  | jq '.data'
```

**Expected:** `data.allowed` is `false` when the model/provider combination is blocked by policies; `data.violations` explains why.

> **Tip**
> The evaluate endpoint is useful for testing policies without actually resolving. It tells you "would this model/provider combination pass all policies?" without executing a full route evaluation.

---

## Step 4.4 — Add a budget cap

Budget caps prevent unexpected spend. When the cap is reached for a period, resolve returns an error rather than allowing more requests.

> **Dashboard**
> Your project → **Policies** → **Create policy**.

1. **Type:** `budget_cap`
2. **Scope:** Environment (`production`)
3. **Limit:** Set a monthly limit in USD (e.g. `500`)
4. **Period:** `monthly`
5. **Save.**

### You'll see

The policy listed with the cap amount and period. Current spend tracking appears in the project's usage section.

### How to test

Budget caps take effect as usage accumulates. For immediate testing, set a very low cap (e.g. `$0.01`) and make a few resolve calls with tracked usage. Then call resolve again — it should fail with a budget error.

**Restore the cap to a realistic value after testing.**

> **Pitfall**
> Budget caps depend on usage tracking. The dashboard resolve endpoint logs resolutions, but it does not automatically know the cost of your provider call unless you also report usage back to Restormel. Until usage reporting is part of your integration, treat `budget_cap` as a config you can create and bind, and validate it primarily via evaluate and later via usage reporting.

---

## Step 4.5 — Test policy stacking

Policies stack: all active policies must pass for a model to be resolved. Verify this by having both a `model_allowlist` and a `deprecated_model_block` active, then evaluating a model that is on the allowlist but deprecated (if one exists).

```bash
curl -s -X POST \
  "https://restormel.dev/keys/dashboard/api/policies/evaluate" \
  -H "Authorization: Bearer ${RESTORMEL_MANAGEMENT_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "'${RESTORMEL_PROJECT_ID}'",
    "environmentId": "production",
    "modelId": "gpt-4o",
    "providerType": "openai"
  }' \
  | jq '.data'
```

**Expected:** `gpt-4o` is on the allowlist and not deprecated → allowed. A model that's on the allowlist but deprecated → blocked by the deprecation policy.

### You'll see

The evaluate response shows which policies passed and which blocked.

### How to test

Test with several model/provider combinations to confirm the intersection of your policies behaves as expected.

---

## Step 4.6 — Handle policy errors in your resolve wrapper

When all route steps are blocked by policies, Restormel returns an error. Your resolve wrapper (from Phase 2) already catches errors and falls back to legacy. Add specific handling for policy errors so you can log or alert on them.

```ts
// src/lib/server/resolve-provider.ts — updated error handling

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
  const message = err instanceof Error ? err.message : String(err);

  if (message.includes('budget') || message.includes('cap')) {
    console.error('[restormel] Budget cap reached:', message);
    // Optionally: alert, notify, or return a specific error to the user
  } else if (message.includes('no_key_available')) {
    console.warn('[restormel] No provider key available for route');
  } else {
    console.error('[restormel] Resolve failed:', message);
  }

  // Fall through to legacy
}
```

### Build-agent prompt: add-policies-and-error-handling

**Context docs** (adapt paths for your project): this page (policy types, evaluate endpoint, error handling); Phase 2 (resolve client and error handling).

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Update the resolve error handling to distinguish policy errors (budget cap, model blocked) from network/auth errors, and add appropriate logging or user-facing responses.
>
> **Steps:**
>
> 1. Open `src/lib/server/resolve-provider.ts` (or equivalent).
> 2. In the `catch` block for the Restormel resolve call, parse the error message for known policy error patterns:
>    - `budget` or `cap` → budget cap reached (log as error, optionally return a user-friendly "quota exceeded" response).
>    - `no_key_available` → no provider could be resolved (log as warning).
>    - `deprecated` or `blocked` → model blocked by policy (log as warning).
>    - Anything else → generic resolve failure (log as error).
> 3. For budget cap errors, optionally add an alert mechanism (e.g. send a notification, emit a metric) so you're notified before production requests start failing.
> 4. For all policy errors, the function still falls through to the legacy path (existing behaviour from Phase 2).
> 5. Add a comment in the code referencing the policy types and evaluate endpoint for future maintainers.
> 6. Verify: with `USE_RESTORMEL_KEYS=true` and a low budget cap set in the dashboard, the budget error is caught and logged, and the legacy fallback runs.
>
> **DO NOT:**
> - Change the legacy fallback logic.
> - Remove the generic error handling from Phase 2.
> - Expose raw Restormel error messages to end-users. Translate them into user-friendly messages.
> - Commit real API keys or secrets.

**Gate:** Policy errors (budget, blocked model) are logged distinctly from generic errors. The legacy fallback still runs on any Restormel failure. No raw error details leak to end-users.

---

## Checkpoint

You now have:

- A `model_allowlist` policy constraining which models can be resolved.
- A `deprecated_model_block` policy preventing resolution to end-of-life models.
- (Optional) A `budget_cap` policy limiting spend per environment per period.
- Policy error handling in your resolve wrapper that distinguishes budget, blocked, and generic errors.
- The evaluate endpoint as a tool for testing policy combinations without executing a full resolve.

Policies are active on the Restormel side. Your app handles policy errors gracefully and falls back to legacy when needed.

**Next:** [Phase 5 — Embed the UI](/keys/docs/walkthrough/phase-5-ui) — add ModelSelector and KeyManager to your app so end-users can choose models and manage their own provider credentials.
