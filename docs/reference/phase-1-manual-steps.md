# Phase 1 — Manual steps required

This document lists **all** manual actions required to complete Phase 1 of the Restormel Keys project, as defined in [07-prompt-pack-phase-1.md](07-prompt-pack-phase-1.md). It is beginner-friendly and step-by-step. Menu names in third-party UIs may vary slightly.

---

## Overview

Phase 1 covers: repository/workspace, core package build, CI/CD, Pulumi infrastructure, provider adapters, storage adapters, router/cost/entitlements/wallet, server middleware, key hashing/security, and first npm publish. Several of these require you to do something **outside** the editor (GitHub, npm, Google Cloud, terminal, etc.). This file tells you exactly what to do, in order.

---

## 1. What you need to do now

Do these in the order below. Skip a step only if the note says “optional” or “when you’re ready.”

### A. Repository and GitHub (Prompts 1.1, 1.3)

**A1. Ensure the code lives in a Git repository.**

- If you already have a repo (e.g. on GitHub) and have pushed your Phase 1 code, you can skip to A2.
- If you are starting from scratch:
  1. Go to [https://github.com/new](https://github.com/new).
  2. Set **Repository name** (e.g. `restormel-keys`).
  3. Choose **Public** or **Private**.
  4. Do **not** add a README, .gitignore, or license if you already have them locally.
  5. Click **Create repository**.
  6. On the empty repo page, copy the “push an existing repository” commands.
  7. In a terminal, in your project root (where `.git` is), run:
     ```bash
     git remote add origin https://github.com/YOUR_ORG_OR_USER/restormel-keys.git
     git branch -M main
     git push -u origin main
     ```
     Replace the URL with the one GitHub showed you.

**A2. Confirm CI runs on push.**

1. Open your repo on GitHub (e.g. `https://github.com/YOUR_ORG_OR_USER/restormel-keys`).
2. Click the **Actions** tab.
3. Push a small change to `main` (or open a pull request) and confirm a workflow run appears (e.g. **CI**).
4. Open the run and check that the jobs (e.g. changes, bootstrap-checks, security, test, codeql) complete successfully or are skipped as designed.
5. If anything is red, open the failed job and note the error message so you or Cursor can fix it.

You do **not** need to paste anything back into Cursor unless something failed.

---

### B. Repository URLs in the npm package (Prompt 1.10)

**B1. Point the package to your real repo.**

- Open in Cursor: `packages/core/package.json`.
- If your repo is **not** `https://github.com/allotment-technology/restormel-keys`, update these three fields to match your repo:
  - `repository.url` → e.g. `https://github.com/YOUR_ORG/YOUR_REPO.git`
  - `homepage` → e.g. `https://github.com/YOUR_ORG/YOUR_REPO#readme`
  - `bugs.url` → e.g. `https://github.com/YOUR_ORG/YOUR_REPO/issues`
- Save the file.
- If your repo **is** `allotment-technology/restormel-keys`, leave them as they are.

Nothing to copy back; just ensure the file is saved (and later committed).

---

### C. npm publish (Prompt 1.10)

**C1. Create an npm account (if you don’t have one).**

1. Go to [https://www.npmjs.com/signup](https://www.npmjs.com/signup).
2. Enter username, email, and password.
3. Complete email verification if prompted.
4. You do not need to paste anything back.

**C2. Create an npm Automation token.**

1. Log in at [https://www.npmjs.com](https://www.npmjs.com).
2. Click your profile picture (top right) → **Access Tokens** (or open [https://www.npmjs.com/settings/~your-username/tokens](https://www.npmjs.com/settings/~your-username/tokens)).
3. Click **Generate New Token** → **Classic Token**.
4. **Token name:** e.g. `restormel-keys-publish`.
5. **Type:** **Automation** (so CI can publish without 2FA).
6. Click **Generate Token**.
7. **Copy the token immediately** (it is shown only once).
8. Store it somewhere safe (e.g. password manager). **Do not** commit it, paste it into code, or share it in chat.

**C3. Add the token to GitHub as a secret.**

1. Open your GitHub repo → **Settings**.
2. Left sidebar: **Secrets and variables** → **Actions**.
3. Click **New repository secret**.
4. **Name:** `NPM_TOKEN` (exactly).
5. **Value:** paste the token from C2.
6. Click **Add secret**.

You do **not** paste the token back into Cursor.

**C4. Commit, push, and push the publish tag.**

1. In a terminal, in the repo root:
   ```bash
   git add -A
   git status
   ```
   Confirm the changed files are what you expect (e.g. `packages/core/package.json`, `packages/core/README.md`, `.github/workflows/publish.yml`, etc.).
2. Commit:
   ```bash
   git commit -m "chore: prepare @restormel/keys v0.1.0 for npm publish"
   ```
3. Push the default branch (e.g. `main`):
   ```bash
   git push origin main
   ```
4. Push the tag so the Publish workflow runs:
   ```bash
   git push origin keys-v0.1.0
   ```
5. Note whether both commands succeeded (no red errors).

**C5. Confirm the Publish workflow and npm.**

1. On GitHub: **Actions** → open the **Publish** workflow run for tag `keys-v0.1.0`.
2. Confirm all steps are green (especially “Publish to npm”).
3. Open [https://www.npmjs.com/package/@restormel/keys](https://www.npmjs.com/package/@restormel/keys) and confirm version **0.1.0** is shown.
4. Optionally in a terminal run:
   ```bash
   npm info @restormel/keys
   ```
   You should see package details.

If the workflow failed, copy the exact error message (or a short screenshot of the failed step) to bring back to Cursor.

---

### D. Pulumi and GCP (Prompt 1.4) — optional until you deploy

Phase 1 infra is **code-only** (TypeScript compiles, `pulumi preview` shows resources). You do **not** have to run `pulumi up` or create a GCP project to “complete” Phase 1. When you **are** ready to deploy:

**D1. Create a GCP project (if needed).**

1. Go to [https://console.cloud.google.com](https://console.cloud.google.com).
2. Top bar: click the project dropdown → **New Project**.
3. **Project name:** e.g. `restormel-keys-prod`.
4. Note the **Project ID** (you’ll use it in Pulumi config).
5. Click **Create**.

**D2. Enable required APIs.**

1. In Cloud Console, go to **APIs & Services** → **Library** (or [https://console.cloud.google.com/apis/library](https://console.cloud.google.com/apis/library)).
2. Enable at least: **Artifact Registry API**, **Cloud Run Admin API**, **Compute Engine API**, **Secret Manager API** (if you use secrets in env).
3. Wait until each shows “API enabled”.

**D3. Log in to Pulumi and set backend.**

1. In a terminal:
   ```bash
   pulumi login
   ```
2. Follow the prompts (browser or `pulumi login --local` for local state).
3. In the repo root:
   ```bash
   cd infra
   pulumi stack select production
   ```
   If the stack doesn’t exist, create it when prompted.

**D4. Set Pulumi config.**

1. In `infra/`, set the GCP project (use the Project ID from D1):
   ```bash
   pulumi config set gcp:project YOUR_PROJECT_ID
   ```
2. If you have a domain for the dashboard and want managed SSL, set:
   ```bash
   pulumi config set domain your-dashboard.example.com
   ```
   Otherwise leave `domain` unset (HTTPS proxy won’t be created).

**D5. Run `pulumi up` when ready.**

- From `infra/` run:
  ```bash
  pulumi up
  ```
- Review the plan and confirm. This will create the service account, Artifact Registry, Cloud Run service, load balancer resources, etc.

**D6. (Later) Configure deploy workflow with GCP.**

When you want GitHub Actions to run `pulumi up` and deploy:

1. In GCP: set up **Workload Identity Federation** for GitHub (see [Google Cloud docs](https://cloud.google.com/iam/docs/workload-identity-federation)).
2. In GitHub repo → **Settings** → **Secrets and variables** → **Actions**, add:
   - `GCP_PROJECT_ID` = your GCP project ID
   - `WIF_PROVIDER` = full WIF provider resource name
   - `WIF_SERVICE_ACCOUNT` = service account email used for deploy
3. In `.github/workflows/deploy.yml`, uncomment the steps that use `google-github-actions/auth` and the real Pulumi / Docker / Cloud Run steps (per your setup).

You do not need to bring config values back into Cursor unless you want the workflow file edited for you.

---

### E. Deploy workflow — GCP secrets (Prompt 1.3) — optional until you deploy

The deploy workflow is valid YAML but uses placeholders. To actually deploy from CI:

- Add the GitHub secrets listed in D6 (`GCP_PROJECT_ID`, `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT`).
- Uncomment and adjust the WIF auth and deploy steps in `.github/workflows/deploy.yml` (see D6).

No manual steps are required in the editor beyond that when you’re ready.

---

### F. Key hashing secret for production (Prompt 1.9)

The security module uses a **hash secret** for HMAC-SHA256 (createApiKey, hashApiKey, createKeyVerifier). In production:

- **Do not** commit the secret or put it in repo code.
- Set it in one of:
  - Environment variable (e.g. `RESTORMEL_KEYS_HASH_SECRET`) where the app runs, or
  - A secret manager (e.g. GCP Secret Manager, AWS Secrets Manager) and pass the value into your server/config at runtime.
- When creating keys or verifying, use the same secret everywhere.

Nothing to paste back into Cursor; just ensure your deployment/config uses a secret from env or a secret manager.

---

## 2. What to bring back into Cursor

- **If the npm Publish workflow failed:** the exact error message from the failed step (or a short screenshot).
- **If CI failed:** the error message or a screenshot of the failed job.
- **If you changed `packages/core/package.json` (repository/homepage/bugs):** no need to paste; just confirm the file is saved and committed.
- **After everything succeeds:** a short confirmation, e.g. “Phase 1 manual steps done: CI green, tag pushed, Publish workflow green, npm shows @restormel/keys@0.1.0.” (First publish is complete as of v0.1.0.)
- **Do not** paste your NPM_TOKEN or any other secret into Cursor.

---

## 3. What to do with any code or files

- **NPM_TOKEN:** Stored only in GitHub → Settings → Secrets and variables → Actions. Never in `.env`, in code, or in the repo.
- **Hash secret (production):** In env or a secret manager only; never committed.
- **`packages/core/package.json`:** If you edited repository/homepage/bugs, keep those changes and commit them with the rest of your Phase 1 work.
- **Pulumi config:** Stored in `infra/Pulumi.production.yaml` or via `pulumi config set` (state); do not commit secrets (e.g. if you ever put a secret in config, use `pulumi config set --secret`).
- No need to paste any generated code or config back into the editor unless you want Cursor to adjust the deploy workflow or docs.

---

## 4. What to ask Cursor next

After you’ve finished the steps above (and the Publish workflow has succeeded), you can say:

```
Phase 1 manual steps are done. I added NPM_TOKEN to GitHub, pushed the keys-v0.1.0 tag, and the Publish workflow succeeded. npm info @restormel/keys shows the package. **First publish complete:** @restormel/keys v0.1.0 is published; STATUS.md, ROADMAP, and CHANGELOG have been updated. Original request was: update STATUS.md and any docs that reference “first publish” or “phase 1 complete” to reflect that @restormel/keys v0.1.0 is published, and add a short note to CHANGELOG for the first npm release.
```

If the Publish workflow failed:

```
The Publish workflow failed. [Paste the error message or describe what you see.] I added NPM_TOKEN in GitHub Actions secrets. Please help me fix the publish step.
```

If CI failed:

```
CI is failing. [Paste the error or describe the failed job.] Please help me fix it.
```

---

## 5. Safety checks before continuing

- **NPM_TOKEN:** Never committed, never pasted into Cursor or any file; it exists only in GitHub Actions secrets.
- **Tag:** You ran `git push origin keys-v0.1.0` and the command completed without error.
- **Workflow:** In the Actions tab, the run for tag `keys-v0.1.0` shows a green “Publish to npm” step (or you have the error message to share).
- **npm:** [https://www.npmjs.com/package/@restormel/keys](https://www.npmjs.com/package/@restormel/keys) shows v0.1.0, or `npm info @restormel/keys` returns package details.
- **Hash secret:** For any production use of key hashing/verification, the secret is only in env or a secret manager, not in the repo.

---

## Summary by Phase 1 prompt

| Prompt | What was implemented | Manual action required |
|--------|----------------------|------------------------|
| 1.1    | Repo/workspace       | Ensure repo exists and push; verify `pnpm install` (A1–A2). |
| 1.2    | Core build           | None. |
| 1.3    | CI/CD                | Verify CI runs (A2). Optional later: GCP secrets and deploy steps (D6, E). |
| 1.4    | Pulumi infra         | Optional until deploy: GCP project, APIs, Pulumi login/config, `pulumi up` (D1–D6). |
| 1.5    | Provider adapters    | None. |
| 1.6    | Storage adapters     | None. |
| 1.7    | Router/cost/wallet   | None. |
| 1.8    | Server middleware    | None. |
| 1.9    | Key hashing/security | Production: set hash secret in env or secret manager (F). |
| 1.10   | First npm publish    | npm token, GitHub secret, repo URLs, push tag, verify (B, C). |

---

*Reference: [07-prompt-pack-phase-1.md](07-prompt-pack-phase-1.md).*
