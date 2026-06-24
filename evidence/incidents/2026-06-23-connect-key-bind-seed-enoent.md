---
id: REC-INC-008
title: "Incident — Prod key→stage bind 500 (apply-recommended-routes; bundled adapter-node import.meta.url seed-path overshoot → ENOENT model-catalog-seed.json)"
class: evidence
owner: "@adam"
status: closed
classification: internal
control-tier: 3
created: 2026-06-23
last-reviewed: 2026-06-23
review-interval: P12M
retention: P6Y
approved-by: "@adam"
approved-on: 2026-06-23
related: [REC-TPL-004, REC-INC-001, REC-INC-003]
---

# Incident — Prod key→stage bind 500 (bundled adapter-node seed-path ENOENT)

> Filed from REC-TPL-004. Append-only once closed. Severity **medium** — a founder-facing
> Connect onboarding action (apply recommended models / bind key→stage) was 100% broken in
> production with an HTTP 500; no data loss, no confidentiality/integrity impact (the request
> failed at a filesystem read **before** any DB write or key/credential code ran).

- **Detected:** 2026-06-23 — confirmed live on **restormel.dev** (prod dashboard, box `.167`).
  The Connect pipeline action **"apply recommended models / bind key→stage"** — `POST
  /keys/dashboard/api/connect/pipeline/apply-recommended-routes` (live route name
  `stage-models/apply`) — returned **HTTP 500**. **Reported by:** prior read-only
  investigation → this fix. **Severity:** medium. **Recurring:** yes — deterministic, every
  attempt on the bundled prod build.

- **What happened:** The apply-recommended-routes / stage-models bind handler synchronously
  loads the bundled model catalogue seed (`apps/dashboard/data/model-catalog-seed.json`) at
  module init (via `ensureModelCatalogSynced` / `loadSeedModels`). On the **bundled
  adapter-node prod build** that read threw **`ENOENT`** because the seed path resolved to the
  wrong location (`/app/apps/data/model-catalog-seed.json` — the `dashboard/` segment dropped).
  The throw happened **before any DB or key/credential code ran**, so SvelteKit's `handleError`
  surfaced a bare **500 "Internal Error"**.

- **Impact:** The founder-facing **key→stage bind / "apply recommended models"** action was
  **fully broken in production** (every attempt 500'd), blocking that step of Connect
  onboarding. **Availability of one action only** — the rest of restormel.dev and the dashboard
  were unaffected. **No data loss; no confidentiality or integrity impact** — the failure was a
  read of a **non-secret, static** seed JSON that aborted before any write, and **no provider
  key, gateway key, encrypted credential, or session token was read, logged, or exposed** on
  the failing path. The seed file itself contains only public model-catalogue metadata (no
  secrets).

- **Response (investigation + remediation):**
  - Root cause was established read-only in the prior investigation and confirmed by static
    analysis of the bundled output: the seed path was computed with a fixed
    `import.meta.url`-relative climb (`new URL("../../../../data/model-catalog-seed.json",
    import.meta.url)`) in two server modules —
    `apps/dashboard/src/lib/server/connect/model-catalog-sync.ts` (~L48-50) and
    `apps/dashboard/src/lib/server/catalogue/seed-repository.ts:15`.
  - **Fix implemented** (branch `fix/model-catalog-seed-enoent`, PR — see Follow-ups): a shared
    robust runtime resolver `resolveSeedPath`
    (`apps/dashboard/src/lib/server/catalogue/seed-path.ts`), mirroring the `resolveRepoRoot`
    pattern merged in **112b8c99**. It prefers the module-relative candidate when it exists on
    disk (unchanged source/prerender behaviour), else walks up from `process.cwd()` to the
    `pnpm-workspace.yaml` workspace marker and resolves the canonical
    `apps/dashboard/data/model-catalog-seed.json`. Applied to **both** consumers.
  - **Validation:** dashboard typecheck (no new errors from the change — 2 pre-existing
    `better-auth.ts` type errors are unrelated and untouched), **production build green**
    (adapter bundle emits the resolver into `chunks/seed-path.js` with the cwd-walk fallback
    intact), targeted unit tests for the resolver (3 branches) + full catalogue & connect
    server suites **619/619 + 25/25 green**.
  - **High-risk-security gate: PASS** — Connect + SvelteKit server route + BYOK-adjacent.
    Diff carries no secrets, no raw-key logging, no `process.env` secret reads, no auth/scope
    change; no attacker-controlled input reaches any `existsSync`/`readFileSync` (path inputs
    are build-time constants and fixed markers — no path traversal). Hygiene scripts
    (check-secrets / hygiene / deps-policy) green; **Aikido SAST + secrets scan: 0 issues**;
    no new dependencies.

- **Root cause:** **Bundled adapter-node `import.meta.url` path overshoot.** A fixed
  module-relative climb to a runtime asset is correct in the **source tree** and under
  **SvelteKit prerender** (build time), but in the **bundled adapter-node runtime** the
  importing module is emitted at a **shallower depth**, so the same relative climb **overshoots**
  — here it drops the `dashboard/` segment and points at a path that does not exist → `ENOENT`.
  The asset (`model-catalog-seed.json`) ships at `apps/dashboard/data/`, but the bundled code
  looked under `apps/data/`.

- **🚩 RECURRING PATTERN — 3rd known instance of this exact class:**
  1. **112b8c99** — `REPO_ROOT` in the records gate (`records/gate.ts`) overshot in the bundle
     → authed `/keys/v1/records` feed returned 0 records in prod. Fixed with `resolveRepoRoot`.
  2. **starter-corpus ENOENT** — the live Connect starter-corpus directory load
     (`connect/starter-corpus.ts`) — same overshoot class (a separate agent is fixing that
     instance concurrently; this incident deliberately did **not** touch shared build config to
     avoid conflicting edits).
  3. **THIS incident** — `model-catalog-seed.json` path in `model-catalog-sync.ts` +
     `seed-repository.ts`.
  Each was a point-fix of the same defect. The structural risk is that **any** server module
  that resolves a shipped non-code asset via a fixed `import.meta.url` climb will silently work
  in dev/CI/prerender and break only in the bundled prod runtime — invisible until a founder
  hits the route in prod. Tracked as **RISK-014** in `governance/risk-register.yaml`.

- **Follow-ups:**
  - **🚩 RECOMMENDED systemic guard (recommend, NOT implemented here)** — pick one and apply
    repo-wide so this class cannot recur per-file: **(a)** a **build-time copy** of
    `apps/dashboard/data/` (and other shipped runtime assets) into the server bundle at a stable,
    bundle-relative location, so runtime asset paths are deterministic regardless of bundle
    depth; **OR (b)** **mandate the shared resolver** (`resolveSeedPath` / `resolveRepoRoot`)
    for every shipped-asset path and add a **lint/CI grep** that fails on a raw
    `new URL("../…", import.meta.url)` / fixed-climb asset read in `src/lib/server/`.
    Build-config edits were deliberately **left out of this PR** because a separate agent is
    concurrently fixing the starter-corpus instance; converging the systemic guard in one place
    avoids conflicting build-config changes. *(track as a PBI; coordinate with the starter-corpus
    fix.)*
  - **Prod error visibility** — there is still **no `restormel` Sentry project** (per REC-INC-003);
    this 500 was diagnosed from code + symptom, not a captured trace. Confirm PostHog server
    exception capture is wired for the dashboard, or add a dedicated error project. *(PBI)*
  - **Risk register:** added **RISK-014** (bundled adapter-node asset-path overshoot) — staged
    with this PR.
  - **Deploy:** the fix is **NOT deployed**. It needs a **Coolify redeploy of
    `restormel-dashboard-prod` on box `.167`** (or it ships with the K3s cutover). Founder action.
  - **Closed:** 2026-06-23 (fix implemented + tests/build/security gate green + PR opened;
    pending founder deploy to `.167`).
