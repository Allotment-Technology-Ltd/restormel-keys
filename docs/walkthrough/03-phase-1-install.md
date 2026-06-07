# Phase 1 — Install and Configure

> **Time:** ~15 minutes
> **Prerequisites:** [Phase 0](./02-phase-0-inventory.md) complete (routing inventory exists), a Restormel Keys account
> **You'll need:** Terminal access, your app's package manager (`pnpm`, `npm`, or `yarn`), access to the [Dashboard](https://restormel.dev/keys/dashboard)

> **Keys MVP — canonical install path (2026-06):** New integrations use **Keys REST** (no npm core) + **`@restormel/keys-elements`** for UI. `@restormel/keys`, `@restormel/keys-svelte`, and `@restormel/keys-react` are deprecated (maintenance-only until 2026-12-01). Do **not** install those deprecated packages for new apps. The authoritative guidance is the in-app walkthrough at [/keys/docs/walkthrough/phase-1-install](https://restormel.dev/keys/docs/walkthrough/phase-1-install). This file is kept for historical reference and agent context; the Svelte route is the canonical public version.

This phase installs the Restormel Keys CLI and UI packages, then creates the dashboard-side resources (workspace, project, environment, Gateway Key) that later phases depend on. By the end, **`pnpm exec @restormel/doctor` exits 0** (REST config check) and your dashboard shows a project ready for routes and policies. Doctor validates **local** setup. It does not validate Cloud env vars (e.g. `RESTORMEL_GATEWAY_KEY`, `RESTORMEL_PROJECT_ID`) — you verify those in Phase 2 when you make your first resolve call.

**See also:** [npm packages — scope and install path](../reference/npm-packages.md) (which packages are required vs optional, pnpm monorepos, verifying `npm view`).

### pnpm monorepos

Add dependencies to the **package that owns your app** (the directory with `svelte.config.js`, `next.config.*`, etc.), not only the repo root:

```bash
cd apps/my-app
pnpm add -D @restormel/keys-cli @restormel/doctor
pnpm add @restormel/keys-elements        # only if you need Phase 5 UI
```

From the workspace root, use a filter or `-w` only when that root **is** the app:

```bash
pnpm add -D @restormel/keys-cli --filter my-app
```

---

## Step 1.1 — Install the packages

**Canonical MVP path (2026-06):** Keys REST is the resolve surface — no npm core required. Install the CLI for local tooling and doctor checks, and `@restormel/keys-elements` if you need embeddable UI (Phase 5).

> **Do not install `@restormel/keys`, `@restormel/keys-svelte`, or `@restormel/keys-react` for new integrations.** These packages are deprecated (maintenance-only until 2026-12-01). Use Keys REST + `@restormel/keys-elements` instead.

**All frameworks (Phases 1–4, server-side Keys REST + CLI):**

```bash
pnpm add -D @restormel/keys-cli @restormel/doctor
```

**With UI (Phase 5, Web Components — all frameworks):**

```bash
pnpm add @restormel/keys-elements
```

Before installing, verify: `npm view @restormel/keys-elements version`. See [npm packages — scope and install path](../reference/npm-packages.md).

> **Tip**
> See [Framework compatibility](/keys/docs/compatibility/) for the full decision tree. Keys REST requires no framework-specific npm adapter.

### You'll see

The CLI and doctor packages appear in your `package.json` devDependencies. No build errors.

### How to test

```bash
# Confirm CLI and doctor are installed
pnpm exec keys --version
pnpm exec @restormel/doctor --version
```

---

## Step 1.2 — Scaffold config (CLI or manual)

### Option A — `@restormel/keys-cli` (recommended)

```bash
pnpm exec keys init
```

Or via npx if not yet installed: `npx @restormel/keys-cli init`.

The `init` command writes `restormel.config.json` and prints suggested packages (core + optional UI for Phase 5).

### Option B — Manual `restormel.config.json` (no CLI)

Create **`restormel.config.json`** in the **app root** (same directory as your framework config). No secrets — only framework id and optional provider labels:

```json
{
  "framework": "sveltekit",
  "providers": []
}
```

Use `"framework":` one of `next` | `sveltekit` | `react` | `astro` | `none` to match your stack. `providers` can stay `[]` until you use `keys add` or document providers elsewhere.

### How to test

```bash
pnpm exec @restormel/doctor
```

`doctor` checks framework detection, REST config (`RESTORMEL_KEYS_BASE`, `RESTORMEL_GATEWAY_KEY`), and CLI setup. At this point it should **exit 0** with a note that no Gateway Key is configured yet (Step 1.4).

> Wrapper: `pnpm exec keys doctor`.

:::note[If you see "framework not detected"]
Ensure `restormel.config.json` exists and `framework` matches your stack. The CLI, when available, looks for `next.config.*`, `svelte.config.*`, `astro.config.*`.
:::

---

## Step 1.3 — Create a project in the Dashboard

Open the [Dashboard](https://restormel.dev/keys/dashboard) and sign in with **GitHub** (interactive OAuth).

> **Human step (not headless CI)**  
> Workspace/project creation and Gateway Key generation require an **authenticated browser session**. Coding agents and unattended automation **cannot** complete GitHub sign-in for you. A human operator must sign in, create the project and environment, then copy **project ID** and **Gateway Key** into `.env` or your secret manager. There is no API-only substitute documented for this walkthrough yet.

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
pnpm exec @restormel/doctor
```

### You'll see

Example output (headless, REST-only setup):

```
✔ Framework detection — SvelteKit
✔ CLI (@restormel/keys-cli) — installed
✔ restormel.config.json — found
○ Gateway Key — not set (RESTORMEL_GATEWAY_KEY) — OK, set after Dashboard step
○ UI package (@restormel/keys-elements) — not installed — OK for headless Phases 1–4

OK
```

Cloud env vars (`RESTORMEL_GATEWAY_KEY`, `RESTORMEL_PROJECT_ID`) are not validated by the CLI. You confirm they work in Phase 2 when you call the REST resolve endpoint.

### How to test

`keys doctor` exits with code 0.

```bash
pnpm exec @restormel/doctor && echo "PASS" || echo "FAIL"
```

> **Pitfall**
> If doctor fails on CLI, run `pnpm add -D @restormel/keys-cli @restormel/doctor`. If config is missing, add `restormel.config.json` (Step 1.2). For Phase 2, set Gateway Key and project ID in `.env` after a human completes the Dashboard steps.

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
- `docs/reference/npm-packages.md` — which packages to install (MVP canonical list)
- `docs/walkthrough/02-phase-0-inventory.md` — routing inventory (confirms what framework the app uses)
- `packages/cli/README.md` — CLI commands (`keys init`, `keys doctor`)
- `docs/ux-contracts.md` — canonical URLs for Dashboard links

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Wire Keys REST + CLI (no deprecated `@restormel/keys` npm for new apps), config, env placeholders; Restormel Doctor exits 0.
>
> **Steps:**
>
> 1. Read the routing inventory at `docs/restormel-integration/00-routing-inventory.md` to confirm the framework and whether UI (Phase 5) is needed.
> 2. In the **app package** (pnpm: `cd` into the app or use `--filter`), install `@restormel/keys-cli` and `@restormel/doctor` as devDependencies. Add `@restormel/keys-elements` only if Phase 5 UI is needed.
> 3. **Do NOT install** `@restormel/keys`, `@restormel/keys-svelte`, or `@restormel/keys-react` — these are deprecated for new integrations.
> 4. Create `restormel.config.json` via `pnpm exec keys init` **or** manually (`framework` + `providers`). See Step 1.2.
> 5. Add to `.env.example` (placeholder names only, no values):
>    ```
>    RESTORMEL_KEYS_BASE=https://restormel.dev
>    RESTORMEL_GATEWAY_KEY=
>    RESTORMEL_PROJECT_ID=
>    USE_RESTORMEL_KEYS=false
>    ```
> 6. If a `.env` file exists and is gitignored, add the same keys with empty values there as well.
> 7. Run `pnpm exec @restormel/doctor` and confirm it exits 0 (no Gateway Key warning is expected here).
> 8. A **human** completes Dashboard sign-in, project creation, and Gateway Key → copy IDs into local `.env` (not committed). Agents document placeholders in `.env.example` only.
> 9. Commit `restormel.config.json`, `.env.example` changes, and `package.json` / lockfile changes.
>
> **DO NOT:**
> - Commit real API keys or secrets to the repo.
> - Add values to `.env.example` — only placeholder names.
> - Install deprecated npm packages.
> - Modify any existing application code. This prompt is install-and-configure only.

**Gate:** `pnpm exec @restormel/doctor` exits 0. `restormel.config.json` exists and is committed. `.env.example` lists the Restormel env vars. No real keys are committed. Dashboard steps completed by a signed-in human or explicitly deferred with placeholders only.

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
