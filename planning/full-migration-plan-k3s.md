---
title: Full Migration Plan — Coolify + Vercel/Railway/Supabase → self-hosted K3s
class: planning
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-19
last-reviewed: 2026-06-19
review-interval: P12M
---

# Full Migration Plan — everything onto one sovereign K3s cluster

**Discovery + planning only.** No execution, no config files, no schema/data changes, no touching live
data. Review before any work begins. Read-only discovery done 2026-06-19 against the real codebases on
this machine (Restormel, Allotmentology, UseSophia, **and PlotBudget**) plus the live Hetzner boxes.

**Target (decided in prior planning — built on, not re-litigated):** one sovereign **K3s** cluster on the
3 existing Hetzner boxes (2× CX33 + 1× CX43, Helsinki) + autoscaled burst nodes via **hetzner-k3s**;
Hetzner EU, OSS-only; Postgres via **CloudNativePG (CNPG)**; SurrealDB in-cluster on **Hetzner CSI**;
backups to the **1 TB Storage Box**; **Coolify retired** as orchestrator.

**Phasing:** **Phase A** = existing Coolify stack → K3s (Restormel, Allotmentology, SurrealDB, CI, the
self-hosted Postgres DBs). **Phase B** = PlotBudget + UseSophia → K3s **directly** (not via Coolify).

> ⚠️ **The K3s/CNPG target design does not exist yet** — confirmed with the founder 2026-06-19 (not in this
> repo, not in a prior pack). A full sweep found **zero** k3s/hetzner-k3s/CNPG/Velero/Barman references;
> everything in-repo describes the *previous* Coolify two-box split (REC-PLAN-012) — the current state K3s
> replaces. **The target design is therefore a deliverable of this effort** — a companion doc
> `k3s-cluster-target-design.md` produced by a dedicated, skilled design pass, gated on the founder decisions
> in §E (asked directly, not just filed). This plan maps current-state → target-shape; the companion design
> fills in the cluster / CNPG / CSI / ingress / autoscaling detail.

---

## STEP 0 — Access reality

| Product | Codebase reachable? | Where | What's missing |
|---|---|---|---|
| **Restormel** | ✅ | `/Users/adamboon/projects/restormel-keys` | — (this repo) |
| **Allotmentology** | ✅ | `/Users/adamboon/projects/allotment-technology-ltd` (`web/`) | — |
| **UseSophia** | ✅ | `/Users/adamboon/projects/sophia` | live secret *values* only |
| **PlotBudget** | ✅ **(found — not under ~/projects)** | `/Users/adamboon/plotbudget/` (repo `plotbudget-v2`) | live secret *values* + a few runtime confirmations |

**All four codebases — including the full PlotBudget Supabase schema (82 migrations, 27 with RLS),
`config.toml`, and edge functions — are on disk.** We do **not** need the founder to send code. The only
hard gaps are (a) **secret values** (live connection strings / service-role keys, held in Vercel/Supabase/
Railway/Coolify + `.secrets-sync.local`) which are needed for *actual* data migration, not planning, and
(b) a few runtime facts that can't be read from code alone (below).

### A. Information-request checklist (narrow — code is in hand)

**PlotBudget**
- ~~Supabase region~~ — **answered: `eu-west-2` (London), already EU** (project ref `jxykecjepxtxzprxheaz`).
- ~~Which features are live~~ — **answered by the deep-dive:** Auth + PostgREST + Storage + Realtime all used.
- Secret values for migration: `SUPABASE_PROD_DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_JWT_SECRET`, project ref — **supply at cutover, redacted until then**.
- Vercel project: build settings, env, custom domains/DNS, any Vercel KV/Blob/Cron/Edge config in the dashboard.
- DNS registrar access for PlotBudget's domain(s).

**UseSophia**
- Railway service config + the GitHub Actions deploy secrets (`RAILWAY_*`) — for decommission, not planning.
- Sophia's **own Neon Postgres** connection (its DB) + Neon Auth project — see the separate decision in §C.
- `usesophia.app` DNS registrar access.

**General (all products)**
- The **K3s target design pack** (see the warning above) — the single biggest missing input.
- Confirmation of the Storage Box access path for backups (SFTP today — see §D backups).

---

## B. PlotBudget — stack findings + the Supabase decision (ADR-ready)

> **Deep-dive complete (2026-06-19).** Hosted facts: Supabase **Postgres 17.6.1 / GoTrue 2.186 / Storage 1.37
> / PostgREST 14.1**, region **AWS `eu-west-2` (London)** — so user data is *already in the EU*; the move is a
> **control / self-hosting win (managed EU SaaS → self-hosted EU)**, not a data-leaving-EU fix.

**App / Vercel platform**
- **Next.js 16.2.6 + React 19** (`apps/web`), plus `apps/marketing`, `apps/native` (Expo/React Native),
  `apps/twa-play-store`. Sanity CMS (`sanity-studio/`). Hosted on **Vercel** (`.vercel/`, vercel config).
- Vercel-platform dependencies to replace when self-hosting (confirm exact set from `next.config` +
  `vercel.json` — the deep-dive enumerates): serverless/edge functions, ISR, image optimization, middleware,
  env handling. Each is a moving part needing a self-hosted equivalent (Next standalone server on K3s +
  an image-optimization story + cron as K8s CronJobs).

**Supabase usage (the crux)**
- **Auth (GoTrue) — CRITICAL, the whole identity system.** `@supabase/ssr` cookie SSR; middleware runs
  `supabase.auth.getUser()` on **every** protected request; Google+Apple OAuth, password/OTP/magic-link/
  recovery; GoTrue **admin API** (`createUser`/`deleteUser`/`generateLink`/`listUsers`); an
  `auth.users → public.users` provisioning trigger (`handle_new_user()`). Passkeys/WebAuthn layer *on top* of
  GoTrue, not a replacement.
- **PostgREST — CRITICAL, the dominant data layer.** **1,201 `supabase.from('…')` calls** across ~40 tables,
  **no ORM** — normal reads/writes ride PostgREST under the anon key, secured by RLS. (Only 3 `.rpc()`.)
- **Storage — used (real).** Buckets `vault-documents` (private, household-scoped RLS) + `avatars` (public):
  upload/signed-url/download/delete — integral to the Vault module.
- **Realtime — used, narrow.** 2 `postgres_changes` subscriptions (live avatar update, grocery/shopping sync).
- **Edge Functions — one, and it's GoTrue infra.** `send-resend-email` = the GoTrue *Send-Email Hook* (HMAC,
  `verify_jwt=false`), fired by GoTrue, **never `functions.invoke`d by the app** — lives/dies with GoTrue.
- **Extensions — essentially none** (`uuid-ossp` only; no pgvector/pg_cron/postgis/etc.).
- **RLS = 42 tables / 158 policies** (was under-counted at 27 files; the real policy count is 158).
- Env names confirm the model: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_PROD_DATABASE_URL`/`_PROJECT_REF`,
  `POSTGRES_URL`/`_NON_POOLING`/`_PRISMA_URL`, plus `VERCEL_*`.

**RLS dependency assessment (security-critical — ISMS).** **42 tables RLS-enabled, 158 policies, and *every
one* keys on a single primitive — `auth.uid()` (171 occurrences). ZERO use of `auth.jwt()`, `auth.role()`, or
`request.jwt.claims`.** Pattern is uniformly household-scoped (inline `EXISTS … households WHERE
owner_id/partner_user_id = auth.uid()`) or owner-scoped (`user_id = auth.uid()`); no helper function to
recreate. Other schema deps: `auth` (the `auth.users` FK target + the provisioning trigger) and `storage`
(bucket/object policies). **On plain CNPG without the Supabase layer, all 171 `auth.uid()` refs fail, the
`auth.users` FK + trigger die, and storage RLS is gone → the boundary breaks.** The cheap fix under vanilla
PG: a one-line `auth.uid()` shim reading a per-transaction GUC the app sets
(`set_config('request.jwt.claim.sub', <uid>, true)`) — then **all 158 policies port verbatim**. The catch:
*something must still authenticate the user and set that GUC.* Any RLS-touching plan MUST include
re-validation with positive **and** negative tests (a user still cannot read another household's rows).

**Auth & user data.** `auth.users` / `auth.identities` / sessions are a **sensitive, security-critical**
migration item (hashed credentials, OAuth identities). Data residency: confirm the current Supabase region;
moving to Hetzner EU is a **sovereignty improvement** if it's currently US-hosted.

### The decision — Option 1 vs Option 2

| | **Option 1 — Self-host Supabase on K3s** | **Option 2 — CNPG + rebuild auth/API + rewrite RLS** |
|---|---|---|
| RLS | preserved **intact** (auth.uid() etc. still resolve) | **rewritten** off Supabase primitives (app sets a session GUC / custom claim fn) — full revalidation |
| Auth | GoTrue moves as-is; identities preserved | new auth implementation; migrate `auth.users` into it |
| API | PostgREST/Realtime/Storage preserved | rebuild any data access that rode PostgREST; drop Realtime/Storage or replace |
| App changes | minimal (point at self-hosted Supabase URL) | significant rewrite |
| Ops cost | **heavier** multi-container stack (Postgres, GoTrue, PostgREST, Realtime, Storage, Kong, Studio) | lighter, consistent with the rest of the cluster |
| Sovereignty | ✅ off Supabase cloud → Hetzner EU | ✅ same, plus fewer moving parts long-term |

**Recommendation: Option 1 (self-host the full Supabase stack on K3s) — now decisive.** The deep-dive removed
the ambiguity: Auth (GoTrue) is the *entire* identity system (SSR sessions, per-request `getUser()`, OAuth,
admin API, the `auth.users` trigger, *and* a GoTrue email hook); PostgREST is the *only* data layer (1,201
calls / 40 tables, no ORM); Storage holds real household-scoped private documents. Option 2 would mean
rebuilding all of that **plus** migrating bcrypt hashes + OAuth identities out of `auth.*` — the
highest-risk, most security-sensitive rewrite possible, over real financial data. Meanwhile the usual
*pro-Option-2* cost drivers are **absent**: no exotic extensions (just `uuid-ossp`), no edge runtime, no
Vercel KV/Blob/Postgres, Redis already self-host-ready (`REDIS_URL`), and a **standalone Dockerfile already
built** (`output:'standalone'`). So self-hosting Supabase is mostly an **ops/Helm** exercise, not an app
rewrite, and RLS ports **unchanged** (`auth.uid()` keeps resolving). Shape: GoTrue + PostgREST + Storage +
Realtime (+ Studio) fronted by the existing Traefik/ingress, **backed by CNPG** as the Postgres operator
(HA/backups from CNPG, Supabase services pointed at it); re-register Google/Apple OAuth on self-hosted
GoTrue, redeploy the email hook, migrate `auth.*` + `public.*` + buckets. **Option 2 is worth it only as a
separate, *later* ADR** if you choose to consolidate identity onto Better Auth (as allotmentology.tech uses)
— a deliberate auth project (rehash-on-login, OAuth re-link, the `auth.uid()` GUC shim), not bundled into the
infra cutover.

---

## C. UseSophia — stack findings (the simpler app, with a twist)

- **Framework:** SvelteKit (Svelte 5) on **Node 22**, `adapter-node` (`node build`), SSR. pnpm 11 monorepo.
- **Railway deploy:** **Dockerfile** build (`railway.toml` → `builder = DOCKERFILE`); deployed by **GitHub
  Actions** (`railway up` via pinned `@railway/cli`), not Railway's git integration. Live domain
  **usesophia.app**. (Codebase still carries GCP Cloud Run lineage — the HTTP SurrealDB client was written
  for Cloud Run's paused-CPU model and remains the runtime path.)
- **TWO databases (critical):**
  1. **Its own Neon Postgres** (Drizzle ORM + `@neondatabase/serverless`, eu-west-2) — operational docs,
     ingestion orchestration/staging, training/eval, ingest runs. Default backend (`SOPHIA_DATA_BACKEND=neon`).
  2. **The shared SurrealDB** (knowledge graph / vector retrieval corpus) — the one on our Hetzner stack.
  - Auth = **Neon Auth** (JWT/JWKS).
- **SurrealDB link:** runtime web app uses **HTTP** (`db.ts` posts SurrealQL to `/sql`, Bearer JWT);
  scripts/workers use **WebSocket** (`surrealdb` client). One `SURREAL_URL` serves both (scheme normalised).
  Prod hits the **public `wss://surreal.restormel.dev`**, NS **`main`** / DB **`sophia`**, user `importer`.
  Env: `SURREAL_URL`, `SURREAL_USER`, `SURREAL_PASS`, `SURREAL_NAMESPACE`, `SURREAL_DATABASE`.
- **Railway platform deps:** none stateful (no Railway PG/Redis/volumes). Scheduled work = a **GitHub Actions
  cron** (`ingestion-job-tick.yml`, every 2 min) POSTing an internal tick endpoint → maps cleanly to a K8s
  **CronJob** (or a worker Deployment, `Dockerfile.ingest-worker`). Only Railway-injected var read is
  `RAILWAY_GIT_COMMIT_SHA` (version reporting) — droppable.

**Cross-phase SurrealDB dependency + sequencing.** Sophia's only coupling to the moving SurrealDB is **four
env vars** — pure env cutover, no code change. Recommended:
1. **Phase A:** stand SurrealDB up in K3s, **restore the `sophia-prod-2026-06-13.surql` dump** (581 MB, NS
   `main`/DB `sophia`), recreate the `importer` user. **Keep the `surreal.restormel.dev` DNS name** and flip
   it to the K3s ingress → the move is **transparent to Sophia** (still on Railway, same hostname). Verify
   Restormel *and* Sophia graph/retrieval paths against the new instance **before** touching Sophia.
2. **Phase B:** move Sophia to K3s as a separate step; optionally switch `SURREAL_URL` to the **internal
   cluster service DNS** (drop the public hop), and move the ingestion-tick cron to a K8s CronJob. Keep the
   old `.150` SurrealDB warm as rollback until Sophia's reads/writes are verified in-cluster.
3. **Do not** move SurrealDB and re-point Sophia in the same window.

**Separate decision — Sophia's own Neon Postgres + Neon Auth.** The SurrealDB-focused brief does **not**
cover Sophia's *own* database. Sophia still runs on **Neon Postgres + Neon Auth** (unlike Restormel, which
is now fully off Neon). Either keep Neon SaaS (K3s Sophia keeps `DATABASE_URL` → Neon eu-west-2) or schedule
a separate Postgres-into-CNPG migration + an auth move (Neon Auth → Better Auth, mirroring Restormel). This
is a genuine founder decision (see §E) and a sovereignty item (Neon = US company, eu-west-2 AWS).

---

## D. End-to-end migration map

```
PHASE A  (Coolify → K3s; the foundation)                         depends on
─────────────────────────────────────────────────────           ──────────
A0  Stand up K3s cluster (hetzner-k3s) + ingress + cert-manager   ← FOUNDER's K3s design pack (missing)
A1  CNPG operator + cluster(s); storage classes (Hetzner CSI)     ← A0
A2  SurrealDB StatefulSet on CSI; restore dump; keep DNS stable   ← A1   ⟶ unblocks UseSophia (Phase B)
A3  Migrate self-hosted Postgres → CNPG (pg_dump/restore;          ← A1
    logical replication if near-zero-downtime needed)
A4  Move Restormel (dashboard + worker) + Allotmentology apps      ← A1,A3 (+A2 for Restormel graph)
    to Deployments; rewrite deploy pipeline off the Coolify API
A5  Decide Forgejo + CI runner + Infisical: in-cluster vs on-box   ← (recommend STAY on box for bootstrap)
A6  Backups: CNPG → Storage Box (S3 gateway or restic CronJob)     ← A1,A3
A7  Retire Coolify + Traefik                                       ← A4 stable

PHASE B  (PlotBudget + UseSophia → K3s DIRECTLY, not via Coolify)
─────────────────────────────────────────────────────
B1  UseSophia → K3s: deploy app; CronJob for ingestion tick;       ← A2 stable (SurrealDB in-cluster)
    re-point SURREAL_URL (env-only); decide its Neon Postgres
B2  PlotBudget → K3s: deploy self-hosted Supabase (Opt 1) OR        ← A0/A1 cluster stable
    CNPG + rebuilt auth/API (Opt 2); migrate Supabase Postgres
    + auth.users; **RE-VALIDATE RLS** (positive+negative tests);
    move Next.js app off Vercel; DNS cutover
```

**Ordering / dependencies:**
- **SurrealDB (A2) → UseSophia (B1)** is the one hard cross-phase link. The DNS-stable approach makes A2
  transparent to Sophia, so B1 can follow at leisure.
- **PlotBudget (B2)** depends only on a stable cluster (A0/A1) — independent of Sophia. It is the **heaviest,
  highest-risk** unit (Supabase + RLS + auth data + Vercel cutover) → schedule it **last**, after Phase A and
  B1 have proven the cluster.
- **Forgejo chicken-and-egg:** Forgejo + its PG are the CI substrate that would deploy K3s. **Recommend they
  stay on a box during Phase A** (bootstrap safety); consider moving in-cluster only once the cluster is proven.

**Cutover + rollback points (per product):** each app keeps its old home warm (Coolify app / Vercel / Railway)
until the K3s deployment is verified, with DNS as the cutover switch and the rollback = re-point DNS + env
back. For stateful stores: a freeze window + dump/restore (or logical replication) + validation, with the
source DB kept authoritative until the target is verified. **PlotBudget's auth + RLS migration is the one
that needs a formal, tested cutover runbook** (it's a security boundary over real user financial data).

---

## E. Flags for founder decision

1. **PlotBudget Supabase path — recommendation now firm: Option 1 (self-host Supabase on K3s, backed by
   CNPG).** Deep-dive confirmed Auth + PostgREST + Storage + 158 `auth.uid()`-keyed RLS policies are all
   load-bearing → Option 2 (rewrite) is deferred to an optional later "own auth on Better Auth" ADR.
2. **Sophia's own Neon Postgres + Neon Auth** — keep Neon SaaS, or migrate into CNPG + Better Auth (mirrors
   Restormel, full sovereignty)? Separate from the SurrealDB move. **Your call.**
3. **K3s/CNPG target design — being created now** (companion doc `k3s-cluster-target-design.md`, dedicated
   design pass). It needs the answers to Q1/Q2/Q4 below before it can be finalized. Phase A detail follows it.
4. **Backups: Storage Box is SFTP/SMB, not S3.** CNPG's Barman wants an S3 target → either front the Storage
   Box with an S3 gateway (MinIO/rclone) or keep a **restic CronJob doing `pg_dump`** (continues today's
   pattern). **Decision needed.** Also: no `governance/bcp-dr-policy.md` exists yet to anchor the RTO<4h claim.
5. **Data residency** — both PlotBudget's Supabase (**eu-west-2**) and Sophia's Neon (**eu-west-2**) are
   *already EU* (AWS London). Moving to Hetzner EU is a **control / self-hosting** win (off managed US-owned
   SaaS), **not** a data-leaving-EU fix — frame it that way in the privacy notice / ROPA.
6. **Forgejo/CI + Infisical: in-cluster vs on-box** during Phase A (recommend on-box for bootstrap safety).
7. **Secrets into the cluster** — land via **External Secrets Operator** (backed by Infisical) or
   **sealed-secrets**, consistent with the ISMS (no plaintext, repo-anchored where appropriate). Pick one.
8. **Downtime windows** — Restormel/Allotmentology/Sophia tolerate short dump/restore freezes; **PlotBudget's
   auth+RLS data migration is the sensitive one** and may warrant logical replication + a rehearsed cutover.

---

## Appendix — discovery sources (read-only, 2026-06-19)

- PlotBudget: `/Users/adamboon/plotbudget/` (`apps/web/package.json`, `supabase/config.toml`,
  `supabase/migrations/` ×82, `supabase/functions/`). Live secret values NOT read.
- UseSophia: `/Users/adamboon/projects/sophia/` (`Dockerfile`, `railway.toml`, `src/lib/server/db.ts`,
  `surrealEnv.ts`, `db/neon.ts`, `.github/workflows/deploy.yml`, `ingestion-job-tick.yml`); dump
  `/Users/adamboon/projects/sophia-prod-2026-06-13.surql`. `.env.local` holds live secrets — not reproduced.
- Allotmentology: `/Users/adamboon/projects/allotment-technology-ltd/web/` (Next.js 16, Drizzle, Better Auth).
- Restormel + infra: this repo (`deploy/docker-compose.coolify.yml`, `planning/infra-split-migration-plan.md`,
  `governance/asset-inventory.yaml`) + live SSH capacity/DB checks on `.150`/`.166`/`.167`.

**No execution, no config files, no schema/data changes, no SSH writes were performed.**
