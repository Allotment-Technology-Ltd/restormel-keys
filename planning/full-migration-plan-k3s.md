---
title: Full Migration Plan — Coolify + Vercel/Railway/Supabase → self-hosted K3s
class: planning
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-19
last-reviewed: 2026-06-20
review-interval: P12M
---

# Full Migration Plan — everything onto one sovereign K3s cluster

**Discovery + planning only.** No execution, no config files, no schema/data changes, no touching live
data. Review before any work begins. Read-only discovery done 2026-06-19 against the real codebases on
this machine (Restormel, Allotmentology, UseSophia, **and PlotBudget**) plus the live Hetzner boxes.

**Target (decided in prior planning — built on, not re-litigated):** one sovereign **K3s** cluster on the
3 existing Hetzner boxes (2× CX33 + 1× CX43, Helsinki) + autoscaled burst nodes via **hetzner-k3s**;
Hetzner EU, OSS-only; Postgres via **CloudNativePG (CNPG)**; SurrealDB in-cluster on **Hetzner CSI**;
Postgres backups via **CNPG Barman (PITR) → Hetzner Object Storage (fsn1, cross-region)** + the **1 TB
Storage Box** for cold copies / SurrealDB exports; **Coolify retired**. The cluster / CNPG / ingress /
secrets / backup **how** is specified in the companion **[k3s-cluster-target-design.md](k3s-cluster-target-design.md)**;
this plan owns the **what/when**.

**Phasing:** **Phase A** = existing Coolify stack → K3s (Restormel, Allotmentology, SurrealDB, CI, the
self-hosted Postgres DBs). **Phase B** = PlotBudget + UseSophia → K3s **directly** (not via Coolify).

> ✅ **The K3s/CNPG target design now EXISTS** — `k3s-cluster-target-design.md` (+ the
> `restormel-k3s-architecture` skill), all founder decisions folded in. Ownership: this plan = what/when;
> design doc = how. The **Decisions register** below is authoritative for both.

---

## Decisions register (authoritative — agreed with the K3s target design)

This table is the single source of truth for the cross-cutting decisions; both this plan and
[k3s-cluster-target-design.md](k3s-cluster-target-design.md) defer to it (so the two docs can't silently drift).

| Area | Decision |
|---|---|
| Cluster topology | 3 existing boxes as HA embedded-etcd control-plane (schedulable) + scale-to-zero burst pool (enabled day-1, min=0/max=2) |
| **Migration approach** | **Path A "bootstrap node": cluster starts on a temporary **Hetzner Cloud** server (≈ **CCX23**, x86, 4 vCPU / 16 GB) on the **€20 "Hetzner Cloud Community" credit (redeem before 31 Aug 2026)** → migrate state onto the cluster → fold the 3 existing boxes in as they free up → retire the temp node. NEVER convert a live prod box in-place. NOT a Robot/dedicated server — €20 won't cover one + hetzner-k3s manages Cloud only.** |
| Postgres | CloudNativePG, hybrid (shared `pg-platform` + dedicated `pg-restormel` + `pg-plotbudget`); instances:2 |
| PG backups | CNPG Barman → Hetzner Object Storage **fsn1** (cross-region PITR) + restic → Storage Box (cold) |
| SurrealDB | in-cluster 1-replica StatefulSet on Hetzner CSI; `surreal.restormel.dev` DNS kept stable (UseSophia dependency) |
| Secrets | External Secrets Operator ← self-hosted Infisical (no sealed-secrets) |
| Ingress/CNI | Traefik (Helm) + cert-manager; Cilium CNI; single-node ingress (no paid LB) |
| DNS | consolidate onto **Hetzner DNS** (DNS-01 wildcards; deSEC fallback; **avoid Cloudflare**) — a migration task |
| Forgejo + Infisical | **off-cluster permanently** (bootstrap anchors) |
| GitOps | Argo CD; prod sync manual/gated; preserves the PBI lifecycle callbacks |
| Auth | Better Auth for Restormel / Allotmentology / **UseSophia**; Ory Hydra scoped to the gateway only; **PlotBudget keeps GoTrue now → migrate to Better Auth LATER (separate ADR, post-cutover)** |
| **UseSophia** | **migrate FULLY**: its own Neon Postgres → CNPG, Neon Auth → Better Auth (plus the SurrealDB cross-phase re-point) |
| **PlotBudget** | **Option 1** (self-host Supabase: GoTrue+PostgREST+Storage+Realtime on K3s, backed by CNPG); **short maintenance-window cutover** (pg_dump/restore + rehearsed runbook + positive/negative RLS revalidation) |
| Restormel/Allotmentology cutover | short pg_dump maintenance window |
| DR targets | RTO ≤ 2h; RPO ≤ 5min (Postgres) / ~1h (SurrealDB hourly export) |
| Cost | ~+€7–9/mo (fsn1 object storage + tight CSI volumes); burst €0 at rest; temp Cloud bootstrap node on the **€20 Hetzner Cloud Community credit** (hourly; ~3.5 wks of a CCX23) |

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

**DECIDED — Sophia migrates FULLY (its own Neon Postgres + Neon Auth too).** The SurrealDB-focused brief
did not cover Sophia's *own* database; that gap is now closed. Sophia today runs on **Neon Postgres + Neon
Auth** (unlike Restormel, which is already fully off Neon) — both move: **its own Neon Postgres → CNPG** and
**Neon Auth → Better Auth** (mirroring Restormel), on top of the SurrealDB cross-phase re-point. This is a
sovereignty win (Neon = US company, eu-west-2 AWS) and is recorded in the Decisions register above.

---

## D. End-to-end migration map

```
PHASE A  (Coolify → K3s; the foundation — Path-A bootstrap)        depends on
─────────────────────────────────────────────────────           ──────────
A0  Provision a temp Hetzner Cloud node (CCX23 x86, €20 credit);   ← Decisions register (Path A)
    bootstrap the K3s cluster on it (hetzner-k3s) + ingress/cert-mgr
A1  CNPG operator + cluster(s) on cluster storage (Hetzner CSI)    ← A0
A2  SurrealDB StatefulSet on CSI; restore dump; keep              ← A1   ⟶ unblocks UseSophia (Phase B)
    surreal.restormel.dev DNS stable
A3  Migrate self-hosted Postgres → CNPG (short pg_dump windows)    ← A1
A4  Move Restormel (dashboard + worker) + Allotmentology apps      ← A1,A3 (+A2 for Restormel graph)
    to Deployments; rewrite deploy off Coolify-API → Argo CD
A5  Join the 3 existing boxes into the cluster as their            ← A4 stable
    workloads move; then retire the temp node
    (Forgejo + Infisical stay off-cluster)
A6  Backups: CNPG Barman → fsn1 + restic → Storage Box             ← A1,A3
A7  Retire Coolify                                                 ← A4 stable

PHASE B  (PlotBudget + UseSophia → K3s DIRECTLY, not via Coolify)
─────────────────────────────────────────────────────
B1  UseSophia → K3s: migrate fully — deploy app; CronJob for       ← A2 stable (SurrealDB in-cluster)
    ingestion tick; re-point SURREAL_URL (env-only); its own
    Neon Postgres → CNPG + Neon Auth → Better Auth
B2  PlotBudget → K3s: Option 1 (self-host Supabase, backed by      ← A0/A1 cluster stable
    CNPG); short maintenance-window cutover; migrate Supabase
    Postgres + auth.users; **RE-VALIDATE RLS** (positive+negative
    tests); move Next.js app off Vercel; DNS cutover
```

**Ordering / dependencies:**
- **SurrealDB (A2) → UseSophia (B1)** is the one hard cross-phase link. The DNS-stable approach makes A2
  transparent to Sophia, so B1 can follow at leisure.
- **PlotBudget (B2)** depends only on a stable cluster (A0/A1) — independent of Sophia. It is the **heaviest,
  highest-risk** unit (Supabase + RLS + auth data + Vercel cutover) → schedule it **last**, after Phase A and
  B1 have proven the cluster.
- **Forgejo chicken-and-egg:** Forgejo + its PG (and Infisical) are the CI/secret substrate that deploys K3s,
  so they stay **off-cluster permanently (decided)** — bootstrap anchors that must survive a cluster rebuild.

**Cutover + rollback points (per product):** each app keeps its old home warm (Coolify app / Vercel / Railway)
until the K3s deployment is verified, with DNS as the cutover switch and the rollback = re-point DNS + env
back. For stateful stores: a freeze window + dump/restore (or logical replication) + validation, with the
source DB kept authoritative until the target is verified. **PlotBudget's auth + RLS migration is the one
that needs a formal, tested cutover runbook** (it's a security boundary over real user financial data).

---

## E. Decisions (resolved) + remaining open items

**Resolved** — per the Decisions register above (agreed with the K3s target design); no longer open:

1. **PlotBudget Supabase path → Option 1** (self-host Supabase on K3s, backed by CNPG). Deep-dive confirmed
   Auth + PostgREST + Storage + 158 `auth.uid()`-keyed RLS policies are all load-bearing → Option 2 (rewrite)
   is deferred to an optional later "own auth on Better Auth" ADR. Cutover = **short maintenance window**.
2. **Sophia migrates fully** — its own Neon Postgres → CNPG **and** Neon Auth → Better Auth (mirrors Restormel,
   full sovereignty), on top of the SurrealDB re-point.
3. **K3s/CNPG target design exists** — `k3s-cluster-target-design.md` (+ the `restormel-k3s-architecture`
   skill); the design is the **how**, this plan the **what/when**, the register authoritative for both.
4. **PG backups → CNPG Barman → Hetzner Object Storage fsn1** (cross-region PITR) + restic → Storage Box (cold).
5. **Forgejo + Infisical → off-cluster permanently** (bootstrap anchors).
6. **Secrets → External Secrets Operator ← self-hosted Infisical** (no sealed-secrets).
7. **Cutover windows → short pg_dump maintenance windows** (pre-launch, low traffic; logical replication
   deferred until live with real users). PlotBudget's auth + RLS migration still gets a **rehearsed, tested
   cutover runbook** with positive/negative RLS revalidation (security boundary over real financial data).
8. **Migration approach → Path A temp-node bootstrap** (build on a temporary **Hetzner Cloud** node — CCX23
   x86 — on the **€20 "Hetzner Cloud Community" credit, redeemed before 31 Aug 2026**; fold the boxes in,
   retire the temp node; never convert a live prod box in-place. NOT a Robot/dedicated server.)
9. **PlotBudget auth → Better Auth LATER** (separate ADR, post-cutover; GoTrue moves as-is at cutover).

**Still genuinely OPEN (factual gaps / outstanding work):**

- **PlotBudget production domain** — needed for ingress + Supabase `SITE_URL`/JWT. Supply when known.
- **`governance/bcp-dr-policy.md` still needs writing** to anchor the RTO<4h target (the register sets RTO ≤ 2h
   / RPO ≤ 5min PG; the policy record is owed).
- **Live secret values supplied at cutover** — connection strings / service-role keys / OAuth creds, redacted
   until the cutover window (planning needs none).
- **Data residency framing (context, not a decision)** — both PlotBudget's Supabase (**eu-west-2**) and Sophia's
   Neon (**eu-west-2**) are *already EU* (AWS London); the move is a **control / self-hosting** win off managed
   US-owned SaaS, **not** a data-leaving-EU fix — frame it that way in the privacy notice / ROPA.

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
