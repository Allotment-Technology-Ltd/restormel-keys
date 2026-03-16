# Zuplo launch — CLI execution path

Single-path runbook to take Zuplo from zero to launch-ready using the CLI, with Portal (or browser MCP) only where the CLI cannot act.

**Prerequisites:** Zuplo project **`restormel-keys-gateway`** exists (create once in [Portal](https://portal.zuplo.com)). Dashboard is on **Vercel** (e.g. https://restormel.dev/keys/dashboard); backend Gateway key created in the Keys dashboard. **KEYS_BACKEND_URL** is set to the dashboard URL (e.g. `https://restormel.dev/keys/dashboard`).

**Reference:** Full setup and field-by-field details in [zuplo-setup.md](zuplo-setup.md). Value sources: [zuplo-setup.md § Where to get each value](zuplo-setup.md#where-to-get-each-value).

---

## 1. Prepare inputs

From repo root:

```bash
cd zuplo-gateway
cp .env.example .env
# Edit .env: set ZUPLO_API_KEY, KEYS_BACKEND_URL, KEYS_BACKEND_API_KEY
# Optional for consumer script: ZUPLO_ACCOUNT_NAME, ZUPLO_BUCKET_NAME, GATEWAY_URL (or set after first deploy)
```

Required in `.env` for setup/deploy:

- `ZUPLO_API_KEY`
- `KEYS_BACKEND_URL` (no trailing slash)
- `KEYS_BACKEND_API_KEY` (value = a Gateway Key from the dashboard Access page; env var name kept for compatibility)

---

## 2. Run setup and deploy (per environment)

**Main:**

```bash
cd zuplo-gateway
pnpm install
export ZUPLO_BRANCH=main   # default; can omit
./scripts/setup-from-cli.sh
```

Script sets `KEYS_BACKEND_URL` and `KEYS_BACKEND_API_KEY` in Zuplo for the chosen branch and deploys. Note the **Gateway URL** from the script output or from Portal → Environments → main → Gateway.

**Working Copy (if you use it):**

```bash
export ZUPLO_BRANCH=working-copy
./scripts/setup-from-cli.sh
```

Use the same `.env` (same backend URL and key). Ensure the **working-copy** branch in the connected repo has the same `config/routes.oas.json` and `config/policies.json` as main; otherwise you get "no routes" or a holding page.

---

## 3. Create a consumer (per environment)

**Option A — Script (needs account + bucket + gateway URL):**

```bash
# Set in .env or export:
# ZUPLO_ACCOUNT_NAME, ZUPLO_BUCKET_NAME, GATEWAY_URL (e.g. from Portal → Environments → main → Gateway)
./scripts/create-consumer-and-test.sh
```

Then put the printed consumer key into `.env` as `ZUPLO_CONSUMER_KEY`.

**Option B — Portal:** Portal → API Key Service → create consumer → create key; copy the `zpka_...` key into `.env` as `ZUPLO_CONSUMER_KEY`.

---

## 4. Run launch validation

From `zuplo-gateway/`:

```bash
./scripts/launch-checklist.sh
```

Or with explicit gateway URL:

```bash
./scripts/launch-checklist.sh https://restormel-keys-gateway-main-XXXX.zuplo.app
```

The script runs the §7 checks (no key → 401, valid key → 200, invalid key → 401) and prints a **pass/fail launch readiness report**. Fix any failures before considering launch-ready. For multiple environments (e.g. main and working-copy), run the script once per gateway URL.

---

## 5. Portal-only steps (no CLI)

These steps have no CLI or API; use the Portal UI or **browser MCP** as fallback.

| Step | Action |
|------|--------|
| **Developer Portal** | Portal → Developer Portal → enable. **No portal editing required** if you deploy from this repo: the portal uses the deployed OpenAPI from `zuplo-gateway/config/routes.oas.json`. (Optional: you can still import [docs/api/openapi.yaml](../api/openapi.yaml), but if the editor is read-only, edit in git and redeploy instead.) |
| **GitHub connection** (optional) | Portal → Settings → Source Control. Connects to a repo whose **root** is a Zuplo project (e.g. a dedicated gateway repo). See [zuplo-setup.md §10](zuplo-setup.md#10-connecting-to-github-optional--do-after-gateway-is-working). |

When the portal shows the API reference and "Try it" works with a consumer key, the gateway is launch-ready.

### Browser MCP fallback (Portal-only steps)

When you want to automate the steps above without using the Portal UI by hand, use the **cursor-ide-browser** MCP to drive the Zuplo Portal in a browser.

1. **Lock and navigate:** `browser_navigate` to `https://portal.zuplo.com`, then `browser_lock` on the tab. Use `browser_snapshot` to get the page structure and element refs.
2. **Log in** if required (e.g. click Login, fill credentials). Prefer doing login once in a real browser and reusing the session if the MCP preserves cookies.
3. **Open your project:** Navigate to your project (e.g. `portal.zuplo.com/<ACCOUNT>/restormel-keys-gateway`).
4. **Developer Portal:** Open the Developer Portal (or Docs) section, enable the portal if needed, then use the import/add spec flow to paste or upload [docs/api/openapi.yaml](../api/openapi.yaml). Set the **Servers** base URL to your gateway URL (from Environments → main → Gateway).
5. **Unlock:** When done, call `browser_unlock`.

**Caveats:** UI selectors and flow can change; keep the runbook in sync. Prefer CLI + config for routes, policies, and env vars; use browser MCP only for steps that have no CLI/API.

---

## Summary: run order

1. Create project (Portal, once).
2. Fill `.env` (see [Where to get each value](zuplo-setup.md#where-to-get-each-value)).
3. `./scripts/setup-from-cli.sh` for **main** (then for **working-copy** if used).
4. Create consumer (script or Portal); set `ZUPLO_CONSUMER_KEY` in `.env`.
5. `./scripts/launch-checklist.sh` → fix any failures.
6. Portal: enable Developer Portal, import OpenAPI, set server URL.
