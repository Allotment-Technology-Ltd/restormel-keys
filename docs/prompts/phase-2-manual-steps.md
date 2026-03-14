# Phase 2 — Manual steps required

This document lists **all** manual actions required to complete Phase 2 of the Restormel Keys project, as defined in [08-prompt-pack-phase-2.md](../reference/08-prompt-pack-phase-2.md). It is beginner-friendly and step-by-step. Menu names in third-party UIs may vary slightly.

---

## Overview

Phase 2 covers: Svelte components (KeyManager, ModelSelector, CostEstimator), Web Components (keys-elements), React wrapper and hooks, Next.js demo, CLI, SOPHIA integration runbook, accessibility audit, publish Phase 2 packages (keys 0.2.0, svelte/elements/react/cli 0.1.0), and SvelteKit demo. Most work is code-only. The main manual actions are: **publishing Phase 2 packages to npm** (tag and push), **optional verification** of demos and CLI, and **SOPHIA integration** (done in the SOPHIA repo).

---

## 1. What you need to do now

Do these in the order below. Skip a step only if the note says “optional” or “when you’re ready.”

### A. Lockfile and install (before publish)

**A1. Ensure the lockfile includes all Phase 2 packages.**

1. In a terminal, in the **repo root** (the folder that contains `packages/` and `apps/`):
   ```bash
   pnpm install --no-frozen-lockfile
   ```
2. If the command reports “Already up to date” or adds/updates packages and completes without error, you’re done.
3. If it fails (e.g. missing workspace package), fix the reported error (e.g. add the missing dependency in the right `package.json`) and run `pnpm install --no-frozen-lockfile` again.
4. **Commit the updated `pnpm-lock.yaml`** (and any `package.json` fixes) so CI and others get the same dependency tree:
   ```bash
   git add pnpm-lock.yaml package.json packages/*/package.json apps/*/package.json
   git status
   git commit -m "chore: update lockfile for Phase 2 packages"
   git push origin main
   ```

You do **not** need to paste anything back into Cursor unless the install failed.

---

### B. Publish Phase 2 packages (Prompt 2.9)

**B1. Confirm you have an npm Automation token in GitHub.**

- Phase 1 manual steps should have added **NPM_TOKEN** in GitHub → **Settings** → **Secrets and variables** → **Actions**.
- If you have **not** done Phase 1 publish yet, do the token steps in [phase-1-manual-steps.md](../reference/phase-1-manual-steps.md) (sections C2–C3) first.
- **Do not** create a new token just for Phase 2; reuse the same secret name `NPM_TOKEN`.

**B2. Dry-run publish from the repo root.**

1. In a terminal, in the **repo root**:
   ```bash
   pnpm -r run build
   ```
   Confirm all packages build (core, svelte, elements, react, cli). Fix any build errors before continuing.
2. Run a publish dry-run so nothing is actually published:
   ```bash
   pnpm -r publish --dry-run --no-git-checks
   ```
3. Check the output: it should list the packages and the version each would publish (e.g. `@restormel/keys@0.2.0`, `@restormel/keys-svelte@0.1.0`, etc.). No Vue package should appear.
4. If anything looks wrong (e.g. wrong version, or test files included in `files`), stop and fix the package’s `package.json` or `files` field before doing the real publish.

You do **not** paste output back unless something failed.

**B3. Commit and push the default branch, then push the tag.**

1. In the repo root:
   ```bash
   git add -A
   git status
   ```
   Confirm the changes are what you expect (e.g. README, CHANGELOG, version bumps, new apps/demos).
2. Commit (adjust message if needed):
   ```bash
   git commit -m "chore: Phase 2 — keys 0.2.0, svelte/elements/react/cli 0.1.0, demos, a11y, README"
   ```
3. Push the default branch (e.g. `main`):
   ```bash
   git push origin main
   ```
4. Create and push the tag that triggers the Publish workflow:
   ```bash
   git tag keys-v0.2.0
   git push origin keys-v0.2.0
   ```
5. Note whether both `git push` commands succeeded. If the tag push fails (e.g. “tag already exists”), delete the tag locally and on the remote, then re-tag at the correct commit and push again.

**B4. Confirm the Publish workflow and npm.**

1. On GitHub: open your repo → **Actions** tab.
2. Find the workflow run triggered by the tag **keys-v0.2.0** (e.g. “Publish” or “Publish to npm”).
3. Open the run and confirm all jobs/steps are green. If any step is red, note the **exact error message** (or take a short screenshot of the failed step).
4. On npm, confirm the packages and versions:
   - [https://www.npmjs.com/package/@restormel/keys](https://www.npmjs.com/package/@restormel/keys) → **0.2.0**
   - [https://www.npmjs.com/package/@restormel/keys-svelte](https://www.npmjs.com/package/@restormel/keys-svelte) → **0.1.0** (if published)
   - [https://www.npmjs.com/package/@restormel/keys-elements](https://www.npmjs.com/package/@restormel/keys-elements) → **0.1.0** (if published)
   - [https://www.npmjs.com/package/@restormel/keys-react](https://www.npmjs.com/package/@restormel/keys-react) → **0.1.0** (if published)
   - [https://www.npmjs.com/package/@restormel/keys-cli](https://www.npmjs.com/package/@restormel/keys-cli) → **0.1.0** (if published)
5. Optionally in a terminal:
   ```bash
   npm info @restormel/keys
   npm info @restormel/keys-svelte
   ```

If the workflow failed, copy the **exact error message** (or a short screenshot of the failed step) to bring back to Cursor.

---

### C. Optional: verify demos and CLI locally

**C1. Next.js demo (apps/demo-next).**

1. In the repo root:
   ```bash
   pnpm install
   pnpm --filter @restormel/keys build
   pnpm --filter demo-next build
   pnpm --filter demo-next run dev
   ```
2. Open [http://localhost:3000](http://localhost:3000) in a browser.
3. Go to **Settings**. Confirm the page shows the KeyManager (e.g. “API keys”, “Add key”, and optionally “Models”).
4. Optionally add a key (use a placeholder value for testing; never a real key) and confirm it appears in the list.
5. Stop the dev server (Ctrl+C).

Nothing to paste back unless something didn’t load or you want Cursor to fix an error.

**C2. SvelteKit demo (apps/demo-svelte).**

1. In the repo root:
   ```bash
   pnpm --filter @restormel/keys-svelte build
   pnpm --filter demo-svelte run dev
   ```
2. Open [http://localhost:5173](http://localhost:5173).
3. Go to **Settings**. Confirm KeyManager and ModelSelector are visible; optionally add a key and confirm it lists.
4. Stop the dev server.

**C3. CLI (keys init, keys doctor).**

1. In the repo root:
   ```bash
   pnpm --filter @restormel/keys-cli build
   node packages/cli/dist/index.js doctor
   ```
2. Run from a fresh Next.js app (or from `apps/demo-next`):
   ```bash
   cd apps/demo-next
   node ../../packages/cli/dist/index.js init
   node ../../packages/cli/dist/index.js doctor
   ```
3. Confirm `doctor` exits 0 and reports framework and suggested packages. Nothing to paste back unless you want a fix.

---

### D. SOPHIA integration (Prompt 2.7) — when you integrate

Phase 2 includes a **runbook** for replacing SOPHIA’s inline BYOK with `@restormel/keys`. The actual code changes happen **in the SOPHIA repo**, not in restormel-keys.

**D1. Open the SOPHIA repo.**

1. Clone or open the repository that contains the SOPHIA application (e.g. `Allotment-Technology-Ltd/sophia` or your fork).
2. Use the runbook in restormel-keys: **docs/reference/sophia-integration.md**.

**D2. In the SOPHIA repo, follow the runbook.**

1. In SOPHIA’s root, run:
   ```bash
   pnpm add @restormel/keys
   ```
2. Create `src/lib/server/keys-adapter.ts` (or the equivalent path in SOPHIA) using the template and instructions in **docs/reference/sophia-integration.md**. Implement KeyStorage with your Firestore client and auth (getUserId from your existing session).
3. Refactor BYOK routes to call the Keys middleware; keep the same API contracts and all SOPHIA-specific billing (wallet, top-ups, founder offers).
4. Run the full SOPHIA test suite and verify the BYOK flow end-to-end (add key, list, use, delete).

**D3. What to bring back.**

- If SOPHIA tests fail or BYOK is broken: paste the error message or a short description so Cursor (or you) can adjust the runbook or the adapter.
- If everything passes: no need to paste anything back into restormel-keys; the runbook is complete.

**Secrets:** Do **not** commit raw API keys or new secrets in the SOPHIA repo. Use your existing pattern (e.g. hashed keys in Firestore, env for hash secret).

---

## 2. What to bring back into Cursor

- **If the Publish workflow failed:** the exact error message from the failed step (or a short screenshot).
- **If CI failed:** the error message or a screenshot of the failed job.
- **If you changed any package.json (e.g. versions or repo URLs):** no need to paste; confirm the file is saved and committed.
- **After publish succeeds:** a short confirmation, e.g. “Phase 2 manual steps done: pushed keys-v0.2.0, Publish workflow green, npm shows @restormel/keys@0.2.0 and Phase 2 packages at 0.1.0.”
- **Do not** paste **NPM_TOKEN** or any other secret into Cursor.
- **SOPHIA:** Only if something failed (tests or BYOK); paste the error or describe what you see.

---

## 3. What to do with any code or files

- **NPM_TOKEN:** Stored only in GitHub → Settings → Secrets and variables → Actions. Never in `.env`, in code, or in the repo.
- **pnpm-lock.yaml:** Commit the updated lockfile so CI and collaborators use the same dependencies.
- **Package versions:** Already set in package.json (e.g. core 0.2.0, svelte/elements/react/cli 0.1.0); no need to paste back.
- **SOPHIA:** All new code (keys-adapter, route changes) lives in the SOPHIA repo. Do not commit secrets there; use env or secret manager for any new secrets.
- **CLI key store:** The CLI stores keys in `.restormel/key-store.json` (gitignored). Never commit that file or paste its contents.

---

## 4. What to ask Cursor next

After you’ve finished the steps above (and the Publish workflow has succeeded), you can say:

```
Phase 2 manual steps are done. I pushed the keys-v0.2.0 tag and the Publish workflow succeeded. npm shows @restormel/keys@0.2.0 and the Phase 2 packages at 0.1.0. Please update STATUS.md and ROADMAP (and any docs that reference “Phase 2 complete” or “first publish of UI packages”) to reflect that Phase 2 publish is complete.
```

If the Publish workflow failed:

```
The Publish workflow failed for tag keys-v0.2.0. [Paste the error message or describe what you see.] NPM_TOKEN is set in GitHub Actions. Please help me fix the publish step.
```

If CI failed:

```
CI is failing after Phase 2 changes. [Paste the error or describe the failed job.] Please help me fix it.
```

If you did SOPHIA integration and something broke:

```
I followed docs/reference/sophia-integration.md in the SOPHIA repo. [Describe what failed: tests, BYOK flow, or paste the error.] Please help me fix the adapter or the runbook.
```

---

## 5. Safety checks before continuing

- **NPM_TOKEN:** Never committed, never pasted into Cursor or any file; it exists only in GitHub Actions secrets.
- **Tag:** You ran `git push origin keys-v0.2.0` and the command completed without error.
- **Workflow:** In the Actions tab, the run for tag `keys-v0.2.0` shows a green publish step (or you have the error message to share).
- **npm:** [https://www.npmjs.com/package/@restormel/keys](https://www.npmjs.com/package/@restormel/keys) shows 0.2.0; other Phase 2 packages show 0.1.0 if you published them.
- **Lockfile:** `pnpm-lock.yaml` is committed so CI does not fail with “lockfile out of date”.
- **SOPHIA:** If you integrated, no raw keys or new secrets are committed; BYOK flow and tests pass.

---

## Summary by Phase 2 prompt

| Prompt   | What was implemented                    | Manual action required |
|----------|----------------------------------------|------------------------|
| 2.1      | KeyManager (Svelte)                    | None. |
| 2.2      | ModelSelector, CostEstimator, icons    | None. |
| 2.3      | keys-elements (Web Components)         | None. |
| 2.4      | keys-react (KeyManager, hooks, etc.)   | None. |
| 2.5      | Next.js demo (apps/demo-next)          | Optional: run and verify (C1). |
| 2.6      | CLI (keys init, add, list, etc.)        | Optional: run doctor (C3). |
| 2.7      | SOPHIA integration runbook             | In SOPHIA repo: add dep, keys-adapter, refactor routes (D). |
| 2.8      | Accessibility audit (axe, keyboard)    | None. |
| 2.9      | Publish Phase 2 packages               | Lockfile (A), dry-run (B2), tag keys-v0.2.0, push, verify (B3–B4). |
| 2.10     | SvelteKit demo (apps/demo-svelte)       | Optional: run and verify (C2). |

---

*Reference: [08-prompt-pack-phase-2.md](../reference/08-prompt-pack-phase-2.md).*
