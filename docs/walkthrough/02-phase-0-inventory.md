# Phase 0 — Inventory Your Routing

> **Time:** ~30 minutes (audit) + implementation time varies
> **Prerequisites:** Access to your app's codebase, a Restormel Keys account ([Sign in](https://restormel.dev/keys/dashboard/login))
> **You'll need:** Your app's source code, terminal access, familiarity with where your app calls AI providers today

---

## Before you begin

This walkthrough takes you from your current AI routing setup to a full Restormel Keys integration. By the end, your app uses Restormel for provider resolution, fallback routing, policy enforcement, and (optionally) embeddable UI for model selection and key management.

### What you'll build across all phases

| Phase | What you do | What you get |
|-------|------------|--------------|
| **0 — Inventory** | Audit and retire your custom routing | Clean separation; one place left to wire |
| **1 — Install** | Add packages, create a project in the dashboard | Working config, `keys doctor` passes |
| **2 — Resolve** | Make your first resolve call | Backend knows which provider + model to use |
| **3 — Routes** | Configure routes with fallback steps | Automatic failover when a provider is down |
| **4 — Policies** | Add allowlists, deprecation blocks, budget caps | Guardrails enforced before resolution |
| **5 — UI** | Embed ModelSelector and/or KeyManager | End-users choose models within your policy constraints |
| **6 — Go live** | Parallel run, cutover, verify | Production traffic through Restormel |

### Key terms

If these are unfamiliar, see the [Overview](/keys/docs/) page or the terms below. The most important for Phase 0:

- **Resolve** — asking Restormel which provider + model + key source to use for a request.
- **Route** — a named routing configuration in the dashboard; contains steps (a fallback chain).
- **Policy** — a rule that constrains resolution (e.g. "only allow these models").
- **Gateway Key** — the `rk_…` key your backend uses to authenticate to Restormel.

### Skip ahead

Already done some of this? Jump to the phase you need:

- Packages installed and project created → [Phase 2 — Resolve](/keys/docs/walkthrough/phase-2-resolve)
- Routes configured → [Phase 4 — Policies](/keys/docs/walkthrough/phase-4-policies)
- Coming from LiteLLM, Portkey, or OpenRouter → [Migration paths](/keys/docs/walkthrough/migration-paths)

---

## Why Phase 0 matters

Most apps that need Restormel Keys already have _something_ doing provider routing — even if it's a hardcoded `if/else` or a config file mapping models to providers. Phase 0 is about finding all of those pieces so you can retire them cleanly rather than running two routing systems in parallel indefinitely.

You are not deleting anything yet. You are making an inventory so the replacement in later phases is surgical.

---

## Step 0.1 — Identify your current routing surface

Search your codebase for the code that currently decides which AI provider and model to use for a given request.

**Look for:**

- Direct provider SDK imports (`openai`, `@anthropic-ai/sdk`, `@google/generative-ai`) — where are they called, and what decides _which_ one to call?
- Environment variables like `DEFAULT_MODEL`, `AI_PROVIDER`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` — who reads them and how do they affect routing?
- Custom router/gateway modules — any file named `router`, `provider`, `gateway`, `ai-client`, `model-selector`, or similar.
- Fallback logic — `try/catch` blocks that retry with a different provider on failure.
- Model selection UI — any dropdown, radio group, or settings page where users pick a model.
- BYOK settings — any UI or API where users paste their own provider API keys.

### You'll see

A list of files and modules. Organise them into three categories:

| Category | What it contains | Example |
|----------|-----------------|---------|
| **Routing logic** | Code that chooses provider/model | `src/lib/server/ai-router.ts`, `src/lib/ai/fallback.ts` |
| **Model selection UI** | Frontend components for model/provider choice | `src/components/ModelPicker.svelte`, `app/settings/page.tsx` |
| **BYOK / key management** | Storage, validation, or UI for user-provided API keys | `src/lib/server/byok.ts`, `src/components/KeySettings.tsx` |

### How to test

There's nothing to test yet — this is an audit. Confirm you can answer: "If I grep for every place my app decides which AI provider to call, these are the files."

> **Tip**
> Use your IDE’s “Find all references” on provider client constructors (e.g. `new OpenAI(...)`, `new Anthropic(...)`) to trace where provider choice happens. It’s often faster than searching for strings.

---

## Step 0.2 — Classify each piece: remove, keep, or wrap

For each item in your inventory, decide its fate:

| Decision | When to use it | Action |
|----------|---------------|--------|
| **Remove** | Custom routing logic that Restormel will replace entirely (fallback chains, provider health checks, model allowlists) | Mark for deletion in Phase 2+. Do not delete yet. |
| **Keep** | App-specific logic that Restormel does not own (billing, auth, session, orchestration/job logic, domain-specific pre/post-processing) | Leave untouched. |
| **Wrap** | Code that currently calls providers directly but should call Restormel resolve first, then call the provider with the resolved result | Refactor in Phase 2 to insert a resolve call before the provider call. |

### You'll see

An annotated version of your inventory. For example:

```text
REMOVE  src/lib/server/ai-router.ts        — custom fallback chain, replaced by Restormel routes
REMOVE  src/lib/server/model-allowlist.ts   — hardcoded model list, replaced by Restormel policies
KEEP    src/lib/server/billing/wallet.ts    — billing logic, not routing
KEEP    src/lib/server/ingestion/worker.ts  — job orchestration (but calls ai-router internally)
WRAP    src/lib/server/ingestion/worker.ts  — replace ai-router call with Restormel resolve
REMOVE  src/components/ModelPicker.svelte   — custom model UI, replaced by Restormel ModelSelector
WRAP    src/components/KeySettings.tsx       — BYOK UI, may replace with Restormel KeyManager or keep as wrapper
```

### How to test

Review your annotations with a second pair of eyes (or a coding agent). Confirm: every "REMOVE" item has a Restormel equivalent identified in the phases ahead. Every "KEEP" item genuinely has no routing responsibility.

> **Pitfall**
> Do not remove anything in this step. Phase 0 is audit-only. Deletion happens in Phase 2+ after the replacement is wired and tested.

---

## Step 0.3 — Document the current provider call pattern

Before you change anything, record how your app currently calls AI providers. This becomes your regression baseline.

Write down (or have a coding agent extract):

1. **Entry points:** Which functions/routes initiate an AI provider call? (e.g. `POST /api/chat`, ingestion worker, background job)
2. **Selection logic:** For each entry point, how is provider + model chosen today? (e.g. env var, user preference, hardcoded, fallback chain)
3. **Credential source:** Where does the API key come from? (e.g. env var, user BYOK from database, config file)
4. **Error handling:** What happens when a provider call fails? (e.g. retry same provider, fallback to different provider, return error to user)
5. **Observability:** Are provider calls logged? Do you track which provider/model was used, latency, cost?

### You'll see

A short document or code comment block that captures the current state. This is your "before" snapshot.

### How to test

Pick one entry point. Trace the request from "user action" to "provider API call" and back. Confirm your documentation matches reality.

### Build-agent prompt: inventory-current-routing

**Context docs** (use in the Restormel Keys repo or adapt paths for your project):

- `docs/walkthrough/02-phase-0-inventory.md` — this page (the audit framework)
- `docs/02-architecture.md` — §1 "Framework compatibility" and §2 "Package structure" (understand what Restormel replaces)

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Audit the codebase to produce a routing inventory for Restormel Keys integration.
>
> **Steps:**
>
> 1. Search for all AI provider SDK imports (`openai`, `@anthropic-ai/sdk`, `@google/generative-ai`, or equivalent). List every file that creates a provider client or calls a completion/chat endpoint.
> 2. For each file found, trace backwards: what decides which provider and model to use? List the routing/selection logic files.
> 3. Search for model selection UI (dropdowns, selectors, settings pages that let users choose a model or provider). List those components.
> 4. Search for BYOK / key management code (where users paste or store their own provider API keys). List those files.
> 5. For each item, classify as REMOVE (Restormel replaces it), KEEP (app-specific, not routing), or WRAP (insert Restormel resolve before the existing provider call).
> 6. Document the current provider call pattern for at least one primary entry point: entry point → selection logic → credential source → provider call → error handling.
> 7. Write the results to `docs/restormel-integration/00-routing-inventory.md` (or your equivalent docs folder).
>
> **DO NOT:**
> - Delete or modify any existing code. This is audit-only.
> - Commit real API keys or secrets in the inventory document.
> - Guess about routing logic — trace the actual code paths.

**Gate:** A routing inventory document exists that lists every routing/selection/BYOK file, classifies each as REMOVE/KEEP/WRAP, and documents at least one end-to-end provider call pattern.

---

## Step 0.4 — Plan the replacement sequence

Based on your inventory, plan which walkthrough phases address which items:

| Inventory item | Replaced by | Walkthrough phase |
|----------------|------------|-------------------|
| Custom fallback chain | Restormel routes + steps | Phase 3 |
| Hardcoded model allowlist | Restormel policies (model_allowlist) | Phase 4 |
| Provider selection logic | Restormel resolve call | Phase 2 |
| Model picker UI | Restormel ModelSelector component | Phase 5 |
| BYOK settings UI | Restormel KeyManager component (or keep as wrapper) | Phase 5 |
| Provider API key env vars | Restormel Gateway Key + provider credentials in dashboard | Phase 1 |

### You'll see

A mapping table specific to your app. Not every row will apply — some apps have no BYOK, some have no fallback logic.

### How to test

Walk through each row and confirm: "When Phase N is complete, this inventory item will be retired." If any item has no corresponding phase, it either belongs in "KEEP" or you need to identify which phase handles it.

---

## Step 0.5 — Set up a feature flag (optional but recommended)

If your app supports feature flags, create one now: `USE_RESTORMEL_KEYS` (or equivalent). This lets you run old and new routing in parallel during Phases 2–6 and roll back instantly if something breaks.

```ts
// src/lib/feature-flags.ts
export const USE_RESTORMEL_KEYS = process.env.USE_RESTORMEL_KEYS === 'true';
```

In your routing code, the eventual pattern will be:

```ts
// src/lib/server/resolve-provider.ts
import { USE_RESTORMEL_KEYS } from '../feature-flags';

export async function resolveProvider(request: AIRequest) {
  if (USE_RESTORMEL_KEYS) {
    // New path: call Restormel resolve
    return await restormelResolve(request);
  }
  // Old path: existing custom routing
  return await legacyRouter.resolve(request);
}
```

You'll wire `restormelResolve` in Phase 2. For now, the flag just exists.

### You'll see

A feature flag that defaults to `false`. Your app behaves identically to before.

### How to test

```bash
# Confirm the flag defaults to off
echo $USE_RESTORMEL_KEYS  # should be empty or unset

# Confirm your app starts normally with the flag file added
pnpm dev  # or your start command
```

### Build-agent prompt: add-feature-flag

**Context docs** (adapt paths for your project):

- This page — §0.5 feature flag pattern
- Phase 2 — where the flag gets used for the resolve call
- Phase 6 — where the flag gets flipped to `true` for production

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Add a feature flag `USE_RESTORMEL_KEYS` to gate the Restormel Keys integration.
>
> **Steps:**
>
> 1. Create a feature flags module (e.g. `src/lib/feature-flags.ts` or the equivalent for your framework) that exports `USE_RESTORMEL_KEYS`, reading from `process.env.USE_RESTORMEL_KEYS` and defaulting to `false`.
> 2. Identify the primary function(s) that currently resolve which AI provider to call (from the routing inventory in `docs/restormel-integration/00-routing-inventory.md`).
> 3. In each of those functions, add a conditional branch: if `USE_RESTORMEL_KEYS` is true, call a placeholder `restormelResolve()` function (which throws "not yet implemented" for now); otherwise, call the existing logic unchanged.
> 4. Add `USE_RESTORMEL_KEYS=false` to `.env.example` (not `.env`).
> 5. Verify the app starts and behaves identically with the flag unset.
>
> **DO NOT:**
> - Set the flag to `true` yet. That happens in Phase 6.
> - Modify any existing routing logic. Only add the conditional branch around it.
> - Implement `restormelResolve` yet. It's a placeholder that throws.
> - Commit real API keys or secrets.

**Gate:** App starts with no behaviour change. A `USE_RESTORMEL_KEYS` env var exists in `.env.example`. The conditional branch is in place but the old path runs by default.

---

## Checkpoint

You now have:

- A routing inventory listing every file that participates in AI provider selection, model choice, and BYOK.
- Each item classified as REMOVE, KEEP, or WRAP.
- A documented "before" snapshot of at least one provider call pattern.
- A replacement mapping showing which walkthrough phase handles each inventory item.
- (Optional) A feature flag ready to gate the new routing path.

Nothing has been deleted or changed. Your app runs exactly as before.

**Next:** [Phase 1 — Install and configure](/keys/docs/walkthrough/phase-1-install) — add the Restormel Keys packages, create a project in the dashboard, and run `keys doctor`.
