---
title: AAIF verified-context integration guide
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-11
last-reviewed: 2026-06-11
review-interval: P12M
---

# AAIF verified-context integration guide

**Audience:** LangChain / LlamaIndex / custom-orchestrator authors who want to consume
Restormel's verified-claim envelopes without the MCP server.

**Requires:** `@restormel/aaif >= 0.0.19`, `@restormel/keys >= 0.1.0`.

---

## What this enables

When you retrieve context from **Connect v1**, each returned claim carries a full
verification chain: EBV state (`supported | inferred | unverified | contradicted |
excluded`), bound evidence spans with source hashes, an entailment judgment (model +
confidence + timestamp), and a provenance trace link. Starting with
`@restormel/aaif@0.0.19`, you can thread these envelopes through your AAIF
request/response so any agent framework can inspect them without a separate Connect API
roundtrip.

See also:
- [`docs/decisions/aaif-envelope-placement.md`](../decisions/aaif-envelope-placement.md)
  for the ADR that decided this placement.
- [`/keys/docs/guides/verified-context`](https://restormel.dev/keys/docs/guides/verified-context)
  for the pipeline fail-safe gates, G2 bar, trace export, and the auditor's guide.
- [`packages/aaif/README.md`](../../packages/aaif/README.md) for general AAIF usage.

---

## Install

```bash
pnpm add @restormel/aaif @restormel/keys
```

---

## Pattern: LangChain-style retrieve-then-generate

This shows how a LangChain (or any retrieval-augmented generation) integration reads
verified claims from Connect v1 and propagates the verification metadata through an AAIF
request/response.

```ts
import { createKeys, openaiProvider } from "@restormel/keys";
import {
  executeAAIFRequest,
  buildVerifiedContextInput,
  buildVerifiedContextOutput,
  allClaimsSupported,
  hasContradictedClaims,
  getSupportedClaims,
  isAAIFVerifiedClaimEnvelope,
} from "@restormel/aaif";
import type {
  AAIFVerifiedClaimEnvelope,
  AAIFRequest,
  AAIFResponse,
} from "@restormel/aaif";

// ---------------------------------------------------------------------------
// Step 1: fetch verified claims from Connect v1
// ---------------------------------------------------------------------------

async function retrieveVerifiedClaims(query: string): Promise<{
  claims: AAIFVerifiedClaimEnvelope[];
  traceRef: string | null;
}> {
  const res = await fetch("https://your-workspace.restormel.dev/connect/v1/retrieve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESTORMEL_GATEWAY_KEY}`,
    },
    body: JSON.stringify({ query, mode: "strict" }),
  });

  if (!res.ok) throw new Error(`Connect retrieve failed: ${res.status}`);

  const data = await res.json();
  // data.claims is VerifiedClaimEnvelope[] — validate for safety
  const claims: AAIFVerifiedClaimEnvelope[] = (data.claims ?? []).filter(
    isAAIFVerifiedClaimEnvelope,
  );
  return { claims, traceRef: data.trace_ref ?? null };
}

// ---------------------------------------------------------------------------
// Step 2: build a prompt that cites the verified claims
// ---------------------------------------------------------------------------

function buildCitedPrompt(
  userQuery: string,
  claims: AAIFVerifiedClaimEnvelope[],
): string {
  const contextBlock = claims
    .map(
      (c, i) =>
        `[${i + 1}] "${c.claim.text}"` +
        (c.citation ? ` (Source: ${c.citation})` : "") +
        ` [state: ${c.state}]`,
    )
    .join("\n");

  return (
    `Answer the question using ONLY the verified context below.\n` +
    `Cite claim numbers in your answer.\n\n` +
    `Context:\n${contextBlock}\n\n` +
    `Question: ${userQuery}`
  );
}

// ---------------------------------------------------------------------------
// Step 3: execute via AAIF runtime
// ---------------------------------------------------------------------------

const keys = createKeys(
  {
    routing: { defaultProvider: "openai" },
    keys: [{ id: "k1", provider: "openai" }],
  },
  { providers: [openaiProvider] },
);

async function verifiedGenerate(userQuery: string): Promise<AAIFResponse> {
  const { claims, traceRef } = await retrieveVerifiedClaims(userQuery);

  // Optional guard: refuse to answer if any claim is contradicted.
  if (hasContradictedClaims({ claims })) {
    throw new Error("Contradicted claims in context — refusing to answer.");
  }

  const request: AAIFRequest = {
    input: buildCitedPrompt(userQuery, claims),
    task: "chat",
    routing: { model: "gpt-4o-mini" },
    constraints: { maxCost: 0.05 },
    // Thread the verified context through the request so routing/audit logs
    // have provenance metadata.
    verifiedContext: buildVerifiedContextInput(claims, traceRef),
  };

  // Replace the generate callback with your real LLM client:
  const response = await executeAAIFRequest(request, keys, {
    generate: async (ctx) => {
      // Call your LLM here. Example (OpenAI SDK):
      //   const completion = await openai.chat.completions.create({ ... });
      //   return completion.choices[0].message.content ?? "";
      return `[stub output for model=${ctx.model}, cost=${ctx.cost.toFixed(4)}]`;
    },
  });

  // Attach the verified context to the response so downstream consumers can
  // inspect which claims grounded this answer without a Connect roundtrip.
  response.verifiedContext = buildVerifiedContextOutput(claims, traceRef);

  return response;
}

// ---------------------------------------------------------------------------
// Step 4: consume the response — read verification metadata
// ---------------------------------------------------------------------------

const response = await verifiedGenerate("What is Restormel's quality bar?");

console.log("Output:", response.output);
console.log("Model:", response.model, "| Cost:", response.cost);

// Read verification metadata from the response
const supported = getSupportedClaims(response);
console.log(`Supported claims in context: ${supported.length}`);

if (response.verifiedContext) {
  console.log("Verification summary:", response.verifiedContext.summary);
  // e.g. { supported: 3, inferred: 1 }

  for (const claim of supported) {
    console.log(
      `  ✓ ${claim.claim.text} (confidence: ${claim.judge?.confidence ?? "n/a"})`,
    );
    if (claim.trace_ref) {
      console.log(`    Trace: https://your-workspace.restormel.dev${claim.trace_ref}`);
    }
  }
}
```

---

## Pattern: gate on verification state before responding

Use `allClaimsSupported` as a strict gate when your application must not answer from
unverified evidence:

```ts
import { allClaimsSupported, buildVerifiedContextInput } from "@restormel/aaif";

const { claims, traceRef } = await retrieveVerifiedClaims(query);

if (!allClaimsSupported({ claims })) {
  // Return a structured rejection rather than an unverified answer
  return {
    status: "insufficient_evidence",
    message: "Context contains non-supported claims. Refine your query.",
    summary: summariseVerifiedClaims(claims),
  };
}

// Proceed with generation only when all claims are evidence-bound + entailed
const request: AAIFRequest = {
  input: buildCitedPrompt(query, claims),
  verifiedContext: buildVerifiedContextInput(claims, traceRef),
};
```

---

## LlamaIndex pattern (same principle, different orchestrator)

```ts
import { filterClaimsByState, buildVerifiedContextOutput } from "@restormel/aaif";

// After your LlamaIndex retriever returns nodes, map them to AAIF envelopes:
const claims = llamaIndexNodes.map(nodeToAAIFEnvelope); // your mapping function

// Filter to only supported claims before injecting into context
const safeClaims = filterClaimsByState({ claims }, "supported");

// Attach to your AAIF response for downstream audit
const verifiedContext = buildVerifiedContextOutput(safeClaims, traceRef);
```

---

## Consuming from @restormel/contracts (Zod validation)

If your host already depends on `@restormel/contracts`, you can use the Zod schemas
for stricter validation of the envelopes coming from Connect v1:

```ts
// @restormel/aaif ships plain TypeScript types only (no Zod, zero extra deps).
// Use @restormel/contracts for Zod-validated parsing:
import { VerifiedClaimEnvelopeSchema } from "@restormel/contracts/verified-claim";

const parsed = VerifiedClaimEnvelopeSchema.safeParse(rawClaim);
if (!parsed.success) { /* handle validation error */ }

// Then cast to the AAIF type — the shapes are intentionally identical:
import type { AAIFVerifiedClaimEnvelope } from "@restormel/aaif";
const claim = parsed.data as AAIFVerifiedClaimEnvelope;
```

---

## Reference: exported API (0.0.19)

**Types** (all plain TypeScript — no Zod at runtime):

| Type | Description |
|---|---|
| `AAIFVerifiedClaimState` | `"supported" \| "inferred" \| "unverified" \| "contradicted" \| "excluded"` |
| `AAIFVerifiedClaimEvidence` | Quote + offsets + source_ref + source_hash + match |
| `AAIFVerifiedClaimJudge` | model + prompt_version + confidence + at |
| `AAIFVerifiedClaimEnvelope` | Full per-claim envelope (mirrors `VerifiedClaimEnvelope` in `@restormel/contracts`) |
| `AAIFVerifiedContextInput` | Carries `claims[]` on `AAIFRequest.verifiedContext` |
| `AAIFVerifiedContextOutput` | Carries `claims[] + summary` on `AAIFResponse.verifiedContext` |

**Validators:**

| Function | Validates |
|---|---|
| `isAAIFVerifiedClaimEnvelope(x)` | Single claim envelope |
| `isAAIFVerifiedContextInput(x)` | Request-side context block |
| `isAAIFVerifiedContextOutput(x)` | Response-side context block |

**Runtime helpers:**

| Function | Purpose |
|---|---|
| `buildVerifiedContextInput(claims, traceRef?)` | Build `AAIFVerifiedContextInput` |
| `buildVerifiedContextOutput(claims, traceRef?)` | Build `AAIFVerifiedContextOutput` with auto summary |
| `summariseVerifiedClaims(claims)` | Per-state count map |
| `filterClaimsByState(ctx, state)` | Subset by state |
| `allClaimsSupported(ctx)` | Gate: all claims must be `"supported"` |
| `hasContradictedClaims(ctx)` | Check for `"contradicted"` state |
| `getRequestVerifiedContext(req)` | Read `verifiedContext` from request |
| `getResponseVerifiedContext(res)` | Read `verifiedContext` from response |
| `getSupportedClaims(res)` | Convenience: filter response claims to `"supported"` |
