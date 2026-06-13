# Phase 4 — Apply Policies

> **Time:** ~20 minutes
> **Prerequisites:** [Phase 3](/keys/docs/walkthrough/phase-3-routes) complete (at least one route with steps configured, resolve returns route-aware results)
> **You'll need:** Access to the [Dashboard](/keys/dashboard), your project from Phase 1

This phase adds guardrails around resolution. Policies constrain which models and providers can be returned, block deprecated models, and cap spend. By the end, resolve is filtered through policies, and you can prove it with evaluate + resolve.

---

## Terminology

| Term | Meaning |
|------|---------|
| **Evaluate** | Hypothetical check: would this `modelId` / `providerType` (and optional route context) pass all bound policies? Returns `allowed` + `violations`. Does **not** run route resolution. |
| **Resolve** | Route execution: first **enabled** step in order that passes the same policy rules. |
| **Policy binding** | Attachment of a policy to a **target** (workspace, project, environment, route). |
| **Scope** | Usually which target you bind to (e.g. project-wide vs one environment). |
| **Restormel step fallback** | Next enabled step when the current step is blocked by policy. |
| **App legacy fallback** | Your app’s non-Restormel routing when resolve fails — **not** the same as step fallback. |
| **policy_blocked** | HTTP **403** from resolve when every enabled step fails policies; JSON body includes `violations`. |

---

## Step 4.1 — Understand policy types

Resolve uses **enabled-step order with policy filtering**: tries each enabled step in order; first that passes all policies wins. No provider health probing. If all steps fail → `policy_blocked`.

| Policy type | What it does |
|-------------|-------------|
| `model_allowlist` | Only listed models can pass |
| `model_denylist` | Listed models blocked |
| `provider_allowlist` / `provider_denylist` | Provider allow/deny |
| `deprecated_model_block` | Blocks deprecated/retired catalog models |
| `budget_cap` | Monthly cap on summed `estimated_cost` in request_logs (per binding scope) |
| `token_cap` | Monthly cap on input+output tokens in request_logs |

Policies **stack**: every bound policy must pass. Resolve returns `data.providerType` as **`vertex`** when the step uses Google internally; policies still use provider type **`google`**.

---

## Step 4.2 — Create a model allowlist

> **Dashboard** — Project → **Policies** → **Create policy**.

1. **Type:** `model_allowlist`
2. **Scope:** Project (typical)
3. **Models:** Pick each **model ID from your live catalog** (Dashboard → Models or `GET /api/models`). Example IDs in older docs are **not** guaranteed in your deployment.
4. **Save.** If bindings are not available in the UI, use the Policies API.

### How to test

- Route with first step blocked by allowlist, second allowed → **200**, `data.modelId` from second step.
- All steps blocked → **403**, `error: "policy_blocked"`, `violations` populated.

---

## Step 4.3 — Deprecated-model block + evaluate

> **Dashboard** — Create `deprecated_model_block` at project scope.

**Security:** Do not call `/api/policies/*` from the browser with a Gateway Key. Call from **backend** (key in env) or use session in dashboard.

### Evaluate response (200)

```json
{
  "data": {
    "allowed": true,
    "violations": []
  }
}
```

Each violation: `policyId`, `policyName`, `type`, `message`.

### curl (replace placeholders from your catalog)

```bash
curl -s -X POST \
  "https://restormel.dev/keys/dashboard/api/policies/evaluate" \
  -H "Authorization: Bearer ${RESTORMEL_GATEWAY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "'${RESTORMEL_PROJECT_ID}'",
    "environmentId": "YOUR_ENV_ID",
    "modelId": "PICK_FROM_CATALOG",
    "providerType": "openai"
  }' | jq '.data'
```

### Minimal backend helper (server-only)

```ts
const base = process.env.RESTORMEL_KEYS_BASE ?? "https://restormel.dev";

export async function evaluatePoliciesRemote(input: {
  projectId: string;
  environmentId?: string;
  routeId?: string;
  modelId?: string;
  providerType?: string;
}) {
  const key = process.env.RESTORMEL_GATEWAY_KEY;
  if (!key) throw new Error("RESTORMEL_GATEWAY_KEY is not set");
  const res = await fetch(`${base}/keys/dashboard/api/policies/evaluate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = (await res.json()) as {
    data?: { allowed: boolean; violations: { policyId: string; policyName: string; type: string; message: string }[] };
    error?: string;
  };
  if (!res.ok) throw new Error(json.error ?? `evaluate HTTP ${res.status}`);
  return json.data!;
}
```

---

## Step 4.4 — Budget / token caps

Enforcement uses **request_logs** for the bound scope over the **current calendar month**.

**Success criteria (choose what matches you):**

1. **Config only** — Policy + binding exist (API or dashboard).
2. **Evaluate** — Under cap → allowed; over cap (e.g. very low `limit` or logs with cost/tokens) → `budget_cap` / `token_cap` in `violations`.
3. **Resolve** — Same rules as other policies (step skip or `policy_blocked`).

Without usage reporting, `estimated_cost` on logs may stay zero — **token_cap** is often easier to test than **budget_cap** until costs are reported.

---

## Step 4.5 — Stacking

With `model_allowlist` + `deprecated_model_block`, evaluate a model that is allowlisted **and** deprecated **in your catalog** (if any) → should be `allowed: false`, `violations[].type` includes `deprecated_model_block`. Use real catalog IDs only.

---

## Step 4.6 — Resolve errors (structured contract)

On **403** `policy_blocked`, body shape:

```json
{
  "error": "policy_blocked",
  "message": "All route steps were blocked by policy",
  "violations": [
    {
      "policyId": "…",
      "policyName": "…",
      "type": "model_allowlist",
      "message": "…"
    }
  ]
}
```

**Do not** classify failures only by `Error.message` from a thrown exception. **Parse `response.json()`** on non-2xx, branch on `error` and `violations[].type`. Log violation detail server-side; user-facing copy should be generic/safe.

Other resolve errors (e.g. **402** `usage_limit_reached`, **404** `no_route`) have different bodies — see Phase 2.

```ts
const res = await fetch(resolveUrl, { method: "POST", headers, body: JSON.stringify({ environmentId, routeId }) });
const body = await res.json().catch(() => ({} as Record<string, unknown>));
if (!res.ok) {
  const code = typeof body.error === "string" ? body.error : "unknown";
  const violations = Array.isArray(body.violations) ? body.violations : [];
  if (res.status === 403 && code === "policy_blocked") {
    // Classify by violations[].type — logs only; separate user message
  }
  return legacyResolve(); // app legacy fallback, not Restormel step fallback
}
```

---

## Agent prompts (handoff)

**4A — Review:** Plan only; no code.

**4C — Create and bind:** Create `model_allowlist`, `deprecated_model_block`, optional `budget_cap`; bind to project/environment; record policy IDs and binding targets; use catalog-backed model IDs only.

**4D — Verify:** Backend `evaluate` for allowed + blocked cases; `resolve` for step skip + `policy_blocked`; redacted evidence; restore test config.

**4B — Error handling:** Structured JSON on non-2xx; no substring-only classification.

---

## Checkpoint (strict)

Phase 4 is complete only if:

- Policies **created** and **bound**; targets documented.
- **Evaluate** run from backend: at least one allowed and one blocked case with `violations[].type` recorded.
- **Resolve** tested: step skip **or** `policy_blocked` when all steps fail.
- App parses **structured** resolve errors, not only thrown message text.

**Dashboard note:** Creation works; rule edits and bindings may require API — future “test policy” UI would reduce friction.

**Next:** [Phase 5 — Embed the UI](/keys/docs/walkthrough/phase-5-ui)
