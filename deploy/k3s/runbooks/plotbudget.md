# Cutover runbook — PlotBudget → K3s (self-hosted Supabase on CNPG)

**Move PlotBudget off Vercel + managed Supabase onto K3s with a self-hosted Supabase stack
(GoTrue + PostgREST + Storage + Realtime + Kong + Studio) backed by the dedicated
`pg-plotbudget` CloudNativePG cluster, using a short `pg_dump` maintenance window.**

> **HIGHEST-RISK MOVE.** PlotBudget holds **real user financial data**, and its entire security
> boundary is **158 RLS policies keyed on `auth.uid()`** plus the **GoTrue auth identity system**
> (bcrypt hashes, OAuth identities). This base runbook covers the **data + app + Supabase-services**
> move. The **auth + RLS revalidation** — the part that must be *rehearsed and tested* before the
> real cutover — is its own runbook: **[`plotbudget-auth-rls.md`](plotbudget-auth-rls.md)**. Do not
> run the real PlotBudget cutover until that rehearsal has passed its go/no-go gate.

- **Decision: Option 1 — self-host the full Supabase stack** (full-plan §B). RLS ports **unchanged**
  (`auth.uid()` keeps resolving under self-hosted GoTrue + PostgREST). Option 2 (rewrite onto Better
  Auth) is a deferred, separate ADR — **not** part of this infra cutover.
- **Source of truth during the window:** the managed Supabase project stays authoritative and
  frozen until the K3s target is verified.
- **Cutover switches:** `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` (→ self-hosted Kong), the
  anon/service-role keys (re-issued under the self-hosted JWT secret), and the app's DNS.
- **Rollback:** re-point the Supabase URL + keys (and DNS) back to managed Supabase.
- **Reference:** full-plan §B, §D (B2); k3s-design §3.5, §4.1 (`pg-plotbudget` dedicated cluster).

---

## 0. Scope & invariants

| Item | Detail |
|---|---|
| **Database** | Supabase Postgres 17.6.1 → CNPG `pg-plotbudget` (dedicated; isolates `auth`/`storage`/`pgjwt`/`pg_graphql` roles+extensions). |
| **Supabase services** | GoTrue 2.186, PostgREST 14.1, Storage 1.37, Realtime, Kong (gateway), Studio — Helm/manifests on K3s, pointed at CNPG. |
| **App** | Next.js 16.2.6 / React 19, `output: 'standalone'` (Dockerfile already built) → Deployment. Image-optimization + cron need self-hosted equivalents (K8s CronJobs). |
| **Data layer** | **1,201 `supabase.from()` calls / ~40 tables, no ORM** — all ride PostgREST under the anon key, secured by RLS. PostgREST **must** come up correctly or the app is dark. |
| **Auth + RLS** | `auth.users`/`auth.identities`/sessions + **158 `auth.uid()` RLS policies** → see [`plotbudget-auth-rls.md`](plotbudget-auth-rls.md). **HARD GATE.** |
| **Storage** | Buckets `vault-documents` (private, household-scoped RLS) + `avatars` (public) — real user documents. Bucket objects + object metadata + policies all migrate. |
| **Email hook** | `send-resend-email` edge function = GoTrue Send-Email Hook (HMAC, `verify_jwt=false`) — redeploy as a self-hosted endpoint and re-point GoTrue's hook URL. |
| **JWT** | `SUPABASE_JWT_SECRET` — the self-hosted stack needs **its own** JWT secret; anon + service-role keys are **re-minted** against it (old keys stop working post-cutover — expected). |
| **Region** | Managed Supabase is `eu-west-2` (London) — **already EU**. The move is a self-hosting / control win, not a data-residency fix. Frame in ROPA/privacy notice (full-plan §E.5). |
| **Secrets** | Via ESO ← Infisical. No plaintext. |

---

## 1. Pre-checks (green-light gate)

- [ ] **[`plotbudget-auth-rls.md`](plotbudget-auth-rls.md) rehearsal PASSED its go/no-go gate** on a
      throwaway copy (auth import verified + all 158 RLS policies pass positive **and** negative tests).
- [ ] `pg-plotbudget` CNPG healthy; required extensions present (`uuid-ossp`, plus the Supabase
      roles/extensions: `auth`, `storage`, `pgjwt`, `pg_graphql`).
- [ ] Self-hosted Supabase services deployed and healthy against an **empty** `pg-plotbudget`
      (GoTrue, PostgREST, Storage, Realtime, Kong, Studio all `Ready`).
- [ ] Self-hosted JWT secret minted in Infisical; anon + service-role keys derived; app build
      configured to read the **new** URL + keys via ESO.
- [ ] Google + Apple OAuth apps **re-registered** with the self-hosted GoTrue callback URLs
      (redirect URIs added); client id/secret in Infisical.
- [ ] `send-resend-email` hook redeployed as a self-hosted endpoint; GoTrue hook URL + HMAC secret set.
- [ ] Storage bucket migration method chosen + tested (object copy + metadata + policies).
- [ ] Next.js standalone image built + pushed; manifests + CronJobs in `restormel-gitops`; Argo ready.
- [ ] Fresh independent backup of the managed Supabase DB exists.
- [ ] Maintenance window communicated; **two operators present (mandatory for PlotBudget)**.

---

## 2. Maintenance-window steps

> Tight window. The auth/RLS verification (§2.5) is the long pole — budget for it. All steps logged.

### 2.1 Freeze the source

```bash
# Put the managed Supabase project into a no-write state for the window:
#  - take the Vercel app offline (maintenance page) so the app issues no writes, AND
#  - revoke app write paths (or simply rely on the app being down — the dominant write source).
# Confirm no app/PostgREST connections remain writing to the source:
psql "$SOURCE_SUPABASE_DB_URL" -c \
  "SELECT count(*) FROM pg_stat_activity WHERE state='active' AND application_name NOT LIKE 'psql%';"
```

### 2.2 `pg_dump` the source (schema-aware: `auth`, `storage`, `public`)

```bash
# Dump ALL relevant schemas — public + auth + storage. Custom format, no owner/privs.
pg_dump --format=custom --no-owner --no-privileges \
  --schema=public --schema=auth --schema=storage \
  --file=/tmp/plotbudget.dump "$SOURCE_SUPABASE_DB_URL"
sha256sum /tmp/plotbudget.dump   # record in migration-log.md
```
> The detailed auth/identity/RLS handling — what to dump, role mapping, the `auth.uid()` resolution
> path under self-hosted GoTrue — is in [`plotbudget-auth-rls.md`](plotbudget-auth-rls.md). Follow it
> for the `auth`/`storage` schema specifics.

### 2.3 Restore into CNPG `pg-plotbudget`

```bash
pg_restore --no-owner --no-privileges --exit-on-error \
  --dbname "$TARGET_PG_PLOTBUDGET_URL" /tmp/plotbudget.dump
```

### 2.4 Migrate storage bucket objects

```bash
# Copy bucket objects (vault-documents private, avatars public) from managed Supabase Storage
# to the self-hosted Storage backend, preserving object paths + metadata so storage RLS still
# resolves. Verify object counts + a sample signed-URL download per bucket.
```
- [ ] `vault-documents` + `avatars` object counts match source.
- [ ] A private `vault-documents` object is downloadable **only** via a valid signed URL (RLS intact).

### 2.5 Verify auth + RLS on the target (HARD GATE — the long pole)

Run the full positive + negative RLS suite from
[`plotbudget-auth-rls.md`](plotbudget-auth-rls.md) §RLS revalidation against the restored
`pg-plotbudget` + the self-hosted GoTrue/PostgREST:

- [ ] All `auth.users` / `auth.identities` rows imported; counts match; a test user can authenticate.
- [ ] **Positive:** a user CAN read their own household's rows across all RLS tables.
- [ ] **Negative:** the same user CANNOT read another household's rows on any of the 158 policies.
- [ ] OAuth login (Google, Apple) works against self-hosted GoTrue.
- [ ] The email hook fires (e.g. a password-reset email is sent via the redeployed hook).

**If any positive or negative RLS test fails → STOP. Roll back (§3). Do not flip the app.**

### 2.6 Flip the Supabase URL + keys (the cutover)

```bash
# Point the app at the self-hosted stack via ESO/Infisical, then Argo-sync:
#   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL → https://<kong-ingress for PlotBudget domain>
#   NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY → re-minted keys
kubectl -n apps rollout status deploy/plotbudget-web
```

### 2.7 Smoke test on K3s

- [ ] App loads at the PlotBudget domain → cluster ingress; cert valid.
- [ ] Log in (password, Google, Apple); session via `@supabase/ssr` cookie SSR works; middleware
      `getUser()` resolves on a protected request.
- [ ] A normal read + write through PostgREST (`supabase.from(...)`) succeeds and is **household-scoped**.
- [ ] Upload + signed-URL download from `vault-documents`; avatar update reflects (Realtime).
- [ ] A password-reset email arrives (email hook end-to-end).
- [ ] Re-run a representative positive + negative RLS check against the **live** stack.

### 2.8 Close the window

- [ ] Remove the maintenance page.
- [ ] Keep the **managed Supabase project warm and authoritative** as the rollback target for an
      extended soak (≥ 72 h recommended given financial data) before any decommission.

---

## 3. Rollback (re-point the Supabase URL + keys)

If verification or smoke tests fail:

```bash
# 1. Re-point NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL + anon/service-role keys back to the
#    MANAGED Supabase project (ESO/Infisical re-sync).
# 2. Bring the Vercel app back online; DNS back to Vercel.
```

- The managed Supabase project was **frozen, not mutated**, so it is still authoritative and
  consistent. Because the app was offline on the source during the window, there are **no divergent
  writes**. Rollback is a URL/key/DNS re-point — no data restore needed.
- File an incident record (REC-TPL-004) and run the `restormel-high-risk-security` review on the
  finding, per CLAUDE.md (this is a security-boundary system).

---

## 4. Validation checklist (window close criteria)

- [ ] CNPG `pg-plotbudget` healthy; Barman WAL + base backup to Object Storage green.
- [ ] `public` + `auth` + `storage` schemas restored; row-count parity on load-bearing tables.
- [ ] Storage objects migrated; signed-URL access intact; private bucket not publicly readable.
- [ ] **All 158 RLS policies pass positive + negative tests** (per `plotbudget-auth-rls.md`).
- [ ] GoTrue auth (password + Google + Apple) works; email hook fires.
- [ ] App serving from K3s; PostgREST data layer works; Realtime subscriptions work.
- [ ] Managed Supabase kept warm + authoritative through the soak period.
- [ ] Actions logged to `migration-log.md`; high-risk-security review on record.
