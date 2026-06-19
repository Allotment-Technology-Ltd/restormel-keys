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

> ⚠️ **The K3s/CNPG target design is NOT in this repo.** A full sweep of `planning/`, `governance/`,
> `deploy/`, `.forgejo/`, `docs/infra/` found **zero** references to k3s, hetzner-k3s, CloudNativePG,
> Velero, or Barman. Everything in-repo describes the *previous* migration (the Coolify two-box split,
> REC-PLAN-012) — i.e. the **current state** K3s replaces. **The cluster design, CNPG topology,
> SurrealDB-on-CSI manifests, ingress/cert-manager choice, and the burst-node autoscaling pool live in a
> Claude Project and must be supplied** before Phase A implementation. This plan maps current-state →
> target-shape and flags every place that prior pack is the missing input.

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
- Live **Supabase project region** (is user data currently in a US region? — determines the residency delta).
- Confirmation of which Supabase features are live **in production** vs merely present in code (the
  Realtime/Storage/PostgREST question — the deep-dive answers most of this from code; confirm prod usage).
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

> **Note:** a focused Supabase/RLS feature deep-dive is finalizing the policy-by-policy inventory and the
> Realtime/Storage/PostgREST usage verdict; this section states the findings to date and the recommendation
> they point to. The deep-dive's table will be appended/confirmed before this plan is marked ready.

**App / Vercel platform**
- **Next.js 16.2.6 + React 19** (`apps/web`), plus `apps/marketing`, `apps/native` (Expo/React Native),
  `apps/twa-play-store`. Sanity CMS (`sanity-studio/`). Hosted on **Vercel** (`.vercel/`, vercel config).
- Vercel-platform dependencies to replace when self-hosting (confirm exact set from `next.config` +
  `vercel.json` — the deep-dive enumerates): serverless/edge functions, ISR, image optimization, middleware,
  env handling. Each is a moving part needing a self-hosted equivalent (Next standalone server on K3s +
  an image-optimization story + cron as K8s CronJobs).

**Supabase usage (the crux)**
- **Postgres + RLS — certain.** `supabase/migrations/` = **82 SQL files** (2024-02 → 2026-06-11);
  **27 contain `ENABLE ROW LEVEL SECURITY` / `CREATE POLICY`** (household-scoped, e.g.
  `project_budgets_select_household`).
- **Auth (GoTrue) — used:** `@supabase/ssr` + `@supabase/supabase-js@2.102.1`; SSR cookie/session handling.
  Supabase Auth is PlotBudget's identity system.
- **Edge Functions — used:** Deno functions under `supabase/functions/` (e.g. `send-resend-email`).
- **PostgREST / Realtime / Storage** — pending the deep-dive's definitive prod-usage verdict.
- Env names confirm the model: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_PROD_DATABASE_URL`/`_PROJECT_REF`,
  `POSTGRES_URL`/`_NON_POOLING`/`_PRISMA_URL`, plus `VERCEL_*`.

**RLS dependency assessment (security-critical — ISMS).** The household-scoped policies depend on Supabase
**auth primitives** (`auth.uid()` / `auth.jwt()` / the `auth` schema + JWT claims surfaced by PostgREST via
`request.jwt.claims`). **On plain CNPG Postgres without the Supabase auth layer, `auth.uid()` does not exist
→ every such policy fails closed (or, worse, must be disabled) → the data-exposure boundary breaks.** Any
plan touching RLS MUST include a re-validation + test step proving policies behave **identically**
post-migration (positive *and* negative tests: a user must still be unable to read another household's rows).

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

**Preliminary recommendation: Option 1 (self-host Supabase).** PlotBudget leans on Supabase **Auth (GoTrue)**
+ a **27-policy RLS set keyed on `auth.uid()`** + **edge functions** (and likely PostgREST data access —
deep-dive to confirm). Rewriting all of that (Option 2) is a large, security-critical project with a full
RLS re-validation — high risk for a solo operator and not the goal of *this* migration, which is a
**sovereignty move** (Supabase cloud → Hetzner EU). Option 1 preserves the working security boundary intact
and is the lower-risk path to "off US SaaS." **Trade-off to accept:** self-hosted Supabase is a heavier
stack to run/maintain on K3s — but it ships as a known compose/Helm bundle and matches what the app already
expects. **Revisit Option 2 only if** the deep-dive shows PostgREST/Realtime/Storage are *not* load-bearing
and RLS is thin — then "Postgres + RLS + app-owned auth" becomes viable and cleaner long-term.

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

1. **PlotBudget Supabase path — Option 1 (self-host Supabase) vs Option 2 (CNPG + rewrite).** The centre of
   gravity. Preliminary rec = **Option 1** (preserve the RLS/auth boundary; lower risk). Final call pending
   the deep-dive's PostgREST/Realtime/Storage verdict. **Your call.**
2. **Sophia's own Neon Postgres + Neon Auth** — keep Neon SaaS, or migrate into CNPG + Better Auth (mirrors
   Restormel, full sovereignty)? Separate from the SurrealDB move. **Your call.**
3. **K3s/CNPG target design pack is not in-repo** — must be supplied (cluster layout, CNPG topology,
   SurrealDB CSI manifest, ingress/cert-manager, burst autoscaling). Phase A can't be detailed without it.
4. **Backups: Storage Box is SFTP/SMB, not S3.** CNPG's Barman wants an S3 target → either front the Storage
   Box with an S3 gateway (MinIO/rclone) or keep a **restic CronJob doing `pg_dump`** (continues today's
   pattern). **Decision needed.** Also: no `governance/bcp-dr-policy.md` exists yet to anchor the RTO<4h claim.
5. **Data residency** — confirm where PlotBudget's Supabase and Sophia's Neon currently store user data
   (region). Moving both to Hetzner EU is a sovereignty win; quantify the delta for the privacy notice / ROPA.
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
