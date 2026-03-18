# Phase 6 — Go Live

> **Time:** ~30 minutes (cutover) + monitoring period
> **Prerequisites:** [Phase 5](/keys/docs/walkthrough/phase-5-ui) complete (resolve, routes, policies, and UI all working with the feature flag on in development)
> **You'll need:** Access to your deployment pipeline, monitoring/logging, the [Dashboard](/keys/dashboard)

This phase moves your Restormel Keys integration from development into production traffic. The strategy is conservative: parallel run, phased traffic shift, verify, then cut over fully. By the end, your production app resolves through Restormel and the legacy routing code is retired.

---

## Step 6.1 — Pre-cutover checklist

Before enabling the feature flag in production, verify everything works in a staging or preview environment.

| Check | How to verify | Pass? |
|-------|--------------|-------|
| Resolve works | `USE_RESTORMEL_KEYS=true` in staging; make AI requests; confirm correct provider/model | ☐ |
| Fallback works | Remove a provider credential in dashboard; confirm resolve returns next step | ☐ |
| Policy enforcement works | Request a blocked model; confirm it's rejected or falls through | ☐ |
| Error fallback works | Set invalid Gateway Key; confirm legacy routing takes over | ☐ |
| ModelSelector renders | Open settings page; confirm component loads and selection works | ☐ |
| (If BYOK) KeyManager works | Add/remove a test key; confirm callbacks fire | ☐ |
| `keys doctor` passes | Run `npx @restormel/doctor` in the staging env | ☐ |
| `keys validate` passes | Run `npx @restormel/validate` to re-check stored keys | ☐ |
| No secrets committed | Run `scripts/check-secrets.sh` or `git log --diff-filter=A -- '*.env'` | ☐ |
| Dashboard logs show requests | Check the project's usage/logs section in the dashboard | ☐ |
| **Observed model matches actual route** | Logs, verify endpoints, and extraction pipelines report the **same** provider/model the request used (not a default env label). Fix hardcoded metadata before full cutover. | ☐ |

> **Pitfall**
> Do not skip the error fallback check. The most dangerous production failure mode is Restormel being unreachable and your app not falling back to legacy. Confirm this works before proceeding.

---

## Step 6.2 — Enable the flag for a small percentage (parallel run)

If your app supports percentage-based rollout (e.g. via LaunchDarkly, Vercel Edge Config, Cloudflare Workers, or a simple random check), start with a small percentage of traffic using Restormel.

```ts
// src/lib/feature-flags.ts — updated for percentage rollout

const RESTORMEL_ROLLOUT_PERCENT = parseInt(
  process.env.RESTORMEL_ROLLOUT_PERCENT ?? '0',
  10
);

export const USE_RESTORMEL_KEYS =
  process.env.USE_RESTORMEL_KEYS === 'true' ||
  (RESTORMEL_ROLLOUT_PERCENT > 0 && Math.random() * 100 < RESTORMEL_ROLLOUT_PERCENT);
```

**Rollout sequence:**

| Step | `RESTORMEL_ROLLOUT_PERCENT` | What to watch |
|------|-----------------------------|---------------|
| 1 | `5` | Errors in logs, latency increase, correct provider in responses |
| 2 | `25` | Same, at higher volume |
| 3 | `50` | Compare Restormel path vs legacy path outcomes |
| 4 | `100` | Full traffic through Restormel |

If you don't have percentage-based rollout, use the boolean flag: `USE_RESTORMEL_KEYS=true` for the full cutover (Step 6.3).

### You'll see

A mix of requests going through Restormel (your app logs should include `providerType` / `modelId` from resolve) and legacy (your existing logs). The ratio should roughly match your rollout percentage.

### How to test

Check your application logs. Requests that went through Restormel should log the resolved provider and source. Requests that went through legacy should log the legacy provider. Both should succeed without user-facing errors.

---

## Step 6.3 — Full cutover

When you're confident from the parallel run, enable Restormel for all traffic:

```bash
# In your production environment variables
USE_RESTORMEL_KEYS=true
RESTORMEL_ROLLOUT_PERCENT=100  # if using percentage-based rollout
```

Deploy the env change. Monitor for 15–30 minutes.

### You'll see

All AI requests resolve through Restormel. Your logs should show the resolved `providerType` / `modelId` for every request. The dashboard shows request volume in the project's usage section.

### How to test

```bash
# Verify no requests are going through legacy
grep -c '"source":"legacy"' /path/to/your/app.log
# Expected: 0 (or near-zero during the deployment window)
```

Check the dashboard: **Projects → your project → Usage**. You should see request counts matching your expected traffic.

> **Tip**
> Keep the legacy fallback code in place for at least one release cycle after cutover. If something unexpected happens, you can flip the flag back to `false` and instantly restore the old behaviour.

---

## Step 6.4 — Post-cutover verification

Run a comprehensive check within the first hour after cutover.

**CLI checks:**

```bash
# Doctor: confirm environment is healthy
npx @restormel/doctor

# Validate: re-check all stored keys
npx @restormel/validate
```

**Dashboard checks:**

1. **Usage:** Request count is non-zero and growing. No unexpected error spikes.
2. **Routes:** The routes you configured show traffic against them.
3. **Policies:** No unexpected policy violations (unless you've intentionally blocked something).
4. **Provider credentials:** All credentials show "valid" status.

**Application checks:**

1. Make a request through each major code path (ingestion, chat, etc.). Confirm correct provider and model.
2. Test fallback: temporarily remove a provider credential in the dashboard. Confirm your app uses the next step. Restore the credential.
3. Test a policy block: request a model not on your allowlist. Confirm it's rejected or falls back.
4. Check latency: compare request latency before and after cutover. The resolve call adds a network round-trip (typically <100ms). If latency is unacceptable, consider switching to local resolve (Phase 2, Step 2.6).

**Smoke test script:**

```bash
#!/bin/bash
# scripts/smoke-test-restormel.sh

echo "=== Restormel smoke test ==="

# 1. Resolve
echo "1. Resolve..."
RESULT=$(curl -s -X POST \
  "https://restormel.dev/keys/dashboard/api/projects/${RESTORMEL_PROJECT_ID}/resolve" \
  -H "Authorization: Bearer ${RESTORMEL_GATEWAY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "environmentId": "production", "routeId": "ingestion" }')
echo "   Provider: $(echo $RESULT | jq -r '.data.providerType')"
echo "   Model: $(echo $RESULT | jq -r '.data.modelId')"
echo "   Explanation: $(echo $RESULT | jq -r '.data.explanation')"

# 2. Policy evaluate
echo "2. Policy evaluate (allowed model)..."
EVAL=$(curl -s -X POST \
  "https://restormel.dev/keys/dashboard/api/policies/evaluate" \
  -H "Authorization: Bearer ${RESTORMEL_GATEWAY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "projectId": "'${RESTORMEL_PROJECT_ID}'", "environmentId": "production", "modelId": "gpt-4o", "providerType": "openai" }')
echo "   Result: $(echo $EVAL | jq '.data')"

# 3. CLI doctor
echo "3. keys doctor..."
npx @restormel/doctor

echo "=== Done ==="
```

### Build-agent prompt: create-smoke-test

**Context docs** (adapt paths for your project): this page (smoke test script, post-cutover checks); [Phase 2 — Resolve](/keys/docs/walkthrough/phase-2-resolve) (resolve endpoint and auth); [Phase 4 — Policies](/keys/docs/walkthrough/phase-4-policies) (evaluate endpoint).

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Create a post-cutover smoke test script that verifies Restormel Keys is working in production.
>
> **Steps:**
>
> 1. Create `scripts/smoke-test-restormel.sh` (bash, executable).
> 2. The script must:
>    a. Call the resolve endpoint with your production project ID and environment. Print the resolved provider, model, and source.
>    b. Call the policy evaluate endpoint with an allowed model. Print whether it's allowed.
>    c. Call the policy evaluate endpoint with a blocked model (if one exists). Print whether it's blocked.
>    d. Run `npx @restormel/doctor` and print the result.
>    e. Run `npx @restormel/validate` and print the result.
>    f. Exit with code 0 if all checks pass, 1 if any fail.
> 3. The script reads `RESTORMEL_GATEWAY_KEY`, `RESTORMEL_PROJECT_ID`, and `RESTORMEL_ENVIRONMENT_ID` from the environment. It must not contain hardcoded secrets.
> 4. Add the script to `package.json` scripts: `"smoke:restormel": "bash scripts/smoke-test-restormel.sh"`.
> 5. Verify: the script runs in your staging environment and exits 0.
>
> **DO NOT:**
> - Hardcode real API keys, project IDs, or URLs in the script.
> - Make the script destructive (no data modification, no key deletion).
> - Skip the doctor/validate checks — they catch drift.
> - Commit real API keys or secrets.

**Gate:** `pnpm run smoke:restormel` exits 0 in staging. The script prints resolved provider, policy evaluation results, and doctor/validate output. No secrets are hardcoded.

---

## Step 6.5 — Remove legacy routing code

Once you're confident Restormel is handling all traffic correctly (at least one full release cycle with the flag at 100%), clean up:

1. **Remove the feature flag.** The Restormel path is now the only path.
2. **Remove the legacy resolve function.** The `legacyResolve` fallback in `resolve-provider.ts` is no longer needed.
3. **Remove the inventory items marked "REMOVE" in Phase 0.** Custom router, hardcoded model lists, custom fallback chains, custom model picker UI.
4. **Remove unused env vars.** Any `DEFAULT_MODEL`, `AI_PROVIDER`, or provider-specific routing env vars that Restormel replaces.
5. **Keep the error fallback to a sensible default.** Even without legacy code, your resolve wrapper should handle Restormel errors gracefully (e.g. return a hardcoded default provider/model or a user-facing error).

### Build-agent prompt: remove-legacy-routing

**Context docs** (adapt paths for your project): this page (Step 6.5 removal scope); [Phase 0 — Inventory](/keys/docs/walkthrough/phase-0-inventory) (the "REMOVE" items); [Phase 2 — Resolve](/keys/docs/walkthrough/phase-2-resolve) (resolve wrapper and feature flag to remove).

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Remove the legacy routing code now that Restormel Keys handles all provider resolution.
>
> **Steps:**
>
> 1. Read the routing inventory at `docs/restormel-integration/00-routing-inventory.md`. For every item marked "REMOVE," delete the file or the relevant code block.
> 2. In `src/lib/server/resolve-provider.ts` (or equivalent):
>    a. Remove the `USE_RESTORMEL_KEYS` feature flag import and conditional.
>    b. Remove the `legacyResolve` function.
>    c. The resolve function now always calls `restormelResolve`. Keep the try/catch but change the fallback from "legacy path" to "return a hardcoded safe default or throw a user-friendly error."
> 3. Remove the feature flag module (`src/lib/feature-flags.ts`) if `USE_RESTORMEL_KEYS` was its only export.
> 4. Remove `USE_RESTORMEL_KEYS` and `RESTORMEL_ROLLOUT_PERCENT` from `.env.example`.
> 5. Remove any UI components marked "REMOVE" in the inventory (custom model picker, custom BYOK panel) that have been replaced by Restormel ModelSelector/KeyManager.
> 6. Remove unused env vars from `.env.example` (e.g. `DEFAULT_MODEL`, `AI_PROVIDER`) if they were only used by the legacy routing.
> 7. Run the full test suite. Fix any broken imports or references.
> 8. Run `scripts/smoke-test-restormel.sh` to confirm everything still works.
>
> **DO NOT:**
> - Remove billing, auth, session, or orchestration code (these are "KEEP" items).
> - Remove the Restormel error handling (try/catch in resolveProvider). The app must still handle Restormel failures gracefully.
> - Remove env vars that other parts of the app use (e.g. `OPENAI_API_KEY` if it's still used for direct provider calls outside of routing).
> - Remove the smoke test script.
> - Commit real API keys or secrets.

**Gate:** All "REMOVE" items from the routing inventory are deleted. The feature flag is gone. `resolveProvider` always uses Restormel. Tests pass. Smoke test passes. No legacy routing code remains.

---

## Checkpoint

You now have:

- Production traffic resolving through Restormel Keys.
- A smoke test script for ongoing verification.
- (After Step 6.5) Legacy routing code removed; Restormel is the single source of truth.
- Dashboard showing live traffic, route usage, and policy enforcement.

Your integration is complete. For ongoing operations, see [Verification strategy](/keys/docs/walkthrough/verification-strategy).

**Next:** [Migration paths](/keys/docs/walkthrough/migration-paths) — if you're coming from LiteLLM, Portkey, or OpenRouter instead of custom code, or want to see the strangler pattern in detail.
