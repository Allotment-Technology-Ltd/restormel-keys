# Example: resolve then AAIF-shaped execution (dev-time)

**Purpose:** Show the **recommended split** between Restormel Keys **HTTP resolve** (full `stepChain`, policies, contract version) and **`@restormel/aaif`** for typed request/response + optional **`routingContext`** / **`routingPlan`** carry fields — **without** embedding secrets.

## Pattern

1. **Server-side** (or trusted worker): call `POST {DASHBOARD_BASE}/keys/dashboard/api/projects/{projectId}/resolve` with a **Bearer** token (Gateway key or session). Never commit tokens; use env vars such as `RESTORMEL_KEYS_BASE` + `RESTORMEL_GATEWAY_KEY` in your own environment.
2. Read `data.providerType`, `data.modelId`, and optionally attach `data.stepChain` / `data` subsets to an **`AAIFRequest`** as **`routingPlan`** (types in `@restormel/aaif`) for logging or downstream agents.
3. Call your provider with the resolved model, or use **`executeAAIFRequest`** from `@restormel/aaif` for **routing + cost only** (the helper still does not call upstream LLMs by itself).

## Pseudocode (TypeScript)

Uses **`fetch`** against the dashboard resolve endpoint (no extra SDK surface required). Adjust types to your strictness; env vars stay **outside** the repo.

```typescript
import type { AAIFRequest, AAIFRoutingPlan } from "@restormel/aaif";

const base = process.env.RESTORMEL_KEYS_BASE!.replace(/\/$/, "");
const projectId = process.env.RESTORMEL_PROJECT_ID!;
const token = process.env.RESTORMEL_GATEWAY_KEY!;

const resolveRes = await fetch(`${base}/keys/dashboard/api/projects/${projectId}/resolve`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    environmentId: process.env.RESTORMEL_ENVIRONMENT_ID!,
    // routeId, workload, stage, attemptNumber, … optional — see OpenAPI / keys-routing-contract
  }),
});

const resolveJson = (await resolveRes.json()) as { error?: string; data?: Record<string, unknown> };
if (!resolveRes.ok || !resolveJson.data) throw new Error(resolveJson.error ?? "resolve_failed");

const data = resolveJson.data;

const routingPlan: AAIFRoutingPlan = {
  contractVersion: data.contractVersion as string,
  routeId: data.routeId as string,
  stepChain: data.stepChain as AAIFRoutingPlan["stepChain"],
};

const req: AAIFRequest = {
  input: "User prompt here",
  task: "chat",
  routing: {
    model: (data.modelId as string | undefined) ?? "gpt-4o-mini",
    provider: (data.providerType as string | undefined) ?? undefined,
  },
  routingContext: {
    routeId: data.routeId as string,
    workload: (data.route as { workload?: string } | undefined)?.workload,
    stage: (data.route as { stage?: string } | undefined)?.stage,
  },
  routingPlan,
};

// Host executes the upstream model (not shown). executeAAIFRequest(req, keys, { generate: ... }) covers cost/routing when using @restormel/keys locally instead of HTTP resolve.
```

## References

- Canonical contract: [docs/architecture/keys-routing-contract.md](../../docs/architecture/keys-routing-contract.md)
- Closed checkpoints (tool overlap, semver): [docs/guides/routing-implementation-checkpoints-closed.md](../../docs/guides/routing-implementation-checkpoints-closed.md)
- AAIF package: [packages/aaif/README.md](../../packages/aaif/README.md)
