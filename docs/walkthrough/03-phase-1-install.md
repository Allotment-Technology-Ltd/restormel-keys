# Phase 1 — Install and Configure

> **Time:** ~15 minutes
> **Prerequisites:** [Phase 0](./02-phase-0-inventory.md) complete (routing inventory exists), a Restormel Keys account
> **You'll need:** Terminal access, your app's package manager (`pnpm`, `npm`, or `yarn`), access to the [Dashboard](https://restormel.dev/keys/dashboard)

This phase gets the Restormel Keys packages into your project and creates the dashboard-side resources (workspace, project, environment, Gateway Key) that later phases depend on. By the end, `keys doctor` passes (framework, packages, and local config) and your dashboard shows a project ready for routes and policies. Doctor validates **local** setup (framework, packages, config, local key store). It does not validate Cloud env vars (e.g. `RESTORMEL_GATEWAY_KEY`, `RESTORMEL_PROJECT_ID`) — you verify those in Phase 2 when you make your first resolve call.

---

## Step 1.1 — Install the packages

Choose the packages for your framework. The headless core (`@restormel/keys`) is always required. Add UI packages if you plan to embed ModelSelector or KeyManager (Phase 5).

**Next.js / React:**

```bash
pnpm add @restormel/keys @restormel/keys-react @restormel/keys-elements
```

**SvelteKit:**

```bash
pnpm add @restormel/keys @restormel/keys-svelte
```

**Vanilla / Astro / Web Components:**

```bash
pnpm add @restormel/keys @restormel/keys-elements
```

**Server-only (no UI, just resolve):**

```bash
pnpm add @restormel/keys
```

> **Tip**
> Not sure which packages you need? See [Framework compatibility](/keys/docs/compatibility/) for the full decision tree. If you only need server-side resolution and no embedded UI, the headless core is enough.

### You'll see

The packages appear in your `package.json` dependencies. No build errors.

### How to test

```bash
# Confirm the package installed correctly
node -e "const k = require('@restormel/keys'); console.log('OK:', Object.keys(k).length, 'exports')"
```

If you use ESM (`"type": "module"` in your `package.json`):

```bash
node --input-type=module -e "import { createKeys } from '@restormel/keys'; console.log('OK: createKeys is', typeof createKeys)"
```

---

## Step 1.2 — Scaffold with the CLI

The CLI generates a starter config and validates your setup. If you prefer to configure manually, skip to Step 1.3.

```bash
npx @restormel/keys-cli init
```

The `init` command detects your framework, suggests the right packages (confirming what you installed in 1.1), and creates a `restormel.config.json` in your project root.

### You'll see

Interactive prompts asking for your framework, which providers you use, and your preferred storage adapter. On completion:

```
✔ Detected framework: Next.js (App Router)
✔ Created restormel.config.json
✔ Suggested packages: @restormel/keys, @restormel/keys-react, @restormel/keys-elements

Run 'keys doctor' to verify your setup.
```

### How to test

```bash
npx @restormel/doctor
```

> You can also run the wrapper: `npx @restormel/keys-cli doctor`.

`doctor` checks framework detection, package versions, config validity, and key health. At this point it should pass with a note that no Gateway Key is configured yet (that's Step 1.4).

:::note[If you see "framework not detected"]
The CLI looks for framework markers (`next.config.*`, `svelte.config.*`, `astro.config.*`). If your project uses a non-standard layout, run `keys init --framework next` (or `sveltekit`, `react`, `astro`) to specify manually.
:::

---

## Step 1.3 — Create a project in the Dashboard

Open the [Dashboard](https://restormel.dev/keys/dashboard) and sign in with GitHub.

1. **Create a workspace** (if you don't have one). This is your top-level organisational container. Name it after your company or team.
2. **Create a project.** Name it after your app (e.g. "My Writing Tool" or "SOPHIA Ingestion"). The project is where routes, policies, and keys live.
3. **Create an environment** within the project: `production`. You can add `staging` later. The environment scopes routes and policies to a deployment context.

> **Dashboard**
> Workspace → Projects → **Create project** → name it → **Environments** → **Create environment** → name it `production`.

### You'll see

The project detail page in the dashboard with:
- Project name and ID
- An "Environments" section showing `production`
- Empty "Routes" and "Policies" sections (you'll fill these in Phases 3–4)
- An "API Keys" section (you'll generate a Gateway Key next)

### How to test

The project detail page loads without errors. The environment `production` is listed.

---

## Step 1.4 — Generate a Gateway Key

Still in the Dashboard, on your project detail page:

1. Click **Generate API key** (or navigate to the API Keys section).
2. Copy the full key immediately. It has the format `rk_…` and is shown only once.
3. Store it securely. This is your **Gateway Key** — the credential your backend uses to authenticate to the Restormel resolve API.

> **Security**
> The Gateway Key is a secret. Store it in your environment variables or secret manager. Never commit it to your repo, paste it into a coding agent, or log it in application output.

### You'll see

A key displayed once with a "Copy" button. After you navigate away, you'll see only the key prefix (e.g. `rk_a3f…`) in the dashboard — the full key is not retrievable.

### How to test

You'll test the key works in Phase 2 when you make your first resolve call. For now, confirm it's stored:

```bash
# Add to your .env (gitignored) — NOT .env.example
echo "RESTORMEL_GATEWAY_KEY=rk_your_key_here" >> .env
echo "RESTORMEL_PROJECT_ID=your_project_id_here" >> .env
echo "RESTORMEL_ENVIRONMENT_ID=production" >> .env
```

Update `.env.example` with placeholder names (no values):

```bash
# .env.example
RESTORMEL_GATEWAY_KEY=
RESTORMEL_PROJECT_ID=
RESTORMEL_ENVIRONMENT_ID=
```

---

## Step 1.5 — Configure provider credentials (optional now)

If your app uses **platform keys** (your own OpenAI/Anthropic/Google keys, not user-provided BYOK), you can add them as provider credentials in the dashboard now. This is optional — you can also continue using your existing env vars and let Restormel resolve point to the provider while you supply the key yourself.

To add provider credentials in the dashboard:

1. In your project, go to **Provider Credentials**.
2. Click **Add credential**, choose the provider (e.g. OpenAI), paste your API key.
3. Restormel validates the key and stores it encrypted.

If you prefer to keep provider keys in your own env vars and only use Restormel for routing decisions, skip this step. The resolve response tells you _which_ provider to call; you can supply the key from your own env.

### You'll see

The credential listed in the dashboard with the provider name and a masked key preview. Validation status shows green if the key is valid.

### How to test

No code-level test yet. The dashboard shows the credential as valid.

---

## Step 1.6 — Run `keys doctor` again

Now that you have a config (and optionally env vars), run the doctor check again:

```bash
npx @restormel/doctor
```

### You'll see

`keys doctor` checks framework detection, package versions, and config validity. Example output:

```
✔ Framework: Next.js (App Router)
✔ Packages: @restormel/keys@0.2.0, @restormel/keys-react@0.1.0, @restormel/keys-elements@0.1.0
✔ Config: restormel.config.json valid

All checks passed.
```

Cloud env vars (`RESTORMEL_GATEWAY_KEY`, `RESTORMEL_PROJECT_ID`, `RESTORMEL_ENVIRONMENT_ID`) are not validated by the CLI. You confirm they work in Phase 2 when you call the resolve endpoint.

### How to test

`keys doctor` exits with code 0.

```bash
npx @restormel/doctor && echo "PASS" || echo "FAIL"
```

> **Pitfall**
> If `doctor` reports missing packages, install them (Step 1.1). If it reports a missing config, run `keys init` (Step 1.2). For resolve to work in Phase 2, ensure your `.env` (or secret manager) has the Gateway Key and project/environment IDs and that your app loads them at runtime.

---

## Step 1.7 — Add env var placeholders to `.env.example`

Make sure your repo's `.env.example` documents the new variables so collaborators know what to set:

```bash
# .env.example — Restormel Keys integration
RESTORMEL_GATEWAY_KEY=
RESTORMEL_PROJECT_ID=
RESTORMEL_ENVIRONMENT_ID=
# Optional: feature flag for phased rollout (see Phase 0)
USE_RESTORMEL_KEYS=false
```

### Build-agent prompt: install-and-configure

**Context docs:**
- `docs/walkthrough/03-phase-1-install.md` — this page
- `docs/02-architecture.md` — §1 framework compatibility, §2 package structure (which packages for which framework)
- `docs/walkthrough/02-phase-0-inventory.md` — routing inventory (confirms what framework the app uses)
- `packages/core/src/keys.ts` — `createKeys` function signature
- `packages/cli/README.md` — CLI commands (`keys init`, `keys doctor`)
- `docs/ux-contracts.md` — canonical URLs for Dashboard links

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Install Restormel Keys packages, scaffold the config, and prepare env vars for integration.
>
> **Steps:**
>
> 1. Read the routing inventory at `docs/restormel-integration/00-routing-inventory.md` to confirm the framework and whether UI packages are needed.
> 2. Install the correct packages for this framework:
>    - Next.js/React: `pnpm add @restormel/keys @restormel/keys-react @restormel/keys-elements`
>    - SvelteKit: `pnpm add @restormel/keys @restormel/keys-svelte`
>    - Server-only: `pnpm add @restormel/keys`
> 3. Run `npx @restormel/keys-cli init` and accept the detected framework and suggested packages.
> 4. Add to `.env.example` (placeholder names only, no values):
>    ```
>    RESTORMEL_GATEWAY_KEY=
>    RESTORMEL_PROJECT_ID=
>    RESTORMEL_ENVIRONMENT_ID=
>    USE_RESTORMEL_KEYS=false
>    ```
> 5. If a `.env` file exists and is gitignored, add the same keys with empty values there as well.
> 6. Run `npx @restormel/doctor` and confirm it exits 0 (ignoring the "no gateway key" warning if `.env` values are empty).
> 7. Commit `restormel.config.json`, `.env.example` changes, and `package.json` / lockfile changes.
>
> **DO NOT:**
> - Commit real API keys or secrets to the repo.
> - Add values to `.env.example` — only placeholder names.
> - Modify any existing application code. This prompt is install-and-configure only.
> - Install packages that don't match the framework (e.g. don't install `@restormel/keys-react` in a SvelteKit-only project).

**Gate:** `npx @restormel/doctor` exits 0. `restormel.config.json` exists and is committed. `.env.example` lists the four Restormel env vars. No real keys are committed.

---

## Checkpoint

You now have:

- Restormel Keys packages installed in your project.
- A `restormel.config.json` that matches your framework.
- A project and environment created in the Restormel Dashboard.
- A Gateway Key stored in your `.env` (gitignored).
- `keys doctor` passing.

Your app still runs on the old routing path (the feature flag from Phase 0 is still `false`). Nothing has changed in your application behaviour.

**Next:** [Phase 2 — Resolve your first model](./04-phase-2-resolve.md) — make your first resolve call from your backend and see the response.
