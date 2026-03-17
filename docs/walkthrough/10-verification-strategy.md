# Verification Strategy

> **Canonical** verification approach for Restormel Keys integrations — during rollout and ongoing.

This document defines three layers of verification: **dashboard checks** (visual, no code), **CLI checks** (terminal, scriptable), and **smoke tests** (HTTP, automatable). Use all three during cutover (Phase 6) and the first two on an ongoing basis.

---

## 1. Verification layers

| Layer | When to use | Who runs it | Automatable? |
|-------|------------|------------|--------------|
| **Dashboard** | After any config change (route, policy, credential); during cutover monitoring | Human (or browser MCP) | Partially |
| **CLI** | After install, before deploy, in CI, during cutover | Human or CI | Yes |
| **Smoke tests** | After deploy, during cutover, as a scheduled health check | CI or cron | Yes |

---

## 2. Dashboard checks

Open the [Dashboard](/keys/dashboard) and verify the following. These checks require no code — just visual confirmation.

### 2.1 Project health

| What to check | Where | Expected |
|--------------|-------|----------|
| Project exists | Projects list | Your project is listed |
| Environment exists | Project → Environments | `production` (and `staging` if used) |
| Gateway Key exists | Project → API Keys | At least one key with `rk_…` prefix |
| Provider credentials valid | Project → Provider Credentials | Green "valid" status for each configured provider |

### 2.2 Route health

| What to check | Where | Expected |
|--------------|-------|----------|
| Routes exist | Project → Routes | At least one route (e.g. `ingestion`, `interactive`) |
| Steps in correct order | Route detail | Steps listed in your intended fallback order |
| Route mode correct | Route detail | `fallback_chain` (or your intended mode) |

### 2.3 Policy health

| What to check | Where | Expected |
|--------------|-------|----------|
| Policies exist | Project → Policies | At least one policy (e.g. `model_allowlist`) |
| Policy scope correct | Policy detail | Scoped to the right project/environment |
| No conflicting policies | Policies list | No two policies that contradict each other (e.g. an allowlist and denylist that block everything) |

### 2.4 Usage and logs

| What to check | Where | Expected |
|--------------|-------|----------|
| Request count non-zero | Project → Usage | After cutover, requests should appear |
| No error spikes | Project → Usage / Logs | Error rate comparable to or lower than pre-cutover |
| Correct route distribution | Project → Usage | Traffic hitting the expected routes |

---

## 3. CLI checks

These checks run in a terminal and can be scripted into CI.

### 3.1 `keys doctor`

```bash
npx @restormel/doctor
```

**Checks:** Framework detection, packages installed, config file validity, and whether local provider keys are present (if you use them).

**Expected:** Exit code 0, all checks green.

**When to run:** After install (Phase 1), before every deploy, in CI on every PR.

### 3.2 `keys validate`

```bash
npx @restormel/validate
```

**Checks:** Re-validates all stored provider keys (makes lightweight test calls to each provider).

**Expected:** Exit code 0 if all keys are valid. Exit code 1 if any key is invalid or expired.

**When to run:** Before deploy, in CI on a schedule (e.g. daily), after rotating any provider keys.

> **Tip**
> `keys validate` with exit code 1 is designed for CI gates. Add it to your deploy pipeline so deploys fail if a provider key has been revoked or expired.

```yaml
# .github/workflows/deploy.yml
- name: Validate Restormel keys
  run: npx @restormel/validate
```

### 3.3 `keys estimate` (optional)

```bash
npx @restormel/keys-cli estimate gpt-4o --input 1000 --output 500
```

**Checks:** Returns the estimated cost for a given model and token count.

**When to run:** Before enabling a new model in a route, to understand cost implications.

---

## 4. Smoke tests

These are HTTP-based tests that verify the resolve endpoint and policy evaluation. They are automatable and should run after every deploy and on a schedule.

### 4.1 Resolve smoke test

```bash
RESULT=$(curl -sf -X POST \
  "https://restormel.dev/keys/dashboard/api/projects/${RESTORMEL_PROJECT_ID}/resolve" \
  -H "Authorization: Bearer ${RESTORMEL_GATEWAY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "environmentId": "production", "routeId": "ingestion" }')

PROVIDER=$(echo $RESULT | jq -r '.data.providerType')
if [ -z "$PROVIDER" ] || [ "$PROVIDER" = "null" ]; then
  echo "FAIL: resolve returned no provider"
  exit 1
fi
echo "PASS: resolve returned provider=$PROVIDER"
```

**Expected:** HTTP 200, non-null `provider` in response.

### 4.2 Fallback smoke test

Create a dedicated **test route** in the dashboard with a deliberately failing first step:

| Step | Provider | Credential | Purpose |
|------|----------|-----------|---------|
| 1 | `test-invalid` | None | Deliberately fails |
| 2 | OpenAI | Valid | Should be returned after fallback |

```bash
RESULT=$(curl -sf -X POST \
  "https://restormel.dev/keys/dashboard/api/projects/${RESTORMEL_PROJECT_ID}/resolve" \
  -H "Authorization: Bearer ${RESTORMEL_GATEWAY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "environmentId": "production", "routeId": "test-fallback" }')

PROVIDER=$(echo $RESULT | jq -r '.data.providerType')
if [ "$PROVIDER" != "openai" ]; then
  echo "FAIL: fallback did not resolve to openai (got $PROVIDER)"
  exit 1
fi
echo "PASS: fallback resolved to openai"
```

### 4.3 Policy smoke test

```bash
# Allowed model
EVAL=$(curl -sf -X POST \
  "https://restormel.dev/keys/dashboard/api/policies/evaluate" \
  -H "Authorization: Bearer ${RESTORMEL_MANAGEMENT_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "projectId": "'${RESTORMEL_PROJECT_ID}'", "environmentId": "production", "modelId": "gpt-4o", "providerType": "openai" }')
echo "Allowed model: $(echo $EVAL | jq '.data.allowed')"

# Blocked model
EVAL_BLOCKED=$(curl -sf -X POST \
  "https://restormel.dev/keys/dashboard/api/policies/evaluate" \
  -H "Authorization: Bearer ${RESTORMEL_MANAGEMENT_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "projectId": "'${RESTORMEL_PROJECT_ID}'", "environmentId": "production", "modelId": "gpt-3.5-turbo", "providerType": "openai" }')
echo "Blocked model: $(echo $EVAL_BLOCKED | jq '.data.allowed')"
```

### 4.4 Combined smoke test script

The script from Phase 6 (Step 6.4) combines all checks:

```bash
pnpm run smoke:restormel
```

---

## 5. Ongoing monitoring recommendations

| What | How | Frequency |
|------|-----|-----------|
| Resolve latency | Log time per `restormelResolve()` call; alert if p95 > 200ms | Every request |
| Resolve errors | Count errors from resolve client; alert on spike | Every request |
| Fallback rate | Count fallback-to-legacy or next-step events; alert if > 5% | Every request |
| Credential expiry | `keys validate` in CI; alert on exit code 1 | Daily |
| Policy violations | Dashboard logs; alert if unexpected blocks | Daily |
| Budget utilisation | Dashboard usage; alert at 80% of cap | Daily |
| Config drift | `keys doctor` in CI; alert on warnings | Every deploy |

### Build-agent prompt: add-ci-verification

**Context docs** (adapt paths for your project): this page (CLI checks, smoke tests, CI integration); [Phase 6 — Go live](/keys/docs/walkthrough/phase-6-golive) (smoke test script).

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Add Restormel Keys verification steps to your CI pipeline.
>
> **Steps:**
>
> 1. Open your CI workflow file (e.g. `.github/workflows/ci.yml`).
> 2. Add a step after build: `npx @restormel/doctor`. Fail the build on non-zero exit.
> 3. Add a step: `npx @restormel/validate`. Fail the build on non-zero exit. Requires `RESTORMEL_GATEWAY_KEY` as a CI secret.
> 4. Add the CI secret: GitHub → Settings → Secrets → Actions → `RESTORMEL_GATEWAY_KEY` (use a staging key, not production).
> 5. Optionally add a post-deploy step: `pnpm run smoke:restormel`. Gate behind an env check if the staging endpoint isn't available during CI.
> 6. Verify: push a PR, confirm doctor and validate pass in CI.
>
> **DO NOT:**
> - Use the production Gateway Key in CI. Use a dedicated staging key.
> - Commit secrets to the workflow file. Use GitHub Actions secrets.
> - Make the smoke test block deploys if it tests against an unavailable endpoint.

**Gate:** CI runs `keys doctor` and `keys validate` on every PR. Both pass. Gateway Key is a GitHub Actions secret.

---

## 6. Verification schedule summary

| Event | Checks to run |
|-------|--------------|
| **Phase 1 complete** | `keys doctor` |
| **Phase 2 complete** | `keys doctor`, resolve curl test |
| **Phase 3 complete** | Resolve with route ID, fallback test |
| **Phase 4 complete** | Policy evaluate (allowed + blocked) |
| **Phase 5 complete** | Visual: ModelSelector renders, callbacks fire |
| **Phase 6 cutover** | Full smoke test, dashboard usage, error rate |
| **Ongoing** | `keys doctor` + `keys validate` in CI; smoke test on schedule; dashboard monitoring |

---

See the [Walkthrough](/keys/docs/walkthrough) index for the full phase listing and related docs.
