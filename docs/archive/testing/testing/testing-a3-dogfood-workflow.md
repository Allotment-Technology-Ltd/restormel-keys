# A3 BYOK dogfood workflow (main)

**Purpose:** Prove **[A3](./restormel-testing-agentic-product-requirements.md)** (BYOK / Keys resolve for `judge_rubric`) on **`main`** using **GitHub Environments** and **secrets only** — no credentials in git.

**Workflow file:** [`.github/workflows/testing-a3-byok-dogfood.yml`](../../.github/workflows/testing-a3-byok-dogfood.yml)

## When it runs

| Trigger | Runs? |
|---------|--------|
| **`workflow_dispatch`** | Always (if you have permission and secrets). |
| **`push` to `main`** | Only when repository variable **`RESTORMEL_TESTING_A3_MAIN`** is set to **`true`** (opt-in; avoids failing every push when secrets are not configured). |

## One-time setup (org/repo)

1. **GitHub Environment** named **`restormel-testing-a3`** (suggested) — optional protection rules for production parity.
2. **Environment secrets** (names must match what the workflow passes through):
   - **`RESTORMEL_KEYS_BASE`** — dashboard origin (e.g. `https://your-deployment.example`).
   - **`RESTORMEL_GATEWAY_KEY`** — Gateway key for the Restormel Testing project (store as secret; never echo in logs).
   - **`RESTORMEL_PROJECT_ID`** — project UUID from the dashboard.
3. Optional: **`RESTORMEL_ENVIRONMENT_ID`** if your `llm/primary` binding requires a non-default environment slot.
4. To enable **automatic runs on every `main` push**, set repository variable **`RESTORMEL_TESTING_A3_MAIN`** = **`true`**.

## What the job does

1. Builds `@restormel/testing-*` and installs Playwright Chromium (same pattern as CI).
2. Serves **`examples/testing-basic-web`** on **4173**.
3. Runs **`testing run --suite a3-byok-smoke`** against **`examples/testing-a3-dogfood/restormel-testing.yaml`** (one browser goal: deterministic **`text_present`** + **`judge_rubric`** resolved via **`ref:restormel-keys:llm/primary`**).

## Success criteria

- Suite **verdict** `passed` (or a **rubric/judge** failure with clear reason — not **`MODEL_RESOLVE_FAILED`** if Keys is configured correctly).
- **`run.json` / `report.json`** include **`keysModelMeta`** with **`resolutionSource: keys`** when resolve succeeds (see [p1-byok-e2e-checklist.md](p1-byok-e2e-checklist.md)).

## Cost note

Each run invokes your LLM provider once for the rubric. Keep **`RESTORMEL_TESTING_A3_MAIN`** off if you only want **manual** `workflow_dispatch` verification.
